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

    fun onRegisterClicked(name: String) {
        if (name.isBlank()) {
            _registrationState.value = RegistrationState.Error("Name cannot be empty.")
            return
        }

        viewModelScope.launch {
            _registrationState.value = RegistrationState.Loading
            try {
                val userId = UUID.randomUUID().toString()
                val response = repository.registerUser(userId, name)
                if (response.isSuccessful) {
                    prefsHelper.userId = userId
                    prefsHelper.userName = name
                    _registrationState.value = RegistrationState.Success
                } else {
                    val errorMsg = response.errorBody()?.string() ?: "An unknown error occurred."
                    _registrationState.value = RegistrationState.Error(errorMsg)
                }
            } catch (e: Exception) {
                _registrationState.value = RegistrationState.Error("Network error: ${e.message}")
            }
        }
    }
}