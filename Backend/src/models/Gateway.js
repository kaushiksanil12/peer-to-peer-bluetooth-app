const mongoose = require('mongoose');

const gatewaySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  deviceName: { type: String, required: true },
  passwordHash: { type: String, required: true },
  
  // Device capabilities (privacy-safe)
  meshCapabilities: {
    maxRange: { type: Number, default: 100, min: 10, max: 1000 },
    batteryLevel: { 
      type: Number, 
      min: 0, 
      max: 100,
      validate: {
        validator: function(v) {
          return v >= 0 && v <= 100;
        },
        message: 'Battery level must be between 0 and 100'
      }
    },
    isScanning: { type: Boolean, default: false },
    scanMode: { 
      type: String, 
      enum: ['LOW_POWER', 'BALANCED', 'HIGH_PERFORMANCE', 'OPPORTUNISTIC'],
      default: 'BALANCED'
    },
    lastScanTimestamp: { type: Date },
    connectionStrength: { type: Number, default: 0 }, // RSSI
    supportedProtocols: [{ type: String }]
  },
  
  // Network discovery (ephemeral, no location)
  nearbyNodes: [{
    deviceId: { type: String },
    signalStrength: { type: Number }, // RSSI for distance estimation
    discoveredAt: { type: Date, default: Date.now },
    expiresAt: { 
      type: Date, 
      default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
      expires: 0 // MongoDB TTL index
    }
  }],
  
  // Message forwarding preferences
  forwardingPreferences: {
    allowsMessageForwarding: { type: Boolean, default: true },
    maxDailyForwards: { type: Number, default: 50, min: 1 },
    maxHourlyForwards: { type: Number, default: 10, min: 1 },
    currentDailyForwards: { type: Number, default: 0, min: 0 },
    currentHourlyForwards: { type: Number, default: 0, min: 0 },
    lastForwardReset: { type: Date, default: Date.now },
    lastHourlyReset: { type: Date, default: Date.now }
  },
  
  // Network statistics (privacy-safe)
  networkStats: {
    messagesForwarded: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    messagesDelivered: { type: Number, default: 0 },
    connectionSuccess: { type: Number, default: 0 },
    connectionAttempts: { type: Number, default: 0 },
    connectionFailures: { type: Number, default: 0 },
    averageConnectionTime: { type: Number, default: 0 },
    totalUptime: { type: Number, default: 0 },
    dataTransferred: { type: Number, default: 0 },
    lastStatsReset: { type: Date, default: Date.now }
  },
  
  // Device status
  internetConnected: { type: Boolean, default: false },
  isActive: { type: Boolean, default: true },
  lastSeen: { type: Date, default: Date.now }
  
  // ❌ REMOVED: All location-related fields for privacy
  // location, locationHistory, lastKnownLocation, movementPattern
  
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for efficient queries (no geospatial indexes needed)
gatewaySchema.index({ deviceId: 1, isActive: 1 });
gatewaySchema.index({ 
  'meshCapabilities.isScanning': 1, 
  isActive: 1,
  'forwardingPreferences.allowsMessageForwarding': 1
});
gatewaySchema.index({ lastSeen: 1 }, { expireAfterSeconds: 7 * 24 * 3600 });

// Virtual fields for calculated properties
gatewaySchema.virtual('connectionReliability').get(function() {
  if (this.networkStats.connectionAttempts === 0) return 0;
  return this.networkStats.connectionSuccess / this.networkStats.connectionAttempts;
});

gatewaySchema.virtual('forwardingCapacity').get(function() {
  return Math.max(0, 
    this.forwardingPreferences.maxDailyForwards - this.forwardingPreferences.currentDailyForwards
  );
});

gatewaySchema.virtual('batteryStatus').get(function() {
  const level = this.meshCapabilities.batteryLevel;
  if (level > 80) return 'EXCELLENT';
  if (level > 60) return 'GOOD';
  if (level > 40) return 'MODERATE';
  if (level > 20) return 'LOW';
  return 'CRITICAL';
});

// Instance Methods

/**
 * Update nearby nodes discovered via BLE (no location storage)
 */
