const prisma = require('../utils/prisma');
const PaymentSms = require('../models/PaymentSms');
const logger = require('../utils/logger');
const { sendPushNotification } = require('../utils/pushNotification');

/**
 * Process a parsed SMS and attempt to match it with a pending user registration.
 */
const processSmsMatching = async (smsId) => {
  const sms = await PaymentSms.findById(smsId);
  if (!sms || !sms.parsed.trxId) return;

  try {
    // 1. Find User with matching TrxID in Postgres
    const user = await prisma.user.findFirst({
      where: {
        paymentTrxId: sms.parsed.trxId,
        status: 'pending'
      }
    });

    if (!user) {
      logger.info(`SMS ${sms.parsed.trxId} received but no matching pending user found.`);
      return;
    }

    // 2. Verify Amount (Optional: but recommended if amount is available)
    // If you have a specific registration fee, check it here.
    // For now, if user entered the TrxID and we got the SMS with same TrxID, it's a strong match.

    // 3. Update User State in Postgres (Transactional source of truth)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        paymentVerified: true,
        verifiedBy: 'system',
        status: 'approved',
        updatedAt: new Date()
      }
    });

    // 4. Update SMS Log in MongoDB
    sms.status = 'matched';
    sms.userId = user.id;
    await sms.save();

    logger.info(`Auto-approved user ${user.phone} via SMS Match (TrxID: ${sms.parsed.trxId})`);

    // 5. Notify User
    await sendPushNotification(user.id, {
      title: 'Account Approved!',
      body: 'Your payment was automatically verified. Welcome to PBL Sheba!',
      url: '/profile'
    });

  } catch (error) {
    logger.error(`Error matching SMS ${sms.parsed.trxId}: ${error.message}`);
    sms.status = 'error';
    sms.error = error.message;
    await sms.save();
  }
};

module.exports = { processSmsMatching };
