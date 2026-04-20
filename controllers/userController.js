const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');
const { getCachedData, cacheData } = require('../utils/redis');
const SystemLog = require('../models/SystemLog');




const searchUsers = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;

    let query = supabase.from('User').select('id, name, fatherName, imageUrl, status, role, phone, nid, email, address');

    const conditions = [];
    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    
    const cacheKey = 'system_settings';
    let settings = await getCachedData(cacheKey);
    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;
      if (settings) await cacheData(cacheKey, settings, 3600);
    }
    const employeeCanViewAll = settings?.employeeCanViewAll || false;

    
    if (req.user.role === 'employee' && !employeeCanViewAll) {
      query = query.eq('referredById', req.user.id);
    }

    
    const { data: users, error } = await query;
    if (error) throw error;

    const sanitizedUsers = users.map(u => {
      const userWithId = { ...u, _id: u.id };
      if (req.user.role === 'owner' || (req.user.role === 'employee' && employeeCanViewAll)) {
        return userWithId;
      }
      return {
        id: u.id,
        _id: u.id,
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




const publicSearch = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;

    let query = supabase.from('User').select('id, name, status, imageUrl').eq('role', 'member');

    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    const { data: users, error } = await query;
    if (error) throw error;

    
    res.json(users.map(u => ({ ...u, _id: u.id })));

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




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




const updateProfile = async (req, res) => {
  try {
    const updateData = {};
    
    
    if ((req.user.role === 'employee' || req.user.role === 'owner') && req.file) {
      updateData.imageUrl = req.file.path;
    }
    
    if (req.body.name) updateData.name = req.body.name;
    if (req.body.email) updateData.email = req.body.email;
    if (req.body.address) updateData.address = req.body.address;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'No updates provided' });
    }

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq('id', req.user.id)
      .select()
      .single();

    if (error) throw error;

    res.json({ message: 'Profile updated successfully', user: { ...updatedUser, _id: updatedUser.id } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { searchUsers, requestEdit, changePassword, publicSearch, getPublicSettings, updateProfile };
