const neon = require('../utils/neon');

/**
 * Analytics Service
 * Aggregates data for admin reporting and performance tracking.
 */
const getStaffPerformance = async () => {
  try {
    const res = await neon.pool.query(`
      SELECT 
        u.id, u.name, u.phone,
        COALESCE(r.reg_count, 0)::int AS registrations,
        COALESCE(s.survey_count, 0)::int AS surveys,
        (COALESCE(r.reg_count, 0) + COALESCE(s.survey_count, 0))::int AS "totalActivity"
      FROM "User" u
      LEFT JOIN (
        SELECT "referredById", COUNT(*)::int AS reg_count 
        FROM "User" 
        WHERE role = 'member' 
        GROUP BY "referredById"
      ) r ON r."referredById" = u.id
      LEFT JOIN (
        SELECT "submittedById", COUNT(*)::int AS survey_count 
        FROM "Survey" 
        GROUP BY "submittedById"
      ) s ON s."submittedById" = u.id
      WHERE u.role = 'employee'
      ORDER BY "totalActivity" DESC;
    `);

    return res.rows;
  } catch (error) {
    console.error('Analytics Error:', error.message);
    throw error;
  }
};

module.exports = {
  getStaffPerformance
};
