package com.messenger.ble

import android.annotation.SuppressLint
import android.bluetooth.*
import android.bluetooth.le.AdvertiseCallback
import android.bluetooth.le.AdvertiseData
import android.bluetooth.le.AdvertiseSettings
import android.content.Context
import android.os.ParcelUuid
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
@SuppressLint("MissingPermission")
class GATTServerService @Inject constructor(
    @ApplicationContext private val context: Context,
    private val bluetoothAdapter: BluetoothAdapter?
) {
    private var gattServer: BluetoothGattServer? = null
    private val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager

    private val advertiseCallback = object : AdvertiseCallback() {}

    fun startServer() {
        if (bluetoothAdapter == null || !bluetoothAdapter.isEnabled) return
        gattServer = bluetoothManager.openGattServer(context, object : BluetoothGattServerCallback() {})

        val service = BluetoothGattService(GATTProfile.SERVICE_UUID, BluetoothGattService.SERVICE_TYPE_PRIMARY)
        val characteristic = BluetoothGattCharacteristic(
            GATTProfile.CHARACTERISTIC_UUID,
            BluetoothGattCharacteristic.PROPERTY_WRITE,
            BluetoothGattCharacteristic.PERMISSION_WRITE
        )
        service.addCharacteristic(characteristic)
        gattServer?.addService(service)

        startAdvertising()
    }

    private fun startAdvertising() {
        val advertiser = bluetoothAdapter?.bluetoothLeAdvertiser ?: return
        val settings = AdvertiseSettings.Builder()
            .setAdvertiseMode(AdvertiseSettings.ADVERTISE_MODE_LOW_LATENCY)
            .setTxPowerLevel(AdvertiseSettings.ADVERTISE_TX_POWER_HIGH)
            .setConnectable(true)
            .build()
        val data = AdvertiseData.Builder()
            .setIncludeDeviceName(true)
            .addServiceUuid(ParcelUuid(GATTProfile.SERVICE_UUID))
            .build()

        advertiser.startAdvertising(settings, data, advertiseCallback)
    }

    fun stopServer() {
        bluetoothAdapter?.bluetoothLeAdvertiser?.stopAdvertising(advertiseCallback)
        gattServer?.close()
        gattServer = null
    }
}