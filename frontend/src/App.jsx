import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import HomePage from './pages/HomePage';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import TakeAssessment from './components/TakeAssessment';
import { isTokenExpired } from './authUtils';
import ProtectedRoute from './components/ProtectedRoute';
import { DialogProvider } from './contexts/DialogContext';
import { SchoolProvider } from './contexts/SchoolContext';

// Public pages
import {
  LandingPage,
  PricingPage,
  SchoolRegistration,
  ContactSales,
} from './pages/public';

// School login page wrapper
function SchoolLoginPage() {
  const { schoolSlug } = useParams();
  // Store the school slug for API calls
  localStorage.setItem('schoolSlug', schoolSlug);
  return <HomePage schoolSlug={schoolSlug} />;
}

// School-scoped routes wrapper
function SchoolRoutes() {
  const { schoolSlug } = useParams();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

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

  // Store school slug for API calls
  useEffect(() => {
    if (schoolSlug) {
      localStorage.setItem('schoolSlug', schoolSlug);
    }
  }, [schoolSlug]);

  return (
    <SchoolProvider>
      <Routes>
        {/* School Login */}
        <Route
          index
          element={
            isAuthenticated && userRole ? (
              <Navigate to={`/${schoolSlug}/${userRole}/dashboard`} />
            ) : (
              <SchoolLoginPage />
            )
          }
        />

        {/* Email Verification within school context */}
        <Route path="verify-email/:token" element={<VerifyEmail />} />

        {/* Admin Dashboard */}
        <Route
          path="admin/dashboard"
          element={
            <ProtectedRoute requiredRole="admin">
              <AdminDashboard />
            </ProtectedRoute>
          }
        />

        {/* Principal Dashboard */}
        <Route
          path="principal/dashboard"
          element={
            <ProtectedRoute requiredRole="principal">
              <PrincipalDashboard />
            </ProtectedRoute>
          }
        />

        {/* Student Dashboard */}
        <Route
          path="student/dashboard"
          element={
            <ProtectedRoute requiredRole="student">
              <StudentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Take Assessment */}
        <Route
          path="student/take-assessment/:assessmentId"
          element={
            <ProtectedRoute requiredRole="student">
              <TakeAssessment />
            </ProtectedRoute>
          }
        />

        {/* Teacher Dashboard */}
        <Route
          path="teacher/dashboard"
          element={
            <ProtectedRoute requiredRole="teacher">
              <TeacherDashboard />
            </ProtectedRoute>
          }
        />

        {/* Parent Dashboard */}
        <Route
          path="parent/dashboard"
          element={
            <ProtectedRoute requiredRole="parent">
              <ParentDashboard />
            </ProtectedRoute>
          }
        />

        {/* Catch all within school - redirect to school root */}
        <Route path="*" element={<Navigate to={`/${schoolSlug}`} />} />
      </Routes>
    </SchoolProvider>
  );
}

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [userRole, setUserRole] = useState(null);

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

    // Ensure page always loads from the top on refresh
    window.scrollTo(0, 0);
  }, []);

  // Function to get default dashboard based on role
  const getDefaultDashboard = (role) => {
    const schoolSlug = localStorage.getItem('schoolSlug') || 'figilschools';
    switch (role) {
      case 'admin':
        return `/${schoolSlug}/admin/dashboard`;
      case 'principal':
        return `/${schoolSlug}/principal/dashboard`;
      case 'student':
        return `/${schoolSlug}/student/dashboard`;
      case 'teacher':
        return `/${schoolSlug}/teacher/dashboard`;
      case 'parent':
        return `/${schoolSlug}/parent/dashboard`;
      default:
        return '/';
    }
  };

  return (
    <DialogProvider>
      <Router>
        <Routes>
          {/* ============== PUBLIC ROUTES ============== */}

          {/* Landing Page */}
          <Route
            path="/"
            element={
              isAuthenticated && userRole ? (
                <Navigate to={getDefaultDashboard(userRole)} />
              ) : (
                <LandingPage />
              )
            }
          />

          {/* Pricing Page */}
          <Route path="/pricing" element={<PricingPage />} />

          {/* School Registration */}
          <Route path="/register" element={<SchoolRegistration />} />

          {/* Contact Sales */}
          <Route path="/contact-sales" element={<ContactSales />} />

          {/* Password Reset Routes - Public (global) */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Payment callback */}
          <Route
            path="/payment/callback"
            element={
              <div style={{ textAlign: 'center', padding: '50px' }}>
                <h2>Processing Payment...</h2>
                <p>Please wait while we verify your payment.</p>
              </div>
            }
          />

          {/* ============== LEGACY ROUTES (Backwards Compatibility) ============== */}

          {/* These routes redirect to school-scoped routes */}
          <Route
            path="/admin/dashboard"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/admin/dashboard`} />
            }
          />
          <Route
            path="/principal/dashboard"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/principal/dashboard`} />
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/student/dashboard`} />
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/teacher/dashboard`} />
            }
          />
          <Route
            path="/parent/dashboard"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/parent/dashboard`} />
            }
          />
          <Route
            path="/student-dashboard/take-assessment/:assessmentId"
            element={
              <Navigate to={`/${localStorage.getItem('schoolSlug') || 'figilschools'}/student/take-assessment/${window.location.pathname.split('/').pop()}`} />
            }
          />
          <Route
            path="/verify-email/:token"
            element={<VerifyEmail />}
          />

          {/* ============== SCHOOL-SCOPED ROUTES ============== */}

          {/* All routes under /:schoolSlug are handled by SchoolRoutes */}
          <Route path="/:schoolSlug/*" element={<SchoolRoutes />} />

          {/* ============== CATCH ALL ============== */}
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </Router>
    </DialogProvider>
  );
}

export default App;
