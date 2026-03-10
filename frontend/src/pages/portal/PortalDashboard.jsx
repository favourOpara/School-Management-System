// src/pages/portal/PortalDashboard.jsx
import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GraduationCap,
  Settings,
  ExternalLink,
  LogOut,
  Building2,
  CreditCard,
  Bell,
  Users,
  ChevronRight,
  Loader2,
  Menu,
  X,
  Plus,
  Eye,
  EyeOff,
  Edit2,
  Key,
  Trash2,
  Copy,
  Check,
  AlertCircle,
  Lock,
  Database,
  Download,
  Shield,
  ToggleLeft,
  ToggleRight,
  FileText,
  Search,
  User,
} from 'lucide-react';
import SchoolConfiguration from '../../components/SchoolConfiguration';
import API_BASE_URL, { getSchoolSlug } from '../../config';
import './PortalDashboard.css';

function PortalDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('branding');
  const [schoolName, setSchoolName] = useState('');
  const [schoolSlug, setSchoolSlug] = useState('');
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Admin accounts state
  const [adminAccounts, setAdminAccounts] = useState([]);
  const [adminLimits, setAdminLimits] = useState({});
  const [adminLoading, setAdminLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showCredentialsModal, setShowCredentialsModal] = useState(false);
  const [selectedAdmin, setSelectedAdmin] = useState(null);
  const [newCredentials, setNewCredentials] = useState(null);
  const [adminError, setAdminError] = useState('');

  // Proprietor accounts state
  const [proprietorAccounts, setProprietorAccounts] = useState([]);
  const [proprietorLimits, setProprietorLimits] = useState({});
  const [proprietorLoading, setProprietorLoading] = useState(false);
  const [proprietorError, setProprietorError] = useState('');
  const [showCreateProprietorModal, setShowCreateProprietorModal] = useState(false);
  const [showEditProprietorModal, setShowEditProprietorModal] = useState(false);
  const [selectedProprietor, setSelectedProprietor] = useState(null);

  // Upgrade modal state
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradePlans, setUpgradePlans] = useState([]);
  const [upgradeLoading, setUpgradeLoading] = useState(false);
  const [upgradeSubmitting, setUpgradeSubmitting] = useState(false);
  const [upgradeError, setUpgradeError] = useState('');
  const [selectedUpgradePlan, setSelectedUpgradePlan] = useState(null);
  const [upgradeBillingCycle, setUpgradeBillingCycle] = useState('monthly');
  const [upgradeSaveCard, setUpgradeSaveCard] = useState(false);

  // Auto-debit state
  const [autoDebitLoading, setAutoDebitLoading] = useState(false);
  const [removeCardLoading, setRemoveCardLoading] = useState(false);
  const [removeCardConfirm, setRemoveCardConfirm] = useState(false);
  const [autoDebitError, setAutoDebitError] = useState(null);

  useEffect(() => {
    // Check if user is authenticated (using portal-specific token)
    const token = localStorage.getItem('portalAccessToken');
    if (!token) {
      navigate('/portal');
      return;
    }

    const storedSchoolName = localStorage.getItem('portalSchoolName');
    const storedSchoolSlug = localStorage.getItem('portalSchoolSlug');

    if (storedSchoolName) setSchoolName(storedSchoolName);
    if (storedSchoolSlug) setSchoolSlug(storedSchoolSlug);

    fetchSubscriptionInfo();
  }, [navigate]);

  useEffect(() => {
    if (activeTab === 'admins') {
      fetchAdminAccounts();
    }
    if (activeTab === 'proprietors') {
      fetchProprietorAccounts();
    }
  }, [activeTab]);

  const fetchSubscriptionInfo = async () => {
    try {
      const token = localStorage.getItem('portalAccessToken');
      const slug = localStorage.getItem('portalSchoolSlug');

      const response = await fetch(`${API_BASE_URL}/api/portal/subscription/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setSubscription(data);
      }
    } catch (error) {
      console.error('Error fetching subscription:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminAccounts = async () => {
    setAdminLoading(true);
    setAdminError('');
    try {
      const token = localStorage.getItem('portalAccessToken');

      const response = await fetch(`${API_BASE_URL}/api/portal/admin-accounts/`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const data = await response.json();
        setAdminAccounts(data.admin_accounts || []);
        setAdminLimits(data.limits || {});
      } else {
        setAdminError('Failed to load admin accounts');
      }
    } catch (error) {
      console.error('Error fetching admin accounts:', error);
      setAdminError('Error loading admin accounts');
    } finally {
      setAdminLoading(false);
    }
  };

  const fetchProprietorAccounts = async () => {
    setProprietorLoading(true);
    setProprietorError('');
    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/proprietor-accounts/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (response.ok) {
        const data = await response.json();
        setProprietorAccounts(data.proprietor_accounts || []);
        setProprietorLimits(data.limits || {});
      } else {
        setProprietorError('Failed to load proprietor accounts');
      }
    } catch (error) {
      console.error('Error fetching proprietor accounts:', error);
      setProprietorError('Error loading proprietor accounts');
    } finally {
      setProprietorLoading(false);
    }
  };

  const openUpgradeModal = async () => {
    setShowUpgradeModal(true);
    setUpgradeError('');
    setUpgradeLoading(true);
    setUpgradeSaveCard(subscription?.has_saved_card || false);
    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/subscription/plans/`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!response.ok) throw new Error('Failed to fetch plans');
      const data = await response.json();
      setUpgradePlans(data.plans || []);
      setSelectedUpgradePlan(data.current_plan_id || null);
      setUpgradeBillingCycle(subscription?.billing_cycle || 'monthly');
    } catch (err) {
      setUpgradeError(err.message);
    } finally {
      setUpgradeLoading(false);
    }
  };

  const handleToggleAutoDebit = async () => {
    try {
      setAutoDebitLoading(true);
      setAutoDebitError(null);
      const token = localStorage.getItem('portalAccessToken');
      const res = await fetch(`${API_BASE_URL}/api/portal/billing/auto-debit/toggle/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update auto-renewal');
      await fetchSubscriptionInfo();
    } catch (err) {
      setAutoDebitError(err.message);
    } finally {
      setAutoDebitLoading(false);
    }
  };

  const handleRemoveCard = async () => {
    if (!removeCardConfirm) {
      setRemoveCardConfirm(true);
      return;
    }
    try {
      setRemoveCardLoading(true);
      setAutoDebitError(null);
      const token = localStorage.getItem('portalAccessToken');
      const res = await fetch(`${API_BASE_URL}/api/portal/billing/saved-card/remove/`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to remove card');
      setRemoveCardConfirm(false);
      await fetchSubscriptionInfo();
    } catch (err) {
      setAutoDebitError(err.message);
    } finally {
      setRemoveCardLoading(false);
    }
  };

  const handleUpgradeSubmit = async () => {
    if (!selectedUpgradePlan) return;
    setUpgradeSubmitting(true);
    setUpgradeError('');
    try {
      const token = localStorage.getItem('portalAccessToken');
      const slug = localStorage.getItem('portalSchoolSlug');
      const response = await fetch(`${API_BASE_URL}/api/portal/subscription/upgrade/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          plan_id: selectedUpgradePlan,
          billing_cycle: upgradeBillingCycle,
          callback_url: `${window.location.origin}/payment/callback?from=portal`,
          save_card: upgradeSaveCard,
        }),
      });
      const data = await response.json();
      if (response.ok && data.payment?.authorization_url) {
        window.location.href = data.payment.authorization_url;
      } else if (response.ok) {
        setShowUpgradeModal(false);
        fetchSubscriptionInfo();
      } else {
        setUpgradeError(data.detail || 'Failed to process upgrade');
      }
    } catch (err) {
      setUpgradeError(err.message);
    } finally {
      setUpgradeSubmitting(false);
    }
  };

  const handleLogout = () => {
    // Clear portal-specific auth data
    localStorage.removeItem('portalAccessToken');
    localStorage.removeItem('portalRefreshToken');
    localStorage.removeItem('portalUserName');
    localStorage.removeItem('portalSchoolSlug');
    localStorage.removeItem('portalSchoolName');
    localStorage.removeItem('portalMode');
    navigate('/portal');
  };

  const getSchoolLoginUrl = () => {
    const slug = localStorage.getItem('portalSchoolSlug') || schoolSlug;
    if (!slug) return null;
    return `${window.location.origin}/${slug}`;
  };

  const hasProprietorFeature = ['standard', 'premium', 'custom'].includes(subscription?.plan?.name);

  const tabs = [
    { id: 'branding', name: 'School Branding', icon: Building2 },
    { id: 'admins', name: 'Admin Accounts', icon: Users },
    ...(hasProprietorFeature ? [{ id: 'proprietors', name: 'Proprietor Accounts', icon: Shield }] : []),
    { id: 'database', name: 'Download Database', icon: Database },
    { id: 'subscription', name: 'Subscription', icon: CreditCard },
    { id: 'notifications', name: 'Notifications', icon: Bell },
  ];

  const handleTabClick = (tabId) => {
    setActiveTab(tabId);
    setMobileMenuOpen(false);
  };

  return (
    <div className="portal-dashboard">
      {/* Mobile Header */}
      <div className="portal-mobile-header">
        <Link to="/portal/dashboard" className="portal-mobile-header-logo">
          <div className="portal-mobile-header-logo-icon">
            <GraduationCap size={20} />
          </div>
          <span>EduCare</span>
        </Link>
        <button
          className="portal-mobile-menu-btn"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Sidebar Overlay */}
      <div
        className={`portal-sidebar-overlay ${mobileMenuOpen ? 'open' : ''}`}
        onClick={() => setMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`portal-sidebar ${mobileMenuOpen ? 'open' : ''}`}>
        <div className="portal-sidebar-header">
          <Link to="/portal/dashboard" className="portal-sidebar-logo">
            <div className="portal-sidebar-logo-icon">
              <GraduationCap size={24} />
            </div>
            <span>EduCare</span>
          </Link>
        </div>

        <div className="portal-sidebar-school">
          <div className="portal-school-avatar">
            {schoolName.charAt(0).toUpperCase()}
          </div>
          <div className="portal-school-info">
            <h3>{schoolName || 'Your School'}</h3>
            <p>Admin Portal</p>
            {subscription && (
              <span className={`portal-plan-badge ${subscription.status || 'trial'}`}>
                {subscription.plan?.display_name || 'No Plan'}
              </span>
            )}
          </div>
        </div>

        <nav className="portal-sidebar-nav">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              className={`portal-nav-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => handleTabClick(tab.id)}
            >
              <tab.icon size={20} />
              <span>{tab.name}</span>
            </button>
          ))}
        </nav>

        <div className="portal-sidebar-footer">
          <a className="portal-access-school-btn" href={getSchoolLoginUrl() || '#'} target="_blank" rel="noopener noreferrer">
            <div className="portal-access-school-content">
              <Settings size={20} />
              <div>
                <span className="portal-access-school-title">School Dashboard</span>
                <span className="portal-access-school-subtitle">Opens login page</span>
              </div>
            </div>
            <ExternalLink size={18} />
          </a>

          <button className="portal-logout-btn" onClick={handleLogout}>
            <LogOut size={20} />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="portal-main">
        <header className="portal-header">
          <div>
            <h1>
              {activeTab === 'branding' && 'School Branding'}
              {activeTab === 'admins' && 'Admin Accounts'}
              {activeTab === 'proprietors' && 'Proprietor Accounts'}
              {activeTab === 'database' && 'Download Database'}
              {activeTab === 'subscription' && 'Subscription'}
              {activeTab === 'notifications' && 'Notification Settings'}
            </h1>
            <p>
              {activeTab === 'branding' && 'Customize your school\'s appearance and identity'}
              {activeTab === 'admins' && 'Manage admin accounts for your School Management System'}
              {activeTab === 'proprietors' && 'Manage proprietor accounts for analytics access'}
              {activeTab === 'database' && 'Export your complete school database'}
              {activeTab === 'subscription' && 'Manage your subscription and billing'}
              {activeTab === 'notifications' && 'Configure email and notification preferences'}
            </p>
          </div>
        </header>

        <div className="portal-content">
          {/* Access School Card - Always visible at top */}
          <div className="portal-access-card">
            <div className="portal-access-card-content">
              <div className="portal-access-card-icon">
                <GraduationCap size={24} />
              </div>
              <div className="portal-access-card-text">
                <h3>Access Your School Management System</h3>
                <p>Use your admin credentials below to log in to the school dashboard.</p>
              </div>
            </div>
            <a className="portal-access-card-btn" href={getSchoolLoginUrl() || '#'} target="_blank" rel="noopener noreferrer">
              Open School Login
              <ExternalLink size={20} />
            </a>
          </div>

          {/* Tab Content */}
          {activeTab === 'branding' && (
            <div className="portal-tab-content">
              <SchoolConfiguration />
            </div>
          )}

          {activeTab === 'admins' && (
            <div className="portal-tab-content">
              <AdminAccountsTab
                adminAccounts={adminAccounts}
                adminLimits={adminLimits}
                adminLoading={adminLoading}
                adminError={adminError}
                onRefresh={fetchAdminAccounts}
                showCreateModal={showCreateModal}
                setShowCreateModal={setShowCreateModal}
                showEditModal={showEditModal}
                setShowEditModal={setShowEditModal}
                showCredentialsModal={showCredentialsModal}
                setShowCredentialsModal={setShowCredentialsModal}
                selectedAdmin={selectedAdmin}
                setSelectedAdmin={setSelectedAdmin}
                newCredentials={newCredentials}
                setNewCredentials={setNewCredentials}
                openUpgradeModal={openUpgradeModal}
              />
            </div>
          )}

          {activeTab === 'proprietors' && (
            <div className="portal-tab-content">
              <ProprietorAccountsTab
                proprietorAccounts={proprietorAccounts}
                proprietorLimits={proprietorLimits}
                proprietorLoading={proprietorLoading}
                proprietorError={proprietorError}
                onRefresh={fetchProprietorAccounts}
                setShowCreateModal={setShowCreateProprietorModal}
                setShowEditModal={setShowEditProprietorModal}
                setSelectedProprietor={setSelectedProprietor}
                setShowCredentialsModal={setShowCredentialsModal}
                setNewCredentials={setNewCredentials}
                openUpgradeModal={openUpgradeModal}
              />
            </div>
          )}

          {activeTab === 'database' && (
            <div className="portal-tab-content">
              <DatabaseDownloadTab subscription={subscription} openUpgradeModal={openUpgradeModal} />
            </div>
          )}

          {activeTab === 'subscription' && (
            <div className="portal-tab-content">
              {loading ? (
                <div className="portal-loading">
                  <Loader2 className="portal-spinner" size={32} />
                  <p>Loading subscription info...</p>
                </div>
              ) : (
                <div className="portal-subscription-content">
                  <div className="portal-subscription-card">
                    <div className="portal-subscription-header">
                      <h3>Current Plan</h3>
                      <span className={`portal-subscription-badge ${subscription?.status || 'pending'}`}>
                        {subscription?.status === 'active' ? 'Active' :
                         subscription?.status === 'trial' ? 'Trial' :
                         subscription?.status === 'pending' ? 'Pending Payment' :
                         subscription?.status === 'grace_period' ? 'Grace Period' :
                         subscription?.status === 'expired' ? 'Expired' :
                         subscription?.status || 'Pending'}
                      </span>
                    </div>
                    <div className="portal-subscription-plan">
                      <h2>{subscription?.plan?.display_name || 'No Plan'}</h2>
                      <p>{subscription?.plan?.description || 'Select a plan to get started'}</p>
                    </div>
                    {subscription?.current_period_end && (
                      <div className="portal-subscription-period">
                        <span>
                          {subscription?.status === 'trial' ? 'Trial ends' : 'Renews'}: {' '}
                          {new Date(subscription.current_period_end).toLocaleDateString()}
                        </span>
                      </div>
                    )}
                    <button className="portal-upgrade-btn" onClick={openUpgradeModal}>
                      View Plans & Upgrade
                      <ChevronRight size={18} />
                    </button>
                  </div>

                  {/* Auto-Renewal Card */}
                  <div className="portal-subscription-card" style={{ marginTop: '16px' }}>
                    <div className="portal-subscription-header">
                      <h3 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <CreditCard size={18} />
                        Auto-Renewal
                      </h3>
                    </div>

                    {autoDebitError && (
                      <p style={{ color: '#ef4444', fontSize: '13px', marginBottom: '12px' }}>{autoDebitError}</p>
                    )}

                    {subscription?.has_saved_card ? (
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div>
                            <p style={{ fontWeight: 600, marginBottom: '2px' }}>
                              {subscription.auto_debit_enabled ? 'Auto-renewal is on' : 'Auto-renewal is off'}
                            </p>
                            <p style={{ fontSize: '13px', color: '#6b7280' }}>Card saved securely via Paystack</p>
                          </div>
                          <button
                            onClick={handleToggleAutoDebit}
                            disabled={autoDebitLoading}
                            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex', alignItems: 'center' }}
                            title={subscription.auto_debit_enabled ? 'Disable auto-renewal' : 'Enable auto-renewal'}
                          >
                            {autoDebitLoading ? (
                              <Loader2 size={28} style={{ animation: 'spin 1s linear infinite', color: '#3b82f6' }} />
                            ) : subscription.auto_debit_enabled ? (
                              <ToggleRight size={36} style={{ color: '#3b82f6' }} />
                            ) : (
                              <ToggleLeft size={36} style={{ color: '#9ca3af' }} />
                            )}
                          </button>
                        </div>
                        <button
                          onClick={handleRemoveCard}
                          disabled={removeCardLoading}
                          style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        >
                          {removeCardLoading ? (
                            <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} />
                          ) : (
                            <Trash2 size={14} />
                          )}
                          {removeCardConfirm ? 'Confirm — remove saved card?' : 'Remove saved card'}
                        </button>
                      </div>
                    ) : (
                      <p style={{ fontSize: '13px', color: '#6b7280' }}>
                        No saved card on file. On your next payment, check "Save card for automatic renewal" to enable auto-renewal.
                      </p>
                    )}
                  </div>

                  <div className="portal-subscription-features">
                    <h4>Usage</h4>
                    <ul>
                      {(() => {
                        const fl = subscription?.feature_limits || {};
                        const items = [
                          { label: 'Students', current: fl.current_students, max: fl.max_students },
                          { label: 'Teachers', current: fl.current_teachers, max: fl.max_teachers },
                          { label: 'Principals', current: fl.current_principals, max: fl.max_principals },
                          { label: 'Parents', current: fl.current_parents, max: fl.max_parents },
                          { label: 'Admin Accounts', current: fl.current_admins, max: fl.max_admins },
                          { label: 'Emails Today', current: fl.emails_sent_today, max: fl.max_daily_emails },
                        ];
                        return items.map((item, i) => (
                          <li key={i}>
                            <span className="feature-label">{item.label}</span>
                            <span className="feature-value">
                              <span className={item.max > 0 && item.current >= item.max ? 'usage-at-limit' : ''}>
                                {item.current ?? 0}
                              </span>
                              {' / '}
                              {item.max === 0 ? 'Unlimited' : item.max ?? 0}
                            </span>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>

                  <div className="portal-subscription-features">
                    <h4>Plan Features</h4>
                    <ul>
                      <li>
                        <span className="feature-label">XLSX Import</span>
                        <span className="feature-value">
                          {subscription?.feature_limits?.has_import
                            ? `Yes (${subscription?.feature_limits?.max_import_rows || 0} per import)`
                            : 'No'}
                        </span>
                      </li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'notifications' && (
            <div className="portal-tab-content">
              <div className="portal-notifications-content">
                <div className="portal-notification-section">
                  <h3>Email Notifications</h3>
                  <p>Configure which emails your school sends automatically.</p>

                  <div className="portal-notification-options">
                    <label className="portal-notification-option">
                      <div>
                        <span className="option-title">Fee Reminders</span>
                        <span className="option-description">Send automatic reminders for pending fees</span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className="portal-notification-option">
                      <div>
                        <span className="option-title">Attendance Alerts</span>
                        <span className="option-description">Notify parents when students are absent</span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className="portal-notification-option">
                      <div>
                        <span className="option-title">Grade Updates</span>
                        <span className="option-description">Send notifications when grades are posted</span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                    <label className="portal-notification-option">
                      <div>
                        <span className="option-title">Announcements</span>
                        <span className="option-description">Email school announcements to parents</span>
                      </div>
                      <input type="checkbox" defaultChecked />
                    </label>
                  </div>
                </div>

                <div className="portal-notification-note">
                  <p>
                    <strong>Note:</strong> Email settings will use the sender name configured in School Branding.
                    Emails will be sent from: <code>noreply@educare.com</code>
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Modals */}
      {showCreateModal && (
        <CreateAdminModal
          onClose={() => setShowCreateModal(false)}
          onSuccess={(credentials) => {
            setShowCreateModal(false);
            setNewCredentials(credentials);
            setShowCredentialsModal(true);
            fetchAdminAccounts();
          }}
        />
      )}

      {showEditModal && selectedAdmin && (
        <EditAdminModal
          admin={selectedAdmin}
          onClose={() => {
            setShowEditModal(false);
            setSelectedAdmin(null);
          }}
          onSuccess={(credentials) => {
            setShowEditModal(false);
            setSelectedAdmin(null);
            if (credentials) {
              setNewCredentials(credentials);
              setShowCredentialsModal(true);
            }
            fetchAdminAccounts();
          }}
        />
      )}

      {showCredentialsModal && newCredentials && (
        <CredentialsModal
          credentials={newCredentials}
          onClose={() => {
            setShowCredentialsModal(false);
            setNewCredentials(null);
          }}
        />
      )}

      {/* Proprietor Modals */}
      {showCreateProprietorModal && (
        <CreateProprietorModal
          onClose={() => setShowCreateProprietorModal(false)}
          onSuccess={(credentials) => {
            setShowCreateProprietorModal(false);
            setNewCredentials(credentials);
            setShowCredentialsModal(true);
            fetchProprietorAccounts();
          }}
        />
      )}

      {showEditProprietorModal && selectedProprietor && (
        <EditProprietorModal
          proprietor={selectedProprietor}
          onClose={() => {
            setShowEditProprietorModal(false);
            setSelectedProprietor(null);
          }}
          onSuccess={(credentials) => {
            setShowEditProprietorModal(false);
            setSelectedProprietor(null);
            if (credentials) {
              setNewCredentials(credentials);
              setShowCredentialsModal(true);
            }
            fetchProprietorAccounts();
          }}
        />
      )}

      {/* Upgrade Modal */}
      {showUpgradeModal && (
        <div className="portal-modal-overlay" onClick={() => setShowUpgradeModal(false)}>
          <div className="portal-modal portal-upgrade-modal" onClick={(e) => e.stopPropagation()}>
            <div className="portal-modal-header">
              <h2>Choose a Plan</h2>
              <button className="portal-modal-close" onClick={() => setShowUpgradeModal(false)}>
                <X size={20} />
              </button>
            </div>

            <div className="upgrade-billing-toggle">
              <button
                className={`toggle-btn ${upgradeBillingCycle === 'monthly' ? 'active' : ''}`}
                onClick={() => setUpgradeBillingCycle('monthly')}
              >
                Monthly
              </button>
              <button
                className={`toggle-btn ${upgradeBillingCycle === 'annual' ? 'active' : ''}`}
                onClick={() => setUpgradeBillingCycle('annual')}
              >
                Annual (Save 20%)
              </button>
            </div>

            {/* Save card option */}
            {selectedUpgradePlan && upgradePlans.find(p => p.id === selectedUpgradePlan && (upgradeBillingCycle === 'annual' ? p.annual_price : p.monthly_price) > 0) && (
              <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', padding: '12px 16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0', cursor: 'pointer', marginBottom: '16px' }}>
                <input
                  type="checkbox"
                  checked={upgradeSaveCard}
                  onChange={(e) => setUpgradeSaveCard(e.target.checked)}
                  style={{ marginTop: '2px' }}
                />
                <div>
                  <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '2px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={15} />
                    Save card for automatic renewal
                  </div>
                  <p style={{ fontSize: '12px', color: '#6b7280', margin: 0 }}>
                    Card stored securely by Paystack. We'll auto-charge at renewal so you never lose access. Toggle off anytime.
                  </p>
                </div>
              </label>
            )}

            {upgradeError && (
              <div className="portal-error-message">
                <AlertCircle size={16} />
                <span>{upgradeError}</span>
              </div>
            )}

            {upgradeLoading ? (
              <div className="portal-loading">
                <Loader2 className="spin" size={24} />
                <span>Loading plans...</span>
              </div>
            ) : (
              <div className="upgrade-plans-grid">
                {upgradePlans.map((plan) => {
                  const priceKobo = upgradeBillingCycle === 'annual' ? plan.annual_price : plan.monthly_price;
                  const price = priceKobo / 100;
                  const isCurrent = plan.id === subscription?.plan?.id;
                  const isSelected = plan.id === selectedUpgradePlan;
                  return (
                    <div
                      key={plan.id}
                      className={`upgrade-plan-card ${isSelected ? 'selected' : ''} ${isCurrent ? 'current' : ''}`}
                      onClick={() => !isCurrent && setSelectedUpgradePlan(plan.id)}
                    >
                      {isCurrent && <span className="current-badge">Current Plan</span>}
                      <h3>{plan.display_name}</h3>
                      <p className="plan-price">
                        {price > 0 ? `₦${price.toLocaleString()}` : 'Contact Sales'}
                        {price > 0 && <span>/{upgradeBillingCycle === 'annual' ? 'year' : 'month'}</span>}
                      </p>
                      <p className="plan-desc">{plan.description}</p>
                      <ul className="plan-features-list">
                        <li>{plan.max_admin_accounts} Admin Account{plan.max_admin_accounts > 1 ? 's' : ''}</li>
                        <li>{plan.max_daily_emails} Daily Emails</li>
                        {plan.features && Object.entries(plan.features).slice(0, 4).map(([key, val]) => (
                          <li key={key}>
                            {val === true ? <Check size={14} /> : null}
                            {' '}{key.replace(/_/g, ' ')}
                          </li>
                        ))}
                      </ul>
                    </div>
                  );
                })}
              </div>
            )}

            <div className="portal-modal-actions">
              <button className="btn-secondary" onClick={() => setShowUpgradeModal(false)}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUpgradeSubmit}
                disabled={upgradeSubmitting || !selectedUpgradePlan || selectedUpgradePlan === subscription?.plan?.id}
              >
                {upgradeSubmitting ? (
                  <>
                    <Loader2 className="spin" size={16} />
                    Processing...
                  </>
                ) : (
                  'Upgrade Plan'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Admin Accounts Tab Component
function AdminAccountsTab({
  adminAccounts,
  adminLimits,
  adminLoading,
  adminError,
  onRefresh,
  setShowCreateModal,
  setShowEditModal,
  setSelectedAdmin,
  setShowCredentialsModal,
  setNewCredentials,
  openUpgradeModal,
}) {
  const [visiblePasswords, setVisiblePasswords] = useState({});
  const [resettingPassword, setResettingPassword] = useState(null);

  const togglePasswordVisibility = (id) => {
    setVisiblePasswords(prev => ({
      ...prev,
      [id]: !prev[id]
    }));
  };

  const handleResetPassword = async (admin) => {
    if (!confirm(`Reset password for ${admin.username}? A new password will be generated.`)) {
      return;
    }

    setResettingPassword(admin.id);
    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/admin-accounts/${admin.id}/reset-password/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNewCredentials(data.credentials);
        setShowCredentialsModal(true);
      } else {
        alert('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password');
    } finally {
      setResettingPassword(null);
    }
  };

  if (adminLoading) {
    return (
      <div className="portal-loading">
        <Loader2 className="portal-spinner" size={32} />
        <p>Loading admin accounts...</p>
      </div>
    );
  }

  if (adminError) {
    return (
      <div className="portal-admin-error">
        <AlertCircle size={24} />
        <p>{adminError}</p>
        <button onClick={onRefresh}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="portal-admin-accounts">
      {/* Info Banner */}
      <div className="portal-admin-info-banner">
        <div className="info-icon">
          <Lock size={20} />
        </div>
        <div className="info-text">
          <p>
            <strong>Admin accounts</strong> are used to log in to the School Management System.
            These are separate from your Admin Portal account.
          </p>
        </div>
      </div>

      {/* Header with limits and create button */}
      <div className="portal-admin-header">
        <div className="portal-admin-count">
          <span className="count-label">Admin Accounts</span>
          <span className="count-value">
            {adminLimits.current_count || 0} / {adminLimits.max_admins || 1}
          </span>
        </div>
        <button
          className={`portal-create-admin-btn ${!adminLimits.can_create ? 'disabled' : ''}`}
          onClick={() => adminLimits.can_create && setShowCreateModal(true)}
          disabled={!adminLimits.can_create}
          title={!adminLimits.can_create ? 'Upgrade your plan to create more admin accounts' : ''}
        >
          <Plus size={18} />
          Create Admin
        </button>
      </div>

      {!adminLimits.can_create && adminLimits.current_count >= adminLimits.max_admins && (
        <div className="portal-upgrade-notice">
          <AlertCircle size={18} />
          <span>Upgrade your plan to create additional admin accounts</span>
          <button onClick={openUpgradeModal} className="portal-inline-link">View Plans</button>
        </div>
      )}

      {/* Admin Accounts List */}
      <div className="portal-admin-list">
        {adminAccounts.length === 0 ? (
          <div className="portal-admin-empty">
            <Users size={48} />
            <p>No admin accounts found</p>
          </div>
        ) : (
          adminAccounts.map((admin) => (
            <div key={admin.id} className="portal-admin-card">
              <div className="admin-card-main">
                <div className="admin-avatar">
                  {admin.first_name?.charAt(0)?.toUpperCase() || 'A'}
                </div>
                <div className="admin-info">
                  <h4>{admin.first_name} {admin.last_name}</h4>
                  <div className="admin-credentials">
                    <div className="credential-row">
                      <span className="credential-label">Username:</span>
                      <code className="credential-value">{admin.username}</code>
                      <CopyButton text={admin.username} />
                    </div>
                  </div>
                  <div className="admin-meta">
                    <span className={`admin-status ${admin.is_active ? 'active' : 'inactive'}`}>
                      {admin.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {admin.last_login && (
                      <span className="admin-last-login">
                        Last login: {new Date(admin.last_login).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="admin-card-actions">
                <button
                  className="admin-action-btn"
                  onClick={() => {
                    setSelectedAdmin(admin);
                    setShowEditModal(true);
                  }}
                  title="Edit account"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="admin-action-btn"
                  onClick={() => handleResetPassword(admin)}
                  disabled={resettingPassword === admin.id}
                  title="Reset password"
                >
                  {resettingPassword === admin.id ? (
                    <Loader2 size={16} className="spinning" />
                  ) : (
                    <Key size={16} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Copy Button Component
function CopyButton({ text }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button className="copy-btn" onClick={handleCopy} title="Copy">
      {copied ? <Check size={14} /> : <Copy size={14} />}
    </button>
  );
}

// Create Admin Modal
function CreateAdminModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/admin-accounts/create/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.credentials);
      } else {
        setError(data.error || Object.values(data).flat().join(', ') || 'Failed to create admin');
      }
    } catch (err) {
      setError('Error creating admin account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h2>Create Admin Account</h2>
          <button className="portal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portal-modal-form">
          {error && <div className="portal-modal-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="e.g., john_admin"
            />
            <span className="form-hint">Used to log in to the School Management System</span>
          </div>

          <div className="form-group">
            <label>Email (optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="admin@school.edu"
            />
            <span className="form-hint">For account recovery and notifications</span>
          </div>

          <div className="portal-modal-note">
            <AlertCircle size={16} />
            <span>A secure password will be automatically generated</span>
          </div>

          <div className="portal-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={18} className="spinning" /> : null}
              Create Admin
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Admin Modal
function EditAdminModal({ admin, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: admin.username,
    email: admin.email || '',
    first_name: admin.first_name,
    last_name: admin.last_name,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Only include password if it's been changed
    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
    }

    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/admin-accounts/${admin.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.new_password ? { username: admin.username, password: data.new_password } : null);
      } else {
        setError(data.error || Object.values(data).flat().join(', ') || 'Failed to update admin');
      }
    } catch (err) {
      setError('Error updating admin account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h2>Edit Admin Account</h2>
          <button className="portal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portal-modal-form">
          {error && <div className="portal-modal-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>New Password (leave blank to keep current)</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
                minLength={8}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="portal-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={18} className="spinning" /> : null}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Credentials Modal
function CredentialsModal({ credentials, onClose }) {
  const [copied, setCopied] = useState(false);

  const handleCopyAll = async () => {
    const text = `Username: ${credentials.username}\nPassword: ${credentials.password}`;
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal credentials-modal" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h2>Admin Credentials</h2>
          <button className="portal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="credentials-content">
          <div className="credentials-warning">
            <AlertCircle size={24} />
            <p>
              <strong>Save these credentials now!</strong><br />
              The password cannot be retrieved later.
            </p>
          </div>

          <div className="credentials-box">
            <div className="credential-item">
              <span className="credential-label">Username</span>
              <div className="credential-value-row">
                <code>{credentials.username}</code>
                <CopyButton text={credentials.username} />
              </div>
            </div>
            <div className="credential-item">
              <span className="credential-label">Password</span>
              <div className="credential-value-row">
                <code>{credentials.password}</code>
                <CopyButton text={credentials.password} />
              </div>
            </div>
          </div>

          <button className="btn-copy-all" onClick={handleCopyAll}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? 'Copied!' : 'Copy All'}
          </button>

          {credentials.note && (
            <p className="credentials-note">{credentials.note}</p>
          )}
        </div>

        <div className="portal-modal-actions">
          <button className="btn-primary" onClick={onClose}>
            I've Saved These Credentials
          </button>
        </div>
      </div>
    </div>
  );
}

// Report Cards Section Component
function ReportCardsSection() {
  const [scope, setScope] = useState('all_time');
  const [availableTerms, setAvailableTerms] = useState([]);
  const [selectedTerm, setSelectedTerm] = useState('');
  const [studentQuery, setStudentQuery] = useState('');
  const [studentResults, setStudentResults] = useState([]);
  const [selectedStudent, setSelectedStudent] = useState(null);
  const [searching, setSearching] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [downloadPhase, setDownloadPhase] = useState('idle'); // 'idle' | 'generating' | 'downloading'
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [error, setError] = useState('');
  const searchTimeout = React.useRef(null);

  // Load available terms on mount
  useEffect(() => {
    const token = localStorage.getItem('portalAccessToken');
    fetch(`${API_BASE_URL}/api/portal/report-cards/terms/`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.json())
      .then(data => { if (Array.isArray(data)) setAvailableTerms(data); })
      .catch(() => {});
  }, []);

  const handleStudentSearch = (val) => {
    setStudentQuery(val);
    setSelectedStudent(null);
    clearTimeout(searchTimeout.current);
    if (val.trim().length < 2) { setStudentResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try {
        const token = localStorage.getItem('portalAccessToken');
        const res = await fetch(`${API_BASE_URL}/api/portal/report-cards/students/search/?q=${encodeURIComponent(val.trim())}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setStudentResults(Array.isArray(data) ? data : []);
      } catch { setStudentResults([]); }
      finally { setSearching(false); }
    }, 350);
  };

  const handleDownload = async () => {
    setError('');
    if (scope === 'specific_student' && !selectedStudent) {
      setError('Please select a student first.'); return;
    }
    if ((scope === 'specific_term') && !selectedTerm) {
      setError('Please select a term first.'); return;
    }

    const params = new URLSearchParams({ scope });
    if (selectedTerm && (scope === 'specific_term' || (scope === 'specific_student' && selectedTerm))) {
      const [ay, t] = selectedTerm.split('||');
      params.append('academic_year', ay);
      params.append('term', t);
    }
    if (selectedStudent) params.append('student_id', selectedStudent.id);

    setDownloading(true);
    setDownloadPhase('generating');
    setDownloadProgress(0);
    try {
      const token = localStorage.getItem('portalAccessToken');
      // fetch() resolves when headers arrive — server is building ZIP until then
      const res = await fetch(`${API_BASE_URL}/api/portal/report-cards/download/?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || 'Download failed');
      }

      // Headers received — switch to download phase and stream the body
      const contentLength = res.headers.get('Content-Length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;
      setDownloadPhase('downloading');

      const reader = res.body.getReader();
      const chunks = [];
      let received = 0;
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
        received += value.length;
        if (total > 0) setDownloadProgress(Math.min(Math.round((received / total) * 100), 99));
      }
      setDownloadProgress(100);

      const blob = new Blob(chunks, { type: 'application/zip' });
      const cd = res.headers.get('Content-Disposition');
      let filename = 'report_cards.zip';
      if (cd) { const m = cd.match(/filename="?([^"]+)"?/); if (m) filename = m[1]; }
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = filename;
      document.body.appendChild(a); a.click(); a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Download failed');
    } finally {
      setDownloading(false);
      setDownloadPhase('idle');
      setDownloadProgress(0);
    }
  };

  const showTermSelector = scope === 'specific_term' || scope === 'specific_student';

  return (
    <div className="report-cards-section">
      <div className="report-cards-header">
        <div className="report-cards-header-icon"><FileText size={20} /></div>
        <div>
          <h4 className="report-cards-title">Report Cards</h4>
          <p className="report-cards-subtitle">Download student report card PDFs as a ZIP archive.</p>
        </div>
      </div>

      <div className="report-cards-scope">
        <label className="rc-scope-label">What do you want to download?</label>
        <div className="rc-scope-options">
          {[
            { value: 'all_time', label: 'All students, all time' },
            { value: 'current_term', label: 'Current term only' },
            { value: 'specific_term', label: 'Specific term' },
            { value: 'specific_student', label: 'Specific student' },
          ].map(opt => (
            <label key={opt.value} className={`rc-scope-option ${scope === opt.value ? 'selected' : ''}`}>
              <input
                type="radio"
                name="rc-scope"
                value={opt.value}
                checked={scope === opt.value}
                onChange={() => { setScope(opt.value); setError(''); setSelectedTerm(''); setSelectedStudent(null); setStudentQuery(''); setStudentResults([]); }}
              />
              <span>{opt.label}</span>
            </label>
          ))}
        </div>
      </div>

      {scope === 'specific_student' && (
        <div className="rc-student-search">
          <label className="rc-field-label">Search student</label>
          <div className="rc-search-input-wrap">
            <Search size={16} className="rc-search-icon" />
            <input
              type="text"
              className="rc-search-input"
              placeholder="Type student name..."
              value={selectedStudent ? selectedStudent.name : studentQuery}
              onChange={e => { setSelectedStudent(null); handleStudentSearch(e.target.value); }}
              autoComplete="off"
            />
            {searching && <div className="rc-search-spinner" />}
            {selectedStudent && <div className="rc-selected-badge"><User size={12} />{selectedStudent.name}</div>}
          </div>
          {!selectedStudent && studentQuery.trim().length >= 2 && studentResults.length > 0 && (
            <div className="rc-search-results">
              {studentResults.map(s => (
                <button
                  key={s.id}
                  className="rc-search-result-item"
                  onClick={() => { setSelectedStudent(s); setStudentQuery(''); setStudentResults([]); }}
                >
                  <User size={14} />
                  <span className="rc-result-name">{s.name}</span>
                  <span className="rc-result-username">({s.username})</span>
                </button>
              ))}
            </div>
          )}
          {!selectedStudent && studentQuery.trim().length >= 2 && studentResults.length === 0 && !searching && (
            <p className="rc-no-results">No students found.</p>
          )}
        </div>
      )}

      {showTermSelector && (
        <div className="rc-term-select">
          <label className="rc-field-label">
            {scope === 'specific_student' ? 'Filter by term (optional)' : 'Select term'}
          </label>
          <select
            className="rc-select"
            value={selectedTerm}
            onChange={e => setSelectedTerm(e.target.value)}
          >
            <option value="">{scope === 'specific_student' ? '— All terms —' : '— Select a term —'}</option>
            {availableTerms.map(t => (
              <option key={`${t.academic_year}||${t.term}`} value={`${t.academic_year}||${t.term}`}>
                {t.label}{t.is_active ? ' (current)' : ''}
              </option>
            ))}
          </select>
        </div>
      )}

      {error && (
        <div className="portal-error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      {downloading && (
        <div className="rc-progress-wrap">
          <div className="rc-progress-info">
            {downloadPhase === 'generating'
              ? 'Generating ZIP\u2026'
              : `Downloading\u2026 ${downloadProgress}%`}
          </div>
          <div className="rc-progress-track">
            {downloadPhase === 'generating'
              ? <div className="rc-progress-indeterminate" />
              : <div className="rc-progress-fill" style={{ width: `${downloadProgress}%` }} />}
          </div>
        </div>
      )}

      <button
        className="portal-download-btn rc-download-btn"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <><Loader2 className="spinning" size={18} />Please wait...</>
        ) : (
          <><Download size={18} />Download Report Cards</>
        )}
      </button>
    </div>
  );
}

// Database Download Tab Component
function DatabaseDownloadTab({ subscription, openUpgradeModal }) {
  const [format, setFormat] = useState('xlsx');
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const planName = subscription?.plan?.name || 'free_trial';
  const hasAccess = ['standard', 'premium', 'custom'].includes(planName);

  const handleDownload = async () => {
    setDownloading(true);
    setError('');

    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/database/download/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ format: format }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Download failed');
      }

      const blob = await response.blob();
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `database_export.${format === 'csv' ? 'zip' : format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="?([^"]+)"?/);
        if (match) filename = match[1];
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download database');
    } finally {
      setDownloading(false);
    }
  };

  if (!hasAccess) {
    return (
      <div className="portal-database-download">
        <div className="database-upgrade-notice">
          <Database size={48} />
          <h3>Database Download</h3>
          <p>Download your complete school database is available on Standard plans and above.</p>
          <button className="portal-upgrade-btn" onClick={openUpgradeModal}>
            Upgrade to Standard
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="portal-database-download">
      <div className="database-info-card">
        <div className="info-icon">
          <Database size={20} />
        </div>
        <div className="info-text">
          <p>
            <strong>Download your complete school database</strong> including all users, classes, subjects,
            attendance records, grades, fees, and more. Useful for backups or migrating to your own platform.
          </p>
        </div>
      </div>

      <div className="database-format-section">
        <h4>Choose Export Format</h4>
        <div className="format-options">
          <label className={`format-option ${format === 'csv' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="csv"
              checked={format === 'csv'}
              onChange={() => setFormat('csv')}
            />
            <div className="format-option-content">
              <strong>CSV (ZIP)</strong>
              <span>Multiple CSV files in a ZIP archive. Compatible with Excel, Google Sheets, etc.</span>
            </div>
          </label>
          <label className={`format-option ${format === 'xlsx' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="xlsx"
              checked={format === 'xlsx'}
              onChange={() => setFormat('xlsx')}
            />
            <div className="format-option-content">
              <strong>Excel (XLSX)</strong>
              <span>Single Excel file with one sheet per table. Easy to browse and filter.</span>
            </div>
          </label>
          <label className={`format-option ${format === 'json' ? 'selected' : ''}`}>
            <input
              type="radio"
              name="format"
              value="json"
              checked={format === 'json'}
              onChange={() => setFormat('json')}
            />
            <div className="format-option-content">
              <strong>JSON</strong>
              <span>Structured JSON format. Ideal for importing into another database or application.</span>
            </div>
          </label>
        </div>
      </div>

      {error && (
        <div className="portal-error-message">
          <AlertCircle size={16} />
          <span>{error}</span>
        </div>
      )}

      <button
        className="portal-download-btn"
        onClick={handleDownload}
        disabled={downloading}
      >
        {downloading ? (
          <>
            <Loader2 className="spinning" size={18} />
            Preparing download...
          </>
        ) : (
          <>
            <Download size={18} />
            Download Database
          </>
        )}
      </button>

      <div className="rc-divider" />
      <ReportCardsSection />
    </div>
  );
}

// Proprietor Accounts Tab Component
function ProprietorAccountsTab({
  proprietorAccounts,
  proprietorLimits,
  proprietorLoading,
  proprietorError,
  onRefresh,
  setShowCreateModal,
  setShowEditModal,
  setSelectedProprietor,
  setShowCredentialsModal,
  setNewCredentials,
  openUpgradeModal,
}) {
  const [resettingPassword, setResettingPassword] = useState(null);

  const handleResetPassword = async (proprietor) => {
    if (!confirm(`Reset password for ${proprietor.username}? A new password will be generated.`)) {
      return;
    }

    setResettingPassword(proprietor.id);
    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/proprietor-accounts/${proprietor.id}/reset-password/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const data = await response.json();
        setNewCredentials(data.credentials);
        setShowCredentialsModal(true);
      } else {
        alert('Failed to reset password');
      }
    } catch (error) {
      console.error('Error resetting password:', error);
      alert('Error resetting password');
    } finally {
      setResettingPassword(null);
    }
  };

  if (proprietorLoading) {
    return (
      <div className="portal-loading">
        <Loader2 className="portal-spinner" size={32} />
        <p>Loading proprietor accounts...</p>
      </div>
    );
  }

  if (proprietorError) {
    return (
      <div className="portal-admin-error">
        <AlertCircle size={24} />
        <p>{proprietorError}</p>
        <button onClick={onRefresh}>Try Again</button>
      </div>
    );
  }

  return (
    <div className="portal-admin-accounts">
      {/* Info Banner */}
      <div className="portal-admin-info-banner">
        <div className="info-icon">
          <Shield size={20} />
        </div>
        <div className="info-text">
          <p>
            <strong>Proprietor accounts</strong> have read-only access to view school analytics,
            performance metrics, and financial summaries. They cannot modify school data.
          </p>
        </div>
      </div>

      {/* Header with limits and create button */}
      <div className="portal-admin-header">
        <div className="portal-admin-count">
          <span className="count-label">Proprietor Accounts</span>
          <span className="count-value">
            {proprietorLimits.current_count || 0} / {proprietorLimits.max_proprietors || 1}
          </span>
        </div>
        <button
          className={`portal-create-admin-btn ${!proprietorLimits.can_create ? 'disabled' : ''}`}
          onClick={() => proprietorLimits.can_create && setShowCreateModal(true)}
          disabled={!proprietorLimits.can_create}
          title={!proprietorLimits.can_create ? 'Upgrade your plan to create more proprietor accounts' : ''}
        >
          <Plus size={18} />
          Create Proprietor
        </button>
      </div>

      {!proprietorLimits.can_create && proprietorLimits.current_count >= proprietorLimits.max_proprietors && (
        <div className="portal-upgrade-notice">
          <AlertCircle size={18} />
          <span>Upgrade to Premium to create additional proprietor accounts</span>
          <button onClick={openUpgradeModal} className="portal-inline-link">View Plans</button>
        </div>
      )}

      {/* Proprietor Accounts List */}
      <div className="portal-admin-list">
        {proprietorAccounts.length === 0 ? (
          <div className="portal-admin-empty">
            <Shield size={48} />
            <p>No proprietor accounts found</p>
          </div>
        ) : (
          proprietorAccounts.map((proprietor) => (
            <div key={proprietor.id} className="portal-admin-card">
              <div className="admin-card-main">
                <div className="admin-avatar" style={{ background: 'linear-gradient(135deg, #8b5cf6, #6366f1)' }}>
                  {proprietor.first_name?.charAt(0)?.toUpperCase() || 'P'}
                </div>
                <div className="admin-info">
                  <h4>{proprietor.first_name} {proprietor.last_name}</h4>
                  <div className="admin-credentials">
                    <div className="credential-row">
                      <span className="credential-label">Username:</span>
                      <code className="credential-value">{proprietor.username}</code>
                      <CopyButton text={proprietor.username} />
                    </div>
                  </div>
                  <div className="admin-meta">
                    <span className={`admin-status ${proprietor.is_active ? 'active' : 'inactive'}`}>
                      {proprietor.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {proprietor.last_login && (
                      <span className="admin-last-login">
                        Last login: {new Date(proprietor.last_login).toLocaleDateString()}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="admin-card-actions">
                <button
                  className="admin-action-btn"
                  onClick={() => {
                    setSelectedProprietor(proprietor);
                    setShowEditModal(true);
                  }}
                  title="Edit account"
                >
                  <Edit2 size={16} />
                </button>
                <button
                  className="admin-action-btn"
                  onClick={() => handleResetPassword(proprietor)}
                  disabled={resettingPassword === proprietor.id}
                  title="Reset password"
                >
                  {resettingPassword === proprietor.id ? (
                    <Loader2 size={16} className="spinning" />
                  ) : (
                    <Key size={16} />
                  )}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// Create Proprietor Modal
function CreateProprietorModal({ onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: '',
    email: '',
    first_name: '',
    last_name: '',
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/proprietor-accounts/create/`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.credentials);
      } else {
        setError(data.error || Object.values(data).flat().join(', ') || 'Failed to create proprietor');
      }
    } catch (err) {
      setError('Error creating proprietor account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h2>Create Proprietor Account</h2>
          <button className="portal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portal-modal-form">
          {error && <div className="portal-modal-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
              placeholder="e.g., proprietor_john"
            />
            <span className="form-hint">Used to log in to the School Management System</span>
          </div>

          <div className="form-group">
            <label>Email (optional)</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              placeholder="proprietor@school.edu"
            />
            <span className="form-hint">For account recovery and notifications</span>
          </div>

          <div className="portal-modal-note">
            <AlertCircle size={16} />
            <span>A secure password will be automatically generated</span>
          </div>

          <div className="portal-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={18} className="spinning" /> : null}
              Create Proprietor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// Edit Proprietor Modal
function EditProprietorModal({ proprietor, onClose, onSuccess }) {
  const [formData, setFormData] = useState({
    username: proprietor.username,
    email: proprietor.email || '',
    first_name: proprietor.first_name,
    last_name: proprietor.last_name,
    password: '',
  });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    // Only include password if it's been changed
    const updateData = { ...formData };
    if (!updateData.password) {
      delete updateData.password;
    }

    try {
      const token = localStorage.getItem('portalAccessToken');
      const response = await fetch(`${API_BASE_URL}/api/portal/proprietor-accounts/${proprietor.id}/`, {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData),
      });

      const data = await response.json();

      if (response.ok) {
        onSuccess(data.new_password ? { username: proprietor.username, password: data.new_password } : null);
      } else {
        setError(data.error || Object.values(data).flat().join(', ') || 'Failed to update proprietor');
      }
    } catch (err) {
      setError('Error updating proprietor account');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={(e) => e.stopPropagation()}>
        <div className="portal-modal-header">
          <h2>Edit Proprietor Account</h2>
          <button className="portal-modal-close" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="portal-modal-form">
          {error && <div className="portal-modal-error">{error}</div>}

          <div className="form-row">
            <div className="form-group">
              <label>First Name *</label>
              <input
                type="text"
                value={formData.first_name}
                onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>Last Name *</label>
              <input
                type="text"
                value={formData.last_name}
                onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label>Username *</label>
            <input
              type="text"
              value={formData.username}
              onChange={(e) => setFormData({ ...formData, username: e.target.value })}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
            />
          </div>

          <div className="form-group">
            <label>New Password (leave blank to keep current)</label>
            <div className="password-input-wrapper">
              <input
                type={showPassword ? 'text' : 'password'}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                placeholder="Enter new password"
                minLength={8}
              />
              <button type="button" onClick={() => setShowPassword(!showPassword)}>
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <div className="portal-modal-actions">
            <button type="button" className="btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? <Loader2 size={18} className="spinning" /> : null}
              Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PortalDashboard;
