const express = require('express');
const { body, validationResult } = require('express-validator');
const Gateway = require('../models/Gateway');
const GatewayService = require('../services/GatewayService');

const router = express.Router();

// Update gateway status with location
router.post('/update-status', [
  body('deviceId').notEmpty(),
  body('internetConnected').isBoolean(),
  body('location').optional().isObject(),
  body('batteryLevel').optional().isNumeric()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      deviceId, 
      internetConnected, 
      location, 
      batteryLevel,
      scanMode,
      isScanning 
    } = req.body;

    let gateway = await Gateway.findOne({ deviceId });
    
    if (!gateway) {
      return res.status(404).json({ msg: 'Gateway not found' });
    }

    // Update basic status
    gateway.internetConnected = internetConnected;
    gateway.lastSeen = new Date();
    gateway.isActive = true;

    // Update location if provided
    if (location && location.coordinates) {
      await gateway.updateLocation(
        location.coordinates,
        location.accuracy,
        location.speed,
        location.heading
      );
    }

    // Update mesh capabilities
    if (batteryLevel !== undefined) {
      gateway.meshCapabilities.batteryLevel = batteryLevel;
    }
    if (scanMode) {
      gateway.meshCapabilities.scanMode = scanMode;
    }
    if (isScanning !== undefined) {
      gateway.meshCapabilities.isScanning = isScanning;
      gateway.meshCapabilities.lastScanTimestamp = new Date();
    }

    await gateway.save();

    res.json({ 
      success: true, 
      gateway: {
        deviceId: gateway.deviceId,
        internetConnected: gateway.internetConnected,
        location: gateway.location,
        batteryLevel: gateway.meshCapabilities.batteryLevel
      }
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get network status with proximity information
router.get('/network-status', async (req, res) => {
  try {
    const { lat, lng, radius = 5000 } = req.query;

    let query = { internetConnected: true, isActive: true };

    // Add location filter if coordinates provided
    if (lat && lng) {
      query.location = {
        $near: {
          $geometry: {
            type: 'Point',
            coordinates: [parseFloat(lng), parseFloat(lat)]
          },
          $maxDistance: parseInt(radius)
        }
      };
    }

    const activeGateways = await Gateway.find(query).select(
      'deviceId deviceName location meshCapabilities.batteryLevel networkStats'
    );

    const totalStats = await Gateway.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalGateways: { $sum: 1 },
          onlineGateways: {
            $sum: { $cond: ['$internetConnected', 1, 0] }
          },
          scanningNodes: {
            $sum: { $cond: ['$meshCapabilities.isScanning', 1, 0] }
          },
          avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
          totalMessagesForwarded: { $sum: '$networkStats.messagesForwarded' }
        }
      }
    ]);

    res.json({
      nearbyGateways: activeGateways,
      networkStats: totalStats[0] || {
        totalGateways: 0,
        onlineGateways: 0,
        scanningNodes: 0,
        avgBatteryLevel: 0,
        totalMessagesForwarded: 0
      }
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Find optimal mesh nodes for message routing
router.post('/find-mesh-nodes', [
  body('recipientId').notEmpty(),
  body('maxDistance').optional().isNumeric()
], async (req, res) => {
  try {
    const { recipientId, maxDistance = 5000 } = req.body;

    const recipient = await Gateway.findOne({ deviceId: recipientId });
    
    if (!recipient) {
      return res.status(404).json({ msg: 'Recipient not found' });
    }

    const meshNodes = await GatewayService.findOptimalMeshNodes(
      recipient.lastKnownLocation || recipient.location,
      maxDistance
    );

    res.json({
      recipientId,
      recipientLocation: recipient.lastKnownLocation || recipient.location,
      availableMeshNodes: meshNodes.length,
      meshNodes: meshNodes.map(node => ({
        deviceId: node.deviceId,
        deviceName: node.deviceName,
        distance: node.calculatedDistance,
        batteryLevel: node.meshCapabilities.batteryLevel,
        reliability: node.reliabilityScore,
        forwardingCapacity: node.forwardingCapacity
      }))
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Reset daily forwarding counters (run via cron)
router.post('/reset-daily-counters', async (req, res) => {
  try {
    const result = await Gateway.updateMany(
      {},
      {
        $set: {
          'forwardingPreferences.currentDailyForwards': 0,
          'forwardingPreferences.lastForwardReset': new Date()
        }
      }
    );

    res.json({
      success: true,
      message: 'Daily counters reset',
      updatedNodes: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
