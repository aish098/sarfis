const userService = require('../services/userService');

// 1. Get All Users (With Pagination, Search, Status, and Role Filters)
exports.getAllUsers = async (req, res, next) => {
  try {
    const result = await userService.getAllUsers(req.query);
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
};

// 2. Get Single User Details
exports.getUserById = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const user = await userService.getUserById(user_id);
    return res.status(200).json({
      success: true,
      data: user
    });
  } catch (err) {
    next(err);
  }
};

// 3. Block or Unblock User
exports.toggleBlockStatus = async (req, res, next) => {
  try {
    const { user_id } = req.params;
    const { status, reason } = req.body;
    const adminId = req.admin ? req.admin.id : null;

    const result = await userService.toggleBlockStatus(user_id, { status, reason }, adminId);

    return res.status(200).json({
      success: true,
      message: result.message,
      data: result.user
    });
  } catch (err) {
    next(err);
  }
};
