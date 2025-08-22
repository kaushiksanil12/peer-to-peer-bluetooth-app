package com.messenger.ui.screens.register

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.messenger.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import javax.inject.Inject

data class RegisterUiState(
    val deviceId: String = "",
    val deviceName: String = "",
    val password: String = "",
    val isLoading: Boolean = false,
    val error: String? = null,
    val registerSuccess: Boolean = false
)

@HiltViewModel
class RegisterViewModel @Inject constructor(
    private val authRepository: AuthRepository
) : ViewModel() {

    private val _uiState = MutableStateFlow(RegisterUiState())
    val uiState = _uiState.asStateFlow()

    fun onDeviceIdChange(deviceId: String) {
        _uiState.update { it.copy(deviceId = deviceId) }
    }

    fun onDeviceNameChange(deviceName: String) {
        _uiState.update { it.copy(deviceName = deviceName) }
    }

    fun onPasswordChange(password: String) {
        _uiState.update { it.copy(password = password) }
    }

    fun register() {
        viewModelScope.launch {
            _uiState.update { it.copy(isLoading = true, error = null) }
            val result = authRepository.register(
                deviceId = _uiState.value.deviceId,
                deviceName = _uiState.value.deviceName,
                password = _uiState.value.password
            )
            result.onSuccess {
                _uiState.update { it.copy(isLoading = false, registerSuccess = true) }
            }.onFailure { error ->
                _uiState.update { it.copy(isLoading = false, error = error.message) }
            }
        }
    }
}