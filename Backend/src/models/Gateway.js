const mongoose = require('mongoose');

const gatewaySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  deviceName: { type: String, required: true },
  isGateway: { type: Boolean, default: false },
  internetConnected: { type: Boolean, default: false },
  
  // MAIN location field - this is what geospatial queries use
  location: { 
    type: { 
      type: String, 
      enum: ['Point'], 
      default: 'Point' 
    }, 
    coordinates: { 
      type: [Number], 
      default: [0, 0],
      validate: {
        validator: function(coords) {
          return coords.length === 2 && 
                 coords[0] >= -180 && coords[0] <= 180 && // longitude
                 coords[1] >= -90 && coords[1] <= 90;     // latitude
        },
        message: 'Coordinates must be [longitude, latitude] within valid ranges'
      }
    }
  },
  
  // Enhanced location tracking for mobile recipients
  locationHistory: [{
    coordinates: {
      type: [Number],
      validate: {
        validator: function(coords) {
          return coords.length === 2;
        }
      }
    },
    timestamp: { type: Date, default: Date.now },
    accuracy: { type: Number, min: 0 }, // GPS accuracy in meters
    speed: { type: Number, min: 0 },    // km/h
    heading: { type: Number, min: 0, max: 360 }, // degrees
    source: { 
      type: String, 
      enum: ['GPS', 'NETWORK', 'PASSIVE', 'FUSED'],
      default: 'GPS' 
    }
  }],
  
  lastKnownLocation: {
    coordinates: { type: [Number] },
    timestamp: { type: Date },
    accuracy: { type: Number },
    confidence: { type: Number, min: 0, max: 1, default: 1 }
  },
  
  // Enhanced mesh networking capabilities
  meshCapabilities: {
    maxRange: { type: Number, default: 100, min: 10, max: 1000 }, // BLE range in meters
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
    scanFrequency: { type: Number, default: 30000 }, // milliseconds
    connectionStrength: { type: Number, default: 0 }, // RSSI or similar
    supportedProtocols: [{ type: String }] // BLE, WiFi Direct, etc.
  },
  
  // Message forwarding preferences and limits
  forwardingPreferences: {
    allowsMessageForwarding: { type: Boolean, default: true },
    maxForwardingDistance: { type: Number, default: 5000, min: 100 }, // meters
    maxDailyForwards: { type: Number, default: 50, min: 1 },
    maxHourlyForwards: { type: Number, default: 10, min: 1 },
    currentDailyForwards: { type: Number, default: 0, min: 0 },
    currentHourlyForwards: { type: Number, default: 0, min: 0 },
    lastForwardReset: { type: Date, default: Date.now },
    lastHourlyReset: { type: Date, default: Date.now },
    priorityLevels: [{
      level: { type: String, enum: ['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'] },
      enabled: { type: Boolean, default: true }
    }]
  },
  
  // Comprehensive network statistics
  networkStats: {
    messagesForwarded: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    messagesDelivered: { type: Number, default: 0 },
    connectionSuccess: { type: Number, default: 0 },
    connectionAttempts: { type: Number, default: 0 },
    connectionFailures: { type: Number, default: 0 },
    averageConnectionTime: { type: Number, default: 0 }, // milliseconds
    totalUptime: { type: Number, default: 0 }, // seconds
    dataTransferred: { type: Number, default: 0 }, // bytes
    lastStatsReset: { type: Date, default: Date.now }
  },
  
  // Device status and health
  deviceHealth: {
    cpuUsage: { type: Number, min: 0, max: 100 },
    memoryUsage: { type: Number, min: 0, max: 100 },
    storageUsage: { type: Number, min: 0, max: 100 },
    temperature: { type: Number }, // celsius
    signalStrength: { type: Number }, // dBm
    lastHealthCheck: { type: Date }
  },
  
  lastSeen: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  // Advanced movement prediction for mobile routing
  movementPattern: {
    commonLocations: [{
      name: { type: String },
      coordinates: { type: [Number] },
      radius: { type: Number, default: 100 }, // meters
      frequency: { type: Number, default: 1 },
      timePatterns: [{ type: String }], // ["morning", "evening", "weekend"]
      avgStayDuration: { type: Number } // minutes
    }],
    averageSpeed: { type: Number, default: 5 }, // km/h
    maxSpeed: { type: Number, default: 50 },
    mobilityType: { 
      type: String, 
      enum: ['STATIONARY', 'WALKING', 'CYCLING', 'VEHICLE', 'PUBLIC_TRANSPORT', 'MIXED'],
      default: 'WALKING'
    },
    predictedNextLocation: {
      coordinates: { type: [Number] },
      confidence: { type: Number, min: 0, max: 1 },
      estimatedArrival: { type: Date },
      calculatedAt: { type: Date }
    },
    routeHistory: [{
      startLocation: { type: [Number] },
      endLocation: { type: [Number] },
      duration: { type: Number }, // minutes
      distance: { type: Number }, // meters
      timestamp: { type: Date }
    }]
  }
}, { 
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Geospatial indexes for proximity queries - CRITICAL for location-based routing
gatewaySchema.index({ location: '2dsphere' });
gatewaySchema.index({ 'lastKnownLocation.coordinates': '2dsphere' });
gatewaySchema.index({ 'locationHistory.coordinates': '2dsphere' });
gatewaySchema.index({ 'movementPattern.commonLocations.coordinates': '2dsphere' });

// Compound indexes for efficient queries
gatewaySchema.index({ 
  internetConnected: 1, 
  isActive: 1, 
  lastSeen: -1 
});
gatewaySchema.index({ 
  'meshCapabilities.isScanning': 1, 
  isActive: 1,
  'forwardingPreferences.allowsMessageForwarding': 1
});
gatewaySchema.index({ 
  'forwardingPreferences.currentDailyForwards': 1,
  'forwardingPreferences.maxDailyForwards': 1
});
gatewaySchema.index({ deviceId: 1, isActive: 1 });
gatewaySchema.index({ lastSeen: 1 }, { expireAfterSeconds: 7 * 24 * 3600 }); // Cleanup after 7 days

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
 * Update location with comprehensive tracking
 */
gatewaySchema.methods.updateLocation = function(coordinates, accuracy, speed, heading, source = 'GPS') {
  // Validate coordinates
  if (!coordinates || coordinates.length !== 2) {
    throw new Error('Invalid coordinates format');
  }
  
  const [longitude, latitude] = coordinates.map(coord => parseFloat(coord));
  
  // Validate coordinate ranges
  if (longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('Coordinates out of valid range');
  }
  
  // Update MAIN location field (critical for geospatial queries)
  this.location = {
    type: 'Point',
    coordinates: [longitude, latitude]
  };
  
  // Update last known location
  this.lastKnownLocation = {
    coordinates: [longitude, latitude],
    timestamp: new Date(),
    accuracy: accuracy || 10,
    confidence: this.calculateLocationConfidence(accuracy, source)
  };
  
  // Add to location history
  this.locationHistory.push({
    coordinates: [longitude, latitude],
    timestamp: new Date(),
    accuracy: accuracy || 10,
    speed: speed || 0,
    heading: heading || 0,
    source
  });
  
  // Keep only last 100 location points for performance
  if (this.locationHistory.length > 100) {
    this.locationHistory = this.locationHistory.slice(-100);
  }
  
  // Update movement pattern
  this.updateMovementPattern([longitude, latitude], speed);
  
  return this.save();
};

/**
 * Calculate location confidence based on accuracy and source
 */
gatewaySchema.methods.calculateLocationConfidence = function(accuracy, source) {
  let confidence = 1.0;
  
  // Reduce confidence based on accuracy
  if (accuracy > 50) confidence -= 0.3;
  else if (accuracy > 20) confidence -= 0.1;
  
  // Adjust based on source reliability
  switch (source) {
    case 'GPS': confidence *= 1.0; break;
    case 'FUSED': confidence *= 0.95; break;
    case 'NETWORK': confidence *= 0.7; break;
    case 'PASSIVE': confidence *= 0.5; break;
  }
  
  return Math.max(0.1, Math.min(1.0, confidence));
};

/**
 * Update movement patterns and predict next location
 */
gatewaySchema.methods.updateMovementPattern = function(newCoordinates, speed) {
  // Update average speed
  if (speed && speed > 0) {
    const currentAvg = this.movementPattern.averageSpeed || 5;
    this.movementPattern.averageSpeed = (currentAvg * 0.9) + (speed * 0.1);
    this.movementPattern.maxSpeed = Math.max(this.movementPattern.maxSpeed || 0, speed);
  }
  
  // Determine mobility type based on speed patterns
  const avgSpeed = this.movementPattern.averageSpeed;
  if (avgSpeed < 2) this.movementPattern.mobilityType = 'STATIONARY';
  else if (avgSpeed < 8) this.movementPattern.mobilityType = 'WALKING';
  else if (avgSpeed < 25) this.movementPattern.mobilityType = 'CYCLING';
  else if (avgSpeed < 80) this.movementPattern.mobilityType = 'VEHICLE';
  else this.movementPattern.mobilityType = 'PUBLIC_TRANSPORT';
  
  // Update common locations if stationary long enough
  this.updateCommonLocations(newCoordinates);
};

/**
 * Update common locations based on stay patterns
 */
gatewaySchema.methods.updateCommonLocations = function(coordinates) {
  const LOCATION_THRESHOLD = 100; // meters
  
  // Check if current location matches any common location
  const existingLocation = this.movementPattern.commonLocations.find(loc => {
    const distance = this.calculateDistance(coordinates, loc.coordinates);
    return distance <= LOCATION_THRESHOLD;
  });
  
  if (existingLocation) {
    existingLocation.frequency += 1;
    existingLocation.avgStayDuration = (existingLocation.avgStayDuration || 0) * 0.9 + 30 * 0.1; // minutes
  } else if (this.movementPattern.commonLocations.length < 10) {
    // Add new common location
    this.movementPattern.commonLocations.push({
      coordinates,
      frequency: 1,
      radius: LOCATION_THRESHOLD,
      timePatterns: [this.getCurrentTimePattern()],
      avgStayDuration: 30
    });
  }
};

/**
 * Get current time pattern (morning, afternoon, evening, night)
 */
gatewaySchema.methods.getCurrentTimePattern = function() {
  const hour = new Date().getHours();
  if (hour >= 6 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
};

/**
 * Predict next location based on movement history
 */
gatewaySchema.methods.predictNextLocation = function(timeHorizonMinutes = 30) {
  if (this.locationHistory.length < 3) {
    return {
      coordinates: this.location.coordinates,
      confidence: 0.1,
      estimatedArrival: new Date(Date.now() + timeHorizonMinutes * 60 * 1000),
      calculatedAt: new Date()
    };
  }
  
  // Simple linear prediction based on recent movement vector
  const recent = this.locationHistory.slice(-3);
  const timeDiff = recent[2].timestamp - recent[0].timestamp; // milliseconds
  const coordDiff = [
    recent[2].coordinates[0] - recent[0].coordinates[0],
    recent[2].coordinates[1] - recent[0].coordinates[1]
  ];
  
  // Project forward
  const projectionRatio = (timeHorizonMinutes * 60 * 1000) / timeDiff;
  const predictedCoords = [
    recent[2].coordinates[0] + (coordDiff[0] * projectionRatio),
    recent[2].coordinates[1] + (coordDiff[1] * projectionRatio)
  ];
  
  // Calculate confidence based on movement consistency
  const avgSpeed = this.movementPattern.averageSpeed || 5;
  const confidence = Math.max(0.1, Math.min(0.9, 0.8 - (avgSpeed / 100)));
  
  this.movementPattern.predictedNextLocation = {
    coordinates: predictedCoords,
    confidence,
    estimatedArrival: new Date(Date.now() + timeHorizonMinutes * 60 * 1000),
    calculatedAt: new Date()
  };
  
  return this.movementPattern.predictedNextLocation;
};

/**
 * Calculate distance between two coordinate points (Haversine formula)
 */
gatewaySchema.methods.calculateDistance = function(coords1, coords2) {
  const R = 6371e3; // Earth's radius in meters
  const φ1 = coords1[1] * Math.PI / 180;
  const φ2 = coords2[1] * Math.PI / 180;
  const Δφ = (coords2[1] - coords1[1]) * Math.PI / 180;
  const Δλ = (coords2[0] - coords1[0]) * Math.PI / 180;

  const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ/2) * Math.sin(Δλ/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

  return R * c; // Distance in meters
};

/**
 * Check if device can accept forwarding request
 */
gatewaySchema.methods.canAcceptForwarding = function(priority = 'NORMAL') {
  // Check basic eligibility
  if (!this.forwardingPreferences.allowsMessageForwarding || !this.isActive) {
    return false;
  }
  
  // Check battery level
  const batteryLevel = this.meshCapabilities.batteryLevel || 0;
  if (batteryLevel < 20 && priority !== 'EMERGENCY') return false;
  if (batteryLevel < 10) return false;
  
  // Check forwarding limits
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
      // Calculate rolling average
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
 * Reset daily forwarding counters (called by cron job)
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
 * Reset hourly forwarding counters (called by cron job)
 */
gatewaySchema.statics.resetHourlyCounters = function() {
  return this.updateMany(
    {},
    {
      $set: {
        'forwardingPreferences.currentHourlyForwards': 0,
        'forwardingPreferences.lastHourlyReset': new Date()
      }
    }
  );
};

/**
 * Find optimal mesh nodes near target location
 */
gatewaySchema.statics.findNearbyMeshNodes = function(targetLocation, maxDistance = 5000, options = {}) {
  const query = {
    isActive: true,
    'meshCapabilities.isScanning': true,
    'forwardingPreferences.allowsMessageForwarding': true,
    location: {
      $near: {
        $geometry: targetLocation,
        $maxDistance: maxDistance
      }
    }
  };
  
  // Add additional filters
  if (options.minBatteryLevel) {
    query['meshCapabilities.batteryLevel'] = { $gte: options.minBatteryLevel };
  }
  
  if (options.requireInternet) {
    query.internetConnected = true;
  }
  
  if (options.maxForwardingLoad) {
    query['$expr'] = {
      $lt: [
        '$forwardingPreferences.currentDailyForwards',
        { $multiply: ['$forwardingPreferences.maxDailyForwards', options.maxForwardingLoad] }
      ]
    };
  }
  
  return this.find(query)
    .limit(options.limit || 10)
    .select(options.select || 'deviceId deviceName location meshCapabilities networkStats forwardingPreferences');
};

/**
 * Cleanup inactive gateways
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
