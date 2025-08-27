// controllers/userController.js
const User = require('../models/User');

// @desc   Register a new user
// @route  POST /api/users/register
exports.registerUser = async (req, res) => {
    const { userId, name } = req.body;

    if (!userId || !name) {
        return res.status(400).json({ msg: 'Please provide a userId and name' });
    }

    try {
        let user = await User.findOne({ userId });

        if (user) {
            return res.status(400).json({ msg: 'User already exists' });
        }

        user = new User({
            userId,
            name,
            isOnline: true,
            lastSeen: new Date()
        });

        await user.save();
        res.status(201).json({ msg: 'User registered successfully', user });

    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server Error');
    }
};