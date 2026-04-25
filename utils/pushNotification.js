const webpush = require('web-push');
const prisma = require('./prisma');

if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT) {
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT,
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  );
} else {
  console.warn('PUSH NOTIFICATIONS DISABLED: VAPID keys missing in environment variables.');
}

/**
 * Send push notification to a specific user
 * @param {string} userId - Target user ID
 * @param {object} payload - Notification payload { title, body, icon, url }
 */
const sendPushNotification = async (userId, payload) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return;
    }

    const notificationPayload = JSON.stringify(payload);

    const results = await Promise.allSettled(
      subscriptions.map(async (sub) => {
        const pushConfig = {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        };

        try {
          await webpush.sendNotification(pushConfig, notificationPayload);
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            // Subscription has expired or is no longer valid, remove it
            await prisma.pushSubscription.delete({ where: { id: sub.id } });
          }
          throw error;
        }
      })
    );

    console.log(`Push notifications sent to user ${userId}:`, results.map(r => r.status));
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error);
  }
};

/**
 * Send push notification to all users with a specific role
 * @param {string} role - Target role ('owner', 'employee', 'member')
 * @param {object} payload - Notification payload
 */
const sendRoleNotification = async (role, payload) => {
  try {
    const where = role === 'all' ? {} : { role };
    const users = await prisma.user.findMany({
      where,
      select: { id: true }
    });

    await Promise.all(users.map(user => sendPushNotification(user.id, payload)));
  } catch (error) {
    console.error(`Error sending role notification to ${role}:`, error);
  }
};

module.exports = {
  sendPushNotification,
  sendRoleNotification
};
