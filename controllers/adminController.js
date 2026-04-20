const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');
const SystemLog = require('../models/SystemLog');
const { cacheData, getCachedData, clearCache } = require('../utils/redis');




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

    
    await SystemLog.create({
      level: 'info',
      message: `Admin ${req.user.name} changed status for ${updatedUser.name} to ${status}`,
      action: 'USER_STATUS_UPDATE',
      userId: updatedUser.id,
      metadata: { adminId: req.user.id, status }
    });

    // Clear metrics cache for both admin and potential referred employee
    await clearCache(`metrics_${req.user.id}_${req.user.role}`);
    if (updatedUser.referredById) {
      await clearCache(`metrics_${updatedUser.referredById}_employee`);
    }

    res.json({ ...updatedUser, _id: updatedUser.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const getMetrics = async (req, res) => {
  try {
    const cacheKey = `metrics_${req.user.id}_${req.user.role}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return res.json(cached);

    const { data: settings } = await supabase.from('Setting').select('registrationFee, employeeCanViewAll').eq('id', 1).single();
    const fee = settings?.registrationFee || 365;
    const canViewAll = req.user.role === 'owner' || settings?.employeeCanViewAll;

    let totalQC = supabase.from('User').select('id', { count: 'exact', head: true }).eq('role', 'member');
    let approvedQC = supabase.from('User').select('id', { count: 'exact', head: true }).eq('status', 'approved').eq('role', 'member');
    let pendingQC = supabase.from('User').select('id', { count: 'exact', head: true }).eq('status', 'pending').eq('role', 'member');

    if (!canViewAll) {
      totalQC = totalQC.eq('referredById', req.user.id);
      approvedQC = approvedQC.eq('referredById', req.user.id);
      pendingQC = pendingQC.eq('referredById', req.user.id);
    }

    const [
      { count: totalMembers },
      { count: pendingApprovals },
      { count: approvedMembers },
      { count: totalEmployees }
    ] = await Promise.all([
      totalQC,
      pendingQC,
      approvedQC,
      supabase.from('User').select('id', { count: 'exact', head: true }).eq('role', 'employee')
    ]);

    const metrics = {
      totalMembers: totalMembers || 0,
      totalEmployees: totalEmployees || 0,
      pendingApprovals: pendingApprovals || 0,
      totalCollected: (approvedMembers || 0) * fee
    };

    await cacheData(cacheKey, metrics, 60);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const getPendingMembers = async (req, res) => {
  try {
    const { data: settings } = await supabase.from('Setting').select('employeeCanViewAll').eq('id', 1).single();
    const canViewAll = req.user.role === 'owner' || settings?.employeeCanViewAll;

    const cacheKey = `pending_${req.user.id}_${canViewAll}`;
    const cached = await getCachedData(cacheKey);
    if (cached) return res.json(cached);

    let query = supabase
      .from('User')
      .select('id, name, phone, email, status, role, createdAt, referredById')
      .eq('status', 'pending')
      .eq('role', 'member');
      
    if (!canViewAll) {
       query = query.eq('referredById', req.user.id);
    }

    const { data: pendingUsers, error } = await query.order('createdAt', { ascending: false });
    if (error) throw error;
    
    const usersWithId = pendingUsers.map(u => ({ ...u, _id: u.id }));
    await cacheData(cacheKey, usersWithId, 300);
    res.json(usersWithId);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




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
          imageUrl: req.file ? req.file.path : null,
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

    await clearCache(`metrics_${req.user.id}_${req.user.role}`);
    res.status(201).json({ ...employee, _id: employee.id });
  } catch (error) {
    console.error('Create Employee Error:', error);
    res.status(500).json({ message: error.message });
  }
};




const createMember = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentMethod, paymentNumber, password, trxId } = req.body;

    const { data: exists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (exists) return res.status(400).json({ message: 'Phone already in use' });

    const imageUrl = req.file ? req.file.path : null;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    
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

    await clearCache(`metrics_${req.user.id}_${req.user.role}`);
    res.status(201).json({ ...member, _id: member.id });
  } catch (error) {
    console.error('Create Member Error:', error);
    res.status(500).json({ message: error.message });
  }
};




const getEmployees = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });
    const { data: employees, error } = await supabase
      .from('User')
      .select('id, name, phone, email, status, role, createdAt')
      .eq('role', 'employee');

    if (error) throw error;
    
    res.json(employees.map(e => ({ ...e, _id: e.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const getMembers = async (req, res) => {
  try {
    const { data: settings } = await supabase.from('Setting').select('employeeCanViewAll').eq('id', 1).single();
    const canViewAll = req.user.role === 'owner' || settings?.employeeCanViewAll;

    let query = supabase
      .from('User')
      .select('id, name, fatherName, email, phone, status, imageUrl, nid, createdAt, referredById')
      .eq('role', 'member')
      .eq('status', 'approved');

    if (!canViewAll) {
       query = query.eq('referredById', req.user.id);
    }

    const { data: members, error } = await query;

    if (error) throw error;
    
    res.json(members.map(m => ({ ...m, _id: m.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const deleteUser = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    
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




const updateUser = async (req, res) => {
  try {
    const { data: user } = await supabase.from('User').select('name').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateData = {};
    const fieldsToUpdate = ['name', 'phone', 'email', 'address', 'nid', 'fatherName', 'dob', 'status'];
    fieldsToUpdate.forEach((field) => {
      if (req.body[field] !== undefined) {
        updateData[field] = field === 'dob' ? new Date(req.body[field]).toISOString() : req.body[field];
      }
    });

    
    const { data: targetUser } = await supabase.from('User').select('role').eq('id', req.params.id).single();
    if (targetUser?.role === 'employee' && req.file) {
      updateData.imageUrl = req.file.path;
    }

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




const getSettings = async (req, res) => {
  try {
    const cacheKey = 'system_settings';
    let settings = await getCachedData(cacheKey);

    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;

      if (!settings) {
        
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




const updateSettings = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    const updateData = {};
    if (req.body.registrationFee !== undefined) updateData.registrationFee = parseInt(req.body.registrationFee);
    if (req.body.paymentMethods) updateData.paymentMethods = JSON.parse(JSON.stringify(req.body.paymentMethods));
    if (req.body.employeeCanViewAll !== undefined) updateData.employeeCanViewAll = Boolean(req.body.employeeCanViewAll);
    if (req.body.jobApplicationsEnabled !== undefined) updateData.jobApplicationsEnabled = Boolean(req.body.jobApplicationsEnabled);
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

    
    await clearCache('system_settings');
    await clearCache('public_settings');

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
      await cacheData(cacheKey, leaderboard, 600); 
    }

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




const getEditRequests = async (req, res) => {
  try {
    const { data: requests, error } = await supabase
      .from('User')
      .select('id, name, phone, editRequestedChanges, updatedAt')
      .eq('editRequestPending', true);

    if (error) throw error;
    
    res.json(requests.map(r => ({ ...r, _id: r.id })));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};




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
