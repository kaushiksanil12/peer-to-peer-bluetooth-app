package com.econet.ble // Corrected package name

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
import com.google.android.gms.nearby.Nearby
import com.google.android.gms.nearby.connection.AdvertisingOptions
import com.google.android.gms.nearby.connection.ConnectionInfo
import com.google.android.gms.nearby.connection.ConnectionLifecycleCallback
import com.google.android.gms.nearby.connection.ConnectionResolution
import com.google.android.gms.nearby.connection.ConnectionsClient
import com.google.android.gms.nearby.connection.DiscoveredEndpointInfo
import com.google.android.gms.nearby.connection.DiscoveryOptions
import com.google.android.gms.nearby.connection.EndpointDiscoveryCallback
import com.google.android.gms.nearby.connection.Payload
import com.google.android.gms.nearby.connection.PayloadCallback
import com.google.android.gms.nearby.connection.PayloadTransferUpdate
import com.google.android.gms.nearby.connection.Strategy
import dagger.hilt.android.AndroidEntryPoint
import com.google.android.gms.nearby.connection.ConnectionsStatusCodes
import javax.inject.Inject

@AndroidEntryPoint
class BleMeshService : Service() {

    private lateinit var connectionsClient: ConnectionsClient
    private val SERVICE_ID = "com.econet.SERVICE_ID"
    private var myName: String = "DefaultDeviceName" // Will be loaded from SharedPreferences

    // --- Service Lifecycle ---

    override fun onCreate() {
        super.onCreate()
        connectionsClient = Nearby.getConnectionsClient(this)
        // TODO: Load user profile (name, userId) from SharedPreferences
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        startForeground(NOTIFICATION_ID, createNotification())
        Log.d(TAG, "Service started")

        // Check for permissions before starting discovery and advertising
        if (hasPermissions()) {
            startDiscovery()
            startAdvertising()
        } else {
            Log.e(TAG, "Missing necessary permissions for Nearby Connections.")
            // In a real app, you'd request permissions from the UI before starting the service.
        }

        return START_STICKY
    }

    override fun onDestroy() {
        super.onDestroy()
        connectionsClient.stopAllEndpoints()
        Log.d(TAG, "Service destroyed")
    }

    override fun onBind(intent: Intent?): IBinder? {
        return null // Not a bound service
    }

    // --- Nearby Connections Logic ---

    private fun startAdvertising() {
        val advertisingOptions = AdvertisingOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startAdvertising(
            myName, SERVICE_ID, connectionLifecycleCallback, advertisingOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Advertising started successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Advertising failed", e)
        }
    }

    private fun startDiscovery() {
        val discoveryOptions = DiscoveryOptions.Builder().setStrategy(Strategy.P2P_CLUSTER).build()
        connectionsClient.startDiscovery(
            SERVICE_ID, endpointDiscoveryCallback, discoveryOptions
        ).addOnSuccessListener {
            Log.d(TAG, "Discovery started successfully")
        }.addOnFailureListener { e ->
            Log.e(TAG, "Discovery failed", e)
        }
    }

    // --- Callbacks for Nearby Connections ---

    private val endpointDiscoveryCallback = object : EndpointDiscoveryCallback() {
        override fun onEndpointFound(endpointId: String, discoveredEndpointInfo: DiscoveredEndpointInfo) {
            Log.d(TAG, "Endpoint found: $endpointId, name: ${discoveredEndpointInfo.endpointName}")
            // An endpoint was found. We request a connection to it.
            connectionsClient.requestConnection(myName, endpointId, connectionLifecycleCallback)
                .addOnSuccessListener {
                    Log.d(TAG, "Connection requested to $endpointId")
                }.addOnFailureListener { e ->
                    Log.e(TAG, "Failed to request connection to $endpointId", e)
                }
        }

        override fun onEndpointLost(endpointId: String) {
            Log.d(TAG, "Endpoint lost: $endpointId")
        }
    }

    private val connectionLifecycleCallback = object : ConnectionLifecycleCallback() {
        override fun onConnectionInitiated(endpointId: String, connectionInfo: ConnectionInfo) {
            Log.d(TAG, "Connection initiated by ${connectionInfo.endpointName}")
            // Automatically accept the connection on both sides.
            connectionsClient.acceptConnection(endpointId, payloadCallback)
        }

        override fun onConnectionResult(endpointId: String, result: ConnectionResolution) {
            when (result.status.statusCode) {
                ConnectionsStatusCodes.STATUS_OK -> {
                    Log.d(TAG, "Connection successful with $endpointId")
                    // TODO: Notify ViewModel that we have a new connection
                }
                ConnectionsStatusCodes.STATUS_CONNECTION_REJECTED -> Log.d(TAG, "Connection rejected by $endpointId")
                ConnectionsStatusCodes.STATUS_ERROR -> Log.e(TAG, "Connection error with $endpointId")
                else -> Log.d(TAG, "Connection result unknown status for $endpointId")
            }
        }

        override fun onDisconnected(endpointId: String) {
            Log.d(TAG, "Disconnected from $endpointId")
            // TODO: Notify ViewModel that a connection was lost
        }
    }

    private val payloadCallback = object : PayloadCallback() {
        override fun onPayloadReceived(endpointId: String, payload: Payload) {
            // A payload has been received from the other device.
            when(payload.type) {
                Payload.Type.BYTES -> {
                    val receivedBytes = payload.asBytes()!!
                    val message = String(receivedBytes, Charsets.UTF_8)
                    Log.d(TAG, "Message received from $endpointId: $message")
                    // TODO: Deserialize the message string into a MessagePacket object
                    // TODO: Pass the message to the MessagingViewModel to display
                    // TODO: Implement the multi-hop relay logic here
                }
                Payload.Type.FILE -> {
                    // TODO: Handle incoming file payload
                    Log.d(TAG, "File received from $endpointId")
                }
                else -> {
                    Log.d(TAG, "Stream received from $endpointId")
                }
            }
        }

        override fun onPayloadTransferUpdate(endpointId: String, update: PayloadTransferUpdate) {
            // Provides updates on the status of the payload transfer.
            // Useful for showing progress bars for file transfers.
        }
    }

    // --- Foreground Service Notification ---

    private fun createNotification(): Notification {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val channel = NotificationChannel(
                CHANNEL_ID,
                "Econet Service",
                NotificationManager.IMPORTANCE_DEFAULT
            )
            val manager = getSystemService(NotificationManager::class.java)
            manager.createNotificationChannel(channel)
        }

        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setContentTitle("Econet Mesh")
            .setContentText("Actively searching for nearby devices.")
            .setSmallIcon(R.drawable.ic_launcher_foreground) // Replace with a proper icon
            .build()
    }

    // --- Permissions ---

    private fun hasPermissions(): Boolean {
        // For Nearby Connections, a coarse location permission is sufficient on some versions.
        // On Android 12+, we need explicit Bluetooth permissions.
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