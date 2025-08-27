package com.econet.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "messages")
data class MessageEntity(
    @PrimaryKey
    val messageId: String,
    val originatorId: String,
    val originatorName: String,
    val textPayload: String,
    val timestamp: Long,
    val isFromMe: Boolean,
    var isSynced: Boolean = false
)