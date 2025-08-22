package com.messenger.ui.screens.dashboard

import android.Manifest
import android.os.Build
import androidx.lifecycle.ViewModel
import com.messenger.ble.BLEService
import com.messenger.ble.DiscoveredDevice
import dagger.hilt.android.lifecycle.HiltViewModel
import kotlinx.coroutines.flow.StateFlow
import javax.inject.Inject

@HiltViewModel
class DashboardViewModel @Inject constructor(
    private val bleService: BLEService
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

    fun startScan() {
        bleService.startScan()
    }

    fun stopScan() {
        bleService.stopScan()
    }
}