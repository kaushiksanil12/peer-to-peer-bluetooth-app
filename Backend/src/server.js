require('dotenv').config();
const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const winston = require('winston');
const cron = require('node-cron');
const { connectDB } = require('./config/database');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const gatewayRoutes = require('./routes/gateway');
const authMiddleware = require('./middleware/auth');
const MessageService = require('./services/MessageService');
const GatewayService = require('./services/GatewayService');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: '*' } });

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [new winston.transports.Console()],
});

// Middleware
app.use(helmet());
app.use(compression());
app.use(cors());
app.use(express.json());
app.use(rateLimit({ windowMs: process.env.RATE_LIMIT_WINDOW_MS, max: process.env.RATE_LIMIT_MAX }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/messages', authMiddleware, messageRoutes);
app.use('/api/gateway', authMiddleware, gatewayRoutes);

// Health Check
app.get('/health', (req, res) => res.json({ status: 'healthy', timestamp: Date.now() }));

// WebSocket Events
io.on('connection', (socket) => {
  logger.info('New WebSocket connection');
  socket.on('register_device', (data) => GatewayService.registerDevice(data, socket));
  socket.on('mesh_message', (data) => MessageService.handleMeshMessage(data, io));
  socket.on('disconnect', () => logger.info('WebSocket disconnected'));
});

// Database Connection
connectDB();

// Cleanup Cron Job (every hour)
cron.schedule('0 * * * *', () => MessageService.cleanupExpiredMessages());

// Start Server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => logger.info(`Server running on port ${PORT}`));

// Graceful Shutdown
process.on('SIGTERM', () => {
  server.close(() => {
    mongoose.connection.close();
    logger.info('Server shutdown');
    process.exit(0);
  });
});
