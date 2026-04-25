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

const sendPushNotification = async (userId, payload) => {
  try {
    const subscriptions = await prisma.pushSubscription.findMany({
      where: { userId }
    });

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    const notificationPayload = JSON.stringify(payload);
    let sent = 0;
    let failed = 0;
    let cleaned = 0;

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
          sent++;
        } catch (error) {
          if (error.statusCode === 410 || error.statusCode === 404) {
            try {
              await prisma.pushSubscription.delete({ where: { id: sub.id } });
              cleaned++;
            } catch (delErr) {
              console.error(`Failed to clean stale subscription ${sub.id}:`, delErr.message);
            }
          } else if (error.statusCode === 429) {
            // Rate limited — wait and retry once
            await new Promise(r => setTimeout(r, 1000));
            try {
              await webpush.sendNotification(pushConfig, notificationPayload);
              sent++;
            } catch (retryErr) {
              failed++;
            }
          } else {
            failed++;
            console.error(`Push failed for sub ${sub.id}:`, error.statusCode, error.body);
          }
        }
      })
    );

    console.log(`Push to user ${userId}: sent=${sent}, failed=${failed}, cleaned=${cleaned}`);
    return { sent, failed, cleaned };
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error.message);
    return { sent: 0, failed: 0, cleaned: 0, error: error.message };
  }
};

const sendRoleNotification = async (role, payload) => {
  try {
    const where = role === 'all' ? {} : { role };
    const users = await prisma.user.findMany({
      where,
      select: { id: true }
    });

    let totalSent = 0;
    let totalFailed = 0;
    let totalCleaned = 0;

    for (const user of users) {
      const result = await sendPushNotification(user.id, payload);
      totalSent += result.sent;
      totalFailed += result.failed;
      totalCleaned += result.cleaned;
    }

    console.log(`Role broadcast (${role}): ${users.length} users, sent=${totalSent}, failed=${totalFailed}`);
    return { users: users.length, sent: totalSent, failed: totalFailed, cleaned: totalCleaned };
  } catch (error) {
    console.error(`Error sending role notification to ${role}:`, error.message);
    return { users: 0, sent: 0, failed: 0, cleaned: 0, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
  sendRoleNotification
};
