package com.econet.ui.screens.discover

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.*
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.hilt.navigation.compose.hiltViewModel

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun DiscoverScreen(
    onDeviceSelected: () -> Unit,
    discoverViewModel: DiscoverViewModel = hiltViewModel()
) {
    val devices by discoverViewModel.discoveredDevices.collectAsState()

    Scaffold(
        topBar = {
            TopAppBar(title = { Text("Nearby Devices") })
        }
    ) { paddingValues ->
        Column(modifier = Modifier.padding(paddingValues).padding(16.dp)) {
            if (devices.isEmpty()) {
                Text("Searching for nearby devices...")
                Spacer(modifier = Modifier.height(16.dp))
                CircularProgressIndicator()
            } else {
                LazyColumn(verticalArrangement = Arrangement.spacedBy(8.dp)) {
                    items(devices) { device ->
                        DeviceListItem(device = device) {
                            discoverViewModel.connectToDevice(device.endpointId)
                            onDeviceSelected()
                        }
                    }
                }
            }
        }
    }
}

@Composable
fun DeviceListItem(device: DiscoveredDevice, onClick: () -> Unit) {
    Card(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick),
        elevation = CardDefaults.cardElevation(defaultElevation = 2.dp)
    ) {
        Text(
            text = device.name,
            modifier = Modifier.padding(16.dp),
            style = MaterialTheme.typography.titleMedium
        )
    }
}