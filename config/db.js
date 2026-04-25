const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    if (!process.env.MONGO_URI) {
      console.warn('MONGODB_URI is missing. Database features will fail.');
      return;
    }
    const conn = await mongoose.connect(process.env.MONGO_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (err) {
    console.error(`MongoDB Connection Error Detail: ${err.message}`);
    if (err.message.includes('whitelist') || err.message.includes('IP')) {
      console.error('ACTION REQUIRED: Please check MongoDB Atlas IP Whitelist (allow 0.0.0.0/0 for Vercel).');
    }
    if (err.message.includes('authentication failed')) {
      console.error('ACTION REQUIRED: Please check your MONGO_URI username and password.');
    }
  }
};

module.exports = connectDB;
