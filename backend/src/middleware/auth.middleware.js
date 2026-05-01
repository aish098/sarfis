const jwt = require('jsonwebtoken');
const db = require('../config/db');

/**
 * Main authentication middleware
 * Verifies JWT and handles multi-company context
 */
const authMiddleware = async (req, res, next) => {
  const token = req.header('Authorization');

  if (!token) {
    return res.status(401).json({ message: 'No token, authorization denied' });
  }

  try {
    const bearer = token.split(' ')[1];
    if (!bearer) return res.status(401).json({ message: 'Invalid token format' });

    const decoded = jwt.verify(bearer, process.env.JWT_SECRET || 'secret');
    req.user = decoded; 

    // Check for company context
    const companyId = req.header('x-company-id');
    if (companyId) {
      // Verify user belongs to this company
      const membership = await db('company_users')
        .select('role')
        .where('user_id', req.user.id)
        .andWhere('company_id', companyId)
        .first();

      if (membership) {
        req.companyId = parseInt(companyId);
        req.userCompanyRole = membership.role; 
      } else if (req.user.role === 'Super Admin') {
        req.companyId = parseInt(companyId);
        req.userCompanyRole = 'Super Admin';
      } else {
        return res.status(403).json({ message: 'Access to this company is denied' });
      }
    }

    next();
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return res.status(401).json({ message: 'Authentication session expired. Please log in again.' });
    }
    console.error('Auth middleware error:', err);
    return res.status(401).json({ message: 'Authentication failed' });
  }
};

/**
 * RBAC Helper Middleware
 * Checks if the user's role (global or company-specific) matches allowed roles
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.userCompanyRole || req.user.role;
    
    if (allowedRoles.includes(userRole) || req.user.role === 'Super Admin') {
      next();
    } else {
      res.status(403).json({ 
        message: `Forbidden: This action requires one of these roles: ${allowedRoles.join(', ')}` 
      });
    }
  };
};

/**
 * Ensures req.params.companyId matches the authenticated req.companyId
 */
const companyGuard = (req, res, next) => {
  const paramId = parseInt(req.params.companyId);
  if (paramId && req.companyId && paramId !== req.companyId && req.user.role !== 'Super Admin') {
    return res.status(403).json({ message: 'Company context mismatch' });
  }
  next();
};

module.exports = { authMiddleware, checkRole, companyGuard };
