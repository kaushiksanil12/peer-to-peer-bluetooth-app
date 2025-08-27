// controllers/messageController.js
const Message = require('../models/Message');

// @desc   Backup messages from a client
// @route  POST /api/messages/backup
exports.backupMessages = async (req, res) => {
    const { messages } = req.body; // Expect an array of message objects

    if (!messages || !Array.isArray(messages) || messages.length === 0) {
        return res.status(400).json({ msg: 'Please provide an array of messages.' });
    }

    try {
        // insertMany is highly efficient for bulk inserts
        const insertedMessages = await Message.insertMany(messages, { ordered: false });
        res.status(201).json({ msg: `${insertedMessages.length} messages backed up successfully.` });
    } catch (err) {
        // We use ordered: false, so some messages might insert even if others fail due to duplicates.
        // The error object will contain more details if needed.
        if (err.code === 11000) { // Duplicate key error
             return res.status(207).json({ msg: 'Partial success. Some messages were duplicates and were ignored.' });
        }
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};

// You will add the forwardMessage logic here later for the gateway feature.