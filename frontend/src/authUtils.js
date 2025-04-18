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
  import axios from 'axios';

  export async function refreshAccessToken() {
    const refresh = localStorage.getItem('refreshToken');
    if (!refresh) return null;
  
    try {
      const res = await axios.post('http://127.0.0.1:8000/api/token/refresh/', {
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
  