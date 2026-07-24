const authService = require('../services/authService');

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    const result = await authService.login(email, password);
    return res.status(200).json({
      success: true,
      message: 'Admin authentication successful.',
      data: result
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
