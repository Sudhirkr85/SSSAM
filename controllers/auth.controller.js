const { authService } = require('../services');
const { successResponse, errorResponse } = require('../utils/responseHelper');
const catchAsync = require('../utils/catchAsync');

class AuthController {
  register = catchAsync(async (req, res) => {
    const user = await authService.register(req.body);
    
    return successResponse(
      res,
      { user },
      'User registered successfully',
      201
    );
  });

  login = catchAsync(async (req, res) => {
    const { email, password, fcmToken, deviceInfo } = req.body;
    
    const result = await authService.login(email, password, fcmToken, deviceInfo);
    
    return successResponse(
      res,
      {
        user: result.user,
        token: result.token
      },
      'Login successful'
    );
  });

  logout = catchAsync(async (req, res) => {
    const { fcmToken } = req.body;
    const userId = req.user.id;

    const result = await authService.logout(userId, fcmToken);

    return successResponse(
      res,
      null,
      result.message
    );
  });
}

module.exports = new AuthController();
