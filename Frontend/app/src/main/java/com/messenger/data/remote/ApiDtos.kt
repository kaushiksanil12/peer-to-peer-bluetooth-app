package com.messenger.data.remote

import com.google.gson.annotations.SerializedName

// For the /login endpoint
data class LoginRequest(
    val deviceId: String,
    val password: String
)

// For the /register endpoint
data class RegisterRequest(
    val deviceId: String,
    val deviceName: String,
    val password: String
)

data class AuthResponse(
    @SerializedName("token")
    val token: String
)

data class SendMessageRequest(
    val content: String,
    val receiverId: String,
    val priority: String = "NORMAL" // Or LOW, HIGH, EMERGENCY
)

// For the message object received from the API
data class MessageDto(
    val id: String,
    val content: String,
    val senderId: String,
    val timestamp: Long
)