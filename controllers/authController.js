const supabase = require('../utils/supabase');
const bcrypt = require('bcrypt');
const generateToken = require('../utils/generateToken');
const { getCachedData, cacheData } = require('../utils/redis');
const SystemLog = require('../models/SystemLog');


const getSettings = async () => {
  const cacheKey = 'system_settings';
  let settings = await getCachedData(cacheKey);
  
  if (!settings) {
    const { data } = await supabase
      .from('Setting')
      .select('*')
      .eq('id', 1)
      .single();
    
    settings = data;
    if (settings) {
      await cacheData(cacheKey, settings, 3600); 
    }
  }
  return settings;
};




const registerUser = async (req, res) => {
  try {
    const { name, fatherName, dob, nid, phone, paymentNumber, password, paymentMethod, trxId } = req.body;

    
    const { data: userExists } = await supabase
      .from('User')
      .select('id')
      .eq('phone', phone)
      .single();

    if (userExists) {
      return res.status(400).json({ message: 'User with this phone already exists' });
    }

    if (nid) {
      const { data: nidExists } = await supabase
        .from('User')
        .select('id')
        .eq('nid', nid)
        .single();
        
      if (nidExists) {
        return res.status(400).json({ message: 'User with this NID already exists' });
      }
    }

    const imageUrl = req.file ? req.file.path : null;
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const { data: user, error } = await supabase
      .from('User')
      .insert([
        {
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
        }
      ])
      .select()
      .single();

    if (error) throw error;

    if (user) {
      
      await SystemLog.create({
        level: 'info',
        message: `New user registration: ${user.name} (${user.phone})`,
        action: 'USER_REGISTER',
        userId: user.id,
        ip: req.ip
      });

      res.status(201).json({
        _id: user.id,
        name: user.name,
        phone: user.phone,
        status: user.status,
        message: 'Registration successful! Please wait for admin approval to log in.'
      });
    } else {
      res.status(400).json({ message: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration' });
  }
};




const authUser = async (req, res) => {
  try {
    const { phone, password } = req.body;

    const { data: user, error } = await supabase
      .from('User')
      .select('*')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid phone or password' });
    }

    
    if (user.status !== 'approved' && user.role !== 'owner') {
      return res.status(401).json({ message: `Your account is currently ${user.status}. You cannot log in.` });
    }

    
    await SystemLog.create({
      level: 'info',
      message: `User logged in: ${user.name}`,
      action: 'USER_LOGIN',
      userId: user.id,
      ip: req.ip
    });

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
      token: generateToken(user.id),
    });
  } catch (error) {
    console.error('Login Error:', error);
    res.status(500).json({ message: 'Server error during login' });
  }
};

module.exports = { registerUser, authUser };
