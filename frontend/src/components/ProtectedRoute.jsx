// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { isTokenExpired } from '../authUtils';

const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');

  // Check if token exists and is not expired
  if (!token || isTokenExpired(token)) {
    // Clear expired tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    return <Navigate to="/" />;
  }

  // Check if user has required role (if specified)
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on user's actual role
    switch (userRole) {
      case 'admin':
        return <Navigate to="/admin/dashboard" />;
      case 'student':
        return <Navigate to="/student/dashboard" />;
      case 'teacher':
        return <Navigate to="/teacher/dashboard" />;
      case 'parent':
        return <Navigate to="/parent/dashboard" />;
      default:
        return <Navigate to="/" />;
    }
  }

  return children;
};

export default ProtectedRoute;