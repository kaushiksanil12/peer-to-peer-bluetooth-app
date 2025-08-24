package com.messenger.ui.screens.dashboard

import android.Manifest
import android.os.Build
import androidx.lifecycle.ViewModel
import com.messenger.ble.BLEService
import com.messenger.ble.DiscoveredDevice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import com.messenger.ble.GATTClientService
import com.messenger.ble.GATTServerService
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val bleService: BLEService,
    private val gattClientService: GATTClientService,
    private val gattServerService: GATTServerService
) : ViewModel() {

    val discoveredDevices: StateFlow<List<DiscoveredDevice>> = bleService.discoveredDevices
    val isScanning: StateFlow<Boolean> = bleService.isScanning

    // Define the required BLE permissions based on Android version
    val requiredPermissions = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        arrayOf(
            Manifest.permission.BLUETOOTH_SCAN,
            Manifest.permission.BLUETOOTH_CONNECT,
            Manifest.permission.BLUETOOTH_ADVERTISE,
        )
    } else {
        arrayOf(Manifest.permission.ACCESS_FINE_LOCATION) // Older versions need location
    }

    val connectionState: StateFlow<Int> = gattClientService.connectionState

    fun connectToDevice(address: String) {
        gattClientService.connect(address)
    }

    fun startAdvertising() {
        gattServerService.startServer()
    }

    fun stopAdvertising() {
        gattServerService.stopServer()
    }
    fun startScan() {
        bleService.startScan()
    }

    fun stopScan() {
        bleService.stopScan()
    }
}