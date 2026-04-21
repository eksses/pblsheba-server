const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Auth Service
 * Handles password management and token operations.
 */
class AuthService {
  /**
   * Hash a plain text password
   */
  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  /**
   * Compare a plain text password with a hash
   */
  static async comparePassword(password, hash) {
    return bcrypt.compare(password, hash);
  }

  /**
   * Generate a JWT token for a user
   */
  static generateToken(user) {
    return jwt.sign(
      { id: user.id || user._id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '3d' }
    );
  }
}

module.exports = AuthService;
