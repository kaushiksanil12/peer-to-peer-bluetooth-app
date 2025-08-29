package com.econet.data

import com.econet.data.local.ConversationDao
import com.econet.data.local.ConversationEntity
import com.econet.data.local.MessageDao
import com.econet.data.local.MessageEntity
import com.econet.data.remote.ApiService
import com.econet.data.remote.request.RegisterRequest
import com.econet.ui.screens.discover.DiscoveredDevice
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.MutableSharedFlow
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AppRepository @Inject constructor(
    private val messageDao: MessageDao,
    private val conversationDao: ConversationDao,
    private val apiService: ApiService
) {
    /**
     * A flow to broadcast discovered devices from the BleMeshService to the UI.
     */
    val discoveredDevices = MutableSharedFlow<DiscoveredDevice>()

    /**
     * A flow to broadcast when a device is no longer discoverable.
     */
    val lostDevices = MutableSharedFlow<String>()

    /**
     * Makes a network call to register a new user with the backend.
     */
    suspend fun registerUser(userId: String, name: String) =
        apiService.registerUser(RegisterRequest(userId, name))

    /**
     * Gets a real-time list of all messages from the local database.
     */
    fun getAllMessages(): Flow<List<MessageEntity>> = messageDao.getAllMessages()

    /**
     * Inserts a single message into the local database.
     */
    suspend fun insertMessage(message: MessageEntity) = messageDao.insertMessage(message)

    /**
     * Gets a real-time list of all conversations from the local database.
     */
    fun getAllConversations(): Flow<List<ConversationEntity>> = conversationDao.getAllConversations()

    /**
     * Inserts a new conversation or updates an existing one in the local database.
     */
    suspend fun upsertConversation(conversation: ConversationEntity) =
        conversationDao.upsertConversation(conversation)
}