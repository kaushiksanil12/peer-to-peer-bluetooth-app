package com.econet.data.remote

import com.econet.data.remote.request.RegisterRequest
import retrofit2.Response
import retrofit2.http.Body
import retrofit2.http.POST

interface ApiService {

    @POST("api/users/register")
    suspend fun registerUser(
        @Body registerRequest: RegisterRequest
    ): Response<Unit>
}