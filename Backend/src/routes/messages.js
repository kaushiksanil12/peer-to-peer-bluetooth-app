import express from 'express';
import { body, validationResult } from 'express-validator';
import Message from '../models/Message.js';
import Gateway from '../models/Gateway.js';
import authMiddleware from '../middleware/auth.js';
import winston from 'winston';

const router = express.Router();

// Logger setup
const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/messages.log' })
  ]
});

// Helper function to generate unique message ID
function generateUniqueMessageId() {
  const timestamp = Date.now();
  const randomStr = Math.random().toString(36).substr(2, 9);
  return `msg_${timestamp}_${randomStr}`;
}

// Safe message creation function with guaranteed unique ID
async function createSafeMessage(messageData) {
  try {
    // Always ensure messageId is generated and unique
    if (!messageData.messageId) {
      messageData.messageId = generateUniqueMessageId();
    }
    
    // Double-check for uniqueness (in case of rapid concurrent requests)
    let attempts = 0;
    while (attempts < 5) {
      try {
        const message = new Message(messageData);
        return await message.save();
      } catch (err) {
        if (err.code === 11000 && err.keyPattern && err.keyPattern.messageId) {
          // Duplicate messageId, generate a new one
          messageData.messageId = generateUniqueMessageId();
          attempts++;
          logger.warn(`Duplicate messageId detected, regenerating (attempt ${attempts})`);
        } else {
          throw err;
        }
      }
    }
    
    throw new Error('Failed to create unique messageId after 5 attempts');
  } catch (err) {
    logger.error('Safe message creation error:', err);
    throw err;
  }
}

// Send message with BLE-based routing (privacy-safe)
router.post('/send', authMiddleware, [
  body('content').notEmpty().withMessage('Message content is required'),
  body('senderName').notEmpty().withMessage('Sender name is required'),
  body('recipientId').notEmpty().withMessage('Recipient ID is required'),
  body('senderId').notEmpty().withMessage('Sender ID is required'),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, senderName, recipientId, senderId, priority = 'NORMAL' } = req.body;

    // Verify sender exists
    const sender = await Gateway.findOne({ deviceId: senderId }).lean();
    if (!sender) {
      return res.status(404).json({ msg: 'Sender device not found' });
    }

    // Check recipient (read-only, no document creation)
    const recipient = await Gateway.findOne({ deviceId: recipientId }).lean();
    
    let deliveryMethod = 'store-and-forward';
    let routedVia = null;
    let estimatedDeliveryTime = null;

    if (recipient && recipient.isActive) {
      // Find available forwarders for mesh routing
      const forwarders = await Gateway.find({
        isActive: true,
        deviceId: { $nin: [senderId, recipientId] },
        'meshCapabilities.isScanning': true,
        'forwardingPreferences.allowsMessageForwarding': true,
        'meshCapabilities.batteryLevel': { 
          $gte: priority === 'EMERGENCY' ? 10 : 20 
        }
      })
      .sort({ 
        'meshCapabilities.batteryLevel': -1,
        'forwardingPreferences.currentDailyForwards': 1 
      })
      .limit(1)
      .lean();

      if (forwarders.length > 0) {
        const forwarder = forwarders[0];
        deliveryMethod = 'mesh-forward';
        routedVia = forwarder.deviceId;
        
        // Calculate delivery time based on battery and load
        const batteryFactor = forwarder.meshCapabilities.batteryLevel / 100;
        const loadFactor = 1 - (forwarder.forwardingPreferences.currentDailyForwards / 
                                forwarder.forwardingPreferences.maxDailyForwards);
        estimatedDeliveryTime = Math.round((2.1 / (batteryFactor * loadFactor)) * 10) / 10;
        
        // Update forwarder statistics
        await Gateway.updateOne(
          { deviceId: forwarder.deviceId },
          { 
            $inc: { 
              'networkStats.messagesForwarded': 1,
              'forwardingPreferences.currentDailyForwards': 1,
              'forwardingPreferences.currentHourlyForwards': 1
            },
            $set: { lastSeen: new Date() }
          }
        );
        
        logger.info(`Message routed via mesh forwarder: ${forwarder.deviceId}`);
        
      } else if (recipient.internetConnected) {
        deliveryMethod = 'direct-internet';
        routedVia = recipient.deviceId;
        estimatedDeliveryTime = 0.5;
        
        logger.info(`Message routed via direct internet: ${recipient.deviceId}`);
      } else {
        logger.info(`No active forwarders found, message queued for: ${recipientId}`);
      }
    } else {
      logger.info(`Recipient offline or not found, message queued for: ${recipientId}`);
    }

    // Create message with safe ID generation
    const messageData = {
      content,
      senderName,
      senderId,
      recipientId,
      priority,
      deliveryMethod,
      routedVia,
      ttl: priority === 'EMERGENCY' ? 10 : 7,
      status: 'pending'
    };

    const message = await createSafeMessage(messageData);

    // Update sender statistics
    await Gateway.updateOne(
      { deviceId: senderId },
      { 
        $inc: { 
          'networkStats.messagesReceived': deliveryMethod === 'direct-internet' ? 1 : 0 
        },
        $set: { lastSeen: new Date() }
      }
    );

    logger.info(`Message created successfully: ${message.messageId}`);

    res.json({
      messageId: message.messageId,
      success: true,
      deliveryMethod,
      routedVia,
      estimatedDeliveryTime,
      priority,
      timestamp: new Date()
    });

  } catch (err) {
    logger.error('Message send error:', err);
    res.status(500).json({ msg: `Message send error: ${err.message}` });
  }
});

