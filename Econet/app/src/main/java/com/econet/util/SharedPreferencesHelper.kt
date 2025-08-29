package com.econet.util

import android.content.Context
import android.content.SharedPreferences
import androidx.security.crypto.EncryptedSharedPreferences
import dagger.hilt.android.qualifiers.ApplicationContext
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class SharedPreferencesHelper @Inject constructor(
    @ApplicationContext context: Context
) {
    // This is the alternative method. It creates the MasterKey behind the scenes.
    private val sharedPreferences: SharedPreferences = EncryptedSharedPreferences.create(
        "econet_secure_prefs",
        "econet_master_key_alias", // A unique alias for the master key
        context,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    companion object {
        private const val KEY_USER_ID = "user_id"
        private const val KEY_USER_NAME = "user_name"
    }

    var userId: String?
        get() = sharedPreferences.getString(KEY_USER_ID, null)
        set(value) {
            sharedPreferences.edit().putString(KEY_USER_ID, value).apply()
        }

    var userName: String?
        get() = sharedPreferences.getString(KEY_USER_NAME, null)
        set(value) {
            sharedPreferences.edit().putString(KEY_USER_NAME, value).apply()
        }

    val isProfileCreated: Boolean
        get() = !userId.isNullOrBlank()

    fun clear() {
        sharedPreferences.edit().clear().apply()
    }
}