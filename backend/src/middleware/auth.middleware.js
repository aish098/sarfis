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

    // Validate active database-backed session
    if (decoded.sessionId) {
      const db = require('../config/db');
      const session = await db('user_sessions').where({ id: decoded.sessionId }).first();
      
      if (!session || !session.is_active) {
        return res.status(401).json({ message: 'Session has been terminated by administrator.' });
      }

      // Safe JSON parsing of cache
      let cache = session.permissions_cache;
      if (cache && typeof cache === 'string') {
        try { cache = JSON.parse(cache); } catch (e) { cache = {}; }
      }
      req.session = { ...session, permissions_cache: cache || {} };

      // Update last activity and company ID dynamically
      const companyIdRaw = req.header('x-company-id');
      const updatePayload = { last_activity: db.fn.now() };
      if (companyIdRaw && companyIdRaw !== 'undefined' && companyIdRaw !== 'null') {
        const companyId = parseInt(companyIdRaw);
        if (!isNaN(companyId) && companyId > 0 && !session.company_id) {
          updatePayload.company_id = companyId;
        }
      }
      await db('user_sessions').where({ id: decoded.sessionId }).update(updatePayload);
    }

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

          // Check permissions cache
          let cachedPerms = null;
          if (req.session && req.session.permissions_cache) {
            if (Array.isArray(req.session.permissions_cache[companyId])) {
              cachedPerms = req.session.permissions_cache[companyId];
            }
          }

          if (cachedPerms) {
            req.userPermissions = cachedPerms;
          } else {
            req.userPermissions = await RoleService.getUserPermissions(req.user.id, companyId);
            
            // Cache the loaded permissions in current session
            if (req.session) {
              const currentCache = req.session.permissions_cache || {};
              currentCache[companyId] = req.userPermissions;

              await db('user_sessions')
                .where({ id: req.session.id })
                .update({ permissions_cache: JSON.stringify(currentCache) });
            }
          }
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
