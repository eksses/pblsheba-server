const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');
const AuthService = require('../../services/authService');

/**
 * Member Controller
 * Handles CRUD operations for members within the admin domain.
 */
const createMember = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentMethod, paymentNumber, password, trxId } = req.body;

    const { data: exists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (exists) return res.status(400).json({ message: 'Phone already in use' });

    const imageUrl = req.file ? req.file.path : null;
    const hashedPassword = await AuthService.hashPassword(password);
    const memberId = require('crypto').randomUUID();

    const { data: member, error } = await supabase
      .from('User')
      .insert([{
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
      }])
      .select()
      .single();

    if (error) throw error;

    await CacheService.invalidateMetrics(req.user.id, req.user.role);
    res.status(201).json({ ...member, _id: member.id });
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

const deleteMember = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    const { data: user } = await supabase.from('User').select('name, phone').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const { error } = await supabase.from('User').delete().eq('id', req.params.id);
    if (error) throw error;

    await LogService.warn(
      `Member deleted by admin: ${user.name} (${user.phone})`,
      'ADMIN_DELETE_USER',
      null,
      { adminId: req.user.id, deletedUserId: req.params.id }
    );

    res.json({ message: 'Member removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const updateMember = async (req, res) => {
  try {
    const { data: user } = await supabase.from('User').select('name').eq('id', req.params.id).single();
    if (!user) return res.status(404).json({ message: 'User not found' });

    const updateData = {};
    const fields = ['name', 'phone', 'email', 'address', 'nid', 'fatherName', 'dob', 'status'];
    fields.forEach(f => {
      if (req.body[f] !== undefined) {
        updateData[f] = f === 'dob' ? new Date(req.body[f]).toISOString() : req.body[f];
      }
    });

    if (req.body.password) {
      updateData.password = await AuthService.hashPassword(req.body.password);
    }

    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({ ...updateData, updatedAt: new Date().toISOString() })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `Member info updated by admin: ${updatedUser.name}`,
      'ADMIN_UPDATE_USER',
      updatedUser.id,
      { adminId: req.user.id }
    );

    res.json({ ...updatedUser, _id: updatedUser.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { createMember, getMembers, deleteMember, updateMember };
