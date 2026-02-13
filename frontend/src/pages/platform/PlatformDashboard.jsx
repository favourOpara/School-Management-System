import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  School,
  DollarSign,
  Settings,
  LogOut,
  Shield,
  Users,
  TrendingUp,
  TrendingDown,
  Search,
  X,
  Eye,
  ChevronDown,
  Menu,
  GraduationCap,
} from 'lucide-react';
import API_BASE_URL from '../../config';
import './PlatformDashboard.css';

/* ────────── helpers ────────── */
const formatMoney = (kobo) => '₦' + (Number(kobo || 0) / 100).toLocaleString();
const formatDate = (iso) => {
  if (!iso) return '-';
  return new Date(iso).toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

const STATUS_COLORS = {
  active: { bg: '#d1fae5', color: '#065f46' },
  trial: { bg: '#dbeafe', color: '#1e40af' },
  expired: { bg: '#fee2e2', color: '#991b1b' },
  cancelled: { bg: '#f1f5f9', color: '#475569' },
  past_due: { bg: '#fef3c7', color: '#92400e' },
};

/* ────────── API helper ────────── */
const platformFetch = async (endpoint, options = {}) => {
  const token = localStorage.getItem('platformAccessToken');
  if (!token) {
    window.location.href = '/platform/login';
    return null;
  }
  const res = await fetch(`${API_BASE_URL}/api/superadmin/${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    localStorage.removeItem('platformAccessToken');
    localStorage.removeItem('platformRefreshToken');
    localStorage.removeItem('platformUserName');
    localStorage.removeItem('platformMode');
    window.location.href = '/platform/login';
    return null;
  }
  return res.json();
};

/* ══════════════════════════════════════════════════════════
   OVERVIEW TAB
   ══════════════════════════════════════════════════════════ */
function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformFetch('overview/').then((d) => {
      if (d) setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="platform-loading">Loading overview...</div>;
  if (!data) return <div className="platform-loading">Failed to load data.</div>;

  const { schools, users, users_total, revenue, plans, recent_registrations } = data;

  return (
    <div className="platform-tab-content">
      {/* Top stat cards */}
      <div className="platform-stat-cards">
        <div className="platform-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="platform-stat-icon" style={{ background: '#eff6ff' }}>
            <School size={24} color="#3b82f6" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{schools.total}</div>
            <div className="platform-stat-label">Total Schools</div>
          </div>
        </div>
        <div className="platform-stat-card" style={{ borderLeftColor: '#10b981' }}>
          <div className="platform-stat-icon" style={{ background: '#ecfdf5' }}>
            <TrendingUp size={24} color="#10b981" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{schools.active + schools.trial}</div>
            <div className="platform-stat-label">Active Subscriptions</div>
          </div>
        </div>
        <div className="platform-stat-card" style={{ borderLeftColor: '#8b5cf6' }}>
          <div className="platform-stat-icon" style={{ background: '#f5f3ff' }}>
            <Users size={24} color="#8b5cf6" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{users_total}</div>
            <div className="platform-stat-label">Total Users</div>
          </div>
        </div>
        <div className="platform-stat-card" style={{ borderLeftColor: '#f59e0b' }}>
          <div className="platform-stat-icon" style={{ background: '#fffbeb' }}>
            <DollarSign size={24} color="#f59e0b" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{formatMoney(revenue.all_time)}</div>
            <div className="platform-stat-label">All-Time Revenue</div>
          </div>
        </div>
      </div>

      {/* Subscription status breakdown */}
      <div className="platform-section-card">
        <h3>Subscription Status</h3>
        <div className="platform-status-grid">
          {['active', 'trial', 'expired', 'cancelled', 'past_due'].map((s) => (
            <div key={s} className="platform-status-item">
              <span
                className="platform-status-badge"
                style={{ background: STATUS_COLORS[s]?.bg, color: STATUS_COLORS[s]?.color }}
              >
                {s.replace('_', ' ')}
              </span>
              <span className="platform-status-count">{schools[s] || 0}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Users by role + Plans */}
      <div className="platform-two-col">
        <div className="platform-section-card">
          <h3>Users by Role</h3>
          <div className="platform-role-list">
            {['admin', 'proprietor', 'principal', 'teacher', 'student', 'parent'].map((role) => (
              <div key={role} className="platform-role-item">
                <span className="platform-role-name">{role.charAt(0).toUpperCase() + role.slice(1)}s</span>
                <span className="platform-role-count">{users[role] || 0}</span>
              </div>
            ))}
          </div>
        </div>
        <div className="platform-section-card">
          <h3>Active Plans Distribution</h3>
          <div className="platform-role-list">
            {plans.map((p, i) => (
              <div key={i} className="platform-role-item">
                <span className="platform-role-name">{p.plan__display_name}</span>
                <span className="platform-role-count">{p.count}</span>
              </div>
            ))}
            {plans.length === 0 && <p className="platform-empty">No active subscriptions</p>}
          </div>
        </div>
      </div>

      {/* Revenue this month */}
      <div className="platform-section-card">
        <h3>Revenue This Month</h3>
        <div className="platform-stat-value" style={{ fontSize: '2rem', marginTop: '0.5rem' }}>
          {formatMoney(revenue.this_month)}
        </div>
      </div>

      {/* Recent registrations */}
      <div className="platform-section-card">
        <h3>Recent Registrations (Last 7 Days)</h3>
        {recent_registrations.length === 0 ? (
          <p className="platform-empty">No new schools in the last 7 days.</p>
        ) : (
          <div className="platform-table-wrapper">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>School Name</th>
                  <th>Slug</th>
                  <th>Email</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {recent_registrations.map((s) => (
                  <tr key={s.id}>
                    <td className="platform-td-bold">{s.name}</td>
                    <td>{s.slug}</td>
                    <td>{s.email}</td>
                    <td>{formatDate(s.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SCHOOLS TAB
   ══════════════════════════════════════════════════════════ */
function SchoolsTab() {
  const [schools, setSchools] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [planFilter, setPlanFilter] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(null);
  const [detailData, setDetailData] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState('');

  const fetchSchools = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (statusFilter) params.append('status', statusFilter);
    if (planFilter) params.append('plan', planFilter);
    const qs = params.toString();
    const data = await platformFetch(`schools/list/${qs ? '?' + qs : ''}`);
    if (data) setSchools(data.schools);
    setLoading(false);
  }, [search, statusFilter, planFilter]);

  useEffect(() => {
    platformFetch('plans/').then((d) => {
      if (d) setPlans(d.plans);
    });
  }, []);

  useEffect(() => {
    fetchSchools();
  }, [fetchSchools]);

  const handleViewDetails = async (schoolId) => {
    setSelectedSchool(schoolId);
    setDetailLoading(true);
    const data = await platformFetch(`schools/${schoolId}/detail/`);
    if (data) setDetailData(data);
    setDetailLoading(false);
  };

  const handleAction = async (schoolId, action, planId = null) => {
    setActionLoading(schoolId);
    const body = { action };
    if (planId) body.plan_id = planId;
    await platformFetch(`schools/${schoolId}/action/`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    setActionLoading('');
    fetchSchools();
    if (selectedSchool === schoolId) {
      handleViewDetails(schoolId);
    }
  };

  return (
    <div className="platform-tab-content">
      {/* Filters */}
      <div className="platform-filters">
        <div className="platform-search-wrapper">
          <Search size={18} />
          <input
            type="text"
            placeholder="Search by name, slug, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button className="platform-search-clear" onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          )}
        </div>
        <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
          <option value="past_due">Past Due</option>
        </select>
        <select value={planFilter} onChange={(e) => setPlanFilter(e.target.value)}>
          <option value="">All Plans</option>
          {plans.map((p) => (
            <option key={p.id} value={p.name}>{p.display_name}</option>
          ))}
        </select>
      </div>

      {/* Schools table */}
      {loading ? (
        <div className="platform-loading">Loading schools...</div>
      ) : (
        <div className="platform-section-card">
          <div className="platform-table-wrapper">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Plan</th>
                  <th>Status</th>
                  <th>Users</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {schools.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', color: '#94a3b8', padding: '2rem' }}>
                      No schools found.
                    </td>
                  </tr>
                ) : (
                  schools.map((s) => (
                    <tr key={s.id}>
                      <td>
                        <div className="platform-school-name">{s.name}</div>
                        <div className="platform-school-slug">{s.slug}</div>
                      </td>
                      <td>{s.plan_name || '-'}</td>
                      <td>
                        {s.subscription_status ? (
                          <span
                            className="platform-badge"
                            style={{
                              background: STATUS_COLORS[s.subscription_status]?.bg,
                              color: STATUS_COLORS[s.subscription_status]?.color,
                            }}
                          >
                            {s.subscription_status.replace('_', ' ')}
                          </span>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td>{s.user_count}</td>
                      <td>{formatDate(s.created_at)}</td>
                      <td>
                        <div className="platform-actions">
                          <button
                            className="platform-action-btn view"
                            onClick={() => handleViewDetails(s.id)}
                          >
                            <Eye size={14} /> View
                          </button>
                          <button
                            className="platform-action-btn toggle"
                            disabled={actionLoading === s.id}
                            onClick={() =>
                              handleAction(s.id, s.is_active ? 'deactivate' : 'activate')
                            }
                          >
                            {s.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <div className="platform-plan-select-wrapper">
                            <select
                              className="platform-plan-select"
                              value=""
                              onChange={(e) => {
                                if (e.target.value) handleAction(s.id, 'change_plan', e.target.value);
                              }}
                            >
                              <option value="">Change Plan</option>
                              {plans
                                .filter((p) => p.name !== s.plan_key)
                                .map((p) => (
                                  <option key={p.id} value={p.id}>{p.display_name}</option>
                                ))}
                            </select>
                            <ChevronDown size={14} className="platform-plan-select-icon" />
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* School detail modal */}
      {selectedSchool && (
        <>
          <div className="platform-modal-overlay" onClick={() => setSelectedSchool(null)} />
          <div className="platform-modal">
            <div className="platform-modal-header">
              <h3>School Details</h3>
              <button onClick={() => setSelectedSchool(null)}>
                <X size={20} />
              </button>
            </div>
            <div className="platform-modal-body">
              {detailLoading ? (
                <div className="platform-loading">Loading details...</div>
              ) : detailData ? (
                <>
                  <div className="platform-detail-grid">
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Name</span>
                      <span className="platform-detail-value">{detailData.school.name}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Slug</span>
                      <span className="platform-detail-value">{detailData.school.slug}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Email</span>
                      <span className="platform-detail-value">{detailData.school.email}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Phone</span>
                      <span className="platform-detail-value">{detailData.school.phone || '-'}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Plan</span>
                      <span className="platform-detail-value">{detailData.school.plan_name || '-'}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Status</span>
                      <span className="platform-detail-value">
                        {detailData.school.subscription_status ? (
                          <span
                            className="platform-badge"
                            style={{
                              background: STATUS_COLORS[detailData.school.subscription_status]?.bg,
                              color: STATUS_COLORS[detailData.school.subscription_status]?.color,
                            }}
                          >
                            {detailData.school.subscription_status.replace('_', ' ')}
                          </span>
                        ) : '-'}
                      </span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Active</span>
                      <span className="platform-detail-value">{detailData.school.is_active ? 'Yes' : 'No'}</span>
                    </div>
                    <div className="platform-detail-item">
                      <span className="platform-detail-label">Created</span>
                      <span className="platform-detail-value">{formatDate(detailData.school.created_at)}</span>
                    </div>
                  </div>

                  {/* User counts */}
                  <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Users</h4>
                  <div className="platform-detail-grid">
                    {['admin', 'proprietor', 'principal', 'teacher', 'student', 'parent'].map((role) => (
                      <div key={role} className="platform-detail-item">
                        <span className="platform-detail-label">{role.charAt(0).toUpperCase() + role.slice(1)}s</span>
                        <span className="platform-detail-value">{detailData.user_counts[role] || 0}</span>
                      </div>
                    ))}
                  </div>

                  {/* Payments */}
                  {detailData.payments.length > 0 && (
                    <>
                      <h4 style={{ marginTop: '1.5rem', marginBottom: '0.75rem' }}>Recent Payments</h4>
                      <div className="platform-table-wrapper">
                        <table className="platform-table">
                          <thead>
                            <tr>
                              <th>Amount</th>
                              <th>Plan</th>
                              <th>Cycle</th>
                              <th>Status</th>
                              <th>Date</th>
                            </tr>
                          </thead>
                          <tbody>
                            {detailData.payments.map((p) => (
                              <tr key={p.id}>
                                <td>{formatMoney(p.amount)}</td>
                                <td>{p.plan_name}</td>
                                <td>{p.billing_cycle}</td>
                                <td>
                                  <span className={`platform-badge ${p.status === 'success' ? 'success' : ''}`}>
                                    {p.status}
                                  </span>
                                </td>
                                <td>{formatDate(p.paid_at || p.created_at)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              ) : (
                <p>Failed to load details.</p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   REVENUE TAB
   ══════════════════════════════════════════════════════════ */
function RevenueTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    platformFetch('revenue/').then((d) => {
      if (d) setData(d);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="platform-loading">Loading revenue data...</div>;
  if (!data) return <div className="platform-loading">Failed to load revenue data.</div>;

  const { all_time, this_month, last_month, by_plan, monthly, recent_payments } = data;

  const monthChange =
    last_month > 0 ? (((this_month - last_month) / last_month) * 100).toFixed(1) : this_month > 0 ? 100 : 0;

  return (
    <div className="platform-tab-content">
      {/* Revenue cards */}
      <div className="platform-stat-cards">
        <div className="platform-stat-card" style={{ borderLeftColor: '#10b981' }}>
          <div className="platform-stat-icon" style={{ background: '#ecfdf5' }}>
            <DollarSign size={24} color="#10b981" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{formatMoney(all_time)}</div>
            <div className="platform-stat-label">All-Time Revenue</div>
          </div>
        </div>
        <div className="platform-stat-card" style={{ borderLeftColor: '#3b82f6' }}>
          <div className="platform-stat-icon" style={{ background: '#eff6ff' }}>
            <TrendingUp size={24} color="#3b82f6" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{formatMoney(this_month)}</div>
            <div className="platform-stat-label">This Month</div>
            {Number(monthChange) !== 0 && (
              <div className={`platform-stat-delta ${Number(monthChange) >= 0 ? 'positive' : 'negative'}`}>
                {Number(monthChange) >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                {Math.abs(monthChange)}% vs last month
              </div>
            )}
          </div>
        </div>
        <div className="platform-stat-card" style={{ borderLeftColor: '#64748b' }}>
          <div className="platform-stat-icon" style={{ background: '#f8fafc' }}>
            <DollarSign size={24} color="#64748b" />
          </div>
          <div className="platform-stat-info">
            <div className="platform-stat-value">{formatMoney(last_month)}</div>
            <div className="platform-stat-label">Last Month</div>
          </div>
        </div>
      </div>

      {/* Revenue by plan + Monthly trend */}
      <div className="platform-two-col">
        <div className="platform-section-card">
          <h3>Revenue by Plan</h3>
          {by_plan.length === 0 ? (
            <p className="platform-empty">No payment data available.</p>
          ) : (
            <div className="platform-role-list">
              {by_plan.map((p, i) => (
                <div key={i} className="platform-role-item">
                  <div>
                    <span className="platform-role-name">{p.plan_name}</span>
                    <span className="platform-role-sub">{p.count} payment{p.count !== 1 ? 's' : ''}</span>
                  </div>
                  <span className="platform-role-count">{formatMoney(p.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className="platform-section-card">
          <h3>Monthly Trend</h3>
          {monthly.length === 0 ? (
            <p className="platform-empty">No monthly data available.</p>
          ) : (
            <div className="platform-monthly-bars">
              {monthly.map((m, i) => {
                const maxRev = Math.max(...monthly.map((x) => x.revenue), 1);
                const pct = (m.revenue / maxRev) * 100;
                return (
                  <div key={i} className="platform-monthly-item">
                    <span className="platform-monthly-label">{m.month}</span>
                    <div className="platform-monthly-bar-track">
                      <div
                        className="platform-monthly-bar-fill"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="platform-monthly-value">{formatMoney(m.revenue)}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Recent payments */}
      <div className="platform-section-card">
        <h3>Recent Payments</h3>
        {recent_payments.length === 0 ? (
          <p className="platform-empty">No payments yet.</p>
        ) : (
          <div className="platform-table-wrapper">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Amount</th>
                  <th>Plan</th>
                  <th>Cycle</th>
                  <th>Method</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recent_payments.map((p) => (
                  <tr key={p.id}>
                    <td className="platform-td-bold">{p.school_name}</td>
                    <td>{formatMoney(p.amount)}</td>
                    <td>{p.plan_name}</td>
                    <td>{p.billing_cycle}</td>
                    <td>{p.payment_method || '-'}</td>
                    <td>{formatDate(p.paid_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SETTINGS TAB
   ══════════════════════════════════════════════════════════ */
function SettingsTab() {
  const userName = localStorage.getItem('platformUserName') || 'Platform Admin';

  return (
    <div className="platform-tab-content">
      <div className="platform-section-card">
        <h3>Platform Information</h3>
        <div className="platform-detail-grid">
          <div className="platform-detail-item">
            <span className="platform-detail-label">Platform</span>
            <span className="platform-detail-value">EduCare School Management</span>
          </div>
          <div className="platform-detail-item">
            <span className="platform-detail-label">Logged in as</span>
            <span className="platform-detail-value">{userName}</span>
          </div>
        </div>
      </div>
      <div className="platform-section-card">
        <h3>Quick Links</h3>
        <div className="platform-links">
          <a href="/admin/" target="_blank" rel="noopener noreferrer" className="platform-link-btn">
            Django Admin Panel
          </a>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   MAIN DASHBOARD
   ══════════════════════════════════════════════════════════ */
function PlatformDashboard() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userName = localStorage.getItem('platformUserName') || 'Platform Admin';

  useEffect(() => {
    const token = localStorage.getItem('platformAccessToken');
    if (!token) {
      navigate('/platform/login');
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('platformAccessToken');
    localStorage.removeItem('platformRefreshToken');
    localStorage.removeItem('platformUserName');
    localStorage.removeItem('platformMode');
    navigate('/platform/login');
  };

  const tabs = [
    { key: 'overview', label: 'Overview', icon: <LayoutDashboard size={20} /> },
    { key: 'schools', label: 'Schools', icon: <School size={20} /> },
    { key: 'revenue', label: 'Revenue', icon: <DollarSign size={20} /> },
    { key: 'settings', label: 'Settings', icon: <Settings size={20} /> },
  ];

  const tabTitles = {
    overview: 'Platform Overview',
    schools: 'Manage Schools',
    revenue: 'Revenue Analytics',
    settings: 'Settings',
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':
        return <OverviewTab />;
      case 'schools':
        return <SchoolsTab />;
      case 'revenue':
        return <RevenueTab />;
      case 'settings':
        return <SettingsTab />;
      default:
        return <OverviewTab />;
    }
  };

  return (
    <div className="platform-container">
      {/* Mobile menu button */}
      <button className="platform-menu-btn" onClick={() => setSidebarOpen(true)}>
        <Menu size={24} />
      </button>

      {/* Sidebar */}
      <aside className={`platform-sidebar ${sidebarOpen ? 'open' : ''}`}>
        <button className="platform-sidebar-close" onClick={() => setSidebarOpen(false)}>
          <X size={24} />
        </button>

        <div className="platform-sidebar-top">
          <div className="platform-sidebar-brand">
            <div className="platform-sidebar-brand-icon">
              <Shield size={24} />
            </div>
            <div>
              <div className="platform-sidebar-brand-name">EduCare</div>
              <div className="platform-sidebar-brand-sub">Platform Admin</div>
            </div>
          </div>
        </div>

        <nav className="platform-sidebar-nav">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              className={`platform-sidebar-item ${activeTab === tab.key ? 'active' : ''}`}
              onClick={() => {
                setActiveTab(tab.key);
                setSidebarOpen(false);
              }}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>

        <div className="platform-sidebar-bottom">
          <div className="platform-sidebar-user">
            <div className="platform-sidebar-avatar">
              {userName.charAt(0).toUpperCase()}
            </div>
            <span className="platform-sidebar-user-name">{userName}</span>
          </div>
          <button className="platform-sidebar-item logout" onClick={handleLogout}>
            <LogOut size={20} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Overlay */}
      {sidebarOpen && (
        <div className="platform-overlay" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main */}
      <main className="platform-main">
        <div className="platform-content">
          <div className="platform-header">
            <h2>{tabTitles[activeTab]}</h2>
          </div>
          {renderTab()}
        </div>
      </main>
    </div>
  );
}

export default PlatformDashboard;
