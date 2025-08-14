const express = require('express');
const { body, query, validationResult } = require('express-validator');
const Gateway = require('../models/Gateway');
const GatewayService = require('../services/GatewayService');
const authMiddleware = require('../middleware/auth');
const winston = require('winston');
const geolib = require('geolib'); // ✅ ADD THIS IMPORT

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

// Validation middleware for coordinates
const validateCoordinates = (coordinates) => {
  if (!Array.isArray(coordinates) || coordinates.length !== 2) {
    return false;
  }
  const [lng, lat] = coordinates.map(coord => parseFloat(coord));
  return lng >= -180 && lng <= 180 && lat >= -90 && lat <= 90;
};

// Update gateway status with comprehensive location tracking
router.post('/update-status', authMiddleware, [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('internetConnected').isBoolean().withMessage('Internet connected must be boolean'),
  body('location.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Location coordinates must be [longitude, latitude]'),
  body('location.coordinates.*').optional().isFloat().withMessage('Coordinates must be valid numbers'),
  body('batteryLevel').optional().isFloat({ min: 0, max: 100 }).withMessage('Battery level must be 0-100'),
  body('meshCapabilities').optional().isObject(),
  body('deviceHealth').optional().isObject()
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
      isScanning,
      meshCapabilities = {},
      deviceHealth = {},
      forwardingPreferences = {}
    } = req.body;

    let gateway = await Gateway.findOne({ deviceId });
    
    if (!gateway) {
      return res.status(404).json({ msg: 'Gateway not found. Please register device first.' });
    }

    // Update basic status
    gateway.internetConnected = internetConnected;
    gateway.lastSeen = new Date();
    gateway.isActive = true;

    // Update location with proper coordinate storage
    if (location && location.coordinates && Array.isArray(location.coordinates)) {
      if (!validateCoordinates(location.coordinates)) {
        return res.status(400).json({ msg: 'Invalid coordinate range. Longitude must be -180 to 180, latitude must be -90 to 90.' });
      }

      const [longitude, latitude] = location.coordinates.map(coord => parseFloat(coord));
      
      // Update MAIN location field (critical for geospatial queries)
      gateway.location = {
        type: 'Point',
        coordinates: [longitude, latitude]
      };
      
      // Update comprehensive location tracking using model method
      try {
        await gateway.updateLocation(
          [longitude, latitude],
          location.accuracy || 10,
          location.speed || 0,
          location.heading || 0,
          location.source || 'GPS'
        );
        
        logger.info(`Location updated for ${deviceId}`, {
          deviceId,
          coordinates: [longitude, latitude],
          accuracy: location.accuracy
        });
      } catch (locationError) {
        logger.error(`Location update error for ${deviceId}:`, locationError);
        return res.status(400).json({ msg: `Location update failed: ${locationError.message}` });
      }
    }

    // Update mesh capabilities with validation
    if (batteryLevel !== undefined) {
      const validBattery = Math.max(0, Math.min(100, parseFloat(batteryLevel)));
      gateway.meshCapabilities.batteryLevel = validBattery;
    }
    
    if (scanMode && ['LOW_POWER', 'BALANCED', 'HIGH_PERFORMANCE', 'OPPORTUNISTIC'].includes(scanMode)) {
      gateway.meshCapabilities.scanMode = scanMode;
    }
    
    if (isScanning !== undefined) {
      gateway.meshCapabilities.isScanning = Boolean(isScanning);
      gateway.meshCapabilities.lastScanTimestamp = new Date();
    }
    
    // Update additional mesh capabilities
    Object.keys(meshCapabilities).forEach(key => {
      if (gateway.meshCapabilities[key] !== undefined) {
        gateway.meshCapabilities[key] = meshCapabilities[key];
      }
    });

    // Update device health metrics
    Object.keys(deviceHealth).forEach(key => {
      if (gateway.deviceHealth[key] !== undefined) {
        gateway.deviceHealth[key] = deviceHealth[key];
      }
    });
    gateway.deviceHealth.lastHealthCheck = new Date();

    // Update forwarding preferences
    Object.keys(forwardingPreferences).forEach(key => {
      if (gateway.forwardingPreferences[key] !== undefined) {
        gateway.forwardingPreferences[key] = forwardingPreferences[key];
      }
    });

    await gateway.save();

    res.json({ 
      success: true, 
      gateway: {
        deviceId: gateway.deviceId,
        internetConnected: gateway.internetConnected,
        location: gateway.location,
        lastKnownLocation: gateway.lastKnownLocation,
        batteryLevel: gateway.meshCapabilities.batteryLevel,
        batteryStatus: gateway.batteryStatus,
        isScanning: gateway.meshCapabilities.isScanning,
        scanMode: gateway.meshCapabilities.scanMode,
        connectionReliability: gateway.connectionReliability,
        forwardingCapacity: gateway.forwardingCapacity,
        mobilityType: gateway.movementPattern.mobilityType,
        lastSeen: gateway.lastSeen
      },
      debug: {
        coordinatesStored: gateway.location.coordinates,
        locationHistoryCount: gateway.locationHistory.length
      }
    });
  } catch (err) {
    logger.error('Gateway status update error:', err);
    res.status(500).json({ msg: `Server error: ${err.message}` });
  }
});

