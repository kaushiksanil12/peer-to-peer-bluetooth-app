package com.messenger.ui.screens.compose

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.messenger.data.repository.MessageRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.launch
import javax.inject.Inject

@HiltViewModel
class ComposeViewModel @Inject constructor(
    private val messageRepository: MessageRepository
) : ViewModel() {

    fun sendMessage(receiverId: String, content: String) {
        viewModelScope.launch {
            messageRepository.sendMessage(receiverId, content)
        }
    }
}