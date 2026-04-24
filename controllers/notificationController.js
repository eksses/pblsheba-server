const prisma = require('../utils/prisma');

const subscribe = async (req, res) => {
  try {
    const { subscription } = req.body;
    const userId = req.user.id; // From auth middleware

    if (!subscription || !subscription.endpoint) {
      return res.status(400).json({ message: 'Invalid subscription object' });
    }

    const { endpoint, keys } = subscription;

    await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId,
        p256dh: keys.p256dh,
        auth: keys.auth
      },
      create: {
        userId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth
      }
    });

    res.status(201).json({ message: 'Subscription saved successfully' });
  } catch (error) {
    console.error('Subscription error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

const unsubscribe = async (req, res) => {
  try {
    const { endpoint } = req.body;
    await prisma.pushSubscription.delete({
      where: { endpoint }
    });
    res.json({ message: 'Unsubscribed successfully' });
  } catch (error) {
    console.error('Unsubscribe error:', error);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  subscribe,
  unsubscribe
};
