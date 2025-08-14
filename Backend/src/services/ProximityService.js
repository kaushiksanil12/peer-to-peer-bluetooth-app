const Gateway = require('../models/Gateway');
const Message = require('../models/Message');
const geolib = require('geolib');
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()]
});

class ProximityService {
  /**
   * Find the best mesh nodes near a recipient's location
   */
  static async findNearbyMeshNodes(recipientLocation, maxDistance = 5000) {
    try {
      const nearbyNodes = await Gateway.find({
        internetConnected: true,
        isActive: true,
        'meshCapabilities.isScanning': true,
        'forwardingPreferences.allowsMessageForwarding': true,
        location: {
          $near: {
            $geometry: {
              type: 'Point',
              coordinates: recipientLocation.coordinates
            },
            $maxDistance: maxDistance
          }
        }
      }).limit(10);

      // Filter by daily forwarding limits
      const availableNodes = nearbyNodes.filter(node => {
        return node.forwardingPreferences.currentDailyForwards < 
               node.forwardingPreferences.maxDailyForwards;
      });

      return availableNodes;
    } catch (error) {
      logger.error('Error finding nearby mesh nodes:', error);
      return [];
    }
  }

  /**
   * Route message to nearest mesh node for offline recipient
   */
  static async routeToNearestMeshNode(message, recipientId) {
    try {
      // Get recipient's last known location
      const recipient = await Gateway.findOne({ deviceId: recipientId });
      
      if (!recipient || !recipient.lastKnownLocation) {
        logger.info(`No location data for recipient ${recipientId}`);
        return await this.fallbackToStoreAndForward(message);
      }

      // Find nearby mesh nodes
      const nearbyNodes = await this.findNearbyMeshNodes(
        recipient.lastKnownLocation, 
        5000
      );

      if (nearbyNodes.length === 0) {
        logger.info(`No nearby mesh nodes for recipient ${recipientId}`);
        return await this.fallbackToStoreAndForward(message);
      }

      // Select best node based on proximity, battery, and success rate
      const bestNode = this.selectOptimalMeshNode(nearbyNodes, recipient);

      // Cache message at selected node(s)
      const cacheResult = await this.cacheMessageAtNode(message, bestNode);

      if (cacheResult.success) {
        // Update message routing info
        message.locationRouting.routedViaProximity = true;
        message.locationRouting.proximityNodes.push(bestNode.deviceId);
        message.deliveryStatus.status = 'CACHED';
        message.deliveryStatus.deliveryMethod = 'PROXIMITY_MESH';
        
        await message.save();

        logger.info(`Message routed to mesh node ${bestNode.deviceId} for recipient ${recipientId}`);
        
        return {
          success: true,
          routedVia: bestNode.deviceId,
          deliveryMethod: 'proximity-mesh',
          estimatedDeliveryTime: this.estimateDeliveryTime(recipient, bestNode)
        };
      }

      return await this.fallbackToStoreAndForward(message);

    } catch (error) {
      logger.error('Error in proximity routing:', error);
      return await this.fallbackToStoreAndForward(message);
    }
  }

  /**
   * Select optimal mesh node based on multiple factors
   */
  static selectOptimalMeshNode(nodes, recipient) {
    return nodes.reduce((best, current) => {
      const bestScore = this.calculateNodeScore(best, recipient);
      const currentScore = this.calculateNodeScore(current, recipient);
      
      return currentScore > bestScore ? current : best;
    });
  }

  /**
   * Calculate score for mesh node selection
   */
  static calculateNodeScore(node, recipient) {
    const distance = geolib.getDistance(
      { latitude: node.location.coordinates[1], longitude: node.location.coordinates[0] },
      { latitude: recipient.lastKnownLocation.coordinates[1], longitude: recipient.lastKnownLocation.coordinates[0] }
    );

    const distanceScore = Math.max(0, 100 - (distance / 50)); // Closer is better
    const batteryScore = node.meshCapabilities.batteryLevel || 50;
    const reliabilityScore = node.networkStats.connectionAttempts > 0 ? 
      (node.networkStats.connectionSuccess / node.networkStats.connectionAttempts) * 100 : 50;
    
    const forwardingCapacity = Math.max(0, 
      node.forwardingPreferences.maxDailyForwards - node.forwardingPreferences.currentDailyForwards
    );

    return (distanceScore * 0.4) + (batteryScore * 0.2) + (reliabilityScore * 0.3) + (forwardingCapacity * 0.1);
  }

