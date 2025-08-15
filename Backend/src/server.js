import 'dotenv/config';
import express from 'express';
import http from 'http';
import { Server as socketIo } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import winston from 'winston';
import cron from 'node-cron';

import { connectDB } from './config/database.js';
import authRoutes from './routes/auth.js';
import messageRoutes from './routes/messages.js';
import gatewayRoutes from './routes/gateway.js';
import authMiddleware from './middleware/auth.js';
import MessageService from './services/MessageService.js';
import GatewayService from './services/GatewayService.js';
import ProximityService from './services/ProximityService.js';
import mongoose from 'mongoose';
import Gateway from './models/Gateway.js';

const app = express();
const server = http.createServer(app);
const io = new socketIo(server, { 
  cors: { 
    origin: '*',
    methods: ['GET', 'POST']
  }
});

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({ filename: 'logs/app.log' })
  ],
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json({ limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 900000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use(limiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/gateway', authMiddleware, gatewayRoutes);

// Health Check with enhanced info
app.get('/health', async (req, res) => {
  try {
    const networkStats = await GatewayService.getNetworkStatus();
    res.json({ 
      status: 'healthy', 
      timestamp: Date.now(),
      version: '2.0.0',
      features: ['proximity-routing', 'mobile-mesh', 'location-aware'],
      networkStats
    });
  } catch (error) {
    res.status(500).json({ 
      status: 'degraded', 
      timestamp: Date.now(),
      error: 'Unable to fetch network stats'
    });
  }
});

// Enhanced WebSocket Events
io.on('connection', (socket) => {
  logger.info(`New WebSocket connection: ${socket.id}`);
  
  // Register device with enhanced capabilities
  socket.on('register_device', async (data) => {
    try {
      const gateway = await GatewayService.registerDevice(data, socket);
      socket.emit('registration_confirmed', {
        deviceId: gateway.deviceId,
        capabilities: gateway.meshCapabilities,
        networkStats: await GatewayService.getNetworkStatus()
      });
      
      logger.info(`Device registered via WebSocket: ${gateway.deviceId}`);
    } catch (error) {
      socket.emit('registration_error', { error: error.message });
      logger.error(`Registration error: ${error.message}`);
    }
  });

  // Handle location updates
  socket.on('location_update', async (data) => {
    try {
      const { deviceId, location, batteryLevel, scanMode } = data;
      
      await GatewayService.updateDeviceLocation(deviceId, {
        coordinates: location.coordinates,
        accuracy: location.accuracy,
        speed: location.speed,
        heading: location.heading,
        batteryLevel,
        scanMode
      });
      
      socket.emit('location_updated', { success: true });
    } catch (error) {
      socket.emit('location_error', { error: error.message });
    }
  });

  // Handle mesh messages with proximity routing
  socket.on('mesh_message', async (data) => {
    try {
      await MessageService.handleMeshMessage(data, io);
      
      // If message has proximity routing needs, handle it
      if (data.recipientId && !data.directDelivery) {
        const routingResult = await ProximityService.routeToNearestMeshNode(
          data, 
          data.recipientId
        );
        
        socket.emit('routing_result', routingResult);
      }
      
    } catch (error) {
      socket.emit('message_error', { error: error.message });
      logger.error(`Mesh message error: ${error.message}`);
    }
  });

  // Handle message delivery confirmation
  socket.on('message_delivered', async (data) => {
    try {
      const { messageId, deviceId, deliveryMethod } = data;
      
      // Update message status
      await MessageService.confirmDelivery(messageId, deviceId, deliveryMethod);
      
      // Update mesh node statistics
      await GatewayService.updateMeshNodeStats(deviceId, {
        connectionSuccess: 1,
        messagesReceived: 1
      });
      
      socket.emit('delivery_confirmed', { messageId });
      logger.info(`Message delivered: ${messageId} via ${deviceId}`);
    } catch (error) {
      socket.emit('delivery_error', { error: error.message });
    }
  });

  // Handle mesh network discovery
  socket.on('discover_mesh_nodes', async (data) => {
    try {
      const { location, maxDistance } = data;
      const nearbyNodes = await GatewayService.findOptimalMeshNodes(
        { type: 'Point', coordinates: location.coordinates },
        maxDistance || 5000
      );
      
      socket.emit('mesh_nodes_discovered', {
        nodes: nearbyNodes.slice(0, 5), // Limit to top 5 nodes
        count: nearbyNodes.length
      });
    } catch (error) {
      socket.emit('discovery_error', { error: error.message });
    }
  });

  socket.on('disconnect', () => {
    logger.info(`WebSocket disconnected: ${socket.id}`);
  });
});

// Database Connection
connectDB();

// Cron Jobs for maintenance
cron.schedule('0 * * * *', () => {
  logger.info('Running hourly maintenance...');
  MessageService.cleanupExpiredMessages();
});

cron.schedule('0 0 * * *', () => {
  logger.info('Running daily maintenance...');
  GatewayService.cleanupInactiveGateways();
  // Reset daily forwarding counters
  Gateway.updateMany(
    {},
    { $set: { 'forwardingPreferences.currentDailyForwards': 0 } }
  );
});

// Error handling
process.on('unhandledRejection', (err, promise) => {
  logger.error('Unhandled Promise Rejection:', err);
});

process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  logger.info(`P2P Mesh Backend Server v2.0 running on port ${PORT}`);
  logger.info('Features: proximity-routing, mobile-mesh, location-aware');
});

// Graceful Shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully...');
  server.close(() => {
    mongoose.connection.close();
    logger.info('Server shutdown complete');
    process.exit(0);
  });
});

export { app, server };
