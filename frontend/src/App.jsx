import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AdminLogin from './pages/AdminLogin';
import AdminDashboard from './pages/AdminDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import HomePage from './pages/HomePage';
import TakeAssessment from './components/TakeAssessment';
import { isTokenExpired } from './authUtils';
import ProtectedRoute from './components/ProtectedRoute';
import { DialogProvider } from './contexts/DialogContext';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

  const handleLogin = () => setIsAuthenticated(true);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');
    
    if (token && !isTokenExpired(token)) {
      setIsAuthenticated(true);
      setUserRole(role);
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      setIsAuthenticated(false);
      setUserRole(null);
    }
  }, []);

  // Function to get default dashboard based on role
  const getDefaultDashboard = (role) => {
    switch (role) {
      case 'admin':
        return '/admin/dashboard';
      case 'principal':
        return '/principal/dashboard';
      case 'student':
        return '/student/dashboard';
      case 'teacher':
        return '/teacher/dashboard';
      case 'parent':
        return '/parent/dashboard';
      default:
        return '/';
    }
  };

  return (
    <DialogProvider>
      <Router>
        <Routes>
        {/* Home Route */}
        <Route
          path="/"
          element={
            isAuthenticated && userRole ? (
              <Navigate to={getDefaultDashboard(userRole)} />
            ) : (
              <HomePage />
            )
          }
        />

        {/* Admin Routes */}
        <Route
          path="/admin/login"
          element={
            isAuthenticated && userRole === 'admin' ? (
              <Navigate to="/admin/dashboard" />
            ) : (
              <AdminLogin onLogin={handleLogin} />
            )
          }
        />

        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Principal Routes */}
        <Route
          path="/principal/dashboard"
          element={
            <ProtectedRoute requiredRole="principal">
              <PrincipalDashboard />
            </ProtectedRoute>
          }
        />

        {/* Student Routes */}
        <Route
          path="/student/dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/student-dashboard/take-assessment/:assessmentId"
          element={
            <ProtectedRoute requiredRole="student">
              <TakeAssessment />
            </ProtectedRoute>
          }
        />

        {/* Teacher Routes */}
        <Route
          path="/teacher/dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Parent Routes */}
        <Route
          path="/parent/dashboard"
          element={
            <ProtectedRoute requiredRole="parent">
              <ParentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch all route - redirect to home */}
        <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </DialogProvider>
  );
}

export default App;