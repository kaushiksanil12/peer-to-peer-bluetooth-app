const Gateway = require('../models/Gateway');
const geolib = require('geolib');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class GatewayService {
  static async registerDevice(data, socket) {
    try {
      let gateway = await Gateway.findOne({ deviceId: data.deviceId });
      
      if (!gateway) {
        gateway = new Gateway({
          deviceId: data.deviceId,
          deviceName: data.deviceName,
          location: {
            type: 'Point',
            coordinates: data.location?.coordinates || [0, 0]
          }
        });
      }

      // Update gateway capabilities
      gateway.isGateway = data.isGateway || false;
      gateway.internetConnected = data.internetConnected || false;
      gateway.lastSeen = new Date();
      gateway.isActive = true;

      // Update mesh capabilities
      if (data.meshCapabilities) {
        gateway.meshCapabilities = {
          ...gateway.meshCapabilities,
          ...data.meshCapabilities
        };
      }

      // Update location if provided
      if (data.location && data.location.coordinates) {
        await gateway.updateLocation(
          data.location.coordinates,
          data.location.accuracy,
          data.location.speed,
          data.location.heading
        );
      }

      await gateway.save();

      // Join WebSocket rooms based on capabilities
      if (socket) {
        if (gateway.isGateway) socket.join('gateways');
        if (gateway.internetConnected) socket.join('online-nodes');
        socket.join(`device-${gateway.deviceId}`);
      }

      logger.info(`Gateway registered: ${gateway.deviceId}`);
      return gateway;
    } catch (error) {
      logger.error('Error registering gateway:', error);
      throw error;
    }
  }

  static async findOptimalMeshNodes(targetLocation, maxDistance = 5000) {
    try {
      const nearbyNodes = await Gateway.find({
        internetConnected: true,
        isActive: true,
        'meshCapabilities.isScanning': true,
        'forwardingPreferences.allowsMessageForwarding': true,
        location: {
          $near: {
            $geometry: targetLocation,
            $maxDistance: maxDistance
          }
        }
      }).limit(10);

      // Calculate additional metrics for each node
      const enhancedNodes = nearbyNodes.map(node => {
        const distance = geolib.getDistance(
          { 
            latitude: targetLocation.coordinates[1], 
            longitude: targetLocation.coordinates[0] 
          },
          { 
            latitude: node.location.coordinates[1], 
            longitude: node.location.coordinates[0] 
          }
        );

        const reliabilityScore = node.networkStats.connectionAttempts > 0 ?
          (node.networkStats.connectionSuccess / node.networkStats.connectionAttempts) : 0.5;

        const forwardingCapacity = Math.max(0,
          node.forwardingPreferences.maxDailyForwards - node.forwardingPreferences.currentDailyForwards
        );

        return {
          ...node.toObject(),
          calculatedDistance: distance,
          reliabilityScore,
          forwardingCapacity,
          overallScore: this.calculateNodeScore(node, distance, reliabilityScore, forwardingCapacity)
        };
      });

      // Sort by overall score
      return enhancedNodes.sort((a, b) => b.overallScore - a.overallScore);
    } catch (error) {
      logger.error('Error finding optimal mesh nodes:', error);
      return [];
    }
  }

  static calculateNodeScore(node, distance, reliabilityScore, forwardingCapacity) {
    const distanceScore = Math.max(0, 100 - (distance / 50));
    const batteryScore = node.meshCapabilities.batteryLevel || 50;
    const reliabilityScorePercent = reliabilityScore * 100;
    const capacityScore = Math.min(100, forwardingCapacity * 2);

    return (distanceScore * 0.3) + 
           (batteryScore * 0.2) + 
           (reliabilityScorePercent * 0.3) + 
           (capacityScore * 0.2);
  }

  static async getNetworkStatus() {
    try {
      const stats = await Gateway.aggregate([
        {
          $group: {
            _id: null,
            totalGateways: { $sum: 1 },
            activeGateways: {
              $sum: { $cond: ['$isActive', 1, 0] }
            },
            onlineGateways: {
              $sum: { $cond: ['$internetConnected', 1, 0] }
            },
            scanningNodes: {
              $sum: { $cond: ['$meshCapabilities.isScanning', 1, 0] }
            },
            avgBatteryLevel: { $avg: '$meshCapabilities.batteryLevel' },
            totalMessagesForwarded: { $sum: '$networkStats.messagesForwarded' },
            totalMessagesReceived: { $sum: '$networkStats.messagesReceived' }
          }
        }
      ]);

      return stats[0] || {
        totalGateways: 0,
        activeGateways: 0,
        onlineGateways: 0,
        scanningNodes: 0,
        avgBatteryLevel: 0,
        totalMessagesForwarded: 0,
        totalMessagesReceived: 0
      };
    } catch (error) {
      logger.error('Error getting network status:', error);
      return {};
    }
  }

  static async updateMeshNodeStats(deviceId, stats) {
    try {
      const gateway = await Gateway.findOne({ deviceId });
      
      if (gateway) {
        if (stats.connectionSuccess !== undefined) {
          gateway.networkStats.connectionSuccess += stats.connectionSuccess;
        }
        if (stats.connectionAttempts !== undefined) {
          gateway.networkStats.connectionAttempts += stats.connectionAttempts;
        }
        if (stats.averageConnectionTime !== undefined) {
          gateway.networkStats.averageConnectionTime = 
            (gateway.networkStats.averageConnectionTime + stats.averageConnectionTime) / 2;
        }

        gateway.lastSeen = new Date();
        await gateway.save();

        return gateway;
      }
    } catch (error) {
      logger.error('Error updating mesh node stats:', error);
    }
    return null;
  }

  static async routeToGateway(message) {
    try {
      const gateways = await Gateway.find({ 
        isGateway: true, 
        internetConnected: true,
        isActive: true
      }).sort({ 'networkStats.messagesForwarded': 1 }); // Load balancing

      if (gateways.length > 0) {
        const selectedGateway = gateways[0];
        
        // Update gateway stats
        selectedGateway.networkStats.messagesForwarded += 1;
        await selectedGateway.save();

        logger.info(`Message routed to gateway: ${selectedGateway.deviceId}`);
        return selectedGateway;
      }
      
      return null;
    } catch (error) {
      logger.error('Error routing to gateway:', error);
      return null;
    }
  }

  // Clean up inactive gateways
  static async cleanupInactiveGateways() {
    try {
      const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
      
      const result = await Gateway.updateMany(
        { lastSeen: { $lt: cutoffTime } },
        { $set: { isActive: false, internetConnected: false } }
      );

      logger.info(`Marked ${result.modifiedCount} gateways as inactive`);
      return result.modifiedCount;
    } catch (error) {
      logger.error('Error cleaning up inactive gateways:', error);
      return 0;
    }
  }
}

module.exports = GatewayService;
