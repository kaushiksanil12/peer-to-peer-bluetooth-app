package com.econet.ui.screens.chats

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.econet.data.local.ConversationEntity

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ChatsScreen(
    onConversationSelected: (partnerId: String) -> Unit,
    chatsViewModel: ChatsViewModel = hiltViewModel()
) {
    // This line will now work correctly because the ViewModel's flow is well-defined.
    val conversations by chatsViewModel.conversations.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Chats") })
        }
    ) { paddingValues ->
        LazyColumn(modifier = Modifier.padding(paddingValues)) {
            // The 'conversation' item is now correctly inferred as ConversationEntity
            items(conversations) { conversation ->
                ConversationListItem(
                    conversation = conversation,
                    onClick = { onConversationSelected(conversation.partnerId) }
                )
            }
        }
    }
}

@Composable
fun ConversationListItem(conversation: ConversationEntity, onClick: () -> Unit) {
    Column(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 12.dp)
    ) {
        Text(text = conversation.partnerName, fontWeight = FontWeight.Bold)
        Text(text = conversation.lastMessage, style = MaterialTheme.typography.bodyMedium, maxLines = 1)
    }
    Divider()
}