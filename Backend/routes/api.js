// routes/api.js
const express = require('express');
const router = express.Router();

// Import controllers
const { registerUser } = require('../controllers/userController');
const { backupMessages } = require('../controllers/messageController'); // <-- IMPORT THIS

// Define user routes
router.post('/users/register', registerUser);

// Define message routes
router.post('/messages/backup', backupMessages); // <-- ADD THIS LINE

module.exports = router;