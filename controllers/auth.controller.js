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
    const { email, password } = req.body;
    
    const result = await authService.login(email, password);
    
    return successResponse(
      res,
      {
        user: result.user,
        token: result.token
      },
      'Login successful'
    );
  });
}

module.exports = new AuthController();
