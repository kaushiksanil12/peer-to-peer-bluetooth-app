package com.messenger.data.repository

import com.messenger.data.local.SessionManager // <-- Import SessionManager
import com.messenger.data.remote.ApiService
import com.messenger.data.remote.LoginRequest
import com.messenger.data.remote.RegisterRequest
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class AuthRepository @Inject constructor(
    private val apiService: ApiService,
    private val sessionManager: SessionManager // <-- Inject SessionManager
) {

    // New function to check login status at startup
    fun isLoggedIn(): Boolean {
        return sessionManager.getAuthToken() != null
    }

    suspend fun login(deviceId: String, password: String): Result<String> {
        return try {
            val request = LoginRequest(deviceId = deviceId, password = password)
            val response = apiService.login(request)

            if (response.isSuccessful && response.body() != null) {
                val token = response.body()!!.token
                // Save the token and device ID on success
                sessionManager.saveAuthToken(token)
                sessionManager.saveDeviceId(deviceId)
                Result.success(token)
            } else {
                Result.failure(Exception("Login failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    suspend fun register(deviceId: String, deviceName: String, password: String): Result<String> {
        return try {
            val request = RegisterRequest(deviceId = deviceId, deviceName = deviceName, password = password)
            val response = apiService.register(request)

            if (response.isSuccessful && response.body() != null) {
                val token = response.body()!!.token
                // Save the token and device ID on success
                sessionManager.saveAuthToken(token)
                sessionManager.saveDeviceId(deviceId)
                Result.success(token)
            } else {
                Result.failure(Exception("Registration failed: ${response.message()}"))
            }
        } catch (e: Exception) {
            Result.failure(e)
        }
    }

    fun logout() {
        sessionManager.clearSession()
    }
}