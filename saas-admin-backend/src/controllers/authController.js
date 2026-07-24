const authService = require('../services/authService');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const deviceInfo = req.headers['user-agent'] || '';
    const ipAddress = req.ip;

    const result = await authService.login(email, password, deviceInfo, ipAddress);

    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful.',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

exports.changeInitialPassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const result = await authService.changeInitialPassword(req.admin.id, currentPassword, newPassword);
    return res.status(200).json({
      success: true,
      message: result.message
    });
  } catch (err) {
    next(err);
  }
};

exports.refresh = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const deviceInfo = req.headers['user-agent'] || '';
    const ipAddress = req.ip;

    const result = await authService.refresh(refreshToken, deviceInfo, ipAddress);
    return res.status(200).json({
      success: true,
      message: 'Access token refreshed successfully.',
      data: result
    });
  } catch (err) {
    next(err);
  }
};

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    await authService.logout(refreshToken);
    return res.status(200).json({
      success: true,
      message: 'Session revoked successfully.'
    });
  } catch (err) {
    next(err);
  }
};

exports.logoutAll = async (req, res, next) => {
  try {
    await authService.logoutAll(req.admin.id);
    return res.status(200).json({
      success: true,
      message: 'All active sessions revoked successfully.'
    });
  } catch (err) {
    next(err);
  }
};

exports.getSessions = async (req, res, next) => {
  try {
    const sessions = await authService.getActiveSessions(req.admin.id);
    return res.status(200).json({
      success: true,
      data: sessions
    });
  } catch (err) {
    next(err);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      success: true,
      data: req.admin
    });
  } catch (err) {
    next(err);
  }
};
