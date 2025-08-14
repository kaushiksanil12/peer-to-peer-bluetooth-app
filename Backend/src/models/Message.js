const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  senderName: { type: String, required: true },
  senderId: { type: String, required: true },
  recipientId: { type: String },
  timestamp: { type: Date, default: Date.now },
  ttl: { type: Number, default: 7 },  // Time-to-Live for routing
  encrypted: { type: Boolean, default: true },
  fromMesh: { type: Boolean, default: false }
}, { timestamps: true });

// Automatic expiration after TTL
messageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 3600 * 24 });  // Expire after 1 day

module.exports = mongoose.model('Message', messageSchema);
