const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  content: { type: String, required: true },
  senderName: { type: String, required: true },
  senderId: { type: String, required: true },
  recipientId: { type: String },
  timestamp: { type: Date, default: Date.now },
  
  // Enhanced routing information
  routing: {
    ttl: { type: Number, default: 7 },
    hopCount: { type: Number, default: 0 },
    routePath: [String], // Track which devices have forwarded this message
    priority: { 
      type: String, 
      enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'],
      default: 'NORMAL'
    }
  },
  
  // Location-based routing
  locationRouting: {
    senderLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    recipientLastKnownLocation: {
      type: { type: String, enum: ['Point'] },
      coordinates: [Number]
    },
    targetDeliveryRadius: { type: Number, default: 1000 }, // meters
    routedViaProximity: { type: Boolean, default: false },
    proximityNodes: [String] // Device IDs that cached this message
  },
  
  // Delivery tracking
  deliveryStatus: {
    status: { 
      type: String, 
      enum: ['PENDING', 'ROUTING', 'CACHED', 'DELIVERED', 'FAILED'],
      default: 'PENDING'
    },
    deliveredAt: Date,
    deliveryMethod: { 
      type: String, 
      enum: ['DIRECT', 'PROXIMITY_MESH', 'STORE_FORWARD', 'GATEWAY_BRIDGE']
    },
    attemptCount: { type: Number, default: 0 },
    lastAttemptAt: Date
  },
  
  encrypted: { type: Boolean, default: true },
  fromMesh: { type: Boolean, default: false },
  
  // Message caching for mobile recipients
  caching: {
    isCached: { type: Boolean, default: false },
    cachedAt: [String], // Device IDs where message is cached
    cacheExpiry: { type: Date },
    maxCacheNodes: { type: Number, default: 5 }
  }
}, { timestamps: true });

// Indexes for efficient querying
messageSchema.index({ recipientId: 1, 'deliveryStatus.status': 1 });
messageSchema.index({ 'locationRouting.recipientLastKnownLocation': '2dsphere' });
messageSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }); // Expire after 7 days
messageSchema.index({ 'routing.ttl': 1 });

// Methods
messageSchema.methods.decrementTTL = function() {
  this.routing.ttl = Math.max(0, this.routing.ttl - 1);
  this.routing.hopCount += 1;
  return this.routing.ttl > 0;
};

messageSchema.methods.addToRoutePath = function(deviceId) {
  if (!this.routing.routePath.includes(deviceId)) {
    this.routing.routePath.push(deviceId);
  }
};

module.exports = mongoose.model('Message', messageSchema);
