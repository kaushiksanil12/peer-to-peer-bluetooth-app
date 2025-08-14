const mongoose = require('mongoose');

const gatewaySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  deviceName: { type: String, required: true },
  isGateway: { type: Boolean, default: false },
  internetConnected: { type: Boolean, default: false },
  
  // Enhanced location tracking for proximity routing
  location: { 
    type: { type: String, enum: ['Point'], default: 'Point' }, 
    coordinates: { type: [Number], default: [0, 0] } // [longitude, latitude]
  },
  
  // Movement tracking for mobile recipients
  locationHistory: [{
    coordinates: [Number],
    timestamp: { type: Date, default: Date.now },
    accuracy: Number, // GPS accuracy in meters
    speed: Number,    // km/h
    heading: Number   // degrees
  }],
  
  lastKnownLocation: {
    coordinates: [Number],
    timestamp: Date,
    accuracy: Number
  },
  
  // Mesh networking capabilities
  meshCapabilities: {
    maxRange: { type: Number, default: 100 }, // BLE range in meters
    batteryLevel: Number,
    isScanning: { type: Boolean, default: false },
    scanMode: { 
      type: String, 
      enum: ['LOW_POWER', 'BALANCED', 'HIGH_PERFORMANCE'],
      default: 'BALANCED'
    },
    lastScanTimestamp: Date
  },
  
  // Message forwarding preferences
  forwardingPreferences: {
    allowsMessageForwarding: { type: Boolean, default: true },
    maxForwardingDistance: { type: Number, default: 5000 }, // meters
    maxDailyForwards: { type: Number, default: 50 },
    currentDailyForwards: { type: Number, default: 0 },
    lastForwardReset: { type: Date, default: Date.now }
  },
  
  // Network statistics
  networkStats: {
    messagesForwarded: { type: Number, default: 0 },
    messagesReceived: { type: Number, default: 0 },
    connectionSuccess: { type: Number, default: 0 },
    connectionAttempts: { type: Number, default: 0 },
    averageConnectionTime: { type: Number, default: 0 }
  },
  
  lastSeen: { type: Date, default: Date.now },
  isActive: { type: Boolean, default: true },
  
  // Movement prediction data
  movementPattern: {
    commonLocations: [{
      name: String,
      coordinates: [Number],
      frequency: Number,
      timePatterns: [String] // e.g., ["morning", "evening"]
    }],
    averageSpeed: Number,
    mobilityType: { 
      type: String, 
      enum: ['STATIONARY', 'WALKING', 'CYCLING', 'VEHICLE', 'PUBLIC_TRANSPORT'],
      default: 'WALKING'
    }
  }
}, { timestamps: true });

// Geospatial indexing for proximity queries
gatewaySchema.index({ location: '2dsphere' });
gatewaySchema.index({ 'lastKnownLocation.coordinates': '2dsphere' });
gatewaySchema.index({ 'locationHistory.coordinates': '2dsphere' });

// Compound indexes for efficient queries
gatewaySchema.index({ internetConnected: 1, isActive: 1, lastSeen: -1 });
gatewaySchema.index({ 'meshCapabilities.isScanning': 1, isActive: 1 });

// Methods for location and movement
gatewaySchema.methods.updateLocation = function(coordinates, accuracy, speed, heading) {
  this.lastKnownLocation = {
    coordinates,
    timestamp: new Date(),
    accuracy
  };
  
  this.locationHistory.push({
    coordinates,
    timestamp: new Date(),
    accuracy,
    speed,
    heading
  });
  
  // Keep only last 50 location points
  if (this.locationHistory.length > 50) {
    this.locationHistory = this.locationHistory.slice(-50);
  }
  
  return this.save();
};

gatewaySchema.methods.predictNextLocation = function() {
  if (this.locationHistory.length < 2) return null;
  
  const recent = this.locationHistory.slice(-3);
  // Simple linear prediction based on recent movement
  // In production, use more sophisticated prediction algorithms
  
  return {
    coordinates: recent[recent.length - 1].coordinates,
    confidence: 0.7
  };
};

module.exports = mongoose.model('Gateway', gatewaySchema);
