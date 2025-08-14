const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Gateway = require('../models/Gateway');
const MessageService = require('../services/MessageService');
const ProximityService = require('../services/ProximityService');
const { v4: uuidv4 } = require('uuid');

const router = express.Router();

// Create message with basic routing
router.post('/', [
  body('content').notEmpty().withMessage('Message content is required'),
  body('senderName').notEmpty().withMessage('Sender name is required'),
  body('senderId').notEmpty().withMessage('Sender ID is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const messageData = {
      id: req.body.id || `msg_${Date.now()}_${uuidv4().slice(0, 8)}`,
      ...req.body
    };

    const message = await MessageService.createMessage(messageData);
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Enhanced message sending with proximity routing
router.post('/send-with-proximity', [
  body('content').notEmpty(),
  body('senderName').notEmpty(),
  body('senderId').notEmpty(),
  body('recipientId').notEmpty(),
  body('senderLocation').optional().isObject()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, senderName, senderId, recipientId, senderLocation, priority } = req.body;

    // Create message with enhanced routing info
    const messageData = {
      id: `msg_${Date.now()}_${uuidv4().slice(0, 8)}`,
      content,
      senderName,
      senderId,
      recipientId,
      routing: {
        ttl: 7,
        priority: priority || 'NORMAL'
      },
      locationRouting: {
        senderLocation: senderLocation ? {
          type: 'Point',
          coordinates: senderLocation.coordinates
        } : undefined
      }
    };

    const message = new Message(messageData);
    await message.save();

    // Check if recipient is online
    const recipient = await Gateway.findOne({ 
      deviceId: recipientId, 
      isActive: true, 
      internetConnected: true 
    });

    let routingResult;

    if (recipient && recipient.lastSeen > new Date(Date.now() - 5 * 60 * 1000)) {
      // Recipient is online - direct delivery
      message.deliveryStatus.status = 'DELIVERED';
      message.deliveryStatus.deliveryMethod = 'DIRECT';
      message.deliveryStatus.deliveredAt = new Date();
      await message.save();

      routingResult = {
        success: true,
        deliveryMethod: 'direct',
        message: 'Message delivered directly to recipient'
      };
    } else {
      // Use proximity routing for offline recipient
      routingResult = await ProximityService.routeToNearestMeshNode(message, recipientId);
    }

    res.json({
      messageId: message.id,
      ...routingResult,
      timestamp: message.timestamp
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Route for mobile recipients
router.post('/send-to-mobile', [
  body('content').notEmpty(),
  body('recipientId').notEmpty(),
  body('senderId').notEmpty()
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const messageData = {
      id: `msg_mobile_${Date.now()}_${uuidv4().slice(0, 8)}`,
      ...req.body,
      routing: {
        ttl: 10, // Higher TTL for mobile routing
        priority: req.body.priority || 'NORMAL'
      }
    };

    const message = new Message(messageData);
    await message.save();

    // Use mobile-optimized routing
    const routingResult = await ProximityService.routeForMovingRecipient(
      message, 
      req.body.recipientId
    );

    res.json({
      messageId: message.id,
      ...routingResult,
      timestamp: message.timestamp
    });

  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get pending messages for a recipient
router.get('/pending/:recipientId', async (req, res) => {
  try {
    const { recipientId } = req.params;
    
    const pendingMessages = await Message.find({
      recipientId,
      'deliveryStatus.status': { $in: ['PENDING', 'CACHED', 'ROUTING'] }
    }).sort({ timestamp: -1 });

    res.json(pendingMessages);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Mark message as delivered
router.patch('/delivered/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deliveryMethod, deviceId } = req.body;

    const message = await Message.findOne({ id: messageId });
    
    if (!message) {
      return res.status(404).json({ msg: 'Message not found' });
    }

    message.deliveryStatus.status = 'DELIVERED';
    message.deliveryStatus.deliveredAt = new Date();
    message.deliveryStatus.deliveryMethod = deliveryMethod || 'UNKNOWN';
    
    if (deviceId) {
      message.addToRoutePath(deviceId);
    }

    await message.save();

    // Update mesh node statistics if delivered via mesh
    if (deviceId && deliveryMethod === 'PROXIMITY_MESH') {
      await Gateway.updateOne(
        { deviceId },
        { 
          $inc: { 'networkStats.messagesReceived': 1 },
          lastSeen: new Date()
        }
      );
    }

    res.json({ success: true, message: 'Delivery confirmed' });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Get message routing analytics
router.get('/analytics/routing', async (req, res) => {
  try {
    const analytics = await Message.aggregate([
      {
        $group: {
          _id: '$deliveryStatus.deliveryMethod',
          count: { $sum: 1 },
          avgDeliveryTime: { 
            $avg: { 
              $subtract: ['$deliveryStatus.deliveredAt', '$timestamp'] 
            }
          }
        }
      }
    ]);

    const proximityStats = await Message.countDocuments({
      'locationRouting.routedViaProximity': true
    });

    res.json({
      routingMethods: analytics,
      proximityRoutingCount: proximityStats,
      totalMessages: await Message.countDocuments()
    });
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

module.exports = router;
