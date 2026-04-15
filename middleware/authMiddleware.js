const jwt = require('jsonwebtoken');
const supabase = require('../utils/supabase');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const { data: user, error } = await supabase
        .from('User')
        .select('id, name, phone, role, status')
        .eq('id', decoded.id)
        .single();

      if (error || !user) {
        console.warn(`Auth Failed: User with ID ${decoded.id} not found in Supabase.`);
        return res.status(401).json({ message: 'User not found' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error('JWT Verification Error:', error.message);
      res.status(401).json({ message: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    console.warn('Auth Failed: No token provided in headers.');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'owner' || req.user.role === 'employee')) {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an admin' });
  }
};

const owner = (req, res, next) => {
  if (req.user && req.user.role === 'owner') {
    next();
  } else {
    res.status(401).json({ message: 'Not authorized as an owner' });
  }
};

module.exports = { protect, admin, owner };
