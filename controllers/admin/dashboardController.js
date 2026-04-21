const supabase = require('../../utils/supabase');
const CacheService = require('../../services/cacheService');

/**
 * Dashboard Controller
 * Handles metric aggregation and leaderboard data for administrative roles.
 */
const getMetrics = async (req, res) => {
  try {
    const cacheKey = `metrics_${req.user.id}_${req.user.role}`;
    const cached = await CacheService.get(cacheKey);
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

    await CacheService.set(cacheKey, metrics, 60);
    res.json(metrics);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getLeaderboard = async (req, res) => {
  try {
    const cacheKey = 'leaderboard_data';
    let leaderboard = await CacheService.get(cacheKey);

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
      await CacheService.set(cacheKey, leaderboard, 600); 
    }

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMetrics, getLeaderboard };
