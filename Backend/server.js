// server.js (Updated for Render)

const http = require('http'); // <-- Change back to http
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// ... (your app setup and middleware)
const app = express();
app.use(express.json());
app.use(cors());
app.use('/api', require('./routes/api'));

// This part is now correct for both local and Render deployment
const PORT = process.env.PORT || 5001;

// Create a standard HTTP server
const server = http.createServer(app);

server.listen(PORT, () => {
    // Check if the database connection is successful before logging server start
    connectDB().then(() => {
        console.log(`Server running on port ${PORT}`);
    }).catch(err => {
        console.error('Failed to connect to MongoDB', err);
        process.exit(1);
    });
});