// models/Message.js
const mongoose = require('mongoose');

const MessageSchema = new mongoose.Schema({
    messageId: { type: String, required: true, unique: true },
    originatorId: { type: String, required: true, index: true }, // Indexed for faster lookups
    originatorName: { type: String, required: true },
    finalDestinationId: { type: String, required: true, index: true }, // Indexed for routing
    textPayload: { type: String, required: true },
    timestamp: { type: Number, required: true }
    // Note: timeToLive is a client-side concept for BLE hops, 
    // so we don't need to store it in the backend database.
});

module.exports = mongoose.model('Message', MessageSchema);