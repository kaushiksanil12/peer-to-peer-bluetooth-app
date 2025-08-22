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