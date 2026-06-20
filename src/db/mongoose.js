const mongoose = require('mongoose');
const { MONGODB_URI } = require('../config/env');

async function connectDB() {
  if (!MONGODB_URI) {
    console.warn('MONGODB_URI is not set. Live API routes will fail until MongoDB is configured.');
    return;
  }
  await mongoose.connect(MONGODB_URI);
  console.log('MongoDB connected successfully');
}

module.exports = connectDB;
