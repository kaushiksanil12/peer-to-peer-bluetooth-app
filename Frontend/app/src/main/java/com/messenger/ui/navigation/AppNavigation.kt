package com.messenger.ui.navigation

import androidx.compose.runtime.Composable
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.rememberNavController
import com.messenger.ui.screens.compose.ComposeScreen
import com.messenger.ui.screens.compose.ComposeViewModel
import com.messenger.ui.screens.login.LoginScreen
import com.messenger.ui.screens.main.MainScreen
import com.messenger.ui.screens.register.RegisterScreen
import com.messenger.ui.screens.splash.SplashScreen

object AppRoutes {
    const val SPLASH = "splash"
    const val LOGIN = "login"
    const val REGISTER = "register"
    const val MAIN_APP = "main_app"
    const val COMPOSE = "compose"
}

@Composable
fun AppNavigation() {
    val navController = rememberNavController()
    NavHost(navController = navController, startDestination = AppRoutes.SPLASH) {

        composable(AppRoutes.SPLASH) {
            SplashScreen(
                onNavigateToLogin = {
                    navController.navigate(AppRoutes.LOGIN) {
                        popUpTo(AppRoutes.SPLASH) { inclusive = true }
                    }
                },
                onNavigateToMain = {
                    navController.navigate(AppRoutes.MAIN_APP) {
                        popUpTo(AppRoutes.SPLASH) { inclusive = true }
                    }
                }
            )
        }

        composable(AppRoutes.LOGIN) {
            LoginScreen(
                onLoginSuccess = {
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
                    navController.navigate(AppRoutes.MAIN_APP) {
                        popUpTo(AppRoutes.LOGIN) { inclusive = true }
                    }
                },
                onNavigateToLogin = {
                    navController.popBackStack()
                }
            )
        }

        composable(AppRoutes.MAIN_APP) {
            MainScreen(
                onNavigateToCompose = {
                    navController.navigate(AppRoutes.COMPOSE)
                }
            )
        }

        composable(AppRoutes.COMPOSE) {
            val viewModel: ComposeViewModel = hiltViewModel()
            ComposeScreen(
                onSendMessage = { receiver, content ->
                    viewModel.sendMessage(receiver, content)
                    navController.popBackStack()
                },
                onNavigateUp = {
                    navController.popBackStack()
                }
            )
        }
    }
}