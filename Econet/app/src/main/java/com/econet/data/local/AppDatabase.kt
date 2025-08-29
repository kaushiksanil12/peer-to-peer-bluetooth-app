package com.econet.data.local

import androidx.room.Database
import androidx.room.RoomDatabase
import com.econet.data.local.ConversationEntity
import com.econet.data.local.MessageEntity

@Database(
    entities = [MessageEntity::class, ConversationEntity::class],
    version = 2
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun messageDao(): MessageDao
    abstract fun conversationDao(): ConversationDao
}