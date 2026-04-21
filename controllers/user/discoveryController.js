const supabase = require('../../utils/supabase');
const CacheService = require('../../services/cacheService');

/**
 * Discovery Controller
 * Handles internal member search and verification for authenticated users.
 */
const searchUsers = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;
    const cacheKey = `search_${req.user.id}_${name || ''}_${fatherName || ''}_${nid || ''}`;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) return res.json(cached);

    let query = supabase.from('User').select('id, name, fatherName, imageUrl, status, role, phone, nid, email, address');

    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    const settings = await CacheService.get('system_settings') ||
      (await supabase.from('Setting').select('*').eq('id', 1).single()).data;

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
      // Minimal data for regular members
      return {
        id: u.id, _id: u.id, name: u.name, fatherName: u.fatherName,
        imageUrl: u.imageUrl, status: u.status, role: u.role
      };
    });

    await CacheService.set(cacheKey, sanitizedUsers, 300);
    res.json(sanitizedUsers);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { searchUsers };
