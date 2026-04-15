const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');
const SystemLog = require('../models/SystemLog');
const { cacheData, getCachedData, removeCachedData } = require('../utils/redis');

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
      updateData.paymentVerified = paymentVerified;
      updateData.verifiedBy = req.user.role === 'owner' ? 'admin' : 'system';
    }

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error || !updatedUser) {
      return res.status(404).json({ message: 'User not found or update failed' });
    }

    // Log Approval/Rejection
    await SystemLog.create({
      level: 'info',
      message: `Admin ${req.user.name} changed status for ${updatedUser.name} to ${status}`,
      action: 'USER_STATUS_UPDATE',
      userId: updatedUser.id,
      metadata: { adminId: req.user.id, status }
    });

    res.json({ ...updatedUser, _id: updatedUser.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get dashboard metrics
// @route   GET /api/admin/dashboard
// @access  Private (Owner/Employee)
const getMetrics = async (req, res) => {
  try {
    const { count: totalMembers } = await supabase.from('User').select('*', { count: 'exact', head: true }).eq('role', 'member');
    const { count: totalEmployees } = await supabase.from('User').select('*', { count: 'exact', head: true }).eq('role', 'employee');
    const { count: pendingApprovals } = await supabase.from('User').select('*', { count: 'exact', head: true }).eq('status', 'pending').eq('role', 'member');

    // Get settings for calculation
    const { data: settings } = await supabase.from('Setting').select('registrationFee').eq('id', 1).single();
    const fee = settings?.registrationFee || 365;

    const { count: approvedMembers } = await supabase.from('User').select('*', { count: 'exact', head: true }).eq('status', 'approved').eq('role', 'member');
    const totalCollected = (approvedMembers || 0) * fee;

    res.json({
      totalMembers: totalMembers || 0,
      totalEmployees: totalEmployees || 0,
      pendingApprovals: pendingApprovals || 0,
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
    const { data: pendingUsers, error } = await supabase
      .from('User')
      .select('*')
      .eq('status', 'pending')
      .eq('role', 'member')
      .order('createdAt', { ascending: false });

    if (error) throw error;
    // Add _id alias for backward compatibility
    const usersWithId = pendingUsers.map(u => ({ ...u, _id: u.id }));
    res.json(usersWithId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Create Employee
// @route   POST /api/admin/employees
// @access  Private (Owner)
const createEmployee = async (req, res) => {
  try {
    const { name, phone, password, nid, email, fatherName, address, dob } = req.body;

    if (req.user.role !== 'owner') {
      return res.status(403).json({ message: 'Only owners can create employees' });
    }

    const { data: exists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (exists) return res.status(400).json({ message: 'Phone already in use' });

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate a unique ID for the employee
    const employeeId = require('crypto').randomUUID();

    const { data: employee, error } = await supabase
      .from('User')
      .insert([
        {
          id: employeeId,
          name,
          phone,
          password: hashedPassword,
          nid,
          email,
          fatherName: fatherName || 'N/A',
          address,
          role: 'employee',
          status: 'approved',
          firstLogin: true,
          dob: dob ? new Date(dob).toISOString() : new Date('1990-01-01').toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error:', error);
      throw error;
    }

    await SystemLog.create({
      level: 'info',
      message: `Employee created: ${employee.name}`,
      action: 'ADMIN_CREATE_EMPLOYEE',
      userId: employee.id,
      metadata: { adminId: req.user.id }
    });

    res.status(201).json({ ...employee, _id: employee.id });
  } catch (error) {
    console.error('Create Employee Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Manual Create Member
// @route   POST /api/admin/members
// @access  Private (Owner/Employee)
const createMember = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentMethod, paymentNumber, password, trxId } = req.body;

    const { data: exists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (exists) return res.status(400).json({ message: 'Phone already in use' });

    const imageUrl = req.file ? req.file.path : null;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Generate unique ID for the member
    const memberId = require('crypto').randomUUID();

    const { data: member, error } = await supabase
      .from('User')
      .insert([
        {
          id: memberId,
          name,
          fatherName,
          dob: dob ? new Date(dob).toISOString() : new Date('1990-01-01').toISOString(),
          nid,
          phone,
          password: hashedPassword,
          imageUrl,
          role: 'member',
          status: 'approved',
          referredById: req.user.id,
          paymentMethod: paymentMethod || 'bKash',
          paymentTrxId: trxId,
          paymentVerified: true,
          verifiedBy: req.user.role === 'owner' ? 'admin' : 'system',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('Create member error:', error);
      throw error;
    }

    await SystemLog.create({
      level: 'info',
      message: `Member manually created: ${member.name}`,
      action: 'ADMIN_CREATE_MEMBER',
      userId: member.id,
      metadata: { adminId: req.user.id }
    });

    res.status(201).json({ ...member, _id: member.id });
  } catch (error) {
    console.error('Create Member Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all employees
// @route   GET /api/admin/employees
// @access  Private (Owner)
const getEmployees = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    const { data: employees, error } = await supabase
      .from('User')
      .select('id, name, phone, email, status, role, createdAt')
      .eq('role', 'employee');

    if (error) throw error;
    // Add _id alias
    res.json(employees.map(e => ({ ...e, _id: e.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get all members
// @route   GET /api/admin/members
// @access  Private (Owner/Employee)
const getMembers = async (req, res) => {
  try {
    const { data: members, error } = await supabase
      .from('User')
      .select('id, name, phone, status, imageUrl, nid, createdAt')
      .eq('role', 'member')
      .eq('status', 'approved');

    if (error) throw error;
    // Add _id alias
    res.json(members.map(m => ({ ...m, _id: m.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private (Owner)
const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    // Check if user exists
    const { data: user } = await supabase.from('User').select('name, phone').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { error } = await supabase.from('User').delete().eq('id', req.params.id);
    if (error) throw error;

    await SystemLog.create({
      level: 'warn',
      message: `User deleted by admin: ${user.name} (${user.phone})`,
      action: 'ADMIN_DELETE_USER',
      metadata: { adminId: req.user.id, deletedUserId: req.params.id }
    });

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
    const { data: user } = await supabase.from('User').select('name').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateData = {};
    const fieldsToUpdate = ['name', 'phone', 'email', 'address', 'nid', 'fatherName', 'dob'];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = field === 'dob' ? new Date(req.body[field]).toISOString() : req.body[field];
      }
    });

    if (req.body.password) {
      const salt = await bcrypt.genSalt(10);
      updateData.password = await bcrypt.hash(req.body.password, salt);
    }

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await SystemLog.create({
      level: 'info',
      message: `User info updated by admin: ${updatedUser.name}`,
      action: 'ADMIN_UPDATE_USER',
      userId: updatedUser.id,
      metadata: { adminId: req.user.id }
    });

    res.json({ ...updatedUser, _id: updatedUser.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get system settings
// @route   GET /api/admin/settings
// @access  Private (Owner/Employee)
const getSettings = async (req, res) => {
  try {
    const cacheKey = 'system_settings';
    let settings = await getCachedData(cacheKey);

    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;

      if (!settings) {
        // Create initial settings if none exist
        const { data: newSettings } = await supabase
          .from('Setting')
          .insert([
            {
              id: 1,
              registrationFee: 365,
              paymentMethods: [
                { name: 'bKash', number: '01700000000', instructions: '...', isActive: true, themeColor: '#E2136E', logoUrl: '...' },
                { name: 'Nagad', number: '01700000000', instructions: '...', isActive: true, themeColor: '#F7931E', logoUrl: '...' }
              ],
              employeeCanViewAll: false,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          ])
          .select()
          .single();
        settings = newSettings;
      }
      await cacheData(cacheKey, settings, 3600);
    }
    res.json({ ...settings, _id: settings.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Update system settings
// @route   PATCH /api/admin/settings
// @access  Private (Owner)
const updateSettings = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    const updateData = {};
    if (req.body.registrationFee !== undefined) updateData.registrationFee = parseInt(req.body.registrationFee);
    if (req.body.paymentMethods) updateData.paymentMethods = JSON.parse(JSON.stringify(req.body.paymentMethods));
    if (req.body.employeeCanViewAll !== undefined) updateData.employeeCanViewAll = Boolean(req.body.employeeCanViewAll);
    updateData.updatedAt = new Date().toISOString();

    const { data: updated, error } = await supabase
      .from('Setting')
      .update(updateData)
      .eq('id', 1)
      .select()
      .single();

    if (error) {
      console.error('Settings update error:', error);
      throw error;
    }

    // Invalidate caches
    await removeCachedData('system_settings');
    await removeCachedData('public_settings');

    await SystemLog.create({
      level: 'info',
      message: `System settings updated by admin`,
      action: 'ADMIN_UPDATE_SETTINGS',
      metadata: { adminId: req.user.id, updates: updateData }
    });

    res.json({ ...updated, _id: updated.id });
  } catch (error) {
    console.error('Update Settings Error:', error);
    res.status(500).json({ message: error.message });
  }
};

// @desc    Get top employees based on members referred
// @route   GET /api/admin/leaderboard
// @access  Private (Owner/Employee)
const getLeaderboard = async (req, res) => {
  try {
    const cacheKey = 'leaderboard_data';
    let leaderboard = await getCachedData(cacheKey);

    if (!leaderboard) {
      const { data: employees, error } = await supabase.from('User').select('id, name, phone').eq('role', 'employee');
      if (error) throw error;

      leaderboard = await Promise.all(employees.map(async (emp) => {
        const { count } = await supabase
          .from('User')
          .select('*', { count: 'exact', head: true })
          .eq('referredById', emp.id)
          .eq('status', 'approved')
          .eq('role', 'member');

        return {
          id: emp.id,
          _id: emp.id,
          name: emp.name,
          phone: emp.phone,
          memberCount: count || 0
        };
      }));

      leaderboard.sort((a, b) => b.memberCount - a.memberCount);
      await cacheData(cacheKey, leaderboard, 600); // 10 mins cache
    }

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
    const { data: requests, error } = await supabase
      .from('User')
      .select('id, name, phone, editRequestedChanges, updatedAt')
      .eq('editRequestPending', true);

    if (error) throw error;
    // Add _id alias
    res.json(requests.map(r => ({ ...r, _id: r.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// @desc    Dismiss an edit request
// @route   PATCH /api/admin/edit-requests/:id/dismiss
// @access  Private (Owner/Employee)
const dismissEditRequest = async (req, res) => {
  try {
    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        editRequestPending: false,
        editApproved: true
      })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await SystemLog.create({
      level: 'info',
      message: `Admin dismissed edit request for ${updatedUser.name}`,
      action: 'ADMIN_DISMISS_EDIT',
      userId: updatedUser.id,
      metadata: { adminId: req.user.id }
    });

    res.json({ message: 'Edit request dismissed', user: { ...updatedUser, _id: updatedUser.id } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { approveUser, getMetrics, getPendingMembers, createEmployee, createMember, getEmployees, getMembers, deleteUser, updateUser, getSettings, updateSettings, getLeaderboard, getEditRequests, dismissEditRequest };
