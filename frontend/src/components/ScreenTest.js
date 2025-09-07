import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';

const ScreenTest = () => {
  const { user, hasPermission, hasRole } = useAuth();
  const [testResults, setTestResults] = useState({});

  const screens = [
    { name: 'Dashboard', path: '/dashboard', requiredRoles: [], requiredPermissions: [] },
    { name: 'Partners', path: '/partners', requiredRoles: [], requiredPermissions: [] },
    { name: 'Investments', path: '/investments', requiredRoles: [], requiredPermissions: [] },
    { name: 'Inventory', path: '/inventory', requiredRoles: [], requiredPermissions: [] },
    { name: 'Sales', path: '/sales', requiredRoles: [], requiredPermissions: [] },
    { name: 'Customers', path: '/customers', requiredRoles: [], requiredPermissions: [] },

    { name: 'Payments', path: '/payments', requiredRoles: [], requiredPermissions: ['payments.view'] },
    { name: 'Reports', path: '/reports', requiredRoles: [], requiredPermissions: ['reports.view'] },
    { name: 'Settings', path: '/settings', requiredRoles: [], requiredPermissions: [] }
  ];

  const testScreenAccess = () => {
    const results = {};
    
    screens.forEach(screen => {
      let hasAccess = true;
      let reason = 'Access granted';
      
      // Check role requirements
      if (screen.requiredRoles.length > 0) {
        hasAccess = hasRole(...screen.requiredRoles);
        if (!hasAccess) {
          reason = `Missing required role: ${screen.requiredRoles.join(' or ')}`;
        }
      }
      
      // Check permission requirements
      if (hasAccess && screen.requiredPermissions.length > 0) {
        hasAccess = screen.requiredPermissions.every(permission => hasPermission(permission));
        if (!hasAccess) {
          reason = `Missing required permission: ${screen.requiredPermissions.join(', ')}`;
        }
      }
      
      results[screen.name] = {
        hasAccess,
        reason,
        path: screen.path
      };
    });
    
    setTestResults(results);
  };

  return (
    <div className="fixed top-4 right-4 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg p-4 shadow-lg z-50 max-w-md">
      <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
        Screen Access Test
      </h3>
      
      <div className="mb-4 text-sm">
        <p className="text-gray-600 dark:text-gray-400">User: {user?.full_name}</p>
        <p className="text-gray-600 dark:text-gray-400">Role: {user?.role}</p>
        <p className="text-gray-600 dark:text-gray-400">
          Permissions: {Object.keys(user?.permissions || {}).length} configured
        </p>
      </div>
      
      <button
        onClick={testScreenAccess}
        className="w-full bg-primary-600 hover:bg-primary-700 text-white px-3 py-2 rounded-md text-sm mb-4"
      >
        Test All Screens
      </button>
      
      {Object.keys(testResults).length > 0 && (
        <div className="space-y-2 max-h-64 overflow-y-auto">
          {Object.entries(testResults).map(([screenName, result]) => (
            <div key={screenName} className="flex items-center justify-between text-xs">
              <span className="text-gray-700 dark:text-gray-300">{screenName}</span>
              <span className={result.hasAccess ? 'text-green-600' : 'text-red-600'}>
                {result.hasAccess ? '✅' : '❌'}
              </span>
            </div>
          ))}
        </div>
      )}
      
      {Object.keys(testResults).length > 0 && (
        <div className="mt-4 text-xs">
          <p className="text-gray-600 dark:text-gray-400">
            ✅ Access Granted: {Object.values(testResults).filter(r => r.hasAccess).length}
          </p>
          <p className="text-gray-600 dark:text-gray-400">
            ❌ Access Denied: {Object.values(testResults).filter(r => !r.hasAccess).length}
          </p>
        </div>
      )}
    </div>
  );
};

export default ScreenTest;