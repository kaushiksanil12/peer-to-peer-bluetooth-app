package com.econet.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey
    val messageId: String,
    val originatorName: String,
    val originatorId: String,
    val textPayload: String,
    val isFromMe: Boolean,
    val timestamp: Long,
    val isSynced: Boolean = false
)