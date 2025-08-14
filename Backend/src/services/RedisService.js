const redis = require('redis');

const client = redis.createClient({ url: process.env.REDIS_URL });
client.connect().catch(console.error);

// Example: Cache message
async function cacheMessage(id, data) {
  await client.set(id, JSON.stringify(data), { EX: 3600 });  // Expire in 1 hour
}

module.exports = { cacheMessage /* Add more methods */ };
