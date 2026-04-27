const { User } = require('../models');
const { generateToken } = require('../utils/jwtHelper');
const AppError = require('../utils/AppError');
const firebaseService = require('./firebaseService');

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

  async login(email, password, fcmToken, deviceInfo = 'web') {
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

    // Save FCM token if provided
    if (fcmToken) {
      await firebaseService.saveFCMToken(user._id, fcmToken, deviceInfo);
    }

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

  async logout(userId, fcmToken) {
    if (!userId) {
      throw new AppError('User ID is required', 400);
    }

    // Remove FCM token if provided
    if (fcmToken) {
      await firebaseService.removeFCMToken(userId, fcmToken);
    }

    return { success: true, message: 'Logout successful' };
  }
}

module.exports = new AuthService();
