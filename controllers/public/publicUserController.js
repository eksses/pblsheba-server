const supabase = require('../../utils/supabase');
const CacheService = require('../../services/cacheService');

/**
 * Public User Controller
 * Handles unauthenticated service discovery and member lookup.
 */
const publicSearch = async (req, res) => {
  try {
    const { name, fatherName, nid } = req.query;
    const cacheKey = `pub_search_${name || ''}_${fatherName || ''}_${nid || ''}`;
    
    const cached = await CacheService.get(cacheKey);
    if (cached) return res.json(cached);

    let query = supabase.from('User').select('id, name, status, imageUrl').eq('role', 'member');

    if (name?.trim()) query = query.ilike('name', `%${name.trim()}%`);
    if (fatherName?.trim()) query = query.ilike('fatherName', `%${fatherName.trim()}%`);
    if (nid?.trim()) query = query.ilike('nid', `%${nid.trim()}%`);

    const { data: users, error } = await query;
    if (error) throw error;

    const results = users.map(u => ({ ...u, _id: u.id }));
    await CacheService.set(cacheKey, results, 600);
    res.json(results);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

const getPublicSettings = async (req, res) => {
  try {
    const cacheKey = 'public_settings';
    let publicSettings = await CacheService.get(cacheKey);

    if (!publicSettings) {
      const { data: settings } = await supabase.from('Setting').select('*').eq('id', 1).single();

      const activePayments = Array.isArray(settings?.paymentMethods) ? settings.paymentMethods.filter(p => p.isActive) : [];
      publicSettings = {
        registrationFee: settings?.registrationFee || 365,
        paymentMethods: activePayments,
        jobApplicationsEnabled: settings?.jobApplicationsEnabled !== false
      };

      await CacheService.set(cacheKey, publicSettings, 3600);
    }

    res.json(publicSettings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { publicSearch, getPublicSettings };
