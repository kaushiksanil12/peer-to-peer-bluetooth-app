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
import com.econet.ui.screens.chats.ChatsScreen
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

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { permissions ->
        if (permissions.values.all { it }) {
            startBleService()
        } else {
            // TODO: Show a message explaining why permissions are needed.
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
                        // If profile is created, start at the new chats list. Otherwise, start at profile creation.
                        startDestination = if (isProfileCreated) "chats" else "profile"
                    ) {
                        composable("profile") {
                            ProfileScreen(
                                onRegistrationSuccess = {
                                    navController.navigate("chats") {
                                        popUpTo("profile") { inclusive = true }
                                    }
                                }
                            )
                        }
                        composable("chats") {
                            // When the chats screen is shown, request P2P permissions
                            LaunchedEffect(Unit) {
                                requestPermissions()
                            }
                            ChatsScreen(
                                onConversationSelected = { partnerId ->
                                    // Navigate to a specific chat screen
                                    navController.navigate("messaging/$partnerId")
                                }
                            )
                        }
                        composable("messaging/{partnerId}") { backStackEntry ->
                            // Extract the partnerId, though we aren't using it in the ViewModel yet
                            val partnerId = backStackEntry.arguments?.getString("partnerId")
                            MessagingScreen()
                        }
                    }
                }
            }
        }
    }

    private fun requestPermissions() {
        val hasPermissions = REQUIRED_PERMISSIONS.all {
            ContextCompat.checkSelfPermission(this, it) == PackageManager.PERMISSION_GRANTED
        }

        if (!hasPermissions) {
            permissionLauncher.launch(REQUIRED_PERMISSIONS)
        } else {
            startBleService()
        }
    }

    private fun startBleService() {
        val serviceIntent = Intent(this, BleMeshService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            startForegroundService(serviceIntent)
        } else {
            startService(serviceIntent)
        }
    }

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