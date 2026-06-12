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
    const companyIdRaw = req.header('x-company-id');
    
    // If we have a company context, verify it
    if (companyIdRaw && companyIdRaw !== 'undefined' && companyIdRaw !== 'null') {
      const companyId = parseInt(companyIdRaw);
      
      if (isNaN(companyId) || companyId <= 0) {
        // Log the error but don't crash if we can recover
        console.warn(`[AUTH] Cleaning invalid company ID header: "${companyIdRaw}"`);
      } else {
        // Verify user belongs to this company and fetch role + permissions
        const RoleService = require('../services/role.service');
        const db = require('../config/db');
        
        const membership = await db('user_roles')
          .join('roles', 'user_roles.role_id', 'roles.id')
          .select('roles.name as role')
          .where('user_roles.user_id', req.user.id)
          .andWhere('user_roles.company_id', companyId)
          .first();

        if (membership) {
          req.companyId = companyId;
          req.userCompanyRole = membership.role;
          req.userPermissions = await RoleService.getUserPermissions(req.user.id, companyId);
        } else if (req.user.role === 'Super Admin') {
          req.companyId = companyId;
          req.userCompanyRole = 'Super Admin';
          req.userPermissions = await RoleService.getSuperAdminPermissions();
        } else {
          console.warn(`[AUTH] 403 Denied: User ${req.user.id} NOT in Company ${companyId}`);
          return res.status(403).json({ 
            message: 'Access to this company is denied',
            debug: { userId: req.user.id, requestedCompanyId: companyId }
          });
        }
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
 * RBAC Helper Middleware: requirePermission
 * Validates that the user has the required permission code
 */
const requirePermission = (permissionCode) => {
  return (req, res, next) => {
    // Super Admin overrides everything
    if (req.user.role === 'Super Admin') {
      return next();
    }
    
    const permissions = req.userPermissions || [];
    
    if (permissions.includes(permissionCode)) {
      next();
    } else {
      res.status(403).json({ 
        message: `Forbidden: Action requires permission '${permissionCode}'`
      });
    }
  };
};

/**
 * Legacy checkRole fallback mapping for smooth transition
 */
const checkRole = (allowedRoles) => {
  return (req, res, next) => {
    const userRole = req.userCompanyRole || req.user.role;
    if (allowedRoles.includes(userRole) || req.user.role === 'Super Admin') {
      next();
    } else {
      res.status(403).json({ message: 'Forbidden' });
    }
  };
};

/**
 * Ensures req.params.companyId matches the authenticated req.companyId
 */
const companyGuard = (req, res, next) => {
  const paramId = parseInt(req.params.companyId);
  if (paramId && req.companyId && paramId !== req.companyId && req.user.role !== 'Super Admin') {
    return res.status(403).json({ 
      message: 'Company context mismatch',
      details: { urlCompanyId: paramId, headerCompanyId: req.companyId }
    });
  }
  next();
};

module.exports = { authMiddleware, checkRole, requirePermission, companyGuard };
