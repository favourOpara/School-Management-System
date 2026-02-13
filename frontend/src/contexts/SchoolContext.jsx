import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { API_ENDPOINTS } from '../config';

const SchoolContext = createContext(null);

export function useSchool() {
  const context = useContext(SchoolContext);
  if (!context) {
    throw new Error('useSchool must be used within a SchoolProvider');
  }
  return context;
}

export function SchoolProvider({ children }) {
  const { schoolSlug } = useParams();
  const navigate = useNavigate();

  const [school, setSchool] = useState(null);
  const [subscription, setSubscription] = useState(null);
  const [featureLimits, setFeatureLimits] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Get stored school slug from localStorage (for backwards compatibility)
  const getStoredSchoolSlug = () => {
    return localStorage.getItem('schoolSlug');
  };

  // Store school slug in localStorage
  const setStoredSchoolSlug = (slug) => {
    if (slug) {
      localStorage.setItem('schoolSlug', slug);
    } else {
      localStorage.removeItem('schoolSlug');
    }
  };

  // Get the active school slug (from URL or localStorage)
  const activeSchoolSlug = schoolSlug || getStoredSchoolSlug();

  // Fetch school info
  const fetchSchoolInfo = useCallback(async (slug) => {
    if (!slug) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const token = localStorage.getItem('accessToken');
      const headers = token
        ? { Authorization: `Bearer ${token}` }
        : {};

      // Fetch school basic info (public endpoint) with cache busting
      const schoolResponse = await fetch(
        `${API_ENDPOINTS.base}/api/public/school/${slug}/`,
        {
          headers,
          cache: 'no-store'
        }
      );

      if (!schoolResponse.ok) {
        if (schoolResponse.status === 404) {
          throw new Error('School not found');
        }
        throw new Error('Failed to fetch school info');
      }

      const schoolData = await schoolResponse.json();
      setSchool(schoolData);
      setStoredSchoolSlug(slug);

      // If user is authenticated, fetch subscription details
      if (token) {
        try {
          const subResponse = await fetch(
            `${API_ENDPOINTS.base}/api/${slug}/subscription/`,
            { headers: { Authorization: `Bearer ${token}` } }
          );

          if (subResponse.ok) {
            const subData = await subResponse.json();
            setSubscription(subData);
            setFeatureLimits(subData.feature_limits);
          }
        } catch (subErr) {
          console.error('Failed to fetch subscription:', subErr);
        }
      }
    } catch (err) {
      setError(err.message);
      console.error('Error fetching school:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Refresh subscription data
  const refreshSubscription = useCallback(async () => {
    if (!activeSchoolSlug) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    try {
      const response = await fetch(
        `${API_ENDPOINTS.base}/api/${activeSchoolSlug}/subscription/`,
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
        setFeatureLimits(data.feature_limits);
      }
    } catch (err) {
      console.error('Failed to refresh subscription:', err);
    }
  }, [activeSchoolSlug]);

  // Fetch school info when slug changes
  useEffect(() => {
    if (activeSchoolSlug) {
      fetchSchoolInfo(activeSchoolSlug);
    } else {
      setLoading(false);
    }
  }, [activeSchoolSlug, fetchSchoolInfo]);

  // Safety net: if school is loaded but subscription isn't, retry when token becomes available
  // This handles the case where the initial fetch happened before login (no token)
  useEffect(() => {
    if (school && !subscription && !loading && activeSchoolSlug) {
      const token = localStorage.getItem('accessToken');
      if (token) {
        refreshSubscription();
      }
    }
  }, [school, subscription, loading, activeSchoolSlug, refreshSubscription]);

  // Update document title when school name changes
  useEffect(() => {
    if (school?.name) {
      document.title = school.name;
    }
    // Cleanup: reset title when component unmounts
    return () => {
      document.title = 'EduCare';
    };
  }, [school?.name]);

  // Build API URL with school slug
  const buildApiUrl = useCallback(
    (endpoint) => {
      if (!activeSchoolSlug) {
        return `${API_ENDPOINTS.base}/api${endpoint}`;
      }
      return `${API_ENDPOINTS.base}/api/${activeSchoolSlug}${endpoint}`;
    },
    [activeSchoolSlug]
  );

  // Navigate within school context
  const navigateToSchool = useCallback(
    (path) => {
      if (activeSchoolSlug) {
        navigate(`/${activeSchoolSlug}${path}`);
      } else {
        navigate(path);
      }
    },
    [activeSchoolSlug, navigate]
  );

  // Check if a feature is available
  const hasFeature = useCallback(
    (feature) => {
      if (!featureLimits) {
        // Premium-gated features default to false when limits aren't loaded
        const premiumFeatures = ['import', 'staff_management'];
        if (premiumFeatures.includes(feature)) return false;
        return true;
      }

      switch (feature) {
        case 'import':
          return featureLimits.has_import;
        case 'staff_management':
          return featureLimits.has_staff_management === true;
        case 'create_admin':
          return featureLimits.current_admins < featureLimits.max_admins;
        case 'send_email':
          return (
            featureLimits.emails_remaining === -1 ||
            featureLimits.emails_remaining > 0
          );
        default:
          return true;
      }
    },
    [featureLimits]
  );

  // Check subscription status
  const isSubscriptionActive = useCallback(() => {
    if (!subscription) return false;
    return ['trial', 'active'].includes(subscription.status);
  }, [subscription]);

  // Check if in trial period
  const isTrialPeriod = useCallback(() => {
    if (!subscription) return false;
    return subscription.status === 'trial';
  }, [subscription]);

  // Get days left in trial
  const getTrialDaysLeft = useCallback(() => {
    if (!school?.trial_end_date) return 0;
    const endDate = new Date(school.trial_end_date);
    const now = new Date();
    const diff = endDate - now;
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  }, [school]);

  // Clear school context (on logout)
  const clearSchool = useCallback(() => {
    setSchool(null);
    setSubscription(null);
    setFeatureLimits(null);
    setStoredSchoolSlug(null);
  }, []);

  const value = {
    // State
    school,
    subscription,
    featureLimits,
    loading,
    error,
    schoolSlug: activeSchoolSlug,

    // Actions
    fetchSchoolInfo,
    refreshSubscription,
    buildApiUrl,
    navigateToSchool,
    clearSchool,

    // Helpers
    hasFeature,
    isSubscriptionActive,
    isTrialPeriod,
    getTrialDaysLeft,
  };

  return (
    <SchoolContext.Provider value={value}>
      {children}
    </SchoolContext.Provider>
  );
}

export default SchoolContext;
