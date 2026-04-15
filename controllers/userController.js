const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');
const { getCachedData, cacheData } = require('../utils/redis');
const SystemLog = require('../models/SystemLog');

// @desc    Search matching users by multi-field logic
// @route   GET /api/users/search
// @access  Private (Registered Member/Employee/Owner)
const searchUsers = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;

    let query = supabase.from('User').select('id, name, fatherName, imageUrl, status, role, phone, nid, email, address');

    const conditions = [];
    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    // Check settings for global employee read access
    const cacheKey = 'system_settings';
    let settings = await getCachedData(cacheKey);
    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;
      if (settings) await cacheData(cacheKey, settings, 3600);
    }
    const employeeCanViewAll = settings?.employeeCanViewAll || false;

    // Employees can only search members they've created UNLESS setting allows all
    if (req.user.role === 'employee' && !employeeCanViewAll) {
      query = query.eq('referredById', req.user.id);
    }

    // Role-based selection
    const { data: users, error } = await query;
    if (error) throw error;

    const sanitizedUsers = users.map(u => {
      if (req.user.role === 'owner' || (req.user.role === 'employee' && employeeCanViewAll)) {
        return u;
      }
      return {
        id: u.id,
        name: u.name,
        fatherName: u.fatherName,
        imageUrl: u.imageUrl,
        status: u.status,
        role: u.role
      };
    });

    res.json(sanitizedUsers);

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
    
    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        editRequestPending: true,
        editRequestedChanges: requestedChanges,
        editApproved: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await SystemLog.create({
      level: 'info',
      message: `Profile edit requested by ${updatedUser.name}`,
      action: 'USER_EDIT_REQUEST',
      userId: updatedUser.id,
      metadata: { requestedChanges }
    });

    res.json({ message: 'Edit request submitted' });

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
    
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        password: hashedPassword,
        firstLogin: false,
        updatedAt: new Date().toISOString()
      })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    await SystemLog.create({
      level: 'info',
      message: `Password changed by user: ${updatedUser.name}`,
      action: 'USER_CHANGE_PASSWORD',
      userId: updatedUser.id
    });
    
    res.json({ message: 'Password updated successfully' });
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

    let query = supabase.from('User').select('name, status, imageUrl').eq('role', 'member');

    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    const { data: users, error } = await query;
    if (error) throw error;

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
    const cacheKey = 'public_settings';
    let publicSettings = await getCachedData(cacheKey);

    if (!publicSettings) {
      const { data: settings } = await supabase.from('Setting').select('*').eq('id', 1).single();
      
      const activePayments = Array.isArray(settings?.paymentMethods) ? settings.paymentMethods.filter(p => p.isActive) : [];
      publicSettings = {
        registrationFee: settings?.registrationFee || 365,
        paymentMethods: activePayments
      };
      
      await cacheData(cacheKey, publicSettings, 3600);
    }
    
    res.json(publicSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { searchUsers, requestEdit, changePassword, publicSearch, getPublicSettings };
