package com.messenger.data.repository

import android.content.Context
import androidx.work.*
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
    private val sessionManager: SessionManager
) {

    // The UI will observe this Flow to get real-time updates from the database
    fun getAllMessages(): Flow<List<MessageEntity>> {
        return messageDao.getAllMessages()
    }

    // Fetches new messages from the network and updates the local database
    suspend fun refreshMessages() {
        val deviceId = sessionManager.getDeviceId() ?: return // Can't refresh without a deviceId
        try {
            val response = apiService.getPendingMessages(deviceId)
            if (response.isSuccessful) {
                response.body()?.forEach { messageDto ->
                    // Convert API DTO to a database Entity and insert it
                    val messageEntity = messageDto.toEntity(receiverId = deviceId)
                    messageDao.insertMessage(messageEntity)
                }
            }
        } catch (e: Exception) {
            // Handle network errors, maybe log them
            e.printStackTrace()
        }
    }

    // This is the function for the worker to sync all pending messages
    suspend fun syncOfflineMessages() {
        val unsyncedMessages = messageDao.getUnsyncedMessages()
        unsyncedMessages.forEach { message ->
            try {
                val request = SendMessageRequest(message.content, message.receiverId)
                val response = apiService.sendMessage(request)
                if (response.isSuccessful) {
                    messageDao.markMessageAsSynced(message.id)
                }
            } catch (e: Exception) {
                e.printStackTrace()
                // If one message fails, we continue to the next one
                // The failed one will be retried the next time the worker runs
            }
        }
    }

    // Saves a message locally and schedules a background job to send it
    suspend fun sendMessage(receiverId: String, content: String) {
        val deviceId = sessionManager.getDeviceId() ?: return

        val messageEntity = MessageEntity(
            id = UUID.randomUUID().toString(),
            content = content,
            senderId = deviceId,
            receiverId = receiverId,
            timestamp = System.currentTimeMillis(),
            isSynced = false
        )
        messageDao.insertMessage(messageEntity)

        // Schedule a background sync to send the message
        scheduleMessageSync()
    }

    private fun scheduleMessageSync() {
        // Define the constraints for the work (e.g., must have network)
        val constraints = Constraints.Builder()
            .setRequiredNetworkType(NetworkType.CONNECTED)
            .build()

        // Create a unique work request to avoid scheduling the same job multiple times
        val syncRequest = OneTimeWorkRequestBuilder<SyncWorker>()
            .setConstraints(constraints)
            .setBackoffCriteria( // If the job fails, retry with a delay
                BackoffPolicy.LINEAR,
                10,
                TimeUnit.SECONDS
            )
            .build()

        // Enqueue the unique work request
        WorkManager.getInstance(context).enqueueUniqueWork(
            "message_sync_work",
            ExistingWorkPolicy.KEEP, // Don't replace the job if it's already scheduled
            syncRequest
        )
    }

    // Helper to convert from a network DTO to a database Entity
    private fun MessageDto.toEntity(receiverId: String) = MessageEntity(
        id = this.id,
        content = this.content,
        senderId = this.senderId,
        receiverId = receiverId, // The current user is the receiver
        timestamp = this.timestamp,
        isSynced = true // It came from the server, so it's synced
    )
}