// Send message to mobile recipient (enhanced mobile routing)
router.post('/send-to-mobile', authMiddleware, [
  body('content').notEmpty().withMessage('Message content is required'),
  body('senderName').notEmpty().withMessage('Sender name is required'),
  body('recipientId').notEmpty().withMessage('Recipient ID is required'),
  body('senderId').notEmpty().withMessage('Sender ID is required'),
  body('priority').optional().isIn(['LOW', 'NORMAL', 'HIGH', 'EMERGENCY'])
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { content, senderName, recipientId, senderId, priority = 'NORMAL' } = req.body;

    // Check mobile recipient
    const mobileRecipient = await Gateway.findOne({ deviceId: recipientId }).lean();
    
    let deliveryMethod = 'store-and-forward';
    let routedVia = null;
    let estimatedDeliveryTime = null;

    if (mobileRecipient && mobileRecipient.isActive) {
      // Find optimal forwarders for mobile recipients
      const mobileForwarders = await Gateway.find({
        isActive: true,
        deviceId: { $nin: [senderId, recipientId] },
        'meshCapabilities.isScanning': true,
        'forwardingPreferences.allowsMessageForwarding': true,
        'meshCapabilities.batteryLevel': { $gte: 25 }, // Higher battery requirement for mobile
        internetConnected: true // Prefer internet-connected nodes for mobile
      })
      .sort({ 
        'meshCapabilities.batteryLevel': -1,
        'forwardingPreferences.currentDailyForwards': 1
      })
      .limit(1)
      .lean();

      if (mobileForwarders.length > 0) {
        const forwarder = mobileForwarders[0];
        deliveryMethod = 'proximity-mesh'; // Mobile-optimized routing
        routedVia = forwarder.deviceId;
        estimatedDeliveryTime = 1.8; // Optimized for mobile delivery
        
        // Update forwarder stats
        await Gateway.updateOne(
          { deviceId: forwarder.deviceId },
          { 
            $inc: { 
              'networkStats.messagesForwarded': 1,
              'forwardingPreferences.currentDailyForwards': 1
            }
          }
        );
      }
    }

    // Create message for mobile recipient
    const messageData = {
      content,
      senderName,
      senderId,
      recipientId,
      priority,
      deliveryMethod,
      routedVia,
      ttl: 10, // Longer TTL for mobile messages
      status: 'pending'
    };

    const message = await createSafeMessage(messageData);

    res.json({
      messageId: message.messageId,
      success: true,
      deliveryMethod,
      routedVia,
      estimatedDeliveryTime,
      timestamp: new Date()
    });

  } catch (err) {
    logger.error('Mobile message send error:', err);
    res.status(500).json({ msg: `Mobile message send error: ${err.message}` });
  }
});

// Get pending messages for a device
router.get('/pending/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    const { limit = 50, priority } = req.query;
    
    // Build query
    const query = {
      recipientId: deviceId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    };
    
    if (priority) {
      query.priority = priority;
    }

    const messages = await Message.find(query)
      .sort({ 
        priority: { EMERGENCY: 4, HIGH: 3, NORMAL: 2, LOW: 1 }[req.query.sortPriority] ? -1 : 1,
        createdAt: -1 
      })
      .limit(parseInt(limit))
      .lean();

    // Group messages by priority for better organization
    const messagesByPriority = {
      EMERGENCY: [],
      HIGH: [],
      NORMAL: [],
      LOW: []
    };

    messages.forEach(msg => {
      messagesByPriority[msg.priority].push({
        messageId: msg.messageId,
        content: msg.content,
        senderName: msg.senderName,
        senderId: msg.senderId,
        priority: msg.priority,
        deliveryMethod: msg.deliveryMethod,
        createdAt: msg.createdAt,
        ttl: msg.ttl
      });
    });

    res.json({
      deviceId,
      pendingMessages: messages.length,
      messages: messagesByPriority,
      allMessages: messages.map(msg => ({
        messageId: msg.messageId,
        content: msg.content,
        senderName: msg.senderName,
        senderId: msg.senderId,
        priority: msg.priority,
        deliveryMethod: msg.deliveryMethod,
        createdAt: msg.createdAt,
        ttl: msg.ttl
      })),
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Get pending messages error:', err);
    res.status(500).json({ msg: `Get pending messages error: ${err.message}` });
  }
});

