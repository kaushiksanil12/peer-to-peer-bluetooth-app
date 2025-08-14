const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  messageId: {
    type: String,
    required: true,
    unique: true,
    default: function() {
      return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
  },
  
  content: { type: String, required: true },
  senderName: { type: String, required: true },
  senderId: { type: String, required: true },
  recipientId: { type: String, required: true },
  
  priority: {
    type: String,
    enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'],
    default: 'NORMAL'
  },
  
  // Routing information (privacy-safe)
  deliveryMethod: {
    type: String,
    enum: ['store-and-forward', 'mesh-forward', 'direct-internet'],
    default: 'store-and-forward'
  },
  
  routedVia: { type: String }, // Device ID of forwarder
  ttl: { type: Number, default: 7, min: 1, max: 15 },
  
  // Message status
  status: {
    type: String,
    enum: ['pending', 'delivered', 'failed', 'expired'],
    default: 'pending'
  },
  
  // Timestamps
  createdAt: { type: Date, default: Date.now },
  deliveredAt: { type: Date },
  expiresAt: {
    type: Date,
    default: function() {
      return new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
    },
    expires: 0 // MongoDB TTL index
  }
  
  // ❌ REMOVED: All location-related fields for privacy
  // No locationRouting, senderLocation, recipientLocation fields
  
}, { 
  timestamps: true 
});

// Indexes for efficient queries
messageSchema.index({ recipientId: 1, status: 1 });
messageSchema.index({ messageId: 1 });
messageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Message', messageSchema);
