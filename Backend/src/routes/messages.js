const express = require('express');
const { body, validationResult } = require('express-validator');
const Message = require('../models/Message');
const Gateway = require('../models/Gateway');
const authMiddleware = require('../middleware/auth');

const router = express.Router();

// Send message with BLE-based routing (simplified, no Gateway document creation)
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

    // Simple recipient check (read-only, no document creation)
    const recipient = await Gateway.findOne({ deviceId: recipientId }).lean();
    
    let deliveryMethod = 'store-and-forward';
    let routedVia = null;
    let estimatedDeliveryTime = null;

    if (recipient && recipient.isActive) {
      // Simple forwarder query (no method calls that create documents)
      const forwarders = await Gateway.find({
        isActive: true,
        deviceId: { $nin: [senderId, recipientId] },
        'meshCapabilities.isScanning': true,
        'forwardingPreferences.allowsMessageForwarding': true,
        'meshCapabilities.batteryLevel': { $gte: 20 }
      }).limit(1).lean();

      if (forwarders.length > 0) {
        deliveryMethod = 'mesh-forward';
        routedVia = forwarders[0].deviceId;
        estimatedDeliveryTime = 2.1;
        
        // Simple stats update (no method calls)
        await Gateway.updateOne(
          { deviceId: forwarders[0].deviceId },
          { 
            $inc: { 
              'networkStats.messagesForwarded': 1,
              'forwardingPreferences.currentDailyForwards': 1
            }
          }
        );
      } else if (recipient.internetConnected) {
        deliveryMethod = 'direct-internet';
        routedVia = recipient.deviceId;
        estimatedDeliveryTime = 0.5;
      }
    }

    // Create message document only (no Gateway creation)
    const message = new Message({
      content,
      senderName,
      senderId,
      recipientId,
      priority,
      deliveryMethod,
      routedVia,
      ttl: priority === 'EMERGENCY' ? 10 : 7,
      status: 'pending'
    });

    await message.save();

    res.json({
      messageId: message.messageId,
      success: true,
      deliveryMethod,
      routedVia,
      estimatedDeliveryTime,
      timestamp: new Date()
    });

  } catch (err) {
    console.error('Message send error:', err);
    res.status(500).json({ msg: `Message send error: ${err.message}` });
  }
});

// Get pending messages for a device
router.get('/pending/:deviceId', authMiddleware, async (req, res) => {
  try {
    const { deviceId } = req.params;
    
    const messages = await Message.find({
      recipientId: deviceId,
      status: 'pending',
      expiresAt: { $gt: new Date() }
    }).sort({ priority: -1, createdAt: -1 }).lean();

    res.json({
      pendingMessages: messages.length,
      messages: messages.map(msg => ({
        messageId: msg.messageId,
        content: msg.content,
        senderName: msg.senderName,
        priority: msg.priority,
        createdAt: msg.createdAt,
        ttl: msg.ttl
      }))
    });
  } catch (err) {
    console.error('Get pending messages error:', err);
    res.status(500).json({ msg: `Get pending messages error: ${err.message}` });
  }
});

module.exports = router;
