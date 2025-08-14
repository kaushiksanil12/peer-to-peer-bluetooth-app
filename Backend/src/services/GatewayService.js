const Gateway = require('../models/Gateway');

class GatewayService {
  static async registerDevice(data, socket) {
    let gateway = await Gateway.findOne({ deviceId: data.deviceId });
    if (!gateway) gateway = new Gateway(data);
    gateway.isGateway = data.isGateway;
    gateway.internetConnected = data.internetConnected;
    await gateway.save();
    socket.join('gateways');  // WebSocket room
  }

  static async routeToGateway(message) {
    // Find nearest gateway and route (geospatial query)
    const gateways = await Gateway.find({ isGateway: true, internetConnected: true });
    // Logic to select and forward (omitted for brevity)
  }

  static async getNetworkStatus() {
    return { activeGateways: await Gateway.countDocuments({ internetConnected: true }) };
  }
}

module.exports = GatewayService;