gatewaySchema.methods.updateNearbyNodes = function(discoveredNodes) {
  // Add new discoveries, remove expired ones
  this.nearbyNodes = discoveredNodes.map(node => ({
    deviceId: node.deviceId,
    signalStrength: node.signalStrength,
    discoveredAt: new Date(),
    expiresAt: new Date(Date.now() + 10 * 60 * 1000) // 10 minutes
  }));
  
  return this.save();
};

/**
 * Find nearby nodes based on recent BLE discovery (not location)
 */
gatewaySchema.methods.getNearbyNodes = function() {
  const now = new Date();
  return this.nearbyNodes.filter(node => node.expiresAt > now);
};

/**
 * Check if device can accept forwarding request
 */
gatewaySchema.methods.canAcceptForwarding = function(priority = 'NORMAL') {
  if (!this.forwardingPreferences.allowsMessageForwarding || !this.isActive) {
    return false;
  }
  
  const batteryLevel = this.meshCapabilities.batteryLevel || 0;
  if (batteryLevel < 20 && priority !== 'EMERGENCY') return false;
  if (batteryLevel < 10) return false;
  
  if (this.forwardingPreferences.currentDailyForwards >= this.forwardingPreferences.maxDailyForwards) {
    return priority === 'EMERGENCY';
  }
  
  if (this.forwardingPreferences.currentHourlyForwards >= this.forwardingPreferences.maxHourlyForwards) {
    return priority === 'EMERGENCY';
  }
  
  return true;
};

/**
 * Update network statistics
 */
gatewaySchema.methods.updateStats = function(statsUpdate) {
  Object.keys(statsUpdate).forEach(key => {
    if (key === 'averageConnectionTime' && statsUpdate[key]) {
      const currentAvg = this.networkStats.averageConnectionTime || 0;
      this.networkStats.averageConnectionTime = (currentAvg * 0.8) + (statsUpdate[key] * 0.2);
    } else if (typeof statsUpdate[key] === 'number') {
      this.networkStats[key] = (this.networkStats[key] || 0) + statsUpdate[key];
    }
  });
  
  return this.save();
};

// Static Methods

/**
 * Find nodes suitable for message forwarding (based on BLE discovery)
 */
gatewaySchema.statics.findAvailableForwarders = function(excludeDeviceIds = [], options = {}) {
  const {
    minBatteryLevel = 20,
    requireInternet = false,
    maxForwardingLoad = 0.8,
    priority = 'NORMAL',
    limit = 10
  } = options;

  const query = {
    isActive: true,
    deviceId: { $nin: excludeDeviceIds },
    'meshCapabilities.isScanning': true,
    'forwardingPreferences.allowsMessageForwarding': true,
    'meshCapabilities.batteryLevel': { 
      $gte: priority === 'EMERGENCY' ? 10 : minBatteryLevel 
    }
  };

  if (requireInternet) {
    query.internetConnected = true;
  }

  if (maxForwardingLoad < 1.0) {
    query.$expr = {
      $lt: [
        '$forwardingPreferences.currentDailyForwards',
        { $multiply: ['$forwardingPreferences.maxDailyForwards', maxForwardingLoad] }
      ]
    };
  }

  return this.find(query)
    .sort({ 
      'meshCapabilities.batteryLevel': -1,
      'forwardingPreferences.currentDailyForwards': 1,
      lastSeen: -1 
    })
    .limit(limit);
};

/**
 * Reset daily forwarding counters
 */
gatewaySchema.statics.resetDailyCounters = function() {
  return this.updateMany(
    {},
    {
      $set: {
        'forwardingPreferences.currentDailyForwards': 0,
        'forwardingPreferences.lastForwardReset': new Date()
      }
    }
  );
};

/**
 * Clean up inactive gateways
 */
gatewaySchema.statics.cleanupInactive = function(inactiveHours = 24) {
  const cutoffTime = new Date(Date.now() - inactiveHours * 60 * 60 * 1000);
  
  return this.updateMany(
    { lastSeen: { $lt: cutoffTime } },
    { 
      $set: { 
        isActive: false, 
        internetConnected: false,
        'meshCapabilities.isScanning': false
      } 
    }
  );
};

module.exports = mongoose.model('Gateway', gatewaySchema);
