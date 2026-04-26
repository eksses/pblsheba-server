const webpush = require('web-push');
const supabase = require('./supabase');

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
    const { data: subscriptions, error } = await supabase
      .from('PushSubscription')
      .select('*')
      .eq('userId', userId);

    if (error) {
      console.error('Failed to fetch subscriptions:', error.message);
      return { sent: 0, failed: 0, cleaned: 0, error: error.message };
    }

    if (!subscriptions || subscriptions.length === 0) {
      console.log(`No push subscriptions found for user: ${userId}`);
      return { sent: 0, failed: 0, cleaned: 0 };
    }

    // Align exactly with the iOS WebPush article structure
    const standardPayload = {
      title: payload.title || 'PBL Sheba',
      body: payload.body || payload.message || 'You have a new notification',
      data: {
        url: payload.url || '/'
      }
    };
    
    const notificationPayload = JSON.stringify(standardPayload);
    let sent = 0;
    let failed = 0;
    let cleaned = 0;
    const sentEndpoints = [];

    for (const sub of subscriptions) {
      const pushConfig = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: sub.p256dh,
          auth: sub.auth
        }
      };

      try {
        await webpush.sendNotification(pushConfig, notificationPayload, {
          urgency: 'high',
          topic: 'pblsheba' // Optional but sometimes helpful for APNs
        });
        sent++;
        sentEndpoints.push(sub.endpoint.substring(0, 20) + '...');
      } catch (err) {
        console.warn(`[Push] Error for sub ${sub.id}:`, {
          statusCode: err.statusCode,
          body: err.body,
          endpoint: sub.endpoint.substring(0, 30) + '...'
        });
        if (err.statusCode === 410 || err.statusCode === 404) {
          await supabase.from('PushSubscription').delete().eq('id', sub.id);
          cleaned++;
        } else if (err.statusCode === 429) {
          await new Promise(r => setTimeout(r, 1000));
          try {
            await webpush.sendNotification(pushConfig, notificationPayload);
            sent++;
          } catch (retryErr) {
            failed++;
          }
        } else {
          failed++;
          console.error(`Push failed for sub ${sub.id}:`, err.statusCode, err.body);
        }
      }
    }

    console.log(`Push to user ${userId}: sent=${sent}, failed=${failed}, cleaned=${cleaned}`);
    return { sent, failed, cleaned, endpoints: sentEndpoints };
  } catch (error) {
    console.error(`Error sending push notification to user ${userId}:`, error.message);
    return { sent: 0, failed: 0, cleaned: 0, error: error.message };
  }
};

const sendRoleNotification = async (role, payload) => {
  try {
    let query = supabase.from('User').select('id');
    if (role !== 'all') {
      query = query.eq('role', role);
    }
    const { data: users, error } = await query;

    if (error) {
      console.error('Failed to fetch users for broadcast:', error.message);
      return { users: 0, sent: 0, failed: 0, cleaned: 0, error: error.message };
    }

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
