package com.messenger.ui.screens.splash

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.hilt.navigation.compose.hiltViewModel
import androidx.lifecycle.ViewModel
import com.messenger.data.repository.AuthRepository
import dagger.hilt.android.lifecycle.HiltViewModel
import javax.inject.Inject

// A simple ViewModel for the splash screen
@HiltViewModel
class SplashViewModel @Inject constructor(
    private val authRepository: AuthRepository
): ViewModel() {
    fun isLoggedIn() = authRepository.isLoggedIn()
}

@Composable
fun SplashScreen(
    viewModel: SplashViewModel = hiltViewModel(),
    onNavigateToLogin: () -> Unit,
    onNavigateToMain: () -> Unit
) {
    // This effect runs once when the screen is composed
    LaunchedEffect(key1 = true) {
        if (viewModel.isLoggedIn()) {
            onNavigateToMain()
        } else {
            onNavigateToLogin()
        }
    }

    // Show a loading indicator while we decide where to go
    Box(
        modifier = Modifier.fillMaxSize(),
        contentAlignment = Alignment.Center
    ) {
        CircularProgressIndicator()
    }
}