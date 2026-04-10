const { User } = require('../models');
const { generateToken } = require('../utils/jwtHelper');
const AppError = require('../utils/AppError');

class AuthService {
  async register(userData) {
    const existingUser = await User.findOne({ email: userData.email });
    
    if (existingUser) {
      throw new AppError('User with this email already exists', 409);
    }

    const user = await User.create(userData);
    
    return {
      id: user._id,
      name: user.name,
      email: user.email,
      role: user.role
    };
  }

  async login(email, password) {
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new AppError('Invalid email or password', 401);
    }

    const isPasswordValid = await user.comparePassword(password);
    
    if (!isPasswordValid) {
      throw new AppError('Invalid email or password', 401);
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role
    });

    return {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      },
      token
    };
  }
}

module.exports = new AuthService();
