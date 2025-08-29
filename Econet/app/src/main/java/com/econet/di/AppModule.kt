package com.econet.di

import android.content.Context
import androidx.room.Room
import com.econet.data.AppRepository
import com.econet.data.local.AppDatabase
import com.econet.data.local.ConversationDao
import com.econet.data.local.MessageDao
import com.econet.data.remote.ApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import net.sqlcipher.database.SupportFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        // In a real app, this passphrase should be retrieved securely from the Android Keystore.
        val passphrase = "your-very-secret-passphrase".toByteArray()
        val factory = SupportFactory(passphrase)

        return Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "econet_database"
        )
            .openHelperFactory(factory)
            .fallbackToDestructiveMigration()
            .build()
    }

    @Provides
    fun provideMessageDao(appDatabase: AppDatabase): MessageDao {
        return appDatabase.messageDao()
    }

    @Provides
    fun provideConversationDao(appDatabase: AppDatabase): ConversationDao {
        return appDatabase.conversationDao()
    }

    @Provides
    @Singleton
    fun provideAppRepository(
        messageDao: MessageDao,
        conversationDao: ConversationDao,
        apiService: ApiService
    ): AppRepository {
        return AppRepository(messageDao, conversationDao, apiService)
    }
}