  /**
   * Cache message at specific mesh node
   */
  static async cacheMessageAtNode(message, meshNode) {
    try {
      // In real implementation, this would trigger a push notification
      // or WebSocket message to the mesh node's device
      
      // Update node's forwarding count
      meshNode.forwardingPreferences.currentDailyForwards += 1;
      meshNode.networkStats.messagesForwarded += 1;
      await meshNode.save();

      // Mark message as cached
      message.caching.isCached = true;
      message.caching.cachedAt.push(meshNode.deviceId);
      message.caching.cacheExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      return { success: true, nodeId: meshNode.deviceId };
    } catch (error) {
      logger.error('Error caching message at node:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Route for mobile recipients along predicted path
   */
  static async routeForMovingRecipient(message, recipientId) {
    try {
      const recipient = await Gateway.findOne({ deviceId: recipientId });
      
      if (!recipient) {
        return await this.fallbackToStoreAndForward(message);
      }

      // Predict movement corridor
      const movementCorridor = this.predictMovementCorridor(recipient);
      
      if (!movementCorridor) {
        return await this.routeToNearestMeshNode(message, recipientId);
      }

      // Find mesh nodes along predicted route
      const routeNodes = await Gateway.find({
        internetConnected: true,
        isActive: true,
        'forwardingPreferences.allowsMessageForwarding': true,
        location: {
          $geoWithin: {
            $geometry: movementCorridor
          }
        }
      }).limit(5);

      // Cache at multiple strategic points
      const cachePromises = routeNodes.slice(0, 3).map(node => 
        this.cacheMessageAtNode(message, node)
      );
      
      const cacheResults = await Promise.all(cachePromises);
      const successfulCaches = cacheResults.filter(result => result.success);

      if (successfulCaches.length > 0) {
        message.locationRouting.routedViaProximity = true;
        message.deliveryStatus.status = 'CACHED';
        message.deliveryStatus.deliveryMethod = 'PROXIMITY_MESH';
        await message.save();

        return {
          success: true,
          routedVia: successfulCaches.map(cache => cache.nodeId),
          deliveryMethod: 'mobile-corridor-mesh',
          cachedNodesCount: successfulCaches.length
        };
      }

      return await this.fallbackToStoreAndForward(message);
    } catch (error) {
      logger.error('Error routing for moving recipient:', error);
      return await this.fallbackToStoreAndForward(message);
    }
  }

  /**
   * Predict movement corridor for mobile recipient
   */
  static predictMovementCorridor(recipient) {
    if (!recipient.locationHistory || recipient.locationHistory.length < 3) {
      return null;
    }

    const recentLocations = recipient.locationHistory.slice(-5);
    
    // Simple corridor prediction - in production, use more sophisticated algorithms
    const avgSpeed = recipient.movementPattern.averageSpeed || 5; // km/h
    const timeWindow = 30; // minutes
    const corridorRadius = (avgSpeed * 1000 * timeWindow / 60) / 2; // meters

    // Create a buffer around the predicted path
    return {
      type: 'Polygon',
      coordinates: [this.createCorridorCoordinates(recentLocations, corridorRadius)]
    };
  }

  /**
   * Create polygon coordinates for movement corridor
   */
  static createCorridorCoordinates(locations, radius) {
    // Simplified corridor creation - in production, use turf.js buffer operations
    const lastLocation = locations[locations.length - 1];
    const radiusDegrees = radius / 111320; // Rough conversion to degrees
    
    return [
      [lastLocation.coordinates[0] - radiusDegrees, lastLocation.coordinates[1] - radiusDegrees],
      [lastLocation.coordinates[0] + radiusDegrees, lastLocation.coordinates[1] - radiusDegrees],
      [lastLocation.coordinates[0] + radiusDegrees, lastLocation.coordinates[1] + radiusDegrees],
      [lastLocation.coordinates[0] - radiusDegrees, lastLocation.coordinates[1] + radiusDegrees],
      [lastLocation.coordinates[0] - radiusDegrees, lastLocation.coordinates[1] - radiusDegrees]
    ];
  }

  /**
   * Fallback to traditional store and forward
   */
  static async fallbackToStoreAndForward(message) {
    message.deliveryStatus.status = 'PENDING';
    message.deliveryStatus.deliveryMethod = 'STORE_FORWARD';
    await message.save();

    return {
      success: true,
      deliveryMethod: 'store-and-forward',
      message: 'Message stored for later delivery'
    };
  }

  /**
   * Estimate delivery time based on recipient patterns
   */
  static estimateDeliveryTime(recipient, meshNode) {
    const distance = geolib.getDistance(
      { latitude: meshNode.location.coordinates[1], longitude: meshNode.location.coordinates[0] },
      { latitude: recipient.lastKnownLocation.coordinates[1], longitude: recipient.lastKnownLocation.coordinates[0] }
    );

    const avgSpeed = recipient.movementPattern.averageSpeed || 5; // km/h
    const estimatedMinutes = (distance / 1000) / (avgSpeed / 60);

    return Math.min(estimatedMinutes, 60); // Max 1 hour estimate
  }
}

module.exports = ProximityService;
