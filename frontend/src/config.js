/**
 * API Configuration
 * Centralized API URL configuration for the application
 */

// Get API URL from environment variable or use default
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

// API endpoints
export const API_ENDPOINTS = {
  // Auth
  login: `${API_BASE_URL}/api/users/login/`,
  token: `${API_BASE_URL}/api/token/`,
  tokenRefresh: `${API_BASE_URL}/api/token/refresh/`,

  // Base URL for fetch calls
  base: API_BASE_URL,
};

// Export default for convenience
export default API_BASE_URL;
