const db = require('../../utils/db');
const CacheService = require('../../services/cacheService');
const AnalyticsService = require('../../services/analyticsService');

/**
 * Dashboard Controller
 * Handles metric aggregation and leaderboard data for administrative roles.
 */
const neon = require('../../utils/neon');

const getMetrics = async (req, res) => {
  try {
    const cacheKey = `metrics_${req.user.id}_${req.user.role}`;
    const cached = await CacheService.get(cacheKey);
    if (cached) return res.json(cached);

    const { data: settings } = await db.from('Setting').select('registrationFee, employeeCanViewAll').eq('id', 1).single();
    const fee = settings?.registrationFee || 365;
    const canViewAll = req.user.role === 'owner' || settings?.employeeCanViewAll;

    const userFilterSql = canViewAll ? '' : ` AND "referredById" = $1`;
    const params = canViewAll ? [] : [req.user.id];

    const [countsRes, staffPerformance] = await Promise.all([
      neon.pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE role = 'member'${userFilterSql})::int AS "totalMembers",
          COUNT(*) FILTER (WHERE role = 'member' AND status = 'pending'${userFilterSql})::int AS "pendingApprovals",
          COUNT(*) FILTER (WHERE role = 'member' AND status = 'approved'${userFilterSql})::int AS "approvedMembers",
          COUNT(*) FILTER (WHERE role = 'employee')::int AS "totalEmployees"
        FROM "User";
      `, params),
      req.user.role === 'owner' ? AnalyticsService.getStaffPerformance() : Promise.resolve(null)
    ]);

    const counts = countsRes.rows[0] || {};
    const metrics = {
      totalMembers: counts.totalMembers || 0,
      totalEmployees: counts.totalEmployees || 0,
      pendingApprovals: counts.pendingApprovals || 0,
      totalCollected: (counts.approvedMembers || 0) * fee,
      staffPerformance
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
      leaderboard = await AnalyticsService.getStaffPerformance();
      await CacheService.set(cacheKey, leaderboard, 600); 
    }

    res.json(leaderboard);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getMetrics, getLeaderboard };
