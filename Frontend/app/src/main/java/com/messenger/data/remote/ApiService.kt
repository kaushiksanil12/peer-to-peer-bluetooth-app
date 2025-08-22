package com.messenger.data.remote

import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.GET
import retrofit2.http.POST
import retrofit2.http.Path

interface ApiService {

    @POST("/api/auth/login")
    suspend fun login(
        @Body request: LoginRequest
    ): Response<AuthResponse>

    @POST("/api/auth/register")
    suspend fun register(
        @Body request: RegisterRequest
    ): Response<AuthResponse>

    @GET("/api/messages/pending/{deviceId}")
    suspend fun getPendingMessages(
        @Path("deviceId") deviceId: String
    ): Response<List<MessageDto>>

    @POST("/api/messages/send")
    suspend fun sendMessage(
        @Body request: SendMessageRequest
    ): Response<Unit> // Assuming the API returns an empty success response
}