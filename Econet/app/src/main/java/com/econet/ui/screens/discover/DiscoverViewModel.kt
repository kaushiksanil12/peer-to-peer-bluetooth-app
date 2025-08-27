package com.econet.ui.screens.discover

import androidx.lifecycle.ViewModel
import com.econet.ble.ServiceManager
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject

data class DiscoveredDevice(
    val endpointId: String,
    val name: String
)

@HiltViewModel
class DiscoverViewModel @Inject constructor() : ViewModel() {

    private val _discoveredDevices = MutableStateFlow<List<DiscoveredDevice>>(emptyList())
    val discoveredDevices = _discoveredDevices.asStateFlow()

    // This function will be called from the BleMeshService when a device is found
    fun addDevice(endpointId: String, name: String) {
        val newDevice = DiscoveredDevice(endpointId, name)
        if (!_discoveredDevices.value.contains(newDevice)) {
            _discoveredDevices.value = _discoveredDevices.value + newDevice
        }
    }

    // This function will be called when a device is lost
    fun removeDevice(endpointId: String) {
        _discoveredDevices.value = _discoveredDevices.value.filterNot { it.endpointId == endpointId }
    }

    // Called from the UI when a user taps a device
    fun connectToDevice(endpointId: String) {
        ServiceManager.bleMeshService?.connectToEndpoint(endpointId)
    }
}