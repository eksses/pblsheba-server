const User = require('../models/User');
const generateToken = require('../utils/generateToken');
const Settings = require('../models/Settings');

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentNumber, password, paymentMethod, trxId } = req.body;

    const userExists = await User.findOne({ phone });
    if (userExists) {
      return res.status(400).json({ message: 'User with this phone already exists' });
    }

    const settings = await Settings.findOne();
    if (settings && settings.isNidVerificationRequired) {
      const nidExists = await User.findOne({ nid });
      if (nidExists) {
         return res.status(400).json({ message: 'User with this NID already exists' });
      }
    }

    const imageUrl = req.file ? req.file.path : null;

    const user = await User.create({
      name,
      fatherName,
      dob,
      nid,
      phone,
      paymentNumber,
      password,
      imageUrl,
      payment: {
         method: paymentMethod || 'bKash',
         number: paymentNumber,
         transactionId: trxId
      }
    });

    if (user) {
      res.status(201).json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        status: user.status,
        message: 'Registration successful! Please wait for admin approval to log in.'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Auth user & get token
// @route   POST /api/auth/login
// @access  Public
const authUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const user = await User.findOne({ phone });

    if (user && (await user.matchPassword(password))) {
      // Check if user is approved
      if (user.status !== 'approved' && user.role !== 'owner') {
        return res.status(401).json({ message: `Your account is currently ${user.status}. You cannot log in.` });
      }

      res.json({
        _id: user._id,
        name: user.name,
        phone: user.phone,
        role: user.role,
        firstLogin: user.firstLogin,
        imageUrl: user.imageUrl,
        status: user.status,
        nid: user.nid,
        fatherName: user.fatherName,
        dob: user.dob,
        token: generateToken(user._id),
      });
    } else {
      res.status(401).json({ message: 'Invalid phone or password' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { registerUser, authUser };
