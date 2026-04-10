const User = require('../models/User');
const Settings = require('../models/Settings');

// @desc    Search matching users by multi-field logic
// @route   GET /api/users/search
// @access  Private (Registered Member/Employee/Owner)
const searchUsers = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;

    const conditions = [];
    if (name?.trim()) conditions.push({ name: { $regex: name.trim(), $options: 'i' } });
    if (fatherName?.trim()) conditions.push({ fatherName: { $regex: fatherName.trim(), $options: 'i' } });
    if (nid?.trim()) conditions.push({ nid: { $regex: nid.trim(), $options: 'i' } });

    // Ensure we don't query the entire DB if no parameters are passed
    if (conditions.length === 0) {
      return res.status(400).json({ message: 'At least one search parameter is required' });
    }

    let keyword = {
      $and: conditions
    };

    // Check settings for global employee read access
    let settings = await Settings.findOne();
    if (!settings) settings = { employeeCanViewAll: false };

    // Employees can only search members they've created UNLESS setting allows all
    if (req.user.role === 'employee' && !settings.employeeCanViewAll) {
      keyword.referredBy = req.user._id;
    }

    // If caller is an owner or employee with full view, allow full data. Otherwise, limit it to name, fatherName, imageUrl.
    let projection = '-password';
    if (req.user.role === 'member') {
      projection = 'name fatherName imageUrl status';
    }

    const users = await User.find({ ...keyword }).select(projection);
    res.json(users);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Request a profile edit
// @route   PATCH /api/users/request-edit
// @access  Private
const requestEdit = async (req, res) => {
  try {
    const { requestedChanges } = req.body;
    
    const user = await User.findById(req.user._id);

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    user.editRequest = {
      pending: true,
      requestedChanges: requestedChanges,
      approved: false
    };

    const updatedUser = await user.save();
    res.json({ message: 'Edit request submitted', editRequest: updatedUser.editRequest });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Change password
// @route   PATCH /api/users/change-password
// @access  Private
const changePassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    user.password = newPassword;
    user.firstLogin = false; // Flag handled
    await user.save();
    
    res.json({ message: 'Password updated successfully', user: { ...user._doc, password: '' } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Public search for visitors to verify members
// @route   GET /api/public/search
// @access  Public
const publicSearch = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;

    const conditions = [];
    if (name?.trim()) conditions.push({ name: { $regex: name.trim(), $options: 'i' } });
    if (fatherName?.trim()) conditions.push({ fatherName: { $regex: fatherName.trim(), $options: 'i' } });
    if (nid?.trim()) conditions.push({ nid: { $regex: nid.trim(), $options: 'i' } });

    if (conditions.length === 0) {
      return res.status(400).json({ message: 'At least one search parameter is required' });
    }

    const keyword = {
      $and: conditions,
      role: 'member' // only members
    };

    // Extreme restriction: ONLY name and status
    const users = await User.find({ ...keyword }).select('name status');
    res.json(users);

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get public settings for registration
// @route   GET /api/public/settings
// @access  Public
const getPublicSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    // Only send public-safe data like fee and active payment methods
    const activePayments = settings.paymentMethods.filter(p => p.isActive);
    
    res.json({
      registrationFee: settings.registrationFee,
      paymentMethods: activePayments
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { searchUsers, requestEdit, changePassword, publicSearch, getPublicSettings };
