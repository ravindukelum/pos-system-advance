import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const ProtectedRoute = ({ children, roles = [], permissions = [] }) => {
  const { isAuthenticated, user, loading } = useAuth();
  const location = useLocation();

  // Show loading spinner while checking authentication
  if (loading) {
    return (
      <div className=\"min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900\">
        <div className=\"flex flex-col items-center\">
          <div className=\"animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 dark:border-primary-400\"></div>
          <p className=\"mt-4 text-gray-600 dark:text-gray-400\">Loading...</p>
        </div>
      </div>
    );
  }

  // Redirect to login if not authenticated
  if (!isAuthenticated) {
    return <Navigate to=\"/login\" state={{ from: location }} replace />;
  }

  // Check role-based access
  if (roles.length > 0 && !roles.includes(user?.role)) {
    return (
      <div className=\"min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900\">
        <div className=\"text-center\">
          <h2 className=\"text-2xl font-bold text-gray-900 dark:text-white mb-4\">
            Access Denied
          </h2>
          <p className=\"text-gray-600 dark:text-gray-400 mb-4\">
            You don't have permission to access this page.
          </p>
          <button
            onClick={() => window.history.back()}
            className=\"bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700\"
          >
            Go Back
          </button>
        </div>
      </div>
    );
  }

  // Check permission-based access
  if (permissions.length > 0) {
    const hasPermission = user?.role === 'admin' || 
      permissions.some(permission => user?.permissions?.[permission] === true);
    
    if (!hasPermission) {
      return (
        <div className=\"min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900\">
          <div className=\"text-center\">
            <h2 className=\"text-2xl font-bold text-gray-900 dark:text-white mb-4\">
              Insufficient Permissions
            </h2>
            <p className=\"text-gray-600 dark:text-gray-400 mb-4\">
              You don't have the required permissions to access this feature.
            </p>
            <button
              onClick={() => window.history.back()}
              className=\"bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700\"
            >
              Go Back
            </button>
          </div>
        </div>
      );
    }
  }

  return children;
};

export default ProtectedRoute;