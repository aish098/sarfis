const userRepository = require('../repositories/userRepository');
const AppError = require('../errors/AppError');
const { getPagination, formatPaginatedResponse } = require('../utils/pagination');

class UserService {
  async getAllUsers(query) {
    const { page, limit, sort, order, offset } = getPagination(query);
    const { status, role, search } = query;

    const { users, totalItems } = await userRepository.findAll({
      offset,
      limit,
      sort,
      order,
      status,
      role,
      search
    });

    return formatPaginatedResponse({ data: users, totalItems, page, limit });
  }

  async getUserById(id) {
    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found.`, 404, 'USER_NOT_FOUND');
    }
    return user;
  }

  async toggleBlockStatus(id, { status, reason }, adminId) {
    if (status === undefined || typeof status !== 'boolean') {
      throw new AppError("The parameter 'status' (boolean) is mandatory.", 400, 'VALIDATION_ERROR');
    }

    const user = await userRepository.findById(id);
    if (!user) {
      throw new AppError(`User with ID '${id}' not found.`, 404, 'USER_NOT_FOUND');
    }

    const newStatus = status ? 'BLOCKED' : 'ACTIVE';
    const blockedReason = status ? (reason || 'Violation of community guidelines') : null;
    const blockedAt = status ? new Date() : null;
    const blockedByAdminId = status ? adminId : null;

    const updatedUser = await userRepository.updateStatus(id, {
      status: newStatus,
      blocked_by_admin_id: blockedByAdminId,
      blocked_reason: blockedReason,
      blocked_at: blockedAt
    });

    return {
      message: `User status updated successfully. User is now ${newStatus}.`,
      user: updatedUser
    };
  }
}

module.exports = new UserService();
