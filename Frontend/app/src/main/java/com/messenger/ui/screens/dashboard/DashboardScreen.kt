package com.messenger.ui.screens.dashboard

import android.Manifest
import android.os.Build
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel
import com.google.accompanist.permissions.ExperimentalPermissionsApi
import com.google.accompanist.permissions.rememberMultiplePermissionsState
import com.messenger.ble.DiscoveredDevice

@OptIn(ExperimentalPermissionsApi::class)
@Composable
fun DashboardScreen(
    viewModel: DashboardViewModel = hiltViewModel()
) {
    val permissionState = rememberMultiplePermissionsState(
        permissions = viewModel.requiredPermissions.toList()
    )

    val discoveredDevices by viewModel.discoveredDevices.collectAsState()
    val isScanning by viewModel.isScanning.collectAsState()

    LaunchedEffect(key1 = permissionState.allPermissionsGranted) {
        if (permissionState.allPermissionsGranted) {
            viewModel.startScan()
        }
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(16.dp),
        horizontalAlignment = Alignment.CenterHorizontally
    ) {
        if (!permissionState.allPermissionsGranted) {
            Text("Bluetooth permissions are required to find nearby devices.")
            Spacer(modifier = Modifier.height(8.dp))
            Button(onClick = { permissionState.launchMultiplePermissionRequest() }) {
                Text("Grant Permissions")
            }
        } else {
            Button(onClick = {
                if (isScanning) viewModel.stopScan() else viewModel.startScan()
            }) {
                Text(if (isScanning) "Stop Scan" else "Start Scan")
            }
            Spacer(modifier = Modifier.height(16.dp))

            if (isScanning) {
                CircularProgressIndicator()
            }

            LazyColumn(modifier = Modifier.fillMaxWidth()) {
                items(discoveredDevices) { device ->
                    DeviceItem(device = device)
                }
            }
        }
    }
}

@Composable
fun DeviceItem(device: DiscoveredDevice) {
    Card(modifier = Modifier
        .fillMaxWidth()
        .padding(vertical = 4.dp)) {
        Row(
            modifier = Modifier.padding(16.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween
        ) {
            Column {
                Text(text = device.name ?: "Unknown Device", style = MaterialTheme.typography.titleMedium)
                Text(text = device.address, style = MaterialTheme.typography.bodySmall)
            }
            Text(text = "${device.rssi} dBm", style = MaterialTheme.typography.bodyMedium)
        }
    }
}