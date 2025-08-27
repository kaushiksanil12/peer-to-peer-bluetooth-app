package com.econet.ui.screens.messaging

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econet.ble.ServiceManager
import com.econet.data.AppRepository
import com.econet.data.local.MessageEntity
import com.econet.util.SharedPreferencesHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

/**
 * A simple data class to represent a message in the UI,
 * decoupled from the database entity.
 */
data class UiMessage(
    val id: String,
    val senderName: String,
    val text: String,
    val isFromMe: Boolean
)

@HiltViewModel
class MessagingViewModel @Inject constructor(
    private val repository: AppRepository,
    private val prefsHelper: SharedPreferencesHelper
) : ViewModel() {

    // The UI will get its messages by observing this flow, which comes directly
    // from the Room database and is updated in real-time.
    val messages = repository.getAllMessages()
        .map { dbMessages ->
            // Convert the list of database entities to a list of UI-specific models.
            dbMessages.map { entity ->
                UiMessage(
                    id = entity.messageId,
                    senderName = entity.originatorName,
                    text = entity.textPayload,
                    isFromMe = entity.isFromMe
                )
            }
        }

    // Holds the current text in the input field.
    private val _currentMessageText = MutableStateFlow("")
    val currentMessageText = _currentMessageText.asStateFlow()

    fun onMessageTextChanged(newText: String) {
        _currentMessageText.value = newText
    }

    /**
     * Called when the user clicks the send button.
     */
    fun onSendMessage() {
        val textToSend = _currentMessageText.value.trim()
        if (textToSend.isBlank()) return

        viewModelScope.launch {
            // Create a database entity for the new message.
            val messageEntity = MessageEntity(
                messageId = System.currentTimeMillis().toString(),
                originatorName = prefsHelper.userName ?: "Me",
                originatorId = prefsHelper.userId ?: "unknown-id",
                textPayload = textToSend,
                isFromMe = true,
                timestamp = System.currentTimeMillis()
            )

            // 1. Save the message to the local database immediately.
            repository.insertMessage(messageEntity)

            // 2. Tell the running BleMeshService to broadcast the message to other peers.
            ServiceManager.bleMeshService?.sendMessage(messageEntity)

            // 3. Clear the input field.
            _currentMessageText.value = ""
        }
    }
}