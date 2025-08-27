package com.econet.ui.screens.messaging

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econet.data.AppRepository
import com.econet.data.local.MessageEntity
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.map
import kotlinx.coroutines.launch
import javax.inject.Inject

// This data class remains the same
data class UiMessage(
    val id: String,
    val senderName: String,
    val text: String,
    val isFromMe: Boolean
)

@HiltViewModel
class MessagingViewModel @Inject constructor(
    private val repository: AppRepository
) : ViewModel() {

    // The UI will now get its messages directly from the database flow
    val messages = repository.getAllMessages()
        .map { dbMessages ->
            dbMessages.map { entity ->
                // Convert database MessageEntity to a UiMessage
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
            // Create a database entity
            val messageEntity = MessageEntity(
                messageId = System.currentTimeMillis().toString(),
                originatorName = "Me", // TODO: Get from SharedPreferences
                originatorId = "my-user-id", // TODO: Get from SharedPreferences
                textPayload = textToSend,
                isFromMe = true,
                timestamp = System.currentTimeMillis()
            )

            // Save the message to the local database
            repository.insertMessage(messageEntity)

            // Clear the input field
            _currentMessageText.value = ""

            // TODO: Send the message over the BLE mesh
        }
    }
}