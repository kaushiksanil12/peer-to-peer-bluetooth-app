package com.messenger.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.content.Context
import dagger.hilt.android.qualifiers.ApplicationContext
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.util.UUID
import javax.inject.Inject
import javax.inject.Singleton

// Define the unique identifiers for your service and characteristic
object GATTProfile {
    val SERVICE_UUID: UUID = UUID.fromString("0000180D-0000-1000-8000-00805F9B34FB") // Example: Heart Rate Service
    val CHARACTERISTIC_UUID: UUID = UUID.fromString("00002A37-0000-1000-8000-00805F9B34FB") // Example: Heart Rate Measurement
}

@Singleton
@SuppressLint("MissingPermission") // Permissions are checked in the UI
class GATTClientService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val bluetoothAdapter: BluetoothAdapter?
) {
    private var gatt: BluetoothGatt? = null
    private val _connectionState = MutableStateFlow<Int>(BluetoothProfile.STATE_DISCONNECTED)
    val connectionState = _connectionState.asStateFlow()

    private val gattCallback = object : BluetoothGattCallback() {
        override fun onConnectionStateChange(gatt: BluetoothGatt?, status: Int, newState: Int) {
            _connectionState.value = newState
            if (newState == BluetoothProfile.STATE_CONNECTED) {
                gatt?.discoverServices()
            }
        }

        override fun onServicesDiscovered(gatt: BluetoothGatt?, status: Int) {
            // Services discovered, you can now interact with them
        }

        override fun onCharacteristicWrite(gatt: BluetoothGatt?, characteristic: BluetoothGattCharacteristic?, status: Int) {
            // Write operation was successful
        }
    }

    fun connect(address: String) {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) return
        val device = bluetoothAdapter.getRemoteDevice(address)
        gatt = device.connectGatt(context, false, gattCallback)
    }

    fun disconnect() {
        gatt?.disconnect()
        gatt?.close()
        gatt = null
        _connectionState.value = BluetoothProfile.STATE_DISCONNECTED
    }

    fun writeMessage(message: String) {
        val service = gatt?.getService(GATTProfile.SERVICE_UUID)
        val characteristic = service?.getCharacteristic(GATTProfile.CHARACTERISTIC_UUID)
        characteristic?.let {
            it.writeType = BluetoothGattCharacteristic.WRITE_TYPE_DEFAULT
            it.setValue(message.toByteArray(Charsets.UTF_8))
            gatt?.writeCharacteristic(it)
        }
    }
}