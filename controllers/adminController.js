const User = require('../models/User');

// @desc    Approve/Reject a pending member
// @route   PATCH /api/admin/approve/:id
// @access  Private (Owner/Employee)
const approveUser = async (req, res) => {
  try {
    const { status, paymentVerified } = req.body;
    
    if (!['approved', 'rejected', 'pending'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const updateData = { status };
    if (paymentVerified !== undefined) {
      updateData['payment.verified'] = paymentVerified;
      updateData['payment.verifiedBy'] = req.user.role === 'owner' ? 'admin' : 'system';
    }

    const updatedUser = await User.findByIdAndUpdate(req.params.id, { $set: updateData }, { new: true });

    if (updatedUser) {
      res.json(updatedUser);
    } else {
      res.status(404).json({ message: 'User not found' });
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard metrics
// @route   GET /api/admin/dashboard
// @access  Private (Owner/Employee)
const getMetrics = async (req, res) => {
  try {
    const totalMembers = await User.countDocuments({ role: 'member' });
    const totalEmployees = await User.countDocuments({ role: 'employee' });
    const pendingApprovals = await User.countDocuments({ status: 'pending' });
    
    // Simulate collected money based on approved members x 365 (assuming full fee payment)
    const approvedMembers = await User.countDocuments({ status: 'approved', role: 'member' });
    const totalCollected = approvedMembers * 365;

    res.json({
      totalMembers,
      totalEmployees,
      pendingApprovals,
      totalCollected
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get pending members
// @route   GET /api/admin/pending
// @access  Private (Owner/Employee)
const getPendingMembers = async (req, res) => {
  try {
    const pendingUsers = await User.find({ status: 'pending', role: 'member' });
    res.json(pendingUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create Employee
// @route   POST /api/admin/employees
// @access  Private (Owner)
const createEmployee = async (req, res) => {
  try {
    const { name, phone, password, nid, email, fatherName, address } = req.body;
    
    if(req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can create employees' });
    }

    const exists = await User.findOne({ phone });
    if(exists) return res.status(400).json({ message: 'Phone already in use' });

    const employee = await User.create({
      name,
      phone,
      password,
      nid,
      email,
      fatherName: fatherName || 'N/A',
      address,
      role: 'employee',
      status: 'approved',
      firstLogin: true,
      dob: new Date('1990-01-01'), // dummy date
    });

    res.status(201).json(employee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manual Create Member
// @route   POST /api/admin/members
// @access  Private (Owner/Employee)
const createMember = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentMethod, paymentNumber, password, trxId } = req.body;

    const exists = await User.findOne({ phone });
    if(exists) return res.status(400).json({ message: 'Phone already in use' });

    const imageUrl = req.file ? req.file.path : null;

    const member = await User.create({
      name,
      fatherName,
      dob: dob || new Date('1990-01-01'),
      nid,
      phone,
      password,
      imageUrl,
      role: 'member',
      status: 'approved', // Manual creation means it's pre-approved
      referredBy: req.user._id,
      payment: {
        method: paymentMethod || 'bKash',
        number: paymentNumber,
        transactionId: trxId,
        verified: true, // Manual creation skips pending verification
        verifiedBy: req.user.role === 'owner' ? 'admin' : 'system'
      }
    });

    res.status(201).json(member);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private (Owner)
const getEmployees = async (req, res) => {
  try {
    if(req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    const employees = await User.find({ role: 'employee' }).select('-password');
    res.json(employees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all members
// @route   GET /api/admin/members
// @access  Private (Owner/Employee)
const getMembers = async (req, res) => {
  try {
    const members = await User.find({ role: 'member', status: 'approved' }).select('-password');
    res.json(members);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Owner)
const deleteUser = async (req, res) => {
  try {
    if(req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    res.json({ message: 'User removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update arbitrary user info
// @route   PATCH /api/admin/users/:id
// @access  Private (Owner/Employee)
const updateUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });

    // Allow updating these fields
    const fieldsToUpdate = ['name', 'phone', 'email', 'address', 'nid', 'fatherName', 'dob'];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        user[field] = req.body[field];
      }
    });

    if (req.body.password) {
      user.password = req.body.password;
    }

    const updatedUser = await user.save();
    res.json(updatedUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const Settings = require('../models/Settings');

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Owner/Employee)
const getSettings = async (req, res) => {
  try {
    let settings = await Settings.findOne();
    if (!settings) {
      settings = await Settings.create({});
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update system settings
// @route   PATCH /api/admin/settings
// @access  Private (Owner)
const updateSettings = async (req, res) => {
  try {
    if(req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    
    let settings = await Settings.findOne();
    if (!settings) {
      settings = new Settings();
    }
    
    settings.registrationFee = req.body.registrationFee !== undefined ? req.body.registrationFee : settings.registrationFee;
    settings.paymentMethods = req.body.paymentMethods || settings.paymentMethods;
    settings.employeeCanViewAll = req.body.employeeCanViewAll !== undefined ? req.body.employeeCanViewAll : settings.employeeCanViewAll;
    
    const updated = await settings.save();
    res.json(updated);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get top employees based on members referred
// @route   GET /api/admin/leaderboard
// @access  Private (Owner/Employee)
const getLeaderboard = async (req, res) => {
  try {
    const leaderboard = await User.aggregate([
      { $match: { role: 'member', status: 'approved', referredBy: { $ne: null } } },
      { $group: { _id: '$referredBy', memberCount: { $sum: 1 } } },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'employee'
        }
      },
      { $unwind: '$employee' },
      { $sort: { memberCount: -1 } },
      { $project: { _id: 1, name: '$employee.name', phone: '$employee.phone', memberCount: 1 } }
    ]);
    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all pending edit requests
// @route   GET /api/admin/edit-requests
// @access  Private (Owner/Employee)
const getEditRequests = async (req, res) => {
  try {
    const requests = await User.find({ 'editRequest.pending': true }).select('-password');
    res.json(requests);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Dismiss an edit request
// @route   PATCH /api/admin/edit-requests/:id/dismiss
// @access  Private (Owner/Employee)
const dismissEditRequest = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'User not found' });
    
    if (user.editRequest) {
      user.editRequest.pending = false;
      user.editRequest.approved = true;
    }
    
    await user.save();
    res.json({ message: 'Edit request dismissed', user: user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { approveUser, getMetrics, getPendingMembers, createEmployee, createMember, getEmployees, getMembers, deleteUser, updateUser, getSettings, updateSettings, getLeaderboard, getEditRequests, dismissEditRequest };
