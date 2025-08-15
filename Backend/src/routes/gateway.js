import express from 'express';
import { body, query, validationResult } from 'express-validator';
import Gateway from '../models/Gateway.js';
import authMiddleware from '../middleware/auth.js';
import winston from 'winston';

const router = express.Router();

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/gateway.log' })
  ]
});

// Update gateway status (privacy-safe, no location storage)
router.post('/update-status', authMiddleware, [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('internetConnected').isBoolean().withMessage('Internet connected must be boolean'),
  body('batteryLevel').optional().isFloat({ min: 0, max: 100 }).withMessage('Battery level must be 0-100'),
  body('nearbyNodes').optional().isArray().withMessage('Nearby nodes must be an array'),
  body('meshCapabilities').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      deviceId, 
      internetConnected, 
      batteryLevel,
      scanMode,
      isScanning,
      nearbyNodes = [],
      meshCapabilities = {}
    } = req.body;

    let gateway = await Gateway.findOne({ deviceId });
    
    if (!gateway) {
      return res.status(404).json({ msg: 'Gateway not found. Please register device first.' });
    }

    // Update basic status
    gateway.internetConnected = internetConnected;
    gateway.lastSeen = new Date();
    gateway.isActive = true;

    // Update mesh capabilities
    if (batteryLevel !== undefined) {
      gateway.meshCapabilities.batteryLevel = Math.max(0, Math.min(100, parseFloat(batteryLevel)));
    }
    
    if (scanMode && ['LOW_POWER', 'BALANCED', 'HIGH_PERFORMANCE', 'OPPORTUNISTIC'].includes(scanMode)) {
      gateway.meshCapabilities.scanMode = scanMode;
    }
    
    if (isScanning !== undefined) {
      gateway.meshCapabilities.isScanning = Boolean(isScanning);
      gateway.meshCapabilities.lastScanTimestamp = new Date();
    }

    // Update nearby nodes from BLE discovery (privacy-safe)
    if (nearbyNodes.length > 0) {
      await gateway.updateNearbyNodes(nearbyNodes);
    }

    await gateway.save();

    res.json({ 
      success: true, 
      gateway: {
        deviceId: gateway.deviceId,
        internetConnected: gateway.internetConnected,
        batteryLevel: gateway.meshCapabilities.batteryLevel,
        batteryStatus: gateway.batteryStatus,
        isScanning: gateway.meshCapabilities.isScanning,
        scanMode: gateway.meshCapabilities.scanMode,
        nearbyNodesCount: gateway.getNearbyNodes().length,
        connectionReliability: gateway.connectionReliability,
        forwardingCapacity: gateway.forwardingCapacity,
        lastSeen: gateway.lastSeen
      }
    });
  } catch (err) {
    logger.error('Gateway status update error:', err);
    res.status(500).json({ msg: `Server error: ${err.message}` });
  }
});

// Get network status (no location data)
router.get('/network-status', authMiddleware, async (req, res) => {
  try {
    const networkStats = await Gateway.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalGateways: { $sum: 1 },
          onlineGateways: { $sum: { $cond: ['$internetConnected', 1, 0] } },
          scanningNodes: { $sum: { $cond: ['$meshCapabilities.isScanning', 1, 0] } },
          avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
          totalMessagesForwarded: { $sum: '$networkStats.messagesForwarded' },
          totalForwardingCapacity: { 
            $sum: { 
              $subtract: ['$forwardingPreferences.maxDailyForwards', '$forwardingPreferences.currentDailyForwards'] 
            } 
          }
        }
      }
    ]);

    // Get battery distribution
    const batteryStats = await Gateway.aggregate([
      { $match: { isActive: true } },
      {
        $bucket: {
          groupBy: '$meshCapabilities.batteryLevel',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'unknown',
          output: { count: { $sum: 1 } }
        }
      }
    ]);

    res.json({
      networkStats: networkStats[0] || {
        totalGateways: 0,
        onlineGateways: 0,
        scanningNodes: 0,
        avgBatteryLevel: 0,
        totalMessagesForwarded: 0,
        totalForwardingCapacity: 0
      },
      batteryDistribution: batteryStats,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Network status error:', err);
    res.status(500).json({ msg: `Network status error: ${err.message}` });
  }
});

// Find available forwarders (based on BLE discovery, not location)
router.post('/find-forwarders', authMiddleware, [
  body('excludeDevices').optional().isArray(),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      excludeDevices = [],
      priority = 'NORMAL',
      requireInternet = false,
      minBatteryLevel,
      maxNodes = 10
    } = req.body;

    const options = {
      requireInternet,
      minBatteryLevel: minBatteryLevel || (priority === 'EMERGENCY' ? 10 : 20),
      priority,
      limit: maxNodes
    };

    const forwarders = await Gateway.findAvailableForwarders(excludeDevices, options);

    const enhancedForwarders = forwarders.map(node => ({
      deviceId: node.deviceId,
      deviceName: node.deviceName,
      batteryLevel: node.meshCapabilities?.batteryLevel,
      batteryStatus: node.batteryStatus,
      reliability: node.connectionReliability,
      forwardingCapacity: node.forwardingCapacity,
      isScanning: node.meshCapabilities?.isScanning,
      scanMode: node.meshCapabilities?.scanMode,
      internetConnected: node.internetConnected,
      lastSeen: node.lastSeen,
      nearbyNodesCount: node.getNearbyNodes().length
    }));

    res.json({
      availableForwarders: enhancedForwarders.length,
      forwarders: enhancedForwarders,
      searchParams: {
        priority,
        requireInternet,
        minBatteryLevel: options.minBatteryLevel
      },
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Find forwarders error:', err);
    res.status(500).json({ msg: `Find forwarders error: ${err.message}` });
  }
});

// Admin routes
router.post('/admin/reset-daily-counters', authMiddleware, async (req, res) => {
  try {
    const result = await Gateway.resetDailyCounters();
    res.json({
      success: true,
      message: 'Daily counters reset successfully',
      updatedNodes: result.modifiedCount
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

export default router;
