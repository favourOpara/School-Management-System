// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { isTokenExpired } from '../authUtils';

const ProtectedRoute = ({ children, requiredRole }) => {
  const token = localStorage.getItem('accessToken');
  const userRole = localStorage.getItem('userRole');
  const schoolSlug = localStorage.getItem('schoolSlug');

  // Check if token exists and is not expired
  if (!token || isTokenExpired(token)) {
    // Clear expired tokens
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    localStorage.removeItem('userName');
    // Redirect to school login page so users don't lose their school URL
    return <Navigate to={schoolSlug ? `/${schoolSlug}` : '/'} />;
  }

  // Check if user has required role (if specified)
  if (requiredRole && userRole !== requiredRole) {
    // Redirect to appropriate dashboard based on user's actual role
    const slug = schoolSlug;
    switch (userRole) {
      case 'admin':
        return <Navigate to={slug ? `/${slug}/admin/dashboard` : '/admin/dashboard'} />;
      case 'principal':
        return <Navigate to={slug ? `/${slug}/principal/dashboard` : '/principal/dashboard'} />;
      case 'student':
        return <Navigate to={slug ? `/${slug}/student/dashboard` : '/student/dashboard'} />;
      case 'teacher':
        return <Navigate to={slug ? `/${slug}/teacher/dashboard` : '/teacher/dashboard'} />;
      case 'parent':
        return <Navigate to={slug ? `/${slug}/parent/dashboard` : '/parent/dashboard'} />;
      case 'proprietor':
        return <Navigate to={slug ? `/${slug}/proprietor/dashboard` : '/proprietor/dashboard'} />;
      default:
        return <Navigate to="/" />;
    }
  }

  return children;
};

export default ProtectedRoute;