// Mark message as delivered
router.post('/delivered/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { deliveryConfirmation } = req.body;
    
    const message = await Message.findOneAndUpdate(
      { messageId, status: 'pending' },
      { 
        status: 'delivered',
        deliveredAt: new Date()
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ msg: 'Message not found or already delivered' });
    }

    // Update delivery statistics for the forwarder
    if (message.routedVia) {
      await Gateway.updateOne(
        { deviceId: message.routedVia },
        { 
          $inc: { 'networkStats.messagesDelivered': 1 }
        }
      );
    }

    logger.info(`Message delivered successfully: ${messageId}`);

    res.json({
      success: true,
      message: 'Message marked as delivered',
      messageId: message.messageId,
      deliveredAt: message.deliveredAt,
      deliveryConfirmation
    });
  } catch (err) {
    logger.error('Mark delivered error:', err);
    res.status(500).json({ msg: `Mark delivered error: ${err.message}` });
  }
});

// Mark message as failed
router.post('/failed/:messageId', authMiddleware, async (req, res) => {
  try {
    const { messageId } = req.params;
    const { failureReason } = req.body;
    
    const message = await Message.findOneAndUpdate(
      { messageId, status: 'pending' },
      { 
        status: 'failed',
        failureReason,
        failedAt: new Date()
      },
      { new: true }
    );

    if (!message) {
      return res.status(404).json({ msg: 'Message not found or already processed' });
    }

    // Update failure statistics
    if (message.routedVia) {
      await Gateway.updateOne(
        { deviceId: message.routedVia },
        { 
          $inc: { 'networkStats.connectionFailures': 1 }
        }
      );
    }

    logger.warn(`Message failed: ${messageId}, reason: ${failureReason}`);

    res.json({
      success: true,
      message: 'Message marked as failed',
      messageId: message.messageId,
      failureReason,
      failedAt: message.failedAt
    });
  } catch (err) {
    logger.error('Mark failed error:', err);
    res.status(500).json({ msg: `Mark failed error: ${err.message}` });
  }
});

// Get message statistics
router.get('/stats', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.query;
    
    const baseMatch = deviceId ? { $or: [{ senderId: deviceId }, { recipientId: deviceId }] } : {};
    
    const messageStats = await Message.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: null,
          totalMessages: { $sum: 1 },
          pendingMessages: { $sum: { $cond: [{ $eq: ['$status', 'pending'] }, 1, 0] } },
          deliveredMessages: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
          failedMessages: { $sum: { $cond: [{ $eq: ['$status', 'failed'] }, 1, 0] } },
          expiredMessages: { $sum: { $cond: [{ $eq: ['$status', 'expired'] }, 1, 0] } },
          emergencyMessages: { $sum: { $cond: [{ $eq: ['$priority', 'EMERGENCY'] }, 1, 0] } },
          highPriorityMessages: { $sum: { $cond: [{ $eq: ['$priority', 'HIGH'] }, 1, 0] } },
          averageDeliveryTime: { $avg: '$estimatedDeliveryTime' }
        }
      }
    ]);

    // Get delivery method distribution
    const deliveryMethodStats = await Message.aggregate([
      { $match: baseMatch },
      {
        $group: {
          _id: '$deliveryMethod',
          count: { $sum: 1 },
          averageDeliveryTime: { $avg: '$estimatedDeliveryTime' }
        }
      }
    ]);

    res.json({
      messageStats: messageStats[0] || {
        totalMessages: 0,
        pendingMessages: 0,
        deliveredMessages: 0,
        failedMessages: 0,
        expiredMessages: 0,
        emergencyMessages: 0,
        highPriorityMessages: 0,
        averageDeliveryTime: 0
      },
      deliveryMethodStats,
      deviceId: deviceId || 'all',
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Message stats error:', err);
    res.status(500).json({ msg: `Message stats error: ${err.message}` });
  }
});

// Cleanup expired messages (admin endpoint)
router.post('/admin/cleanup-expired', authMiddleware, async (req, res) => {
  try {
    const result = await Message.updateMany(
      { 
        status: 'pending',
        expiresAt: { $lt: new Date() }
      },
      { 
        $set: { 
          status: 'expired',
          expiredAt: new Date()
        }
      }
    );

    logger.info(`Expired messages cleaned up: ${result.modifiedCount}`);

    res.json({
      success: true,
      message: 'Expired messages cleaned up successfully',
      expiredCount: result.modifiedCount,
      timestamp: new Date()
    });
  } catch (err) {
    logger.error('Cleanup expired error:', err);
    res.status(500).json({ msg: `Cleanup error: ${err.message}` });
  }
});

export default router;
