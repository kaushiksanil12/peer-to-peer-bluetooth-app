package com.messenger.workers

import android.content.Context
import androidx.hilt.work.HiltWorker
import androidx.work.CoroutineWorker
import androidx.work.WorkerParameters
import com.messenger.data.repository.MessageRepository
import dagger.assisted.Assisted
import dagger.assisted.AssistedInject

@HiltWorker
class SyncWorker @AssistedInject constructor(
    @Assisted appContext: Context,
    @Assisted workerParams: WorkerParameters,
    private val messageRepository: MessageRepository // Hilt injects the repository
) : CoroutineWorker(appContext, workerParams) {

    override suspend fun doWork(): Result {
        return try {
            // This is the core logic that runs in the background
            messageRepository.syncOfflineMessages()
            Result.success()
        } catch (e: Exception) {
            e.printStackTrace()
            // If something goes wrong, retry the job later
            Result.retry()
        }
    }
}