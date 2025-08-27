package com.econet.data

import com.econet.data.local.MessageDao
import com.econet.data.local.MessageEntity
import com.econet.data.remote.ApiService
import com.econet.data.remote.request.RegisterRequest
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppRepository @Inject constructor(
    private val messageDao: MessageDao,
    private val apiService: ApiService
) {
    // This flow will be used to broadcast incoming messages from the service to the ViewModel
    val incomingMessages = MutableSharedFlow<MessageEntity>()

    suspend fun registerUser(userId: String, name: String) =
        apiService.registerUser(RegisterRequest(userId, name))

    fun getAllMessages(): Flow<List<MessageEntity>> = messageDao.getAllMessages()

    suspend fun insertMessage(message: MessageEntity) {
        messageDao.insertMessage(message)
    }
}