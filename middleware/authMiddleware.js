const jwt = require('jsonwebtoken');
const prisma = require('../utils/prisma');
const logger = require('../utils/logger');

const protect = async (req, res, next) => {
  let token;
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true, phone: true, role: true, status: true }
      });

      if (!user) {
        logger.warn(`Auth Attempt Failed: User ${decoded.id} not found.`);
        return res.status(401).json({ message: 'User not found or account deleted' });
      }

      req.user = user;
      next();
    } catch (error) {
      logger.error('JWT Verification Error:', { message: error.message, stack: error.stack });
      const message = error.name === 'TokenExpiredError' ? 'Token expired' : 'Not authorized, token failed';
      res.status(401).json({ message });
    }
  }

  if (!token) {
    logger.warn('Auth Attempt Failed: No token provided.');
    res.status(401).json({ message: 'Not authorized, no token' });
  }
};

const admin = (req, res, next) => {
  if (req.user && (req.user.role === 'owner' || req.user.role === 'employee')) {
    next();
  } else {
    logger.warn(`RBAC Denial (Admin/Staff): User ${req.user?.id} with role ${req.user?.role}`);
    res.status(403).json({ message: 'Not authorized: Admin or Staff access required' });
  }
};

const owner = (req, res, next) => {
  if (req.user && req.user.role === 'owner') {
    next();
  } else {
    logger.warn(`RBAC Denial (Owner): User ${req.user?.id} with role ${req.user?.role}`);
    res.status(403).json({ message: 'Not authorized: Owner access required' });
  }
};

module.exports = { protect, admin, owner };