// Get network status with proximity information
router.get('/network-status', authMiddleware, [
  query('lat').optional().isFloat({ min: -90, max: 90 }).withMessage('Latitude must be between -90 and 90'),
  query('lng').optional().isFloat({ min: -180, max: 180 }).withMessage('Longitude must be between -180 and 180'),
  query('radius').optional().isInt({ min: 100, max: 50000 }).withMessage('Radius must be between 100 and 50000 meters'),
  query('minBatteryLevel').optional().isInt({ min: 0, max: 100 }),
  query('requireInternet').optional().isBoolean(),
  query('mobilityType').optional().isIn(['STATIONARY', 'WALKING', 'CYCLING', 'VEHICLE', 'PUBLIC_TRANSPORT', 'MIXED'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      lat, 
      lng, 
      radius = 5000, 
      minBatteryLevel = 0,
      requireInternet,
      mobilityType,
      limit = 50,
      includeInactive = false 
    } = req.query;

    let nearbyGateways = [];

    // Get nearby gateways if location provided
    if (lat && lng) {
      const targetLocation = {
        type: 'Point',
        coordinates: [parseFloat(lng), parseFloat(lat)]
      };

      const options = {
        minBatteryLevel: parseInt(minBatteryLevel),
        requireInternet: requireInternet === 'true',
        mobilityPreference: mobilityType,
        limit: parseInt(limit)
      };

      try {
        nearbyGateways = await Gateway.findNearbyMeshNodes(targetLocation, parseInt(radius), options);
        
        // ✅ FIXED: Add distance calculations using geolib directly
        nearbyGateways = nearbyGateways.map(gateway => {
          const distance = geolib.getDistance(
            { latitude: targetLocation.coordinates[1], longitude: targetLocation.coordinates[0] },
            { latitude: gateway.location.coordinates[1], longitude: gateway.location.coordinates[0] }
          );
          
          return {
            ...gateway.toObject(),
            calculatedDistance: distance
          };
        });
        
      } catch (geoError) {
        logger.error('Geospatial query error:', geoError);
        // Continue with empty array if geospatial query fails
      }
    }

    // Get comprehensive network statistics
    const baseMatch = includeInactive === 'true' ? {} : { isActive: true };
    
    const networkStats = await Gateway.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalGateways: { $sum: 1 },
          activeGateways: { $sum: { $cond: ['$isActive', 1, 0] } },
          onlineGateways: { $sum: { $cond: [{ $and: ['$internetConnected', '$isActive'] }, 1, 0] } },
          scanningNodes: { $sum: { $cond: [{ $and: ['$meshCapabilities.isScanning', '$isActive'] }, 1, 0] } },
          gatewayNodes: { $sum: { $cond: [{ $and: ['$isGateway', '$isActive'] }, 1, 0] } },
          avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
          totalMessagesForwarded: { $sum: '$networkStats.messagesForwarded' },
          totalMessagesReceived: { $sum: '$networkStats.messagesReceived' },
          totalConnectionAttempts: { $sum: '$networkStats.connectionAttempts' },
          totalConnectionSuccess: { $sum: '$networkStats.connectionSuccess' },
          totalForwardingCapacity: { 
            $sum: { 
              $subtract: ['$forwardingPreferences.maxDailyForwards', '$forwardingPreferences.currentDailyForwards'] 
            } 
          },
          avgConnectionReliability: {
            $avg: {
              $cond: [
                { $gt: ['$networkStats.connectionAttempts', 0] },
                { $divide: ['$networkStats.connectionSuccess', '$networkStats.connectionAttempts'] },
                0
              ]
            }
          }
        }
      }
    ]);

    // Get mobility distribution
    const mobilityStats = await Gateway.aggregate([
      { $match: { ...baseMatch, 'movementPattern.mobilityType': { $exists: true } } },
      {
        $group: {
          _id: '$movementPattern.mobilityType',
          count: { $sum: 1 },
          avgSpeed: { $avg: '$movementPattern.averageSpeed' },
          avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' }
        }
      }
    ]);

    // Get battery distribution
    const batteryStats = await Gateway.aggregate([
      { $match: { ...baseMatch, 'meshCapabilities.batteryLevel': { $exists: true } } },
      {
        $bucket: {
          groupBy: '$meshCapabilities.batteryLevel',
          boundaries: [0, 20, 40, 60, 80, 100],
          default: 'unknown',
          output: { 
            count: { $sum: 1 },
            avgForwardingCapacity: { 
              $avg: { 
                $subtract: ['$forwardingPreferences.maxDailyForwards', '$forwardingPreferences.currentDailyForwards'] 
              } 
            }
          }
        }
      }
    ]);

    // Get scan mode distribution
    const scanModeStats = await Gateway.aggregate([
      { $match: { ...baseMatch, 'meshCapabilities.scanMode': { $exists: true } } },
      {
        $group: {
          _id: '$meshCapabilities.scanMode',
          count: { $sum: 1 },
          avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' }
        }
      }
    ]);

    res.json({
      nearbyGateways,
      networkStats: networkStats[0] || {
        totalGateways: 0,
        activeGateways: 0,
        onlineGateways: 0,
        scanningNodes: 0,
        gatewayNodes: 0,
        avgBatteryLevel: 0,
        totalMessagesForwarded: 0,
        totalMessagesReceived: 0,
        totalConnectionAttempts: 0,
        totalConnectionSuccess: 0,
        totalForwardingCapacity: 0,
        avgConnectionReliability: 0
      },
      distributionStats: {
        mobility: mobilityStats,
        battery: batteryStats,
        scanMode: scanModeStats
      },
      queryParams: {
        location: lat && lng ? [parseFloat(lng), parseFloat(lat)] : null,
        radius: parseInt(radius),
        filters: {
          minBatteryLevel: parseInt(minBatteryLevel),
          requireInternet: requireInternet === 'true',
          mobilityType,
          includeInactive: includeInactive === 'true'
        },
        resultCount: nearbyGateways.length
      },
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Network status error:', err);
    res.status(500).json({ msg: `Network status error: ${err.message}` });
  }
});

