package com.econet.data

import com.econet.data.local.ConversationDao
import com.econet.data.local.ConversationEntity
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
    private val conversationDao: ConversationDao, // Inject the new DAO
    private val apiService: ApiService
) {
    suspend fun registerUser(userId: String, name: String) =
        apiService.registerUser(RegisterRequest(userId, name))

    // --- Message Functions ---
    fun getAllMessages(): Flow<List<MessageEntity>> = messageDao.getAllMessages()
    suspend fun insertMessage(message: MessageEntity) = messageDao.insertMessage(message)

    // --- Conversation Functions (ADD THESE) ---
    fun getAllConversations(): Flow<List<ConversationEntity>> = conversationDao.getAllConversations()
    suspend fun upsertConversation(conversation: ConversationEntity) = conversationDao.upsertConversation(conversation)
}