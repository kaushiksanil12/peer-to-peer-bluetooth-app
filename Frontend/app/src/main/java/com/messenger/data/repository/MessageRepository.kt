package com.messenger.data.repository

import android.bluetooth.BluetoothProfile
import android.content.Context
import androidx.work.*
import com.messenger.ble.GATTClientService
import com.messenger.crypto.CryptoService
import com.messenger.data.local.MessageDao
import com.messenger.data.local.MessageEntity
import com.messenger.data.local.SessionManager
import com.messenger.data.remote.ApiService
import com.messenger.data.remote.MessageDto
import com.messenger.data.remote.SendMessageRequest
import com.messenger.workers.SyncWorker
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.Flow
import java.util.UUID
import java.util.concurrent.TimeUnit
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class MessageRepository @Inject constructor(
    @ApplicationContext private val context: Context,
    private val apiService: ApiService,
    private val messageDao: MessageDao,
    private val sessionManager: SessionManager,
    private val gattClientService: GATTClientService,
    private val cryptoService: CryptoService
) {

    fun getAllMessages(): Flow<List<MessageEntity>> {
        return messageDao.getAllMessages()
    }

    suspend fun refreshMessages() {
        val deviceId = sessionManager.getDeviceId() ?: return
        try {
            val response = apiService.getPendingMessages(deviceId)
            if (response.isSuccessful) {
                response.body()?.forEach { messageDto ->
                    val messageEntity = messageDto.toEntity(receiverId = deviceId)
                    messageDao.insertMessage(messageEntity)
                }
            }
        } catch (e: Exception) {
            e.printStackTrace()
        }
    }

    suspend fun syncOfflineMessages() {
        val unsyncedMessages = messageDao.getUnsyncedMessages()
        unsyncedMessages.forEach { message ->
            try {
                // Encrypt content before sending to the server
                val encryptedContentString = message.content // Assuming content is stored encrypted
                val request = SendMessageRequest(encryptedContentString, message.receiverId)
                val response = apiService.sendMessage(request)
                if (response.isSuccessful) {
                    messageDao.markMessageAsSynced(message.id)
                }
            } catch (e: Exception) {
                e.printStackTrace()
            }
        }
    }

    suspend fun sendMessage(receiverId: String, content: String) {
        val deviceId = sessionManager.getDeviceId() ?: return

        // 1. Establish a shared key if one doesn't exist
        cryptoService.establishSharedKey(receiverId)

        // 2. Encrypt the message content
        val encryptedContent = cryptoService.encrypt(content, receiverId)
        if (encryptedContent == null) {
            println("Encryption failed!")
            return
        }

        // In a real app, you would Base64 encode the byte array for transport
        val encryptedContentString = String(encryptedContent, Charsets.ISO_8859_1)

        val messageEntity = MessageEntity(
            id = UUID.randomUUID().toString(),
            content = encryptedContentString,
            senderId = deviceId,
            receiverId = receiverId,
            timestamp = System.currentTimeMillis(),
            isSynced = false
        )

        // Priority 1: Check for an active P2P connection
        if (gattClientService.connectionState.value == BluetoothProfile.STATE_CONNECTED) {
            gattClientService.writeMessage(encryptedContentString)
            messageDao.insertMessage(messageEntity.copy(isSynced = true))
        } else {
            // Priority 2: Fallback to internet via offline queue
            messageDao.insertMessage(messageEntity)
            scheduleMessageSync()
        }
    }

    private fun scheduleMessageSync() {
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria(
                BackoffPolicy.LINEAR,
                10,
                TimeUnit.SECONDS
            )
            .build()

        WorkManager.getInstance(context).enqueueUniqueWork(
            "message_sync_work",
            ExistingWorkPolicy.KEEP,
            syncRequest
        )
    }

    private fun MessageDto.toEntity(receiverId: String) = MessageEntity(
        id = this.id,
        content = this.content, // Note: This assumes incoming messages are not encrypted yet
        senderId = this.senderId,
        receiverId = receiverId,
        timestamp = this.timestamp,
        isSynced = true
    )
}