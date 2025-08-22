package com.messenger.ui.screens.login

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.messenger.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import com.messenger.data.local.SessionManager
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class LoginUiState(
    val deviceId: String = "", // <-- Updated
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val loginSuccess: Boolean = false
)

@HiltViewModel
class LoginViewModel @Inject constructor(
    private val authRepository: AuthRepository,
    private val sessionManager: SessionManager // <-- Inject SessionManager
) : ViewModel() {

    private val _uiState = MutableStateFlow(LoginUiState())
    val uiState = _uiState.asStateFlow()

    init {
        // When the ViewModel is created, pre-fill the device ID field
        val savedDeviceId = sessionManager.getDeviceId()
        if (savedDeviceId != null) {
            _uiState.update { it.copy(deviceId = savedDeviceId) }
        }
    }
    fun onDeviceIdChange(deviceId: String) { // <-- Updated
        _uiState.update { it.copy(deviceId = deviceId) }
    }
    fun onPasswordChange(password: String) {
        _uiState.update { it.copy(password = password) }
    }
    fun login() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = authRepository.login(
                deviceId = _uiState.value.deviceId, // <-- Updated
                password = _uiState.value.password
            )
            result.onSuccess {
                _uiState.update { it.copy(isLoading = false, loginSuccess = true) }
            }.onFailure { error ->
                _uiState.update { it.copy(isLoading = false, error = error.message) }
            }
        }
    }
}