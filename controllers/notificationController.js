const crypto = require('crypto');
const supabase = require('../utils/supabase');
const { sendPushNotification, sendRoleNotification } = require('../utils/pushNotification');

const generateId = () => crypto.randomUUID().replace(/-/g, '').slice(0, 25);

const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id;

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    const { endpoint, keys } = subscription;

    if (!keys || !keys.p256dh || !keys.auth) {
      return res.status(400).json({ message: 'Missing encryption keys (p256dh or auth)' });
    }

    // Clean up: remove ALL old subscriptions for this user (prevents duplicates)
    await supabase
      .from('PushSubscription')
      .delete()
      .eq('userId', userId);

    // Insert fresh subscription
    const { error } = await supabase
      .from('PushSubscription')
      .insert({ id: generateId(), userId, endpoint, p256dh: keys.p256dh, auth: keys.auth });
    if (error) throw error;

    res.status(201).json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Subscription error:', error.message || error);
    res.status(500).json({ message: 'Failed to save subscription', error: error.message });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    const { error } = await supabase
      .from('PushSubscription')
      .delete()
      .eq('endpoint', endpoint);
    if (error) throw error;
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error.message);
    res.status(500).json({ message: 'Failed to unsubscribe' });
  }
};

const testPush = async (req, res) => {
  try {
    const userId = req.user.id;
    const { title, body } = req.body;

    const result = await sendPushNotification(userId, {
      title: title || 'PBL Sheba Test',
      body: body || 'Push notification is working!',
      url: '/'
    });

    res.json({ message: 'Test push sent', delivery: result });
  } catch (error) {
    console.error('Test push error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const broadcast = async (req, res) => {
  try {
    const { role, userId, title, body, url } = req.body;

    if (!title) {
      return res.status(400).json({ message: 'Title is required' });
    }

    let result;
    if (userId) {
      result = await sendPushNotification(userId, { title, body, url: url || '/' });
    } else if (role) {
      result = await sendRoleNotification(role, { title, body, url: url || '/' });
    } else {
      return res.status(400).json({ message: 'Provide either userId or role' });
    }

    res.json({ message: 'Broadcast complete', delivery: result });
  } catch (error) {
    console.error('Broadcast error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const mySubscriptions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('PushSubscription')
      .select('id, endpoint, createdAt')
      .eq('userId', req.user.id)
      .order('createdAt', { ascending: false });
    if (error) throw error;

    res.json({
      count: data.length,
      subscriptions: data.map(s => ({
        id: s.id,
        endpoint: s.endpoint.substring(0, 60) + '...',
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('List subscriptions error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

const allSubscriptions = async (req, res) => {
  try {
    const { data, error } = await supabase
      .from('PushSubscription')
      .select('id, userId, endpoint, createdAt')
      .order('createdAt', { ascending: false });
    if (error) throw error;

    res.json({
      count: data.length,
      subscriptions: data.map(s => ({
        id: s.id,
        userId: s.userId,
        endpoint: s.endpoint.substring(0, 60) + '...',
        createdAt: s.createdAt
      }))
    });
  } catch (error) {
    console.error('List all subscriptions error:', error.message);
    res.status(500).json({ message: error.message });
  }
};

module.exports = {
  subscribe,
  unsubscribe,
  testPush,
  broadcast,
  mySubscriptions,
  allSubscriptions
};
