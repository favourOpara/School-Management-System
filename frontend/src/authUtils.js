import API_BASE_URL, { getSchoolSlug, setSchoolSlug } from './config';
import axios from 'axios';

export function parseJwt(token) {
  try {
    const base64Url = token.split('.')[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64).split('').map(c => '%' + c.charCodeAt(0).toString(16)).join('')
    );
    return JSON.parse(jsonPayload);
  } catch (e) {
    return null;
  }
}

export function isTokenExpired(token) {
  const decoded = parseJwt(token);
  if (!decoded || !decoded.exp) return true;

  const currentTime = Math.floor(Date.now() / 1000); // in seconds
  return decoded.exp < currentTime;
}

export async function refreshAccessToken() {
  const refresh = localStorage.getItem('refreshToken');
  if (!refresh) return null;

  const schoolSlug = getSchoolSlug();

  try {
    const res = await axios.post(`${API_BASE_URL}/api/${schoolSlug}/token/refresh/`, {
      refresh: refresh,
    });
    localStorage.setItem('accessToken', res.data.access);
    return res.data.access;
  } catch (error) {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    return null;
  }
}

// Store user session with school context
export function storeUserSession(accessToken, refreshToken, schoolSlug) {
  localStorage.setItem('accessToken', accessToken);
  localStorage.setItem('refreshToken', refreshToken);
  if (schoolSlug) {
    setSchoolSlug(schoolSlug);
  }
}

// Clear user session
export function clearUserSession() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('schoolSlug');
  localStorage.removeItem('user');
}

// Check if user is authenticated
export function isAuthenticated() {
  const token = localStorage.getItem('accessToken');
  if (!token) return false;
  return !isTokenExpired(token);
}

// Get current user from localStorage
export function getCurrentUser() {
  const userStr = localStorage.getItem('user');
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
  }
}
  