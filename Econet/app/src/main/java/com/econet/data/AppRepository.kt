package com.econet.data

import com.econet.data.local.MessageDao
import com.econet.data.local.MessageEntity
import com.econet.data.remote.ApiService
import com.econet.data.remote.request.RegisterRequest
import kotlinx.coroutines.flow.Flow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppRepository @Inject constructor(
    private val messageDao: MessageDao,
    private val apiService: ApiService
) {
    suspend fun registerUser(userId: String, name: String) =
        apiService.registerUser(RegisterRequest(userId, name))

    // Get all messages from the local database as a real-time Flow
    fun getAllMessages(): Flow<List<MessageEntity>> = messageDao.getAllMessages()

    // Insert a single message into the local database
    suspend fun insertMessage(message: MessageEntity) {
        messageDao.insertMessage(message)
    }
}