// server.js
const https = require('https'); // Use https instead of http
const fs = require('fs');
const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const connectDB = require('./config/db');

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Body parser middleware
app.use(express.json());

// Enable CORS (allows your app to talk to the server)
app.use(cors());

// Mount the router
app.use('/api', require('./routes/api'));

const sslOptions = {
  key: fs.readFileSync('key.pem'),
  cert: fs.readFileSync('cert.pem')
};


const PORT = process.env.PORT || 5001;

https.createServer(sslOptions, app).listen(PORT, () => {
  console.log(`Secure server running on port ${PORT}`);
});