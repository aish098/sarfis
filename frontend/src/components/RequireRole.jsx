import React from 'react';
import { Navigate } from 'react-router-dom';
import useAuthStore from '../store/authStore';

export default function RequireRole({ children, allowedRoles }) {
 const { userRole, isLoading } = useAuthStore();

 if (isLoading) return null;

 const normalizedAllowed = allowedRoles.map(r => r.toUpperCase());
 const currentRole = (userRole || 'VIEWER').toUpperCase();

 if (!normalizedAllowed.includes(currentRole)) {
 // If not allowed, redirect to dashboard root
 return <Navigate to="/dashboard" replace />;
 }

 return children;
}
