const express = require('express');
const GatewayService = require('../services/GatewayService');

const router = express.Router();

router.get('/status', async (req, res) => {
  try {
    const status = await GatewayService.getNetworkStatus();
    res.json(status);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Other endpoints (omitted for brevity)

module.exports = router;
