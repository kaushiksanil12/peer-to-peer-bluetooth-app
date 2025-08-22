package com.messenger.di

import android.content.Context
import androidx.room.Room
import com.messenger.data.local.AppDatabase
import com.messenger.data.local.MessageDao
import com.messenger.data.remote.ApiService
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.android.qualifiers.ApplicationContext
import dagger.hilt.components.SingletonComponent
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import javax.inject.Singleton
import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothManager

@Module
@InstallIn(SingletonComponent::class)
object AppModule {

    // IMPORTANT: Replace with your actual backend URL if needed
    // This is the default address for the Android emulator to connect to your computer's localhost
    private const val BASE_URL = "http://10.0.2.2:3000/"

    @Provides
    @Singleton
    fun provideAppDatabase(@ApplicationContext context: Context): AppDatabase {
        return Room.databaseBuilder(
            context,
            AppDatabase::class.java,
            "messenger_db"
        ).build()
    }
    @Provides
    @Singleton
    fun provideOkHttpClient(): OkHttpClient {
        // This is useful for debugging to see network requests in Logcat
        val loggingInterceptor = HttpLoggingInterceptor().apply {
            level = HttpLoggingInterceptor.Level.BODY
        }
        return OkHttpClient.Builder()
            .addInterceptor(loggingInterceptor)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(okHttpClient: OkHttpClient): Retrofit {
        return Retrofit.Builder()
            .baseUrl(BASE_URL)
            .client(okHttpClient)
            .addConverterFactory(GsonConverterFactory.create())
            .build()
    }

    @Provides
    @Singleton
    fun provideApiService(retrofit: Retrofit): ApiService {
        // This is the function the error is looking for.
        // It tells Hilt how to create the ApiService using Retrofit.
        return retrofit.create(ApiService::class.java)
    }
    @Provides
    @Singleton
    fun provideMessageDao(database: AppDatabase): MessageDao {
        return database.messageDao()
    }
    @Provides
    @Singleton
    fun provideBluetoothAdapter(@ApplicationContext context: Context): BluetoothAdapter? {
        val bluetoothManager = context.getSystemService(Context.BLUETOOTH_SERVICE) as BluetoothManager
        return bluetoothManager.adapter
    }
}