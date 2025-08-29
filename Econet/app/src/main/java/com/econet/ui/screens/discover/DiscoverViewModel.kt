package com.econet.ui.screens.discover

import androidx.lifecycle.ViewModel
import androidx.lifecycle.viewModelScope
import com.econet.ble.ServiceManager
import com.econet.data.AppRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import javax.inject.Inject

data class DiscoveredDevice(
    val endpointId: String,
    val name: String
)

@HiltViewModel
class DiscoverViewModel @Inject constructor(
    private val repository: AppRepository
) : ViewModel() {

    private val _discoveredDevices = MutableStateFlow<List<DiscoveredDevice>>(emptyList())
    val discoveredDevices = _discoveredDevices.asStateFlow()

    init {
        repository.discoveredDevices
            .onEach { newDevice ->
                if (_discoveredDevices.value.none { it.endpointId == newDevice.endpointId }) {
                    _discoveredDevices.value = _discoveredDevices.value + newDevice
                }
            }
            .launchIn(viewModelScope)

        repository.lostDevices
            .onEach { lostEndpointId ->
                _discoveredDevices.value = _discoveredDevices.value.filterNot { it.endpointId == lostEndpointId }
            }
            .launchIn(viewModelScope)
    }

    fun connectToDevice(endpointId: String) {
        ServiceManager.bleMeshService?.connectToEndpoint(endpointId)
    }
}