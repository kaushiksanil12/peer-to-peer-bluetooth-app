package com.econet.ui.screens.chats

import androidx.lifecycle.ViewModel
import com.econet.data.AppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

@HiltViewModel
class ChatsViewModel @Inject constructor(
    private val repository: AppRepository
) : ViewModel() {
    val conversations = repository.getAllConversations()
}