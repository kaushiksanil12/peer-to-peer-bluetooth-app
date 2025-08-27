package com.econet.ble

import android.Manifest
import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.IBinder
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.app.NotificationCompat
import com.econet.R
import com.econet.data.AppRepository
import com.econet.data.local.MessageEntity
import com.econet.util.SharedPreferencesHelper
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.*
import com.google.gson.Gson
import dagger.hilt.android.AndroidEntryPoint
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import javax.inject.Inject

@AndroidEntryPoint
class BleMeshService : Service() {

    @Inject
    lateinit var repository: AppRepository
    @Inject
    lateinit var prefsHelper: SharedPreferencesHelper
    @Inject
    lateinit var gson: Gson

    private val serviceScope = CoroutineScope(Dispatchers.IO)
    private val connectedEndpoints = mutableSetOf<String>()
    private lateinit var connectionsClient: ConnectionsClient
    private val serviceId = "com.econet.SERVICE_ID"
    private var myName = "EconetDevice" // Default name

    // --- Service Lifecycle ---

    override fun onCreate() {
        super.onCreate()
        connectionsClient = Nearby.getConnectionsClient(this)
        myName = prefsHelper.userName ?: myName // Load user's name
        ServiceManager.bleMeshService = this
        Log.d(TAG, "Service created. My device name: $myName")
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        Log.d(TAG, "Service started")

        if (hasPermissions()) {
            startAdvertising()
            startDiscovery()
        } else {
            Log.e(TAG, "Service cannot start without necessary permissions.")
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        connectionsClient.stopAllEndpoints()
        ServiceManager.bleMeshService = null
        Log.d(TAG, "Service destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? = null

    // --- Public Service Method ---

    fun sendMessage(messageEntity: MessageEntity) {
        val payload = Payload.fromBytes(gson.toJson(messageEntity).toByteArray(Charsets.UTF_8))
        if (connectedEndpoints.isNotEmpty()) {
            connectionsClient.sendPayload(ArrayList(connectedEndpoints), payload)
            Log.d(TAG, "Broadcasting message to ${connectedEndpoints.size} endpoints")
        } else {
            Log.d(TAG, "No connected endpoints to send message to.")
        }
    }

    // --- Nearby Connections Logic ---

    private fun startAdvertising() {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startAdvertising(
            myName, serviceId, connectionLifecycleCallback, advertisingOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Advertising started successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Advertising failed", e)
        }
    }

    private fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startDiscovery(
            serviceId, endpointDiscoveryCallback, discoveryOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Discovery started successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Discovery failed", e)
        }
    }

    // --- Callbacks for Nearby Connections ---

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, info: DiscoveredEndpointInfo) {
            Log.d(TAG, "Endpoint found: $endpointId, name: ${info.endpointName}")
            connectionsClient.requestConnection(myName, endpointId, connectionLifecycleCallback)
                .addOnSuccessListener { Log.d(TAG, "Connection requested to $endpointId") }
                .addOnFailureListener { e -> Log.e(TAG, "Failed to request connection", e) }
        }

        override fun onEndpointLost(endpointId: String) {
            Log.d(TAG, "Endpoint lost: $endpointId")
        }
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, info: ConnectionInfo) {
            Log.d(TAG, "Connection initiated by ${info.endpointName}")
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    Log.d(TAG, "Connection successful with $endpointId")
                    connectedEndpoints.add(endpointId)
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> Log.d(TAG, "Connection rejected by $endpointId")
                ConnectionsStatusCodes.STATUS_ERROR -> Log.e(TAG, "Connection error with $endpointId")
                else -> Log.d(TAG, "Connection result unknown for $endpointId")
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected from $endpointId")
            connectedEndpoints.remove(endpointId)
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            if (payload.type == Payload.Type.BYTES) {
                val receivedBytes = payload.asBytes() ?: return
                try {
                    val messageJson = String(receivedBytes, Charsets.UTF_8)
                    val messageEntity = gson.fromJson(messageJson, MessageEntity::class.java)
                    val incomingMessage = messageEntity.copy(isFromMe = false)

                    Log.d(TAG, "Message received and parsed from $endpointId: ${incomingMessage.textPayload}")

                    serviceScope.launch {
                        repository.insertMessage(incomingMessage)
                    }
                    // TODO: Implement multi-hop logic here

                } catch (e: Exception) {
                    Log.e(TAG, "Failed to parse payload.", e)
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Useful for tracking file transfer progress
        }
    }

    // --- Foreground Service Notification & Permissions ---

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Econet Service",
                NotificationManager.IMPORTANCE_LOW
            )
            getSystemService(NotificationManager::class.java).createNotificationChannel(channel)
        }
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Econet Mesh")
            .setContentText("Actively searching for nearby devices.")
            .setSmallIcon(R.drawable.ic_launcher_foreground) // Replace with a proper icon
            .build()
    }

    private fun hasPermissions(): Boolean {
        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
            ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_ADVERTISE) == PackageManager.PERMISSION_GRANTED &&
                    ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_CONNECT) == PackageManager.PERMISSION_GRANTED &&
                    ActivityCompat.checkSelfPermission(this, Manifest.permission.BLUETOOTH_SCAN) == PackageManager.PERMISSION_GRANTED
        } else {
            ActivityCompat.checkSelfPermission(this, Manifest.permission.ACCESS_FINE_LOCATION) == PackageManager.PERMISSION_GRANTED
        }
    }

    companion object {
        private const val TAG = "BleMeshService"
        private const val NOTIFICATION_ID = 1
        private const val CHANNEL_ID = "EconetServiceChannel"
    }
}