package com.messenger.ui.screens.main

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Add
import androidx.compose.material.icons.filled.Dashboard
import androidx.compose.material.icons.filled.Message
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

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun MainScreen(
    onNavigateToCompose: () -> Unit
) {
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
                    icon = { Icon(Icons.Default.Dashboard, contentDescription = "Dashboard") }
                )
                NavigationBarItem(
                    selected = currentTitle == "Messages",
                    onClick = {
                        navController.navigate(MainAppRoutes.MESSAGES)
                        currentTitle = "Messages"
                    },
                    label = { Text("Messages") },
                    icon = { Icon(Icons.Default.Message, contentDescription = "Messages") }
                )
            }
        },
        floatingActionButton = {
            FloatingActionButton(onClick = onNavigateToCompose) {
                Icon(Icons.Default.Add, contentDescription = "New Message")
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