import { Navigate } from 'react-router-dom';
import { isTokenExpired } from '../authUtils';

const ProtectedRoute = ({ children }) => {
  const token = localStorage.getItem('accessToken');
  const isValid = token && !isTokenExpired(token);

  if (!isValid) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return <Navigate to="/" replace />;
  }

  return children;
};

export default ProtectedRoute;
