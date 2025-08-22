package com.messenger.ble

import android.annotation.SuppressLint
import android.bluetooth.BluetoothAdapter
import android.bluetooth.le.ScanCallback
import android.bluetooth.le.ScanResult
import android.bluetooth.le.ScanSettings
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import javax.inject.Inject
import javax.inject.Singleton

// A simple data class to hold scan result information
data class DiscoveredDevice(
    val address: String,
    val name: String?,
    val rssi: Int // Signal strength
)

@Singleton
class BLEService @Inject constructor(
    private val bluetoothAdapter: BluetoothAdapter?
) {
    private val _discoveredDevices = MutableStateFlow<List<DiscoveredDevice>>(emptyList())
    val discoveredDevices = _discoveredDevices.asStateFlow()

    private val _isScanning = MutableStateFlow(false)
    val isScanning = _isScanning.asStateFlow()

    private val leScanCallback = object : ScanCallback() {
        @SuppressLint("MissingPermission") // Permissions are checked before calling
        override fun onScanResult(callbackType: Int, result: ScanResult?) {
            super.onScanResult(callbackType, result)
            result?.device?.let { device ->
                val existingDevice = _discoveredDevices.value.find { it.address == device.address }
                if (existingDevice == null && device.name != null) {
                    val newDevice = DiscoveredDevice(
                        address = device.address,
                        name = device.name,
                        rssi = result.rssi
                    )
                    _discoveredDevices.value += newDevice
                }
            }
        }
    }

    @SuppressLint("MissingPermission")
    fun startScan() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled || isScanning.value) return
        val scanner = bluetoothAdapter.bluetoothLeScanner
        val scanSettings = ScanSettings.Builder()
            .setScanMode(ScanSettings.SCAN_MODE_LOW_LATENCY)
            .build()

        // TODO: Add a ScanFilter to scan only for your app's specific UUID
        scanner.startScan(null, scanSettings, leScanCallback)
        _isScanning.value = true
    }

    @SuppressLint("MissingPermission")
    fun stopScan() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled || !isScanning.value) return
        bluetoothAdapter.bluetoothLeScanner.stopScan(leScanCallback)
        _isScanning.value = false
    }
}