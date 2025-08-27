package com.econet.data.local

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "conversations")
data class ConversationEntity(
    @PrimaryKey
    val partnerId: String, // The unique ID of the person you are chatting with
    val partnerName: String,
    val lastMessage: String,
    val lastMessageTimestamp: Long
)