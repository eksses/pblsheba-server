const supabase = require('../../utils/supabase');
const AuthService = require('../../services/authService');
const LogService = require('../../services/logService');
const CacheService = require('../../services/cacheService');
const { sendPushNotification, sendRoleNotification } = require('../../utils/pushNotification');

/**
 * Authentication Controller
 * Handles user lifecycle entry points: registration and session initiation.
 */
const registerUser = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentNumber, password, paymentMethod, trxId } = req.body;

    // Check availability
    const { data: userExists } = await supabase.from('User').select('id').eq('phone', phone).single();
    if (userExists) return res.status(400).json({ message: 'User with this phone already exists' });

    if (nid) {
      const { data: nidExists } = await supabase.from('User').select('id').eq('nid', nid).single();
      if (nidExists) return res.status(400).json({ message: 'User with this NID already exists' });
    }

    const imageUrl = req.file ? req.file.path : null;
    const hashedPassword = await AuthService.hashPassword(password);

    const { data: user, error } = await supabase
      .from('User')
      .insert([{
        id: require('crypto').randomUUID(),
        name,
        fatherName,
        dob: new Date(dob).toISOString(),
        nid: nid || null,
        phone,
        paymentNumber,
        password: hashedPassword,
        imageUrl,
        paymentMethod: paymentMethod || 'bKash',
        paymentTrxId: trxId,
        role: 'member',
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) throw error;

    await LogService.info(
      `New user registration: ${user.name} (${user.phone})`,
      'USER_REGISTER',
      user.id,
      { ip: req.ip }
    );

    // Notify Admins
    await sendRoleNotification('owner', {
      title: 'New Member Registration',
      body: `${user.name} has registered and is awaiting approval.`,
      url: '/approvals'
    });

    // Notify User about pending payment
    await sendPushNotification(user.id, {
      title: 'Registration Received',
      body: 'Your registration is being processed. Payment status: PENDING.',
      url: '/profile'
    });

    res.status(201).json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      status: user.status,
      message: 'Registration successful! Please wait for admin approval to log in.'
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during registration' });
  }
};

const authUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { data: user, error } = await supabase.from('User').select('*').eq('phone', phone).single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const isMatch = await AuthService.comparePassword(password, user.password);
    if (!isMatch) return res.status(401).json({ message: 'Invalid phone or password' });

    if (user.status !== 'approved' && user.role !== 'owner') {
      return res.status(401).json({ message: `Your account is currently ${user.status}. You cannot log in.` });
    }

    await LogService.info(
      `User logged in: ${user.name}`,
      'USER_LOGIN',
      user.id,
      { ip: req.ip }
    );

    res.json({
      _id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      firstLogin: user.firstLogin,
      imageUrl: user.imageUrl,
      status: user.status,
      nid: user.nid,
      fatherName: user.fatherName,
      dob: user.dob,
      token: AuthService.generateToken(user),
    });
  } catch (error) {
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { registerUser, authUser };
