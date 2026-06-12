import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

/**
 * A wrapper component that checks if the user has the specified permission.
 * If fallback is provided (like <Navigate /> or "Access Denied"), it renders that.
 * Otherwise, it simply hides the children (useful for action buttons).
 */
export default function RequirePermission({ permission, children, fallback = null }) {
  const user = useAuthStore((state) => state.user);
  const permissions = useAuthStore((state) => state.permissions) || [];

  if (!user) return fallback;

  // Super Admin overrides all frontend permission checks
  if (user.role === 'Super Admin') {
    return <>{children}</>;
  }

  if (permissions.includes(permission)) {
    return <>{children}</>;
  }

  return fallback;
}
