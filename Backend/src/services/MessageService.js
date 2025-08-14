const Message = require('../models/Message');
const GatewayService = require('../services/GatewayService');

class MessageService {
  static async createMessage(data) {
    const message = new Message(data);
    await message.save();
    // Route via gateway if needed
    if (data.fromMesh) await GatewayService.routeToGateway(message);
    return message;
  }

  static async handleMeshMessage(data, io) {
    // Implement TTL decrement and forwarding
    if (data.ttl > 0) {
      data.ttl -= 1;
      io.emit('direct_message', data);  // Broadcast
    }
  }

  static async cleanupExpiredMessages() {
    // Custom cleanup logic
  }
}

module.exports = MessageService;
