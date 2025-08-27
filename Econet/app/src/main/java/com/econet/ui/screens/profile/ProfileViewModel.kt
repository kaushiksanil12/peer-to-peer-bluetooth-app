package com.econet.ui.screens.profile

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econet.data.AppRepository
import com.econet.util.SharedPreferencesHelper
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import java.util.UUID
import javax.inject.Inject

/**
 * Represents the different states the UI can be in during the registration process.
 * Using a sealed class ensures that the UI can only be in one of these states at a time.
 */
sealed class RegistrationState {
    object Idle : RegistrationState()
    object Loading : RegistrationState()
    object Success : RegistrationState()
    data class Error(val message: String) : RegistrationState()
}

@HiltViewModel
class ProfileViewModel @Inject constructor(
    private val repository: AppRepository,
    private val prefsHelper: SharedPreferencesHelper
) : ViewModel() {

    private val _registrationState = MutableStateFlow<RegistrationState>(RegistrationState.Idle)
    val registrationState = _registrationState.asStateFlow()

    /**
     * This function is called from the UI when the user clicks the register button.
     * It handles input validation, makes the network call, and saves the profile.
     */
    fun onRegisterClicked(name: String) {
        // Simple input validation
        if (name.isBlank()) {
            _registrationState.value = RegistrationState.Error("Name cannot be empty.")
            return
        }

        // Launch a coroutine to perform network and disk operations off the main thread
        viewModelScope.launch {
            _registrationState.value = RegistrationState.Loading
            try {
                val userId = UUID.randomUUID().toString()
                val response = repository.registerUser(userId, name)

                if (response.isSuccessful) {
                    // On success, save the new profile to EncryptedSharedPreferences
                    prefsHelper.userId = userId
                    prefsHelper.userName = name
                    _registrationState.value = RegistrationState.Success
                } else {
                    // Handle server-side errors (e.g., "user already exists")
                    val errorMsg = response.errorBody()?.string() ?: "An unknown error occurred."
                    _registrationState.value = RegistrationState.Error(errorMsg)
                }
            } catch (e: Exception) {
                // Handle network failures (e.g., no internet, server down)
                _registrationState.value = RegistrationState.Error("Network error: ${e.message}")
            }
        }
    }
}