const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');

/**
 * Approval Controller
 * Handles user status transitions, pending queues, and correction requests.
 */
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

    await LogService.info(
      `Admin ${req.user.name} changed status for ${updatedUser.name} to ${status}`,
      'USER_STATUS_UPDATE',
      updatedUser.id,
      { adminId: req.user.id, status }
    );

    // Invalidate metrics
    await CacheService.invalidateMetrics(req.user.id, req.user.role, updatedUser.referredById);
    // Also clear pending list cache
    await CacheService.clear(`pending_${req.user.id}_true`);
    await CacheService.clear(`pending_${req.user.id}_false`);

    res.json({ ...updatedUser, _id: updatedUser.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPendingMembers = async (req, res) => {
  try {
    const { data: settings } = await supabase.from('Setting').select('employeeCanViewAll').eq('id', 1).single();
    const canViewAll = req.user.role === 'owner' || settings?.employeeCanViewAll;

    const cacheKey = `pending_${req.user.id}_${canViewAll}`;
    const cached = await CacheService.get(cacheKey);
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
    await CacheService.set(cacheKey, usersWithId, 300);
    res.json(usersWithId);
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
      .update({ editRequestPending: false, editApproved: true })
      .eq('id', req.params.id)
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `Admin dismissed edit request for ${updatedUser.name}`,
      'ADMIN_DISMISS_EDIT',
      updatedUser.id,
      { adminId: req.user.id }
    );

    res.json({ message: 'Edit request dismissed', user: { ...updatedUser, _id: updatedUser.id } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { approveUser, getPendingMembers, getEditRequests, dismissEditRequest };
