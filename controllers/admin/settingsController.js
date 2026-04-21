const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');

/**
 * Settings Controller
 * Handles system-wide configuration and metadata.
 */
const getSettings = async (req, res) => {
  try {
    const cacheKey = 'system_settings';
    let settings = await CacheService.get(cacheKey);

    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;

      if (!settings) {
        // Initialize default settings if missing
        const { data: newSettings } = await supabase
          .from('Setting')
          .insert([{
            id: 1,
            registrationFee: 365,
            paymentMethods: [
              { name: 'bKash', number: '01700000000', instructions: '...', isActive: true, themeColor: '#E2136E', logoUrl: '...' },
              { name: 'Nagad', number: '01700000000', instructions: '...', isActive: true, themeColor: '#F7931E', logoUrl: '...' }
            ],
            employeeCanViewAll: false,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }])
          .select()
          .single();
        settings = newSettings;
      }
      await CacheService.set(cacheKey, settings, 3600);
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

    if (error) throw error;

    // Invalidate caches
    await CacheService.invalidateSettings();

    await LogService.info(
      `System settings updated by admin`,
      'ADMIN_UPDATE_SETTINGS',
      null,
      { adminId: req.user.id, updates: updateData }
    );

    res.json({ ...updated, _id: updated.id });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

module.exports = { getSettings, updateSettings };
