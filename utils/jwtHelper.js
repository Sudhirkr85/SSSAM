const jwt = require('jsonwebtoken');
const { JWT_CONFIG } = require('../config/constants');

const generateToken = (payload) => {
  return jwt.sign(payload, JWT_CONFIG.SECRET, {
    expiresIn: JWT_CONFIG.EXPIRE
  });
};

const verifyToken = (token) => {
  return jwt.verify(token, JWT_CONFIG.SECRET);
};

module.exports = {
  generateToken,
  verifyToken
};
