const supabase = require('../utils/supabase');

/**
 * Analytics Service
 * Aggregates data for admin reporting and performance tracking.
 */
const getStaffPerformance = async () => {
  try {
    // 1. Get all employees
    const { data: employees, error: empError } = await supabase
      .from('User')
      .select('id, name, phone')
      .eq('role', 'employee');

    if (empError) throw empError;

    // 2. Fetch counts for each employee
    const performance = await Promise.all(employees.map(async (emp) => {
      // Count registrations
      const { count: regCount } = await supabase
        .from('User')
        .select('*', { count: 'exact', head: true })
        .eq('referredById', emp.id)
        .eq('role', 'member');

      // Count surveys
      const { count: surveyCount } = await supabase
        .from('Survey')
        .select('*', { count: 'exact', head: true })
        .eq('submittedById', emp.id);

      return {
        id: emp.id,
        name: emp.name,
        phone: emp.phone,
        registrations: regCount || 0,
        surveys: surveyCount || 0,
        totalActivity: (regCount || 0) + (surveyCount || 0)
      };
    }));

    return performance.sort((a, b) => b.totalActivity - a.totalActivity);
  } catch (error) {
    console.error('Analytics Error:', error.message);
    throw error;
  }
};

module.exports = {
  getStaffPerformance
};
