const mongoose = require('mongoose');

const gatewaySchema = new mongoose.Schema({
  deviceId: { type: String, required: true, unique: true },
  deviceName: { type: String, required: true },
  isGateway: { type: Boolean, default: false },
  internetConnected: { type: Boolean, default: false },
  location: { 
    type: { 
      type: String, 
      enum: ['Point'], 
      default: 'Point' 
    }, 
    coordinates: { 
      type: [Number], 
      default: [0, 0]  // Add this default to fix the error
    } 
  },
  lastSeen: { type: Date, default: Date.now }
});

gatewaySchema.index({ location: '2dsphere' });

module.exports = mongoose.model('Gateway', gatewaySchema);
