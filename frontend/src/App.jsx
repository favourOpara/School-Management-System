import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useParams } from 'react-router-dom';
import AdminDashboard from './pages/AdminDashboard';
import PrincipalDashboard from './pages/PrincipalDashboard';
import StudentDashboard from './pages/StudentDashboard';
import TeacherDashboard from './pages/TeacherDashboard';
import ParentDashboard from './pages/ParentDashboard';
import ProprietorDashboard from './pages/ProprietorDashboard';
import HomePage from './pages/HomePage';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import PaymentCallback from './pages/PaymentCallback';
import TakeAssessment from './components/TakeAssessment';
import { isTokenExpired, parseJwt } from './authUtils';
import ProtectedRoute from './components/ProtectedRoute';
import { DialogProvider } from './contexts/DialogContext';
import { SchoolProvider } from './contexts/SchoolContext';

// Public pages
import {
  LandingPage,
  PricingPage,
  SchoolRegistration,
  ContactSales,
  PublicUserGuide,
} from './pages/public';

// Portal pages
import { PortalLogin, PortalDashboard, PortalVerifyEmail } from './pages/portal';

// Platform admin pages
import { PlatformLogin, PlatformDashboard } from './pages/platform';

// Onboarding team pages
import { OnboardingLogin, OnboardingDashboard } from './pages/onboarding';

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
  const [schoolMismatch, setSchoolMismatch] = useState(false);
  const [userSchoolSlug, setUserSchoolSlug] = useState(null);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    const role = localStorage.getItem('userRole');

    if (token && !isTokenExpired(token)) {
      setIsAuthenticated(true);
      setUserRole(role);

      // Verify user belongs to this school
      const decoded = parseJwt(token);
      if (decoded?.school_slug && decoded.school_slug !== schoolSlug) {
        setSchoolMismatch(true);
        setUserSchoolSlug(decoded.school_slug);
      } else {
        setSchoolMismatch(false);
      }
    } else {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('userRole');
      localStorage.removeItem('userId');
      localStorage.removeItem('userName');
      setIsAuthenticated(false);
      setUserRole(null);
    }
  }, [schoolSlug]);

  // Only store school slug if user belongs to this school
  useEffect(() => {
    if (schoolSlug && !schoolMismatch) {
      localStorage.setItem('schoolSlug', schoolSlug);
    }
  }, [schoolSlug, schoolMismatch]);

  // If authenticated user is trying to access a school they don't belong to,
  // redirect them to their own school's dashboard
  if (schoolMismatch && isAuthenticated && userRole && userSchoolSlug) {
    return <Navigate to={`/${userSchoolSlug}/${userRole}/dashboard`} replace />;
  }

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

        {/* Proprietor Dashboard */}
        <Route
          path="proprietor/dashboard"
          element={
            <ProtectedRoute requiredRole="proprietor">
              <ProprietorDashboard />
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
    const schoolSlug = localStorage.getItem('schoolSlug');
    if (!schoolSlug) return '/';

    const firstTimeSetup = localStorage.getItem('firstTimeSetup');

    // Check if this is first-time setup for admin
    if (role === 'admin' && firstTimeSetup === 'true') {
      // Clear the flag so they don't keep getting redirected
      localStorage.removeItem('firstTimeSetup');
      return `/${schoolSlug}/admin/dashboard?tab=settings`;
    }

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
      case 'proprietor':
        return `/${schoolSlug}/proprietor/dashboard`;
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

          {/* Public User Guide */}
          <Route path="/user-guide" element={<PublicUserGuide />} />

          {/* Admin Portal */}
          <Route path="/portal" element={<PortalLogin />} />
          <Route path="/portal/verify-email" element={<PortalVerifyEmail />} />
          <Route path="/portal/dashboard" element={<PortalDashboard />} />

          {/* Platform Admin Routes */}
          <Route path="/platform/login" element={<PlatformLogin />} />
          <Route path="/platform/dashboard" element={<PlatformDashboard />} />

          {/* Onboarding Team Routes */}
          <Route path="/onboarding/login" element={<OnboardingLogin />} />
          <Route path="/onboarding/dashboard" element={<OnboardingDashboard />} />

          {/* Password Reset Routes - Public (global) */}
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password/:token" element={<ResetPassword />} />

          {/* Payment callback */}
          <Route path="/payment/callback" element={<PaymentCallback />} />

          {/* ============== LEGACY ROUTES (Backwards Compatibility) ============== */}

          {/* These routes redirect to school-scoped routes */}
          <Route
            path="/admin/dashboard"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/admin/dashboard` : '/'} />
            }
          />
          <Route
            path="/principal/dashboard"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/principal/dashboard` : '/'} />
            }
          />
          <Route
            path="/student/dashboard"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/student/dashboard` : '/'} />
            }
          />
          <Route
            path="/teacher/dashboard"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/teacher/dashboard` : '/'} />
            }
          />
          <Route
            path="/parent/dashboard"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/parent/dashboard` : '/'} />
            }
          />
          <Route
            path="/student-dashboard/take-assessment/:assessmentId"
            element={
              <Navigate to={localStorage.getItem('schoolSlug') ? `/${localStorage.getItem('schoolSlug')}/student/take-assessment/${window.location.pathname.split('/').pop()}` : '/'} />
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
