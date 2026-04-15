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
  UserCheck,
  PlusCircle,
  Trash2,
  ToggleLeft,
  ToggleRight,
  ClipboardList,
  MessageSquare,
  CheckCircle2,
  Clock,
  AlertCircle,
  StickyNote,
  ChevronUp,
  HeartHandshake,
  Send,
  RefreshCw,
  MessageCircle,
  Reply,
  CalendarCheck,
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
  grace_period: { bg: '#ffedd5', color: '#9a3412' },
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
          {['active', 'trial', 'grace_period', 'expired', 'cancelled', 'past_due'].map((s) => (
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
                  <th>Expires In</th>
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
                      <td>
                        {s.days_left === null || s.days_left === undefined ? (
                          <span style={{ color: '#94a3b8', fontSize: '0.82rem' }}>—</span>
                        ) : ['expired', 'grace_period', 'cancelled'].includes(s.subscription_status) ? (
                          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '0.2rem 0.55rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600 }}>
                            Expired
                          </span>
                        ) : (
                          <span style={{
                            padding: '0.2rem 0.55rem', borderRadius: '20px',
                            fontSize: '0.75rem', fontWeight: 700,
                            background: s.days_left > 30 ? '#d1fae5' : s.days_left > 10 ? '#fef3c7' : '#fee2e2',
                            color: s.days_left > 30 ? '#065f46' : s.days_left > 10 ? '#92400e' : '#991b1b',
                          }}>
                            {s.days_left}d
                          </span>
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
   ONBOARDING MANAGEMENT TAB
   ══════════════════════════════════════════════════════════ */
const OB_STATUS_COLORS = {
  pending:     { bg: '#dbeafe', color: '#1e40af' },
  in_progress: { bg: '#fef3c7', color: '#92400e' },
  completed:   { bg: '#d1fae5', color: '#065f46' },
  skipped:     { bg: '#f1f5f9', color: '#475569' },
};

const CHECKLIST_LABELS = {
  students_imported:     'Students imported',
  teachers_added:        'Teachers added',
  classes_setup:         'Classes set up',
  subjects_setup:        'Subjects configured',
  parents_added:         'Parents linked',
  attendance_configured: 'Attendance configured',
  grading_configured:    'Grading configured',
};

/** Parse "[DD Mon YYYY HH:MM]\ntext" entries separated by \n\n */
const parseNotes = (str) => {
  if (!str || !str.trim()) return [];
  return str.split('\n\n').filter(Boolean).map((entry) => {
    const match = entry.match(/^\[([^\]]+)\]\n([\s\S]*)$/);
    if (match) return { ts: match[1], text: match[2].trim() };
    return { ts: null, text: entry.trim() };
  }).reverse(); // newest first
};

/* ══════════════════════════════════════════════════════════
   SHARED REPLY THREAD COMPONENT (platform admin)
   ══════════════════════════════════════════════════════════ */
function ReplyThread({ thread = [], replies = [], replyEndpoint, onNewReply, senderName }) {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');

  // Use unified thread if available; normalise old replies format as fallback
  const items = thread.length > 0 ? thread : replies.map(r => ({
    direction: 'outbound',
    sender_name: r.sender_name,
    message: r.message,
    created_at: r.created_at,
    email_sent: r.email_sent,
  }));

  const handleSend = async () => {
    if (!message.trim()) return;
    setSending(true);
    setError('');
    const data = await platformFetch(replyEndpoint, {
      method: 'POST',
      body: JSON.stringify({ message: message.trim(), sender_name: senderName }),
    });
    if (data) {
      setMessage('');
      onNewReply(data.reply);
    } else {
      setError('Failed to send reply. Please try again.');
    }
    setSending(false);
  };

  return (
    <div style={{ marginTop: '1rem' }}>
      <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
        <MessageCircle size={13} /> Conversation with School
      </div>

      {/* Thread */}
      {items.length === 0 ? (
        <p style={{ fontSize: '0.82rem', color: '#94a3b8', fontStyle: 'italic', margin: '0 0 0.75rem' }}>No messages yet. Send the first message below.</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '0.75rem', maxHeight: '220px', overflowY: 'auto', padding: '2px' }}>
          {[...items].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).map((item, i) => {
            const outbound = item.direction === 'outbound';
            return (
              <div key={i} style={{
                background: outbound ? '#eff6ff' : '#f0fdf4',
                border: `1px solid ${outbound ? '#bfdbfe' : '#86efac'}`,
                borderRadius: '8px', padding: '0.55rem 0.85rem',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.2rem' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: outbound ? '#1d4ed8' : '#15803d' }}>
                    {outbound ? `🛡 ${item.sender_name || 'InsightWick'}` : `🏫 ${item.sender_name}`}
                  </span>
                  <span style={{ fontSize: '0.68rem', color: '#94a3b8' }}>
                    {new Date(item.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    {outbound && item.email_sent !== undefined && (
                      <span style={{ marginLeft: '0.4rem', color: item.email_sent ? '#16a34a' : '#dc2626', fontSize: '0.65rem' }}>
                        {item.email_sent ? '✓ emailed' : '⚠ not sent'}
                      </span>
                    )}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: '0.83rem', color: '#374151', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{item.message}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Compose */}
      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-end' }}>
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Type your reply to the school…"
          rows={2}
          style={{ flex: 1, border: '1.5px solid #e2e8f0', borderRadius: '7px', padding: '0.45rem 0.7rem', fontSize: '0.83rem', fontFamily: 'inherit', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }}
          onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSend(); }}
        />
        <button
          onClick={handleSend}
          disabled={sending || !message.trim()}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '0.3rem', padding: '0.45rem 0.9rem', background: sending || !message.trim() ? '#e2e8f0' : '#2563eb', color: sending || !message.trim() ? '#94a3b8' : '#fff', border: 'none', borderRadius: '7px', fontWeight: 600, fontSize: '0.82rem', cursor: sending || !message.trim() ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', height: 'fit-content' }}
        >
          <Reply size={14} />
          {sending ? 'Sending…' : 'Send'}
        </button>
      </div>
      {error && <p style={{ color: '#dc2626', fontSize: '0.78rem', margin: '0.35rem 0 0' }}>{error}</p>}
    </div>
  );
}

function OnboardingMgmtTab() {
  const [agents, setAgents] = useState([]);
  const [queue, setQueue] = useState([]);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [queueFilter, setQueueFilter] = useState('');
  const [expandedRow, setExpandedRow] = useState(null);
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '', phone: '' });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');
  const [createSuccess, setCreateSuccess] = useState('');
  const [assigning, setAssigning] = useState({});      // { [recordId]: true }
  const [reassignOpen, setReassignOpen] = useState({}); // { [recordId]: { agentId, note } }
  const [localReplies, setLocalReplies] = useState({});  // { [recordId]: [reply, ...] }
  const adminName = localStorage.getItem('platformUserName') || 'InsightWick Admin';

  const loadAgents = useCallback(async () => {
    setLoadingAgents(true);
    const data = await platformFetch('onboarding-agents/');
    if (data) setAgents(data.agents || []);
    setLoadingAgents(false);
  }, []);

  const loadQueue = useCallback(async () => {
    setLoadingQueue(true);
    const url = queueFilter ? `onboarding-queue/?status=${queueFilter}` : 'onboarding-queue/';
    const data = await platformFetch(url);
    if (data) setQueue(data.records || []);
    setLoadingQueue(false);
  }, [queueFilter]);

  useEffect(() => { loadAgents(); }, [loadAgents]);
  useEffect(() => { loadQueue(); }, [loadQueue]);

  const handleCreate = async (e) => {
    e.preventDefault();
    setCreating(true);
    setCreateError('');
    setCreateSuccess('');
    const data = await platformFetch('onboarding-agents/create/', {
      method: 'POST',
      body: JSON.stringify(form),
    });
    if (data?.message) {
      setCreateSuccess(data.message);
      setForm({ email: '', password: '', first_name: '', last_name: '', phone: '' });
      setShowCreateForm(false);
      loadAgents();
    } else if (data?.error) {
      setCreateError(data.error);
    }
    setCreating(false);
  };

  const handleToggleActive = async (agent) => {
    await platformFetch(`onboarding-agents/${agent.id}/`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: !agent.is_active }),
    });
    loadAgents();
  };

  const handleDelete = async (agent) => {
    if (!window.confirm(`Delete agent ${agent.full_name}? This cannot be undone.`)) return;
    await platformFetch(`onboarding-agents/${agent.id}/`, { method: 'DELETE' });
    loadAgents();
  };

  const handleAssign = async (recordId, agentId, note = '') => {
    setAssigning((prev) => ({ ...prev, [recordId]: true }));
    await platformFetch(`onboarding-queue/${recordId}/assign/`, {
      method: 'POST',
      body: JSON.stringify({ agent_id: agentId || null, note }),
    });
    setAssigning((prev) => ({ ...prev, [recordId]: false }));
    setReassignOpen((prev) => { const n = { ...prev }; delete n[recordId]; return n; });
    loadQueue();
    loadAgents();
  };

  const openReassign = (r) => setReassignOpen((prev) => ({
    ...prev,
    [r.id]: { agentId: r.agent ? (agents.find((a) => a.full_name === r.agent)?.id || '') : '', note: '' },
  }));
  const closeReassign = (id) => setReassignOpen((prev) => { const n = { ...prev }; delete n[id]; return n; });
  const updateReassign = (id, field, value) => setReassignOpen((prev) => ({
    ...prev, [id]: { ...prev[id], [field]: value },
  }));

  const activeAgents = agents.filter((a) => a.is_active);

  const inputStyle = { width: '100%', border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.5rem 0.75rem', fontSize: '0.875rem', boxSizing: 'border-box' };
  const labelStyle = { display: 'block', fontSize: '0.8rem', fontWeight: 600, color: '#374151', marginBottom: '0.3rem' };

  return (
    <div className="platform-tab-content">

      {/* ── Onboarding Queue (top — this is the primary action area) ── */}
      <div className="platform-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Assign Schools to Onboarding Staff</h3>
          <select
            value={queueFilter}
            onChange={(e) => setQueueFilter(e.target.value)}
            style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.75rem', fontSize: '0.85rem', background: '#fff', cursor: 'pointer' }}
          >
            <option value="">All Schools</option>
            <option value="pending">Unassigned</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
          </select>
        </div>

        {loadingQueue ? (
          <p className="platform-empty">Loading queue…</p>
        ) : queue.length === 0 ? (
          <p className="platform-empty">No schools match this filter.</p>
        ) : (
          <div className="platform-table-wrapper">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>School</th>
                  <th>Plan</th>
                  <th>Registered</th>
                  <th>Status</th>
                  <th>Progress</th>
                  <th style={{ minWidth: '200px' }}>Assign To</th>
                </tr>
              </thead>
              <tbody>
                {queue.map((r) => {
                  const sc = OB_STATUS_COLORS[r.onboarding_status] || OB_STATUS_COLORS.pending;
                  const isExpanded = expandedRow === r.id;
                  const hasDetail = r.onboarding_status === 'completed' || r.onboarding_status === 'in_progress' || r.preferred_slots?.length > 0;
                  return (
                    <React.Fragment key={r.id}>
                      <tr
                        style={{ cursor: hasDetail ? 'pointer' : 'default', background: isExpanded ? '#f8fafc' : r.needs_assignment ? '#fefce8' : undefined }}
                        onClick={() => hasDetail && setExpandedRow(isExpanded ? null : r.id)}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span className="platform-td-bold">{r.school_name}</span>
                            {r.unread_school_messages > 0 && (
                              <span style={{ background: '#dc2626', color: '#fff', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 6px', lineHeight: 1.4 }}>
                                {r.unread_school_messages} new
                              </span>
                            )}
                            {r.needs_assignment && (
                              <span style={{ display: 'flex', alignItems: 'center', gap: '3px', background: '#fef08a', color: '#854d0e', borderRadius: '999px', fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', lineHeight: 1.4 }}>
                                <CalendarCheck size={10} /> Availability submitted
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{r.school_email}</div>
                        </td>
                        <td>{r.plan_name}</td>
                        <td>{formatDate(r.registered_at)}</td>
                        <td>
                          <span style={{
                            background: sc.bg, color: sc.color,
                            padding: '0.2rem 0.55rem', borderRadius: '20px',
                            fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize',
                          }}>
                            {r.onboarding_status?.replace('_', ' ')}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: r.progress.completed === r.progress.total ? '#059669' : '#374151' }}>
                            {r.progress.completed}/{r.progress.total}
                          </span>
                          {hasDetail && (
                            <span style={{ marginLeft: '0.4rem', fontSize: '0.7rem', color: '#94a3b8' }}>
                              {isExpanded ? '▲' : '▼'}
                            </span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          {reassignOpen[r.id] ? (
                            /* ── Inline reassign form ── */
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', minWidth: '220px' }}>
                              <select
                                value={reassignOpen[r.id].agentId}
                                onChange={(e) => updateReassign(r.id, 'agentId', e.target.value)}
                                style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.82rem', background: '#fff', cursor: 'pointer' }}
                              >
                                <option value="">— Unassign —</option>
                                {activeAgents.map((a) => (
                                  <option key={a.id} value={a.id}>{a.full_name}</option>
                                ))}
                              </select>
                              <textarea
                                placeholder="Reason for reassignment (optional)…"
                                value={reassignOpen[r.id].note}
                                onChange={(e) => updateReassign(r.id, 'note', e.target.value)}
                                rows={2}
                                style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.35rem 0.6rem', fontSize: '0.78rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' }}
                              />
                              <div style={{ display: 'flex', gap: '0.4rem' }}>
                                <button
                                  onClick={() => handleAssign(r.id, reassignOpen[r.id].agentId, reassignOpen[r.id].note)}
                                  disabled={assigning[r.id]}
                                  className="platform-action-btn"
                                  style={{ background: '#2563eb', color: '#fff', fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                                >
                                  {assigning[r.id] ? 'Saving…' : 'Confirm'}
                                </button>
                                <button
                                  onClick={() => closeReassign(r.id)}
                                  className="platform-action-btn"
                                  style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                                >
                                  Cancel
                                </button>
                              </div>
                            </div>
                          ) : r.onboarding_status === 'completed' ? (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              <span style={{ fontSize: '0.8rem', color: '#059669', fontWeight: 600 }}>
                                ✓ Done{r.agent ? ` by ${r.agent}` : ''}
                              </span>
                              <button
                                onClick={() => openReassign(r)}
                                className="platform-action-btn"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem' }}
                              >
                                Reassign
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                              {r.agent && (
                                <span style={{ fontSize: '0.78rem', color: '#374151', fontWeight: 600 }}>{r.agent}</span>
                              )}
                              <button
                                onClick={() => openReassign(r)}
                                className="platform-action-btn"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', alignSelf: 'flex-start' }}
                              >
                                {r.agent ? 'Reassign' : 'Assign'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>

                      {/* ── Expanded detail row ── */}
                      {isExpanded && (
                        <tr style={{ background: '#f8fafc' }}>
                          <td colSpan={6} style={{ padding: '0.75rem 1.25rem 1rem', borderTop: '1px solid #e2e8f0' }}>
                            <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                              {/* Preferred availability slots */}
                              {r.preferred_slots?.length > 0 && (
                                <div style={{ width: '100%', marginBottom: '0.5rem' }}>
                                  <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <CalendarCheck size={13} style={{ color: '#16a34a' }} /> School's Available Times
                                  </div>
                                  <div style={{ display: 'flex', gap: '0.6rem', flexWrap: 'wrap' }}>
                                    {r.preferred_slots.map((slot, si) => (
                                      <div key={si} style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '8px', padding: '8px 12px', fontSize: '0.82rem' }}>
                                        <div style={{ fontWeight: 600, color: '#166534' }}>
                                          {new Date(slot.date + 'T00:00:00').toLocaleDateString('en-NG', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}
                                        </div>
                                        <div style={{ color: '#374151', marginTop: '2px' }}>{slot.time}</div>
                                        {slot.note && <div style={{ color: '#6b7280', fontSize: '0.75rem', marginTop: '2px', fontStyle: 'italic' }}>{slot.note}</div>}
                                      </div>
                                    ))}
                                  </div>
                                  {r.scheduling_submitted_at && (
                                    <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '0.4rem' }}>
                                      Submitted {formatDate(r.scheduling_submitted_at)}
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Checklist */}
                              <div style={{ flex: '1', minWidth: '220px' }}>
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Setup Checklist
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                                  {Object.entries(CHECKLIST_LABELS).map(([key, label]) => {
                                    const done = r.checklist?.[key];
                                    return (
                                      <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.83rem' }}>
                                        <span style={{
                                          width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0,
                                          background: done ? '#d1fae5' : '#f1f5f9',
                                          border: `1.5px solid ${done ? '#6ee7b7' : '#e2e8f0'}`,
                                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                                          fontSize: '0.65rem', color: done ? '#059669' : '#94a3b8',
                                        }}>
                                          {done ? '✓' : ''}
                                        </span>
                                        <span style={{ color: done ? '#374151' : '#94a3b8', textDecoration: done ? 'none' : 'none' }}>
                                          {label}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Notes + Meta */}
                              <div style={{ flex: '2', minWidth: '240px' }}>
                                {/* Staff notes history */}
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', marginBottom: '0.5rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Staff Notes
                                </div>
                                {parseNotes(r.notes).length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {parseNotes(r.notes).map((entry, i) => (
                                      <div key={i} style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '0.55rem 0.85rem' }}>
                                        {entry.ts && <div style={{ fontSize: '0.72rem', color: '#94a3b8', fontWeight: 600, marginBottom: '0.2rem' }}>{entry.ts}</div>}
                                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.83rem', color: '#94a3b8', fontStyle: 'italic' }}>No notes from staff yet.</div>
                                )}

                                {/* Admin notes history */}
                                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', margin: '0.75rem 0 0.4rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                  Admin Notes
                                </div>
                                {parseNotes(r.admin_notes).length > 0 ? (
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {parseNotes(r.admin_notes).map((entry, i) => (
                                      <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.55rem 0.85rem' }}>
                                        {entry.ts && <div style={{ fontSize: '0.72rem', color: '#b45309', fontWeight: 600, marginBottom: '0.2rem' }}>{entry.ts}</div>}
                                        <div style={{ fontSize: '0.85rem', color: '#374151', lineHeight: '1.6', whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                                      </div>
                                    ))}
                                  </div>
                                ) : (
                                  <div style={{ fontSize: '0.83rem', color: '#94a3b8', fontStyle: 'italic' }}>No admin notes yet.</div>
                                )}

                                <div style={{ marginTop: '0.75rem', display: 'flex', gap: '1.5rem', flexWrap: 'wrap' }}>
                                  {r.agent && (
                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                      <span style={{ fontWeight: 600 }}>Staff:</span> {r.agent}
                                      {r.agent_email && <span style={{ color: '#94a3b8' }}> ({r.agent_email})</span>}
                                    </div>
                                  )}
                                  {r.assigned_at && (
                                    <div style={{ fontSize: '0.78rem', color: '#64748b' }}>
                                      <span style={{ fontWeight: 600 }}>Assigned:</span> {formatDate(r.assigned_at)}
                                    </div>
                                  )}
                                  {r.completed_at && (
                                    <div style={{ fontSize: '0.78rem', color: '#059669' }}>
                                      <span style={{ fontWeight: 600 }}>Completed:</span> {formatDate(r.completed_at)}
                                    </div>
                                  )}
                                </div>

                                {/* Reply thread */}
                                <div style={{ marginTop: '1rem', borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                                  <ReplyThread
                                    thread={localReplies[r.id] ?? (r.thread || [])}
                                    replyEndpoint={`onboarding-queue/${r.id}/reply/`}
                                    senderName={adminName}
                                    onNewReply={rep => setLocalReplies(prev => ({ ...prev, [r.id]: [...(prev[r.id] ?? (r.thread || [])), rep] }))}
                                  />
                                </div>
                              </div>

                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Agents section ── */}
      <div className="platform-section-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h3 style={{ margin: 0 }}>Onboarding Staff Accounts</h3>
          <button
            className="platform-action-btn"
            onClick={() => { setShowCreateForm((v) => !v); setCreateError(''); setCreateSuccess(''); }}
          >
            <PlusCircle size={16} />
            {showCreateForm ? 'Cancel' : 'Add Staff'}
          </button>
        </div>

        {createSuccess && (
          <div style={{ background: '#d1fae5', color: '#065f46', padding: '0.6rem 1rem', borderRadius: '8px', marginBottom: '1rem', fontSize: '0.875rem' }}>
            {createSuccess}
          </div>
        )}

        {showCreateForm && (
          <form onSubmit={handleCreate} style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '1.25rem', marginBottom: '1.25rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.75rem' }}>
              {[
                { name: 'first_name', label: 'First Name', type: 'text',     required: true },
                { name: 'last_name',  label: 'Last Name',  type: 'text',     required: true },
                { name: 'email',      label: 'Email',      type: 'email',    required: true },
                { name: 'password',   label: 'Password',   type: 'password', required: true },
                { name: 'phone',      label: 'Phone',      type: 'tel',      required: false },
              ].map((f) => (
                <div key={f.name}>
                  <label style={labelStyle}>{f.label}</label>
                  <input
                    type={f.type}
                    required={f.required}
                    value={form[f.name]}
                    onChange={(e) => setForm((prev) => ({ ...prev, [f.name]: e.target.value }))}
                    style={inputStyle}
                  />
                </div>
              ))}
            </div>
            {createError && (
              <div style={{ background: '#fee2e2', color: '#991b1b', padding: '0.5rem 0.75rem', borderRadius: '6px', marginTop: '0.75rem', fontSize: '0.82rem' }}>
                {createError}
              </div>
            )}
            <button type="submit" disabled={creating} className="platform-action-btn" style={{ marginTop: '1rem' }}>
              {creating ? 'Creating…' : 'Create Staff Account'}
            </button>
          </form>
        )}

        {loadingAgents ? (
          <p className="platform-empty">Loading staff…</p>
        ) : agents.length === 0 ? (
          <p className="platform-empty">No onboarding staff yet. Add one above.</p>
        ) : (
          <div className="platform-table-wrapper">
            <table className="platform-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Active Tasks</th>
                  <th>Completed</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.id}>
                    <td className="platform-td-bold">{a.full_name}</td>
                    <td style={{ fontSize: '0.85rem' }}>{a.email}</td>
                    <td>{a.active_schools}</td>
                    <td>{a.completed_schools}</td>
                    <td>
                      <span style={{
                        background: a.is_active ? '#d1fae5' : '#fee2e2',
                        color: a.is_active ? '#065f46' : '#991b1b',
                        padding: '0.2rem 0.6rem', borderRadius: '20px',
                        fontSize: '0.75rem', fontWeight: 600,
                      }}>
                        {a.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          title={a.is_active ? 'Deactivate' : 'Activate'}
                          onClick={() => handleToggleActive(a)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: a.is_active ? '#059669' : '#94a3b8', display: 'flex', padding: '2px' }}
                        >
                          {a.is_active ? <ToggleRight size={20} /> : <ToggleLeft size={20} />}
                        </button>
                        <button
                          title="Delete"
                          onClick={() => handleDelete(a)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', display: 'flex', padding: '2px' }}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
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
   CONTACTS TAB
   ══════════════════════════════════════════════════════════ */
const CONTACT_STATUS_COLORS = {
  new:         { bg: '#dbeafe', color: '#1e40af' },
  assigned:    { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#ede9fe', color: '#5b21b6' },
  resolved:    { bg: '#d1fae5', color: '#065f46' },
};

function ContactsTab() {
  const [inquiries, setInquiries]   = useState([]);
  const [agents, setAgents]         = useState([]);
  const [counts, setCounts]         = useState({});
  const [loading, setLoading]       = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]         = useState('');
  const [expanded, setExpanded]     = useState(null);
  const [assignOpen, setAssignOpen] = useState({});  // { [id]: { agentId, note } }
  const [saving, setSaving]         = useState({});
  const [localReplies, setLocalReplies] = useState({});  // { [inquiryId]: [reply, ...] }
  const adminName = localStorage.getItem('platformUserName') || 'InsightWick Admin';

  const load = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.append('status', statusFilter);
    if (search) params.append('search', search);
    const qs = params.toString();
    const [cData, aData] = await Promise.all([
      platformFetch(`contacts/${qs ? '?' + qs : ''}`),
      platformFetch('onboarding-agents/'),
    ]);
    if (cData) { setInquiries(cData.inquiries || []); setCounts(cData.counts || {}); }
    if (aData) setAgents((aData.agents || []).filter(a => a.is_active));
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { load(); }, [load]);

  const patch = async (id, body) => {
    setSaving(p => ({ ...p, [id]: true }));
    await platformFetch(`contacts/${id}/`, { method: 'PATCH', body: JSON.stringify(body) });
    setSaving(p => ({ ...p, [id]: false }));
    setAssignOpen(p => { const n = { ...p }; delete n[id]; return n; });
    load();
  };

  const openAssign = (inq) => setAssignOpen(p => ({
    ...p, [inq.id]: { agentId: inq.assigned_agent_id || '', note: '' },
  }));
  const closeAssign = (id) => setAssignOpen(p => { const n = { ...p }; delete n[id]; return n; });
  const updateAssign = (id, field, val) => setAssignOpen(p => ({
    ...p, [id]: { ...p[id], [field]: val },
  }));

  const STATUS_TABS = [
    { key: '',            label: 'All',         icon: <ClipboardList size={14} /> },
    { key: 'new',         label: 'New',         icon: <AlertCircle size={14} /> },
    { key: 'assigned',    label: 'Assigned',    icon: <UserCheck size={14} /> },
    { key: 'in_progress', label: 'In Progress', icon: <Clock size={14} /> },
    { key: 'resolved',    label: 'Resolved',    icon: <CheckCircle2 size={14} /> },
  ];

  return (
    <div className="platform-tab-content">
      {/* Status tabs + search */}
      <div className="platform-section-card" style={{ padding: '0.75rem 1.25rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
            {STATUS_TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setStatusFilter(t.key)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: '0.3rem',
                  padding: '0.35rem 0.85rem', borderRadius: '20px', fontSize: '0.82rem',
                  fontWeight: 600, cursor: 'pointer', border: '1.5px solid',
                  background: statusFilter === t.key ? '#2563eb' : '#fff',
                  color: statusFilter === t.key ? '#fff' : '#64748b',
                  borderColor: statusFilter === t.key ? '#2563eb' : '#e2e8f0',
                }}
              >
                {t.icon} {t.label}
                {t.key && counts[t.key] > 0 && (
                  <span style={{
                    background: statusFilter === t.key ? 'rgba(255,255,255,0.25)' : '#f1f5f9',
                    color: statusFilter === t.key ? '#fff' : '#374151',
                    borderRadius: '10px', padding: '0 0.4rem', fontSize: '0.72rem',
                  }}>{counts[t.key]}</span>
                )}
              </button>
            ))}
          </div>
          <div className="platform-search-wrapper" style={{ maxWidth: '260px' }}>
            <Search size={16} />
            <input
              placeholder="Search school, name, email…"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && <button className="platform-search-clear" onClick={() => setSearch('')}><X size={14} /></button>}
          </div>
        </div>
      </div>

      {/* Inquiries list */}
      {loading ? (
        <div className="platform-loading">Loading contacts…</div>
      ) : inquiries.length === 0 ? (
        <div className="platform-section-card">
          <p className="platform-empty">No contacts match this filter.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {inquiries.map(inq => {
            const sc = CONTACT_STATUS_COLORS[inq.status] || CONTACT_STATUS_COLORS.new;
            const isExpanded = expanded === inq.id;
            const assignState = assignOpen[inq.id];
            return (
              <div key={inq.id} className="platform-section-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card header */}
                <div
                  style={{ padding: '0.85rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: isExpanded ? '#f8fafc' : '#fff' }}
                  onClick={() => setExpanded(isExpanded ? null : inq.id)}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{inq.school_name}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {inq.contact_name} &nbsp;·&nbsp; {inq.email}
                      {inq.phone && <> &nbsp;·&nbsp; {inq.phone}</>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexShrink: 0 }}>
                    <span style={{ ...sc, padding: '0.2rem 0.6rem', borderRadius: '20px', fontSize: '0.75rem', fontWeight: 600, textTransform: 'capitalize' }}>
                      {inq.status.replace('_', ' ')}
                    </span>
                    <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{formatDate(inq.created_at)}</span>
                    {isExpanded ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExpanded && (
                  <div style={{ borderTop: '1px solid #f1f5f9', padding: '1rem 1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap' }}>

                      {/* Inquiry details */}
                      <div style={{ flex: '2', minWidth: '240px' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.5rem' }}>Inquiry</div>
                        <p style={{ fontSize: '0.88rem', color: '#374151', lineHeight: '1.65', margin: '0 0 0.75rem', whiteSpace: 'pre-wrap' }}>{inq.message}</p>
                        <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', fontSize: '0.8rem', color: '#64748b' }}>
                          {inq.expected_students && <span><strong>Students:</strong> {inq.expected_students}</span>}
                          {inq.expected_staff && <span><strong>Staff:</strong> {inq.expected_staff}</span>}
                        </div>
                      </div>

                      {/* Assignment + admin notes */}
                      <div style={{ flex: '1', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                        <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Assignment</div>

                        {assignState ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                            <select
                              value={assignState.agentId}
                              onChange={e => updateAssign(inq.id, 'agentId', e.target.value)}
                              style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', background: '#fff' }}
                            >
                              <option value="">— Unassign —</option>
                              {agents.map(a => <option key={a.id} value={a.id}>{a.full_name}</option>)}
                            </select>
                            <select
                              value={assignState.status || inq.status}
                              onChange={e => updateAssign(inq.id, 'status', e.target.value)}
                              style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.82rem', background: '#fff' }}
                            >
                              <option value="new">New</option>
                              <option value="assigned">Assigned</option>
                              <option value="in_progress">In Progress</option>
                              <option value="resolved">Resolved</option>
                            </select>
                            <textarea
                              placeholder="Add a note (optional)…"
                              value={assignState.note}
                              onChange={e => updateAssign(inq.id, 'note', e.target.value)}
                              rows={2}
                              style={{ border: '1.5px solid #e2e8f0', borderRadius: '6px', padding: '0.4rem 0.6rem', fontSize: '0.78rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box', width: '100%' }}
                            />
                            <div style={{ display: 'flex', gap: '0.4rem' }}>
                              <button
                                disabled={saving[inq.id]}
                                onClick={() => patch(inq.id, { agent_id: assignState.agentId || '', status: assignState.status || undefined, note: assignState.note })}
                                className="platform-action-btn"
                                style={{ background: '#2563eb', color: '#fff', fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}
                              >
                                {saving[inq.id] ? 'Saving…' : 'Save'}
                              </button>
                              <button onClick={() => closeAssign(inq.id)} className="platform-action-btn" style={{ fontSize: '0.78rem', padding: '0.3rem 0.7rem' }}>
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                            {inq.assigned_agent ? (
                              <span style={{ fontSize: '0.83rem', color: '#374151' }}>
                                <strong>{inq.assigned_agent}</strong>
                                {inq.assigned_agent_email && <span style={{ color: '#94a3b8' }}> ({inq.assigned_agent_email})</span>}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.83rem', color: '#94a3b8', fontStyle: 'italic' }}>Unassigned</span>
                            )}
                            <button onClick={() => openAssign(inq)} className="platform-action-btn" style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', alignSelf: 'flex-start' }}>
                              {inq.assigned_agent ? 'Reassign' : 'Assign'}
                            </button>
                            {inq.status !== 'resolved' && (
                              <button
                                onClick={() => patch(inq.id, { status: 'resolved' })}
                                disabled={saving[inq.id]}
                                className="platform-action-btn"
                                style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', alignSelf: 'flex-start', background: '#059669', color: '#fff' }}
                              >
                                Mark Resolved
                              </button>
                            )}
                          </div>
                        )}

                        {/* Admin notes history */}
                        {parseNotes(inq.admin_notes).length > 0 && (
                          <div>
                            <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '0.4rem' }}>Notes</div>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                              {parseNotes(inq.admin_notes).map((entry, i) => (
                                <div key={i} style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '0.5rem 0.75rem' }}>
                                  {entry.ts && <div style={{ fontSize: '0.7rem', color: '#b45309', fontWeight: 600, marginBottom: '0.15rem' }}>{entry.ts}</div>}
                                  <div style={{ fontSize: '0.82rem', color: '#374151', whiteSpace: 'pre-wrap' }}>{entry.text}</div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Reply thread */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <ReplyThread
                        replies={localReplies[inq.id] ?? (inq.replies || [])}
                        replyEndpoint={`contacts/${inq.id}/reply/`}
                        senderName={adminName}
                        onNewReply={r => setLocalReplies(prev => ({ ...prev, [inq.id]: [...(prev[inq.id] ?? (inq.replies || [])), r] }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   SUPPORT TICKETS TAB
   ══════════════════════════════════════════════════════════ */
const SUPPORT_STATUS_COLORS = {
  open:        { bg: '#dbeafe', color: '#1e40af' },
  assigned:    { bg: '#fef3c7', color: '#92400e' },
  in_progress: { bg: '#ede9fe', color: '#5b21b6' },
  resolved:    { bg: '#d1fae5', color: '#065f46' },
};

function SupportTab() {
  const [tickets, setTickets]   = useState([]);
  const [agents, setAgents]     = useState([]);
  const [counts, setCounts]     = useState({});
  const [loading, setLoading]   = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch]     = useState('');
  const [expanded, setExpanded] = useState(null);
  const [assignState, setAssignState] = useState({});   // { [id]: { agentId, note } }
  const [autoAssigning, setAutoAssigning] = useState(false);
  const [reopeningId, setReopeningId] = useState(null);
  const [localReplies, setLocalReplies] = useState({});  // { [ticketId]: [reply, ...] }
  const adminName = localStorage.getItem('platformUserName') || 'InsightWick Admin';

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (statusFilter) params.set('status', statusFilter);
    if (search) params.set('search', search);
    const data = await platformFetch(`support/?${params}`);
    if (data) {
      setTickets(data.tickets || []);
      setCounts(data.counts || {});
    }
    setLoading(false);
  }, [statusFilter, search]);

  useEffect(() => { fetchTickets(); }, [fetchTickets]);

  useEffect(() => {
    platformFetch('onboarding-agents/').then(d => d && setAgents(d.agents || []));
  }, []);

  const handleAssign = async (ticketId) => {
    const st = assignState[ticketId] || {};
    const body = {};
    if (st.agentId !== undefined) body.agent_id = st.agentId;
    if (st.note) body.note = st.note;
    const data = await platformFetch(`support/${ticketId}/`, { method: 'PATCH', body: JSON.stringify(body) });
    if (data) {
      setAssignState(s => { const n = {...s}; delete n[ticketId]; return n; });
      fetchTickets();
    }
  };

  const handleAutoAssign = async () => {
    setAutoAssigning(true);
    const data = await platformFetch('support/auto-assign/', { method: 'POST', body: '{}' });
    if (data) { alert(data.message); fetchTickets(); }
    setAutoAssigning(false);
  };

  const handleReopen = async (ticket) => {
    setReopeningId(ticket.id);
    const newStatus = ticket.assigned_agent ? 'assigned' : 'open';
    const data = await platformFetch(`support/${ticket.id}/`, { method: 'PATCH', body: JSON.stringify({ status: newStatus }) });
    if (data) fetchTickets();
    setReopeningId(null);
  };

  const openCount = counts.open || 0;

  return (
    <div className="platform-tab-content">
      {/* Header row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem' }}>
        <div>
          <h2 className="platform-section-title" style={{ margin: 0 }}>Support Tickets</h2>
          <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>Support requests submitted by school admins</p>
        </div>
        <button
          onClick={handleAutoAssign}
          disabled={autoAssigning || openCount === 0}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: autoAssigning || openCount === 0 ? '#e2e8f0' : '#2563eb', color: autoAssigning || openCount === 0 ? '#94a3b8' : '#fff', border: 'none', borderRadius: 8, padding: '9px 18px', fontWeight: 600, fontSize: '0.88rem', cursor: autoAssigning || openCount === 0 ? 'not-allowed' : 'pointer' }}
        >
          <Send size={15} />
          {autoAssigning ? 'Assigning…' : `Auto-Assign All Open (${openCount})`}
        </button>
      </div>

      {/* Status filter chips */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem' }}>
        {[['', 'All'], ['open', 'Open'], ['assigned', 'Assigned'], ['in_progress', 'In Progress'], ['resolved', 'Resolved']].map(([val, lbl]) => (
          <button key={val} onClick={() => setStatusFilter(val)}
            style={{ padding: '5px 14px', borderRadius: 20, border: '1px solid', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer',
              background: statusFilter === val ? '#2563eb' : '#f8fafc',
              color: statusFilter === val ? '#fff' : '#475569',
              borderColor: statusFilter === val ? '#2563eb' : '#e2e8f0' }}>
            {lbl}{val && counts[val] !== undefined ? ` (${counts[val]})` : ''}
          </button>
        ))}
      </div>

      {/* Search */}
      <div style={{ position: 'relative', marginBottom: '1.25rem', maxWidth: 400 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by school, subject or email…"
          style={{ width: '100%', padding: '9px 36px 9px 14px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: '0.88rem', outline: 'none', boxSizing: 'border-box' }} />
        {search && <button onClick={() => setSearch('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8' }}><X size={14} /></button>}
      </div>

      {loading ? <div className="platform-loading">Loading tickets…</div>
      : tickets.length === 0 ? (
        <div className="platform-section-card"><p className="platform-empty">No tickets match this filter.</p></div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          {tickets.map(t => {
            const sc = SUPPORT_STATUS_COLORS[t.status] || SUPPORT_STATUS_COLORS.open;
            const isExp = expanded === t.id;
            const as = assignState[t.id];
            return (
              <div key={t.id} className="platform-section-card" style={{ padding: 0, overflow: 'hidden' }}>
                {/* Card header */}
                <div onClick={() => setExpanded(isExp ? null : t.id)}
                  style={{ padding: '0.85rem 1.25rem', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '1rem', flexWrap: 'wrap', background: isExp ? '#f8fafc' : '#fff' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{t.subject}</div>
                    <div style={{ fontSize: '0.8rem', color: '#64748b', marginTop: '0.15rem' }}>
                      {t.school_name} &nbsp;·&nbsp; {t.submitted_by_name} &nbsp;·&nbsp; {t.submitted_by_email}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: 2 }}>
                      {new Date(t.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {t.assigned_agent && <> &nbsp;·&nbsp; Agent: <strong>{t.assigned_agent.name}</strong></>}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <span style={{ background: sc.bg, color: sc.color, fontSize: '0.72rem', fontWeight: 700, padding: '3px 10px', borderRadius: 20 }}>
                      {t.status.replace('_', ' ')}
                    </span>
                    {t.status === 'resolved' && (
                      <button
                        onClick={e => { e.stopPropagation(); handleReopen(t); }}
                        disabled={reopeningId === t.id}
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: '#fff', border: '1px solid #d1d5db', borderRadius: 6, padding: '4px 10px', fontSize: '0.75rem', fontWeight: 600, color: '#374151', cursor: reopeningId === t.id ? 'not-allowed' : 'pointer', opacity: reopeningId === t.id ? 0.6 : 1 }}
                      >
                        <RefreshCw size={12} />
                        {reopeningId === t.id ? 'Reopening…' : 'Reopen'}
                      </button>
                    )}
                    {isExp ? <ChevronUp size={16} color="#94a3b8" /> : <ChevronDown size={16} color="#94a3b8" />}
                  </div>
                </div>

                {/* Expanded detail */}
                {isExp && (
                  <div style={{ padding: '1rem 1.25rem', borderTop: '1px solid #f1f5f9', background: '#fafafa' }}>
                    <p style={{ margin: '0 0 1rem', fontSize: '0.88rem', color: '#334155', lineHeight: 1.7, whiteSpace: 'pre-wrap' }}>{t.message}</p>

                    {/* Onboarding staff notes */}
                    {parseNotes(t.agent_notes).length > 0 && (
                      <div style={{ background: '#f0fdf4', border: '1px solid #86efac', borderRadius: 8, padding: '10px 14px', marginBottom: '0.75rem' }}>
                        <strong style={{ display: 'block', fontSize: '0.78rem', color: '#15803d', marginBottom: 6 }}>Notes from Onboarding Staff</strong>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {parseNotes(t.agent_notes).map((entry, i) => (
                            <div key={i} style={{ fontSize: '0.82rem', color: '#166534' }}>
                              {entry.ts && <span style={{ fontSize: '0.72rem', color: '#15803d', display: 'block', marginBottom: 1 }}>{entry.ts}</span>}
                              <p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{entry.text}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Assign agent */}
                    <div style={{ display: 'flex', alignItems: 'flex-end', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
                      <div style={{ flex: 1, minWidth: 180 }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Assign to agent</label>
                        <select value={as?.agentId ?? (t.assigned_agent?.id || '')}
                          onChange={e => setAssignState(s => ({ ...s, [t.id]: { ...s[t.id], agentId: e.target.value } }))}
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.85rem' }}>
                          <option value="">— Unassigned —</option>
                          {agents.map(a => <option key={a.id} value={a.id}>{a.first_name} {a.last_name}</option>)}
                        </select>
                      </div>
                      <div style={{ flex: 2, minWidth: 200 }}>
                        <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: 4 }}>Note (optional)</label>
                        <input value={as?.note || ''} placeholder="Leave a note for the agent…"
                          onChange={e => setAssignState(s => ({ ...s, [t.id]: { ...s[t.id], note: e.target.value } }))}
                          style={{ width: '100%', padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.85rem', boxSizing: 'border-box' }} />
                      </div>
                      <button onClick={() => handleAssign(t.id)}
                        style={{ padding: '8px 18px', background: '#2563eb', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                        Save
                      </button>
                    </div>

                    {/* Admin notes history */}
                    {t.admin_notes && (
                      <div style={{ background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 14px', fontSize: '0.82rem', color: '#78350f', whiteSpace: 'pre-wrap', marginBottom: '0.75rem' }}>
                        <strong style={{ display: 'block', marginBottom: 4 }}>Admin Notes</strong>
                        {t.admin_notes}
                      </div>
                    )}

                    {/* Reply thread */}
                    <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '0.75rem' }}>
                      <ReplyThread
                        replies={localReplies[t.id] ?? (t.replies || [])}
                        replyEndpoint={`support/${t.id}/reply/`}
                        senderName={adminName}
                        onNewReply={r => setLocalReplies(prev => ({ ...prev, [t.id]: [...(prev[t.id] ?? (t.replies || [])), r] }))}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
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
            <span className="platform-detail-value">InsightWick School Management</span>
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
    { key: 'overview',   label: 'Overview',   icon: <LayoutDashboard size={20} /> },
    { key: 'schools',    label: 'Schools',    icon: <School size={20} /> },
    { key: 'revenue',    label: 'Revenue',    icon: <DollarSign size={20} /> },
    { key: 'onboarding', label: 'Onboarding', icon: <UserCheck size={20} /> },
    { key: 'contacts',   label: 'Contacts',   icon: <MessageSquare size={20} /> },
    { key: 'support',    label: 'Support',    icon: <HeartHandshake size={20} /> },
    { key: 'settings',   label: 'Settings',   icon: <Settings size={20} /> },
  ];

  const tabTitles = {
    overview:   'Platform Overview',
    schools:    'Manage Schools',
    revenue:    'Revenue Analytics',
    onboarding: 'Onboarding Management',
    contacts:   'Contact Inquiries',
    support:    'Support Tickets',
    settings:   'Settings',
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'overview':   return <OverviewTab />;
      case 'schools':    return <SchoolsTab />;
      case 'revenue':    return <RevenueTab />;
      case 'onboarding': return <OnboardingMgmtTab />;
      case 'contacts':   return <ContactsTab />;
      case 'support':    return <SupportTab />;
      case 'settings':   return <SettingsTab />;
      default:           return <OverviewTab />;
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
              <div className="platform-sidebar-brand-name">InsightWick</div>
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