// ✅ FIXED: Find optimal mesh nodes with corrected distance calculation
router.post('/find-mesh-nodes', authMiddleware, [
  body('recipientId').optional().notEmpty().withMessage('Recipient ID cannot be empty'),
  body('targetLocation.coordinates').optional().isArray({ min: 2, max: 2 }).withMessage('Target location must have [longitude, latitude]'),
  body('maxDistance').optional().isInt({ min: 100, max: 50000 }).withMessage('Max distance must be 100-50000 meters'),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { 
      recipientId, 
      targetLocation,
      maxDistance = 5000, 
      priority = 'NORMAL',
      requireInternet = true,
      minBatteryLevel,
      mobilityPreference,
      maxNodes = 10
    } = req.body;

    let searchLocation;
    let recipientInfo = null;

    // Get target location from recipient or use provided location
    if (recipientId) {
      const recipient = await Gateway.findOne({ deviceId: recipientId });
      if (!recipient) {
        return res.status(404).json({ msg: 'Recipient not found' });
      }
      
      recipientInfo = {
        deviceId: recipient.deviceId,
        deviceName: recipient.deviceName,
        isActive: recipient.isActive,
        internetConnected: recipient.internetConnected,
        lastSeen: recipient.lastSeen,
        mobilityType: recipient.movementPattern.mobilityType
      };
      
      // Use predicted location if available and confident, otherwise last known or current location
      if (recipient.movementPattern.predictedNextLocation && 
          recipient.movementPattern.predictedNextLocation.confidence > 0.5) {
        searchLocation = {
          type: 'Point',
          coordinates: recipient.movementPattern.predictedNextLocation.coordinates
        };
        recipientInfo.usingPredictedLocation = true;
        recipientInfo.predictionConfidence = recipient.movementPattern.predictedNextLocation.confidence;
      } else if (recipient.lastKnownLocation && recipient.lastKnownLocation.coordinates.length === 2) {
        searchLocation = { type: 'Point', coordinates: recipient.lastKnownLocation.coordinates };
        recipientInfo.usingLastKnownLocation = true;
      } else {
        searchLocation = recipient.location;
        recipientInfo.usingCurrentLocation = true;
      }
    } else if (targetLocation && validateCoordinates(targetLocation.coordinates)) {
      searchLocation = targetLocation;
    } else {
      return res.status(400).json({ msg: 'Either valid recipientId or targetLocation must be provided' });
    }

    // Validate search location
    if (!searchLocation || !searchLocation.coordinates || searchLocation.coordinates.length !== 2) {
      return res.status(400).json({ msg: 'Invalid search location coordinates' });
    }

    // Find optimal mesh nodes with advanced options
    const options = {
      requireInternet,
      minBatteryLevel: minBatteryLevel || (priority === 'EMERGENCY' ? 10 : 20),
      mobilityPreference,
      priority,
      limit: maxNodes
    };

    const meshNodes = await GatewayService.findOptimalMeshNodes(searchLocation, maxDistance, options);

    // ✅ FIXED: Enhanced node data with corrected distance calculations
    const enhancedNodes = meshNodes.map(node => {
      // Use geolib directly instead of calling GatewayService.calculateDistance
      const distance = geolib.getDistance(
        { latitude: searchLocation.coordinates[1], longitude: searchLocation.coordinates[0] },
        { latitude: node.location.coordinates[1], longitude: node.location.coordinates[0] }
      );
      
      // Calculate node score using a local function
      const calculateNodeScore = (node, distance) => {
        const distanceScore = Math.max(0, 100 - (distance / 50));
        const batteryScore = node.meshCapabilities?.batteryLevel || 50;
        const reliabilityScore = node.connectionReliability * 100;
        const forwardingCapacity = node.forwardingCapacity;

        return (distanceScore * 0.3) + 
               (batteryScore * 0.2) + 
               (reliabilityScore * 0.3) + 
               (Math.min(100, forwardingCapacity * 2) * 0.2);
      };
      
      return {
        deviceId: node.deviceId,
        deviceName: node.deviceName,
        location: node.location,
        distance,
        batteryLevel: node.meshCapabilities?.batteryLevel,
        batteryStatus: node.batteryStatus,
        reliability: node.connectionReliability,
        forwardingCapacity: node.forwardingCapacity,
        isScanning: node.meshCapabilities?.isScanning,
        scanMode: node.meshCapabilities?.scanMode,
        internetConnected: node.internetConnected,
        mobilityType: node.movementPattern?.mobilityType,
        lastSeen: node.lastSeen,
        score: calculateNodeScore(node, distance),
        canAcceptForwarding: node.canAcceptForwarding ? node.canAcceptForwarding(priority) : true,
        estimatedConnectionTime: node.networkStats?.averageConnectionTime || 2000,
        forwardingLoad: node.forwardingPreferences ? 
          (node.forwardingPreferences.currentDailyForwards / node.forwardingPreferences.maxDailyForwards) : 0
      };
    });

    // Sort by score (highest first)
    enhancedNodes.sort((a, b) => b.score - a.score);

    res.json({
      searchLocation,
      recipientInfo,
      availableMeshNodes: enhancedNodes.length,
      totalNodesInRange: meshNodes.length,
      meshNodes: enhancedNodes,
      searchParams: {
        maxDistance,
        priority,
        requireInternet,
        minBatteryLevel: options.minBatteryLevel,
        mobilityPreference
      },
      recommendations: {
        bestNode: enhancedNodes[0] || null,
        backupNodes: enhancedNodes.slice(1, 3),
        averageDistance: enhancedNodes.length > 0 ? 
          enhancedNodes.reduce((sum, node) => sum + node.distance, 0) / enhancedNodes.length : 0,
        averageBatteryLevel: enhancedNodes.length > 0 ?
          enhancedNodes.reduce((sum, node) => sum + (node.batteryLevel || 0), 0) / enhancedNodes.length : 0
      },
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Find mesh nodes error:', err);
    res.status(500).json({ msg: `Find mesh nodes error: ${err.message}` });
  }
});

// Get detailed gateway information with predictions
router.get('/details/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { includePredictions = true, includeHistory = true } = req.query;
    
    let selectFields = 'deviceId deviceName location meshCapabilities networkStats forwardingPreferences movementPattern lastSeen isActive internetConnected isGateway deviceHealth';
    
    if (includeHistory === 'true') {
      selectFields += ' locationHistory';
    }
    
    const gateway = await Gateway.findOne({ deviceId }).select(selectFields);
    
    if (!gateway) {
      return res.status(404).json({ msg: 'Gateway not found' });
    }

    let predictions = null;
    
    // Generate location prediction if requested and not recent
    if (includePredictions === 'true') {
      try {
        if (!gateway.movementPattern.predictedNextLocation || 
            new Date() - new Date(gateway.movementPattern.predictedNextLocation.calculatedAt) > 5 * 60 * 1000) {
          predictions = gateway.predictNextLocation(30);
          await gateway.save();
        } else {
          predictions = gateway.movementPattern.predictedNextLocation;
        }
      } catch (predictionError) {
        logger.warn(`Prediction error for ${deviceId}:`, predictionError);
        predictions = null;
      }
    }

    // Calculate nearby mesh nodes
    let nearbyNodes = [];
    try {
      if (gateway.location && gateway.location.coordinates) {
        nearbyNodes = await Gateway.findNearbyMeshNodes(gateway.location, 2000, { limit: 5 });
      }
    } catch (nearbyError) {
      logger.warn(`Nearby nodes error for ${deviceId}:`, nearbyError);
    }

    res.json({
      gateway: {
        ...gateway.toObject(),
        calculatedFields: {
          connectionReliability: gateway.connectionReliability,
          forwardingCapacity: gateway.forwardingCapacity,
          batteryStatus: gateway.batteryStatus
        }
      },
      predictions,
      nearbyNodes: nearbyNodes.map(node => ({
        deviceId: node.deviceId,
        deviceName: node.deviceName,
        distance: geolib.getDistance(
          { latitude: gateway.location.coordinates[1], longitude: gateway.location.coordinates[0] },
          { latitude: node.location.coordinates[1], longitude: node.location.coordinates[0] }
        ),
        batteryLevel: node.meshCapabilities?.batteryLevel,
        isScanning: node.meshCapabilities?.isScanning
      })),
      analytics: {
        locationHistoryCount: gateway.locationHistory ? gateway.locationHistory.length : 0,
        commonLocationsCount: gateway.movementPattern.commonLocations ? gateway.movementPattern.commonLocations.length : 0,
        uptimeHours: gateway.networkStats.totalUptime ? gateway.networkStats.totalUptime / 3600 : 0
      },
      lastUpdated: new Date()
    });
  } catch (err) {
    logger.error('Gateway details error:', err);
    res.status(500).json({ msg: `Gateway details error: ${err.message}` });
  }
});

