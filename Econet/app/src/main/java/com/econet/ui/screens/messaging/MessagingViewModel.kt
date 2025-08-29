package com.econet.ui.screens.messaging

import androidx.lifecycle.SavedStateHandle
import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econet.ble.ServiceManager
import com.econet.data.AppRepository
import com.econet.data.local.ConversationEntity
import com.econet.data.local.MessageEntity
import com.econet.util.SharedPreferencesHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

data class UiMessage(
    val id: String,
    val senderName: String,
    val text: String,
    val isFromMe: Boolean
)

@HiltViewModel
class MessagingViewModel @Inject constructor(
    private val repository: AppRepository,
    private val prefsHelper: SharedPreferencesHelper,
    savedStateHandle: SavedStateHandle // Hilt provides this to get navigation arguments
) : ViewModel() {

    // Get the partner's ID from the navigation arguments passed in MainActivity
    private val partnerId: String = savedStateHandle.get<String>("partnerId")!!

    // This flow gets all messages. To show messages for only one chat,
    // you would create a new function in your AppRepository and MessageDao.
    val messages = repository.getAllMessages()
        .map { dbMessages ->
            // TODO: Filter messages to show only those between the current user and partnerId
            dbMessages.map { entity ->
                UiMessage(
                    id = entity.messageId,
                    senderName = entity.originatorName,
                    text = entity.textPayload,
                    isFromMe = entity.isFromMe
                )
            }
        }

    private val _currentMessageText = MutableStateFlow("")
    val currentMessageText = _currentMessageText.asStateFlow()

    fun onMessageTextChanged(newText: String) {
        _currentMessageText.value = newText
    }

    fun onSendMessage() {
        val textToSend = _currentMessageText.value.trim()
        if (textToSend.isBlank()) return

        viewModelScope.launch {
            val myId = prefsHelper.userId ?: "unknown-id"
            val myName = prefsHelper.userName ?: "Me"

            val messageEntity = MessageEntity(
                messageId = System.currentTimeMillis().toString(),
                originatorName = myName,
                originatorId = myId,
                textPayload = textToSend,
                isFromMe = true,
                timestamp = System.currentTimeMillis(),
                isSynced = false // Assuming this field exists from the previous fix
            )

            // 1. Save the message to the local database
            repository.insertMessage(messageEntity)

            // 2. Tell the service to send the message to other peers
            ServiceManager.bleMeshService?.sendMessage(messageEntity)

            // 3. Create or update the conversation entry in the chats list
            val conversation = ConversationEntity(
                partnerId = partnerId,
                partnerName = "Partner Name", // You would get this from the connection info
                lastMessage = textToSend,
                lastMessageTimestamp = System.currentTimeMillis()
            )
            repository.upsertConversation(conversation)

            // 4. Clear the input field
            _currentMessageText.value = ""
        }
    }
}