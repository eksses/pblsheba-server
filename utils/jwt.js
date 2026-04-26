const jwt = require('jsonwebtoken');

module.exports = {
  verify: (token, secret) => jwt.verify(token, secret),
  sign: (payload, secret, options) => jwt.sign(payload, secret, options)
};
