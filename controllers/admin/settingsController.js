const crypto = require('crypto');
const supabase = require('../../utils/supabase');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');
const logger = require('../../utils/logger');

/**
 * Settings Controller
 * Handles system-wide configuration and metadata.
 */
const getSettings = async (req, res) => {
  try {
    const { data: settings, error } = await supabase.from('Setting').select('*').eq('id', 1).maybeSingle();

    if (error && error.code !== 'PGRST116') throw error;

    if (!settings) {
      const defaultSettings = {
        id: 1,
        registrationFee: 365,
        paymentMethods: [
          { name: 'Bkash', number: '01XXXXXXXXX', type: 'Personal' },
          { name: 'Nagad', number: '01XXXXXXXXX', type: 'Personal' }
        ],
        employeeCanViewAll: false,
        jobApplicationsEnabled: true,
        smsWebhookKey: Array.from({length: 48}, () => Math.floor(Math.random() * 16).toString(16)).join(''),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      const { data: newSettings, error: initError } = await supabase
        .from('Setting')
        .insert([defaultSettings])
        .select()
        .single();

      if (initError) throw initError;
      return res.json({ ...newSettings, _id: newSettings.id });
    }

    res.json({ ...settings, _id: settings.id });
  } catch (error) {
    logger.error('Failed to get settings:', error);
    res.status(500).json({ message: error.message });
  }
};

const updateSettings = async (req, res) => {
  try {
    const { data: current } = await supabase.from('Setting').select('*').eq('id', 1).maybeSingle();
    
    const dbSmsKey = current ? Object.keys(current).find(k => k.toLowerCase() === 'smswebhookkey' || k.toLowerCase() === 'sms_webhook_key') : 'smsWebhookKey';
    const dbUpdateKey = current ? Object.keys(current).find(k => k.toLowerCase() === 'updatedat' || k.toLowerCase() === 'updated_at') : 'updatedAt';

    const updateData = {};
    if (req.body.registrationFee !== undefined) updateData.registrationFee = parseInt(req.body.registrationFee);
    if (req.body.paymentMethods) updateData.paymentMethods = JSON.parse(JSON.stringify(req.body.paymentMethods));
    if (req.body.employeeCanViewAll !== undefined) updateData.employeeCanViewAll = Boolean(req.body.employeeCanViewAll);
    if (req.body.jobApplicationsEnabled !== undefined) updateData.jobApplicationsEnabled = Boolean(req.body.jobApplicationsEnabled);
    if (req.body.smsWebhookKey !== undefined) updateData[dbSmsKey || 'smsWebhookKey'] = req.body.smsWebhookKey;
    
    updateData[dbUpdateKey || 'updatedAt'] = new Date().toISOString();

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

const regenerateSmsApiKey = async (req, res) => {
  try {
    if (req.user.role !== 'owner') return res.status(403).json({ message: 'Owner only' });

    const newKey = Array.from({length: 48}, () => Math.floor(Math.random() * 16).toString(16)).join('');

    // 1. Ensure settings exist and get existing data
    let { data: settings, error: fetchError } = await supabase.from('Setting').select('*').eq('id', 1).maybeSingle();
    
    if (!settings) {
      // Bootstrap if missing (emergency fallback)
      const bootstrap = {
        id: 1,
        registrationFee: 365,
        paymentMethods: [{ name: 'Bkash', number: '01XXXXXXXXX', type: 'Personal' }],
        employeeCanViewAll: false,
        jobApplicationsEnabled: true,
        smsWebhookKey: newKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      const { data: created, error: createError } = await supabase.from('Setting').insert([bootstrap]).select().single();
      if (createError) throw createError;
      settings = created;
    } else {
      // 2. Perform update with schema awareness
      const updatePayload = { updatedAt: new Date().toISOString() };
      
      // Determine correct column name from fetched settings
      const dbSmsKey = Object.keys(settings).find(k => k.toLowerCase() === 'smswebhookkey' || k.toLowerCase() === 'sms_webhook_key');
      const dbUpdateKey = Object.keys(settings).find(k => k.toLowerCase() === 'updatedat' || k.toLowerCase() === 'updated_at');
      
      if (dbSmsKey) updatePayload[dbSmsKey] = newKey;
      else updatePayload.smsWebhookKey = newKey; // Fallback
      
      if (dbUpdateKey) updatePayload[dbUpdateKey] = new Date().toISOString();

      const { data: updated, error: updateError } = await supabase
        .from('Setting')
        .update(updatePayload)
        .eq('id', 1)
        .select()
        .single();

      if (updateError) throw updateError;
      settings = updated;
    }

    await CacheService.invalidateSettings();

    LogService.info(
      `SMS Webhook API Key regenerated by admin`,
      'ADMIN_REGENERATE_SMS_KEY',
      null,
      { adminId: req.user.id }
    ).catch(err => logger.error('Audit logging failed:', err));

    res.json({ key: newKey });
  } catch (error) {
    logger.error('SMS Key Regeneration Failed:', error);
    res.status(500).json({ 
      message: error.message || 'Internal server error',
      details: error.details || null
    });
  }
};

module.exports = { getSettings, updateSettings, regenerateSmsApiKey };
