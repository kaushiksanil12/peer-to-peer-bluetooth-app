package com.econet.data.local

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.OnConflictStrategy
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface MessageDao {

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertMessage(message: MessageEntity)

    @Query("SELECT * FROM messages ORDER BY timestamp ASC")
    fun getAllMessages(): Flow<List<MessageEntity>>

    // Optional: A query to get messages for a specific chat
    @Query("SELECT * FROM messages WHERE originatorId = :partnerId OR (isFromMe = 1 AND originatorId = :myId)")
    fun getMessagesForConversation(partnerId: String, myId: String): Flow<List<MessageEntity>>
}