// Update network statistics for a gateway
router.post('/update-stats/:deviceId', authMiddleware, [
  body('connectionSuccess').optional().isInt({ min: 0 }),
  body('connectionAttempts').optional().isInt({ min: 0 }),
  body('messagesForwarded').optional().isInt({ min: 0 }),
  body('messagesReceived').optional().isInt({ min: 0 }),
  body('messagesDelivered').optional().isInt({ min: 0 }),
  body('connectionTime').optional().isInt({ min: 0 }),
  body('dataTransferred').optional().isInt({ min: 0 })
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId } = req.params;
    const statsUpdate = req.body;

    const gateway = await Gateway.findOne({ deviceId });
    
    if (!gateway) {
      return res.status(404).json({ msg: 'Gateway not found' });
    }

    await gateway.updateStats(statsUpdate);

    // Update forwarding counters if messages were forwarded
    if (statsUpdate.messagesForwarded > 0) {
      gateway.forwardingPreferences.currentDailyForwards += statsUpdate.messagesForwarded;
      gateway.forwardingPreferences.currentHourlyForwards += statsUpdate.messagesForwarded;
      await gateway.save();
    }

    res.json({
      success: true,
      message: 'Statistics updated successfully',
      currentStats: gateway.networkStats,
      forwardingStatus: {
        dailyForwards: gateway.forwardingPreferences.currentDailyForwards,
        maxDailyForwards: gateway.forwardingPreferences.maxDailyForwards,
        remainingCapacity: gateway.forwardingCapacity
      }
    });
  } catch (err) {
    logger.error('Update stats error:', err);
    res.status(500).json({ msg: `Update stats error: ${err.message}` });
  }
});

