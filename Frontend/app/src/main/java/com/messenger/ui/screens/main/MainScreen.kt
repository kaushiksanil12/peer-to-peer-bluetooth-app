package com.messenger.ui.screens.main

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Dashboard // <-- Add this import
import androidx.compose.material.icons.filled.Message    // <-- Add this import
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.ui.Modifier
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.messenger.ui.screens.dashboard.DashboardScreen
import com.messenger.ui.screens.messages.MessagesScreen

object MainAppRoutes {
    const val DASHBOARD = "main/dashboard"
    const val MESSAGES = "main/messages"
}

@Composable
@OptIn(ExperimentalMaterial3Api::class)
fun MainScreen() {
    val navController = rememberNavController()
    var currentTitle by remember { mutableStateOf("Dashboard") }

    Scaffold(
        topBar = {
            TopAppBar(
                title = { Text(currentTitle) },
                colors = TopAppBarDefaults.topAppBarColors(
                    containerColor = MaterialTheme.colorScheme.primary,
                    titleContentColor = MaterialTheme.colorScheme.onPrimary
                )
            )
        },
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = currentTitle == "Dashboard",
                    onClick = {
                        navController.navigate(MainAppRoutes.DASHBOARD)
                        currentTitle = "Dashboard"
                    },
                    label = { Text("Dashboard") },
                    // The icon now resolves correctly
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") }
                )
                NavigationBarItem(
                    selected = currentTitle == "Messages",
                    onClick = {
                        navController.navigate(MainAppRoutes.MESSAGES)
                        currentTitle = "Messages"
                    },
                    label = { Text("Messages") },
                    // The icon now resolves correctly
                    icon = { Icon(Icons.Default.Message, contentDescription = "Messages") }
                )
            }
        }
    ) { innerPadding ->
        NavHost(
            navController = navController,
            startDestination = MainAppRoutes.DASHBOARD,
            modifier = Modifier.padding(innerPadding)
        ) {
            composable(MainAppRoutes.DASHBOARD) { DashboardScreen() }
            composable(MainAppRoutes.MESSAGES) { MessagesScreen() }
        }
    }
}