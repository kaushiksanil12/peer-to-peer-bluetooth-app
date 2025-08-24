package com.messenger.crypto

import com.google.crypto.tink.Aead
import com.google.crypto.tink.KeyTemplates
import com.google.crypto.tink.aead.AeadConfig
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class CryptoService @Inject constructor() {

    // A simple in-memory map to store shared keys for different conversations.
    // In a real app, this should be a secure, persistent database (e.g., encrypted Room table).
    private val sessionKeys = mutableMapOf<String, Aead>()

    init {
        // Initialize Tink
        AeadConfig.register()
    }

    // In a real E2EE system, this key would be derived from a key exchange protocol
    // like Diffie-Hellman. For this example, we will simulate creating a shared key.
    fun establishSharedKey(receiverId: String) {
        if (!sessionKeys.containsKey(receiverId)) {
            val keyHandle = com.google.crypto.tink.KeysetHandle.generateNew(KeyTemplates.get("AES256_GCM"))
            val aead = keyHandle.getPrimitive(Aead::class.java)
            sessionKeys[receiverId] = aead
        }
    }

    fun encrypt(plainText: String, receiverId: String): ByteArray? {
        val aead = sessionKeys[receiverId] ?: return null
        // The second parameter is "associated data" for authentication, can be null
        return aead.encrypt(plainText.toByteArray(Charsets.UTF_8), null)
    }

    fun decrypt(cipherText: ByteArray, senderId: String): String? {
        val aead = sessionKeys[senderId] ?: return null
        return try {
            val decryptedBytes = aead.decrypt(cipherText, null)
            String(decryptedBytes, Charsets.UTF_8)
        } catch (e: Exception) {
            e.printStackTrace()
            null // Decryption failed
        }
    }
}