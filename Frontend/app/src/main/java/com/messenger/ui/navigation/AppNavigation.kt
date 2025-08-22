package com.messenger.ui.navigation

import androidx.compose.runtime.Composable
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.messenger.ui.screens.login.LoginScreen
import com.messenger.ui.screens.main.MainScreen
import com.messenger.ui.screens.register.RegisterScreen
import com.messenger.ui.screens.splash.SplashScreen

object AppRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val MAIN_APP = "main_app"
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    // Start at the Splash screen to check for a saved session
    NavHost(navController = navController, startDestination = AppRoutes.SPLASH) {

        composable(AppRoutes.SPLASH) {
            SplashScreen(
                onNavigateToLogin = {
                    // If not logged in, go to Login and clear splash from backstack
                    navController.navigate(AppRoutes.LOGIN) {
                        popUpTo(AppRoutes.SPLASH) { inclusive = true }
                    }
                },
                onNavigateToMain = {
                    // If already logged in, go to Main and clear splash from backstack
                    navController.navigate(AppRoutes.MAIN_APP) {
                        popUpTo(AppRoutes.SPLASH) { inclusive = true }
                    }
                }
            )
        }

        composable(AppRoutes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
                    // On success, go to Main and clear login from backstack
                    navController.navigate(AppRoutes.MAIN_APP) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToRegister = {
                    navController.navigate(AppRoutes.REGISTER)
                }
            )
        }

        composable(AppRoutes.REGISTER) {
            RegisterScreen(
                onRegisterSuccess = {
                    // On success, go to Main and clear the auth flow from backstack
                    navController.navigate(AppRoutes.MAIN_APP) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack() // Go back to the login screen
                }
            )
        }

        composable(AppRoutes.MAIN_APP) {
            MainScreen()
        }
    }
}