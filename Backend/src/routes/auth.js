import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { body, validationResult } from 'express-validator';
import Gateway from '../models/Gateway.js';

const router = express.Router();

// Register device with password hashing (updated for privacy-enhanced schema)
router.post('/register', [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('deviceName').notEmpty().withMessage('Device name is required'),
  body('password').isLength({ min: 6 }).withMessage('Password must be at least 6 characters')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, deviceName, password } = req.body;

    // Check if device already exists
    let existingDevice = await Gateway.findOne({ deviceId });
    if (existingDevice) {
      return res.status(400).json({ msg: 'Device already exists' });
    }

    // Hash password for secure storage
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create new device with privacy-enhanced schema
    const gateway = new Gateway({
      deviceId,
      deviceName,
      passwordHash,  // ✅ Store hashed password, not plain text
      meshCapabilities: {
        batteryLevel: 100,
        isScanning: false,
        scanMode: 'BALANCED'
      },
      forwardingPreferences: {
        allowsMessageForwarding: true,
        maxDailyForwards: 50,
        maxHourlyForwards: 10,
        currentDailyForwards: 0,
        currentHourlyForwards: 0
      },
      networkStats: {
        messagesForwarded: 0,
        messagesReceived: 0,
        connectionSuccess: 0,
        connectionAttempts: 0
      },
      internetConnected: false,
      isActive: true,
      nearbyNodes: []
    });

    await gateway.save();

    // Create JWT token
    const payload = {
      device: {
        id: gateway._id,
        deviceId: gateway.deviceId
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          msg: 'Device registered successfully',
          token,
          deviceId: gateway.deviceId,
          deviceName: gateway.deviceName
        });
      }
    );

  } catch (err) {
    console.error('Registration error:', err);
    res.status(500).json({ msg: 'Server error during registration' });
  }
});

// Login endpoint for existing devices
router.post('/login', [
  body('deviceId').notEmpty().withMessage('Device ID is required'),
  body('password').notEmpty().withMessage('Password is required')
], async (req, res) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errors: errors.array() });
    }

    const { deviceId, password } = req.body;

    // Find device
    const gateway = await Gateway.findOne({ deviceId });
    if (!gateway) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Check password
    const isMatch = await bcrypt.compare(password, gateway.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    // Update last seen
    gateway.lastSeen = new Date();
    gateway.isActive = true;
    await gateway.save();

    // Create JWT token
    const payload = {
      device: {
        id: gateway._id,
        deviceId: gateway.deviceId
      }
    };

    jwt.sign(
      payload,
      process.env.JWT_SECRET || 'fallback_secret_key',
      { expiresIn: '24h' },
      (err, token) => {
        if (err) throw err;
        res.json({
          msg: 'Login successful',
          token,
          deviceId: gateway.deviceId,
          deviceName: gateway.deviceName
        });
      }
    );

  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error during login' });
  }
});

export default router;
