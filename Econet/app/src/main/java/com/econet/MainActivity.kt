package com.econet

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Modifier
import androidx.core.content.ContextCompat
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.econet.ble.BleMeshService
import com.econet.ui.screens.messaging.MessagingScreen
import com.econet.ui.screens.profile.ProfileScreen
import com.econet.ui.theme.EconetTheme
import com.econet.util.SharedPreferencesHelper
import dagger.hilt.android.AndroidEntryPoint
import javax.inject.Inject

@AndroidEntryPoint
class MainActivity : ComponentActivity() {

    @Inject
    lateinit var prefsHelper: SharedPreferencesHelper

    // 1. Create the permission launcher
    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.all { it }) {
            // All permissions were granted, start the service
            startBleService()
        } else {
            // Handle the case where the user denies permissions
            // TODO: Show a message to the user explaining why permissions are needed
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        val isProfileCreated = prefsHelper.isProfileCreated

        setContent {
            EconetTheme {
                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background
                ) {
                    val navController = rememberNavController()
                    NavHost(
                        navController = navController,
                        startDestination = if (isProfileCreated) "messaging" else "profile"
                    ) {
                        composable("profile") {
                            ProfileScreen(
                                onRegistrationSuccess = {
                                    navController.navigate("messaging") {
                                        popUpTo("profile") { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("messaging") {
                            // 2. Trigger the permission request when the messaging screen is shown
                            LaunchedEffect(Unit) {
                                requestPermissions()
                            }
                            MessagingScreen()
                        }
                    }
                }
            }
        }
    }

    // 3. A function to check for and request permissions
    private fun requestPermissions() {
        val hasPermissions = REQUIRED_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        if (!hasPermissions) {
            permissionLauncher.launch(REQUIRED_PERMISSIONS)
        } else {
            // Permissions are already granted, start the service directly
            startBleService()
        }
    }

    // 4. A helper function to start the service
    private fun startBleService() {
        val serviceIntent = Intent(this, BleMeshService::class.java)
        startForegroundService(serviceIntent)
    }

    // 5. Define the required permissions based on Android version
    companion object {
        private val REQUIRED_PERMISSIONS =
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                arrayOf(
                    Manifest.permission.BLUETOOTH_SCAN,
                    Manifest.permission.BLUETOOTH_CONNECT,
                    Manifest.permission.BLUETOOTH_ADVERTISE
                )
            } else {
                arrayOf(Manifest.permission.ACCESS_FINE_LOCATION)
            }
    }
}