// Admin routes for maintenance

// Reset daily forwarding counters (for cron job)
router.post('/admin/reset-daily-counters', authMiddleware, async (req, res) => {
  try {
    const result = await Gateway.resetDailyCounters();

    logger.info('Daily counters reset', { updatedNodes: result.modifiedCount });

    res.json({
      success: true,
      message: 'Daily forwarding counters reset successfully',
      updatedNodes: result.modifiedCount,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Reset daily counters error:', err);
    res.status(500).json({ msg: `Reset counters error: ${err.message}` });
  }
});

// Reset hourly forwarding counters (for cron job)
router.post('/admin/reset-hourly-counters', authMiddleware, async (req, res) => {
  try {
    const result = await Gateway.resetHourlyCounters();

    logger.info('Hourly counters reset', { updatedNodes: result.modifiedCount });

    res.json({
      success: true,
      message: 'Hourly forwarding counters reset successfully',
      updatedNodes: result.modifiedCount,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Reset hourly counters error:', err);
    res.status(500).json({ msg: `Reset hourly counters error: ${err.message}` });
  }
});

// Cleanup inactive gateways
router.post('/admin/cleanup-inactive', authMiddleware, [
  body('inactiveHours').optional().isInt({ min: 1, max: 168 })
], async (req, res) => {
  try {
    const { inactiveHours = 24 } = req.body;
    
    const updatedCount = await GatewayService.cleanupInactiveGateways(inactiveHours);

    res.json({
      success: true,
      message: `Inactive gateways cleaned up successfully`,
      updatedNodes: updatedCount,
      inactiveHours,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Cleanup inactive error:', err);
    res.status(500).json({ msg: `Cleanup error: ${err.message}` });
  }
});

// Get comprehensive network analytics
router.get('/analytics', authMiddleware, [
  query('includeHistory').optional().isBoolean(),
  query('includeInactive').optional().isBoolean()
], async (req, res) => {
  try {
    const { includeHistory = false, includeInactive = false } = req.query;
    
    const baseMatch = includeInactive === 'true' ? {} : { isActive: true };
    
    const analytics = await Gateway.aggregate([
      {
        $facet: {
          // Overall network health
          networkHealth: [
            { $match: baseMatch },
            {
              $group: {
                _id: null,
                totalDevices: { $sum: 1 },
                activeDevices: { $sum: { $cond: ['$isActive', 1, 0] } },
                onlineDevices: { $sum: { $cond: [{ $and: ['$internetConnected', '$isActive'] }, 1, 0] } },
                scanningDevices: { $sum: { $cond: [{ $and: ['$meshCapabilities.isScanning', '$isActive'] }, 1, 0] } },
                avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
                totalForwardingCapacity: { 
                  $sum: { 
                    $subtract: ['$forwardingPreferences.maxDailyForwards', '$forwardingPreferences.currentDailyForwards'] 
                  } 
                },
                avgConnectionReliability: {
                  $avg: {
                    $cond: [
                      { $gt: ['$networkStats.connectionAttempts', 0] },
                      { $divide: ['$networkStats.connectionSuccess', '$networkStats.connectionAttempts'] },
                      0
                    ]
                  }
                }
              }
            }
          ],
          
          // Battery distribution
          batteryDistribution: [
            { $match: baseMatch },
            {
              $bucket: {
                groupBy: '$meshCapabilities.batteryLevel',
                boundaries: [0, 20, 40, 60, 80, 100],
                default: 'unknown',
                output: { 
                  count: { $sum: 1 },
                  avgForwardingCapacity: { 
                    $avg: { 
                      $subtract: ['$forwardingPreferences.maxDailyForwards', '$forwardingPreferences.currentDailyForwards'] 
                    } 
                  }
                }
              }
            }
          ],
          
          // Mobility patterns
          mobilityPatterns: [
            { $match: baseMatch },
            {
              $group: {
                _id: '$movementPattern.mobilityType',
                count: { $sum: 1 },
                avgSpeed: { $avg: '$movementPattern.averageSpeed' },
                avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' }
              }
            }
          ],
          
          // Performance metrics
          performanceMetrics: [
            { $match: baseMatch },
            {
              $group: {
                _id: null,
                totalMessagesForwarded: { $sum: '$networkStats.messagesForwarded' },
                totalMessagesReceived: { $sum: '$networkStats.messagesReceived' },
                totalConnectionAttempts: { $sum: '$networkStats.connectionAttempts' },
                totalConnectionSuccess: { $sum: '$networkStats.connectionSuccess' },
                avgConnectionTime: { $avg: '$networkStats.averageConnectionTime' },
                totalDataTransferred: { $sum: '$networkStats.dataTransferred' }
              }
            }
          ]
        }
      }
    ]);

    // Get geographic distribution if requested
    let geographicDistribution = [];
    if (includeHistory === 'true') {
      geographicDistribution = await Gateway.aggregate([
        { $match: baseMatch },
        {
          $group: {
            _id: {
              lat: { $round: [{ $arrayElemAt: ['$location.coordinates', 1] }, 1] },
              lng: { $round: [{ $arrayElemAt: ['$location.coordinates', 0] }, 1] }
            },
            count: { $sum: 1 },
            avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
            deviceIds: { $push: '$deviceId' }
          }
        },
        { $limit: 50 }
      ]);
    }

    res.json({
      analytics: analytics[0],
      geographicDistribution,
      queryParams: {
        includeHistory: includeHistory === 'true',
        includeInactive: includeInactive === 'true'
      },
      generatedAt: new Date()
    });
  } catch (err) {
    logger.error('Analytics error:', err);
    res.status(500).json({ msg: `Analytics error: ${err.message}` });
  }
});

module.exports = router;
