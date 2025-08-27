package com.econet.di

import android.content.Context
import androidx.room.Room
import androidx.sqlite.db.SupportSQLiteDatabase
import androidx.sqlite.db.SupportSQLiteOpenHelper
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
import net.sqlcipher.database.SQLiteDatabase
import net.sqlcipher.database.SupportFactory
import javax.inject.Singleton

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        // Create the passphrase as a ByteArray
        val passphrase = "your-very-secret-passphrase".toByteArray()

        // Pass the ByteArray directly to the SupportFactory constructor
        val factory = SupportFactory(passphrase)

        return Room.databaseBuilder(
            context.applicationContext,
            AppDatabase::class.java,
            "econet_database"
        )
            .openHelperFactory(factory)
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
        conversationDao: ConversationDao, // <-- Add this
        apiService: ApiService
    ): AppRepository {
        return AppRepository(messageDao, conversationDao, apiService) // <-- And this
    }

}