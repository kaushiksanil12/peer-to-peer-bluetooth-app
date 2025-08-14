const express = require('express');
const MessageService = require('../services/MessageService');

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const message = await MessageService.createMessage(req.body);
    res.json(message);
  } catch (err) {
    res.status(500).json({ msg: err.message });
  }
});

// Other endpoints: GET /:id, GET /, etc. (omitted for brevity)

module.exports = router;
