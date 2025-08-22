package com.messenger.ui.screens.messages

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.messenger.data.local.MessageEntity

@Composable
fun MessagesScreen(
    viewModel: MessagesViewModel = hiltViewModel()
) {
    val uiState by viewModel.uiState.collectAsState()

    if (uiState.messages.isEmpty()) {
        Box(
            modifier = Modifier.fillMaxSize(),
            contentAlignment = Alignment.Center
        ) {
            Text("No messages yet.")
        }
    } else {
        LazyColumn(
            modifier = Modifier.fillMaxSize(),
            reverseLayout = true // To show the newest messages at the bottom
        ) {
            items(uiState.messages) { message ->
                MessageItem(message = message)
            }
        }
    }
}

@Composable
fun MessageItem(message: MessageEntity) {
    // This is a simple placeholder. You can design a proper message bubble here.
    Column(modifier = Modifier.padding(16.dp)) {
        Text("From: ${message.senderId}", style = MaterialTheme.typography.titleMedium)
        Text(message.content, style = MaterialTheme.typography.bodyLarge)
    }
}