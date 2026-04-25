const jwt = require('jsonwebtoken');

let jwtWrapper;

if (process.env.NODE_ENV === 'test' && global.__JWT_MOCK__) {
  jwtWrapper = global.__JWT_MOCK__;
} else {
  jwtWrapper = {
    verify: (token, secret) => jwt.verify(token, secret),
    sign: (payload, secret, options) => jwt.sign(payload, secret, options)
  };
}

module.exports = jwtWrapper;
