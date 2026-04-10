const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const Settings = require('../models/Settings');

dotenv.config();

mongoose.connect(process.env.MONGO_URI);

const seedData = async () => {
  try {
    await User.deleteMany();
    await Settings.deleteMany();

    const createdSettings = await Settings.create({
      registrationFee: 365,
      isNidVerificationRequired: true,
      activePaymentMethods: ['bkash', 'nagad', 'bank']
    });

    const owner = await User.create({
      name: 'samir',
      fatherName: 'N/A',
      dob: new Date('1990-01-01'),
      nid: '0000000000',
      phone: 'samir',
      password: 'samir',
      role: 'owner',
      status: 'approved',
      firstLogin: false
    });

    console.log('Data Imported!');
    console.log(`Owner Login: samir`);
    console.log(`Owner Password: samir`);
    process.exit();
  } catch (error) {
    console.error(`${error}`);
    process.exit(1);
  }
};

seedData();
