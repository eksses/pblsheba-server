const PaymentSms = require('../../models/PaymentSms');
const { parseSms } = require('../../utils/smsParser');
const { processSmsMatching } = require('../../services/paymentService');
const CacheService = require('../../services/cacheService');
const supabase = require('../../utils/supabase');
const logger = require('../../utils/logger');

/**
 * SMS Webhook Controller
 * Receives incoming SMS data from Android Automation.
 */
const receiveSms = async (req, res) => {
  try {
    const { sender, body, apiKey } = req.body;

    // 1. Authenticate Request via DB Settings
    let settings = await CacheService.get('system_settings');
    if (!settings) {
      const { data } = await supabase.from('Setting').select('*').eq('id', 1).single();
      settings = data;
    }

    if (apiKey !== settings?.smsWebhookKey) {
      logger.warn(`Unauthorized SMS Webhook attempt from ${sender}`);
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!sender || !body) {
      return res.status(400).json({ message: 'Missing sender or body' });
    }

    // 2. Parse SMS
    const parsedData = parseSms(body);
    
    // 3. Save to MongoDB Log
    const newSms = new PaymentSms({
      sender,
      body,
      parsed: {
        ...parsedData,
        timestamp: new Date()
      }
    });

    try {
      await newSms.save();
    } catch (dbError) {
      if (dbError.code === 11000) {
        logger.info(`Duplicate SMS TrxID received: ${parsedData.trxId}`);
        return res.status(200).json({ message: 'Duplicate ignored' });
      }
      throw dbError;
    }

    // 4. Trigger Matching (Async)
    // We respond 200 immediately to the app, then process matching in background
    processSmsMatching(newSms._id).catch(err => {
      logger.error(`Background SMS Matching Error: ${err.message}`);
    });

    res.status(200).json({ 
      message: 'SMS Received',
      trxId: parsedData.trxId 
    });

  } catch (error) {
    logger.error(`SMS Webhook Error: ${error.message}`);
    res.status(500).json({ message: 'Internal server error' });
  }
};

/**
 * Get Unprocessed SMS (for Admin View)
 */
const getUnprocessedSms = async (req, res) => {
    if (require('mongoose').connection.readyState !== 1) {
      throw new Error('Database not connected. Please check MONGO_URI.');
    }
    const list = await PaymentSms.find({ status: 'unprocessed' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json(list);
  } catch (error) {
    logger.error(`Failed to fetch unprocessed SMS: ${error.message}`);
    res.status(500).json({ message: error.message });
  }
};

module.exports = { receiveSms, getUnprocessedSms };
