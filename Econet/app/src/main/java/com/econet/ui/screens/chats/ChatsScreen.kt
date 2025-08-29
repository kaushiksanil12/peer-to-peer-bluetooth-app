package com.econet.ui.screens.chats

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material3.*
import androidx.compose.material3.HorizontalDivider
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
    onDiscoverClick: () -> Unit,
    chatsViewModel: ChatsViewModel = hiltViewModel()
) {
    val conversations by chatsViewModel.conversations.collectAsState(initial = emptyList())

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Chats") })
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onDiscoverClick) {
                Icon(Icons.Default.Add, contentDescription = "Discover new devices")
            }
        }
    ) { paddingValues ->
        LazyColumn(modifier = Modifier.padding(paddingValues)) {
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
    HorizontalDivider(Modifier, DividerDefaults.Thickness, DividerDefaults.color)
}