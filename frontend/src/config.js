/**
 * API Configuration
 * Centralized API URL configuration for the application
 * Supports multi-tenant school-scoped API calls
 */

// Get API URL from environment variable or use default
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// Paystack public key
export const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_xxxxx';

// Get stored school slug from localStorage or URL
export function getSchoolSlug() {
  // First try to get from localStorage
  const stored = localStorage.getItem('schoolSlug');
  if (stored) return stored;

  // Then try to extract from URL path
  const pathMatch = window.location.pathname.match(/^\/([a-z0-9-]+)/);
  if (pathMatch && !['pricing', 'register', 'contact-sales', 'login'].includes(pathMatch[1])) {
    return pathMatch[1];
  }

  // Default fallback for legacy routes
  return 'figilschools';
}

// Set school slug in localStorage
export function setSchoolSlug(slug) {
  localStorage.setItem('schoolSlug', slug);
}

// Build school-scoped API URL
export function buildApiUrl(endpoint, schoolSlug = null) {
  const slug = schoolSlug || getSchoolSlug();
  // Remove leading slash if present
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/api/${slug}/${cleanEndpoint}`;
}

// Build public API URL (no school scope)
export function buildPublicApiUrl(endpoint) {
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint;
  return `${API_BASE_URL}/api/public/${cleanEndpoint}`;
}

// API endpoints - Public (no auth required)
export const PUBLIC_ENDPOINTS = {
  plans: `${API_BASE_URL}/api/public/plans/`,
  register: `${API_BASE_URL}/api/public/register/`,
  checkSlug: (slug) => `${API_BASE_URL}/api/public/check-slug/${slug}/`,
  contactSales: `${API_BASE_URL}/api/public/contact-sales/`,
};

// API endpoints - School-scoped (use buildApiUrl or getSchoolScopedEndpoints)
export function getSchoolScopedEndpoints(schoolSlug = null) {
  const slug = schoolSlug || getSchoolSlug();
  const base = `${API_BASE_URL}/api/${slug}`;

  return {
    // Auth
    login: `${base}/users/login/`,
    token: `${base}/token/`,
    tokenRefresh: `${base}/token/refresh/`,

    // Users
    users: `${base}/users/`,
    profile: `${base}/users/profile/`,

    // Academics
    classes: `${base}/academics/classes/`,
    subjects: `${base}/academics/subjects/`,
    assessments: `${base}/academics/assessments/`,

    // Attendance
    attendance: `${base}/attendance/`,

    // School Admin
    fees: `${base}/schooladmin/fees/`,
    announcements: `${base}/schooladmin/announcements/`,

    // Subscription
    school: `${base}/subscription/school/`,
    subscription: `${base}/subscription/`,
    upgrade: `${base}/subscription/upgrade/`,
    payments: `${base}/subscription/payments/`,
  };
}

// Legacy API endpoints (for backwards compatibility during migration)
export const API_ENDPOINTS = {
  // Auth - uses default school slug
  login: `${API_BASE_URL}/api/users/login/`,
  token: `${API_BASE_URL}/api/token/`,
  tokenRefresh: `${API_BASE_URL}/api/token/refresh/`,

  // Base URL for fetch calls
  base: API_BASE_URL,
};

// Export default for convenience
export default API_BASE_URL;
