package com.messenger.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey
    val id: String,
    val content: String,
    val senderId: String,
    val receiverId: String,
    val timestamp: Long,
    val isSynced: Boolean = false // Tracks if it's been sent to the backend
)