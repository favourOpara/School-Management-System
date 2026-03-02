import React, { useState, useEffect, useRef, Suspense } from 'react';
import {
  LayoutDashboard, TrendingUp, DollarSign, Users,
  GraduationCap, Building2, LogOut, ChevronDown,
  Loader2, AlertCircle, Menu, X, BarChart3, CalendarCheck, UserX,
  ShieldAlert, FileWarning, ClipboardX, UserMinus, UsersRound, CheckCircle2,
  TrendingDown, ArrowUpRight, ArrowDownRight, Minus, Trophy, Clock,
  BookOpen, UserCheck, Activity, ExternalLink, CircleDollarSign,
  CalendarDays, UserPlus, Briefcase, Megaphone, Send, Eye, FileText,
  PlusCircle, Mail, HelpCircle,
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';
import { useSchool } from '../contexts/SchoolContext';
import { buildApiUrl } from '../config';
import TopHeader from '../components/TopHeader';
import { GracePeriodBanner } from '../components/subscription';
import Announcements from '../components/Announcements';
import './ProprietorDashboard.css';

const UserGuide = React.lazy(() => import('../components/UserGuide'));

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#84cc16'];

function ProprietorDashboard() {
  const [activeTab, setActiveTab] = useState('overview');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userName, setUserName] = useState('');
  const { school } = useSchool();

  useEffect(() => {
    setUserName(localStorage.getItem('userName') || 'Proprietor');
  }, []);

  const handleLogout = () => {
    const schoolSlug = school?.slug || localStorage.getItem('schoolSlug');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    localStorage.removeItem('schoolSlug');
    localStorage.removeItem('userName');
    localStorage.removeItem('userRole');
    localStorage.removeItem('userId');
    window.location.href = `/${schoolSlug}`;
  };

  const sidebarStyle = school?.accent_color ? {
    '--sidebar-accent': school.accent_color,
    '--sidebar-accent-dark': school.secondary_color || school.accent_color,
  } : {};

  const tabs = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'performance', label: 'Performance', icon: TrendingUp },
    { id: 'revenue', label: 'Revenue', icon: DollarSign },
    { id: 'attendance', label: 'Attendance', icon: CalendarDays },
    { id: 'staff', label: 'Staff', icon: Briefcase },
    { id: 'enrollment', label: 'Enrollment', icon: Users },
    { id: 'announcements', label: 'Announcements', icon: Megaphone },
    { id: 'user-guide', label: 'User Guide', icon: HelpCircle },
  ];

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="proprietor-container">
      {/* Sidebar */}
      <div className={`proprietor-sidebar ${sidebarOpen ? 'open' : ''}`} style={sidebarStyle}>
        <button className="proprietor-sidebar-close" onClick={() => setSidebarOpen(false)}>
          <X size={20} />
        </button>
        <div className="proprietor-sidebar-top">
          {school?.logo ? (
            <img src={school.logo} alt={school.name} className="proprietor-sidebar-logo" />
          ) : (
            <div className="proprietor-sidebar-logo-placeholder">
              <GraduationCap size={28} />
              <span>{school?.name || 'School'}</span>
            </div>
          )}
        </div>
        <nav className="proprietor-sidebar-nav">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`proprietor-sidebar-item ${activeTab === tab.id ? 'active' : ''}`}
              onClick={() => { setActiveTab(tab.id); setSidebarOpen(false); }}
            >
              <tab.icon size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
        <div className="proprietor-sidebar-bottom">
          <button className="proprietor-sidebar-item logout" onClick={handleLogout}>
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>
      </div>

      {/* Overlay */}
      {sidebarOpen && <div className="proprietor-overlay" onClick={() => setSidebarOpen(false)} />}

      {/* Main */}
      <main className="proprietor-main">
        <TopHeader onMenuClick={() => setSidebarOpen(true)} />
        <GracePeriodBanner />
        <div className="proprietor-content">
          <div className="proprietor-header">
            <h2>{getGreeting()}, {userName}</h2>
            <p className="proprietor-header-subtitle">
              {activeTab === 'overview' && 'School overview and statistics'}
              {activeTab === 'performance' && 'Academic performance analysis'}
              {activeTab === 'revenue' && 'Fee collection and revenue'}
              {activeTab === 'attendance' && 'Student attendance analytics'}
              {activeTab === 'staff' && 'Staff overview and management'}
              {activeTab === 'enrollment' && 'Student enrollment analytics'}
              {activeTab === 'announcements' && 'School-wide announcements'}
              {activeTab === 'user-guide' && 'Help and documentation'}
            </p>
          </div>
          {activeTab === 'overview' && <OverviewTab />}
          {activeTab === 'performance' && <PerformanceTab />}
          {activeTab === 'revenue' && <RevenueTab />}
          {activeTab === 'attendance' && <AttendanceTab />}
          {activeTab === 'staff' && <StaffTab />}
          {activeTab === 'enrollment' && <EnrollmentTab />}
          {activeTab === 'announcements' && <AnnouncementsTab />}
          {activeTab === 'user-guide' && (
            <Suspense fallback={<div className="kb-loading">Loading...</div>}>
              <UserGuide userRole="proprietor" />
            </Suspense>
          )}
        </div>
      </main>
    </div>
  );
}

/* ========== Overview Tab ========== */
function OverviewTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Revenue by class state
  const [sessions, setSessions] = useState([]);
  const [revenueSession, setRevenueSession] = useState('');
  const [revenueTerm, setRevenueTerm] = useState('');
  const [revenueData, setRevenueData] = useState(null);
  const [revenueLoading, setRevenueLoading] = useState(false);

  // Attendance analytics state
  const [attendanceSession, setAttendanceSession] = useState('');
  const [attendanceTerm, setAttendanceTerm] = useState('');
  const [attendanceData, setAttendanceData] = useState(null);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [showAtRiskStudents, setShowAtRiskStudents] = useState(false);

  // Data quality state
  const [dataQualitySession, setDataQualitySession] = useState('');
  const [dataQualityTerm, setDataQualityTerm] = useState('');
  const [dataQualityData, setDataQualityData] = useState(null);
  const [dataQualityLoading, setDataQualityLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/dashboard/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error('Failed to load dashboard');
        setData(await res.json());
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Fetch sessions for filters
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setRevenueSession(d.current_session || '');
        setRevenueTerm(d.current_term || '');
        setAttendanceSession(d.current_session || '');
        setAttendanceTerm(d.current_term || '');
        setDataQualitySession(d.current_session || '');
        setDataQualityTerm(d.current_term || '');
      } catch (e) {
        console.error('Failed to fetch sessions:', e);
      }
    };
    fetchSessions();
  }, []);

  // Fetch revenue by class when session/term changes
  useEffect(() => {
    if (!revenueSession || !revenueTerm) return;
    const fetchRevenue = async () => {
      setRevenueLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(
          buildApiUrl(`proprietor/revenue-by-class/?session=${encodeURIComponent(revenueSession)}&term=${encodeURIComponent(revenueTerm)}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setRevenueData(await res.json());
      } catch (e) {
        console.error('Failed to fetch revenue:', e);
      } finally {
        setRevenueLoading(false);
      }
    };
    fetchRevenue();
  }, [revenueSession, revenueTerm]);

  // Fetch attendance analytics when session/term changes
  useEffect(() => {
    if (!attendanceSession || !attendanceTerm) return;
    const fetchAttendance = async () => {
      setAttendanceLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(
          buildApiUrl(`proprietor/attendance-analytics/?session=${encodeURIComponent(attendanceSession)}&term=${encodeURIComponent(attendanceTerm)}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setAttendanceData(await res.json());
      } catch (e) {
        console.error('Failed to fetch attendance:', e);
      } finally {
        setAttendanceLoading(false);
      }
    };
    fetchAttendance();
  }, [attendanceSession, attendanceTerm]);

  // Fetch data quality metrics when session/term changes
  useEffect(() => {
    if (!dataQualitySession || !dataQualityTerm) return;
    const fetchDataQuality = async () => {
      setDataQualityLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(
          buildApiUrl(`proprietor/data-quality/?session=${encodeURIComponent(dataQualitySession)}&term=${encodeURIComponent(dataQualityTerm)}`),
          { headers: { Authorization: `Bearer ${token}` } }
        );
        setDataQualityData(await res.json());
      } catch (e) {
        console.error('Failed to fetch data quality:', e);
      } finally {
        setDataQualityLoading(false);
      }
    };
    fetchDataQuality();
  }, [dataQualitySession, dataQualityTerm]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!data) return null;

  const statCards = [
    { label: 'Students', value: data.students_count, icon: Users, color: '#3b82f6' },
    { label: 'Teachers', value: data.teachers_count, icon: UserCheck, color: '#10b981' },
    { label: 'Parents', value: data.parents_count, icon: UsersRound, color: '#f59e0b' },
    { label: 'Principals', value: data.principals_count, icon: Building2, color: '#8b5cf6' },
    { label: 'Teacher:Student', value: `1:${data.teacher_student_ratio || 0}`, icon: Users, color: '#06b6d4' },
    { label: 'Avg Class Size', value: data.avg_class_size || 0, icon: GraduationCap, color: '#ec4899' },
  ];

  // Prepare sessions filter data
  const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
  const termsForYear = sessions.filter(s => s.academic_year === revenueSession).map(s => s.term);

  const formatMoney = (val) => `₦${Number(val || 0).toLocaleString()}`;

  // Prepare gender data for pie chart
  const genderChartData = data.gender_distribution ? Object.entries(data.gender_distribution).map(([name, value]) => ({
    name: name || 'Unknown',
    value,
  })) : [];

  const GENDER_COLORS = { Male: '#3b82f6', Female: '#ec4899', Unknown: '#94a3b8' };

  return (
    <div className="proprietor-tab-content">
      {/* Main Stat Cards */}
      <div className="proprietor-stat-cards">
        {statCards.map((card, i) => (
          <div key={i} className="proprietor-stat-card" style={{ borderLeftColor: card.color }}>
            <div className="stat-card-icon" style={{ backgroundColor: card.color + '15', color: card.color }}>
              <card.icon size={22} />
            </div>
            <div className="stat-card-info">
              <span className="stat-card-value">{card.value}</span>
              <span className="stat-card-label">{card.label}</span>
            </div>
          </div>
        ))}
      </div>

      {/* Term Comparison Cards */}
      {data.term_comparison && (
        <div className="term-comparison-section">
          <h3>Term-over-Term Comparison</h3>
          <div className="term-comparison-cards">
            <div className="comparison-card">
              <div className="comparison-card-header">
                <span className="comparison-label">Enrollment</span>
                <span className={`comparison-change ${data.term_comparison.changes.enrollment >= 0 ? 'positive' : 'negative'}`}>
                  {data.term_comparison.changes.enrollment >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(data.term_comparison.changes.enrollment_pct)}%
                </span>
              </div>
              <div className="comparison-values">
                <div className="comparison-current">
                  <span className="comparison-value">{data.term_comparison.current.enrollment}</span>
                  <span className="comparison-term">{data.term_comparison.current.term}</span>
                </div>
                <span className="comparison-vs">vs</span>
                <div className="comparison-previous">
                  <span className="comparison-value">{data.term_comparison.previous.enrollment}</span>
                  <span className="comparison-term">{data.term_comparison.previous.term}</span>
                </div>
              </div>
            </div>

            <div className="comparison-card">
              <div className="comparison-card-header">
                <span className="comparison-label">Revenue</span>
                <span className={`comparison-change ${data.term_comparison.changes.revenue >= 0 ? 'positive' : 'negative'}`}>
                  {data.term_comparison.changes.revenue >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(data.term_comparison.changes.revenue_pct)}%
                </span>
              </div>
              <div className="comparison-values">
                <div className="comparison-current">
                  <span className="comparison-value">{formatMoney(data.term_comparison.current.revenue)}</span>
                  <span className="comparison-term">{data.term_comparison.current.term}</span>
                </div>
                <span className="comparison-vs">vs</span>
                <div className="comparison-previous">
                  <span className="comparison-value">{formatMoney(data.term_comparison.previous.revenue)}</span>
                  <span className="comparison-term">{data.term_comparison.previous.term}</span>
                </div>
              </div>
            </div>

            <div className="comparison-card">
              <div className="comparison-card-header">
                <span className="comparison-label">Pass Rate</span>
                <span className={`comparison-change ${data.term_comparison.changes.pass_rate >= 0 ? 'positive' : 'negative'}`}>
                  {data.term_comparison.changes.pass_rate >= 0 ? <ArrowUpRight size={16} /> : <ArrowDownRight size={16} />}
                  {Math.abs(data.term_comparison.changes.pass_rate)}%
                </span>
              </div>
              <div className="comparison-values">
                <div className="comparison-current">
                  <span className="comparison-value">{data.term_comparison.current.pass_rate}%</span>
                  <span className="comparison-term">{data.term_comparison.current.term}</span>
                </div>
                <span className="comparison-vs">vs</span>
                <div className="comparison-previous">
                  <span className="comparison-value">{data.term_comparison.previous.pass_rate}%</span>
                  <span className="comparison-term">{data.term_comparison.previous.term}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Fee Collection Progress */}
      {data.fee_progress && (
        <div className="fee-progress-section">
          <h3>Fee Collection Progress ({data.current_term})</h3>
          <div className="fee-progress-content">
            <div className="fee-progress-bar-container">
              <div className="fee-progress-bar">
                <div
                  className="fee-progress-fill"
                  style={{ width: `${data.fee_progress.collection_rate}%` }}
                />
              </div>
              <div className="fee-progress-labels">
                <span>0%</span>
                <span className="fee-progress-rate">{data.fee_progress.collection_rate}% Collected</span>
                <span>100%</span>
              </div>
            </div>
            <div className="fee-progress-stats">
              <div className="fee-stat collected">
                <CircleDollarSign size={20} />
                <div>
                  <span className="fee-stat-value">{formatMoney(data.fee_progress.total_collected)}</span>
                  <span className="fee-stat-label">Collected</span>
                </div>
              </div>
              <div className="fee-stat outstanding">
                <CircleDollarSign size={20} />
                <div>
                  <span className="fee-stat-value">{formatMoney(data.fee_progress.outstanding)}</span>
                  <span className="fee-stat-label">Outstanding</span>
                </div>
              </div>
              <div className="fee-stat total">
                <CircleDollarSign size={20} />
                <div>
                  <span className="fee-stat-value">{formatMoney(data.fee_progress.total_expected)}</span>
                  <span className="fee-stat-label">Total Expected</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Gender Distribution & Top Classes Row */}
      <div className="proprietor-charts-row">
        {genderChartData.length > 0 && (
          <div className="proprietor-chart-card">
            <h3>Gender Distribution</h3>
            <div className="gender-chart-content">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={genderChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {genderChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={GENDER_COLORS[entry.name] || COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [value, 'Students']} />
                </PieChart>
              </ResponsiveContainer>
              <div className="gender-legend">
                {genderChartData.map((entry, idx) => (
                  <div key={idx} className="gender-legend-item">
                    <span className="legend-dot" style={{ backgroundColor: GENDER_COLORS[entry.name] || COLORS[idx] }} />
                    <span>{entry.name}: {entry.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {data.top_performing_classes && data.top_performing_classes.length > 0 && (
          <div className="proprietor-chart-card">
            <h3><Trophy size={18} /> Top Performing Classes</h3>
            <div className="top-classes-list">
              {data.top_performing_classes.map((cls, idx) => (
                <div key={idx} className="top-class-item">
                  <span className={`top-class-rank rank-${idx + 1}`}>{idx + 1}</span>
                  <span className="top-class-name">{cls.name}</span>
                  <span className="top-class-score">{cls.average_score}%</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Quick Alerts Row */}
      <div className="quick-alerts-row">
        {data.subjects_without_teacher > 0 && (
          <div className="quick-alert warning">
            <BookOpen size={20} />
            <div>
              <span className="alert-count">{data.subjects_without_teacher}</span>
              <span className="alert-label">Subjects without teachers</span>
            </div>
          </div>
        )}
        {data.upcoming_fees && data.upcoming_fees.length > 0 && (
          <div className="quick-alert danger">
            <DollarSign size={20} />
            <div>
              <span className="alert-count">{data.upcoming_fees.length}+</span>
              <span className="alert-label">Students with outstanding fees</span>
            </div>
          </div>
        )}
      </div>

      {/* Students by Department & Class Charts */}
      <div className="proprietor-charts-row">
        {data.departments.length > 0 && (
          <div className="proprietor-chart-card">
            <h3>Students by Department</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.departments}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="student_count" name="Students" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {data.classes.length > 0 && (
          <div className="proprietor-chart-card">
            <h3>Students by Class</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={data.classes}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} angle={-30} textAnchor="end" height={60} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="student_count" name="Students" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Recent Activity & Upcoming Fees Row */}
      <div className="proprietor-charts-row">
        {data.recent_activities && data.recent_activities.length > 0 && (
          <div className="proprietor-chart-card">
            <h3><Activity size={18} /> Recent Activity</h3>
            <div className="activity-feed">
              {data.recent_activities.map((activity, idx) => (
                <div key={idx} className="activity-item">
                  <div className="activity-icon">
                    <Clock size={14} />
                  </div>
                  <div className="activity-content">
                    <span className="activity-action">{activity.action}</span>
                    <span className="activity-user">by {activity.user}</span>
                    <span className="activity-time">
                      {new Date(activity.timestamp).toLocaleDateString()} {new Date(activity.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {data.upcoming_fees && data.upcoming_fees.length > 0 && (
          <div className="proprietor-chart-card">
            <h3><DollarSign size={18} /> Outstanding Fees</h3>
            <div className="upcoming-fees-list">
              {data.upcoming_fees.map((fee, idx) => (
                <div key={idx} className="upcoming-fee-item">
                  <div className="fee-student-info">
                    <span className="fee-student-name">{fee.student_name}</span>
                    <span className="fee-type">{fee.fee_name}</span>
                  </div>
                  <span className="fee-amount">{formatMoney(fee.outstanding)}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Revenue by Class Chart */}
      <div className="proprietor-chart-card revenue-by-class-card">
        <div className="revenue-chart-header">
          <h3>Revenue by Class</h3>
          <div className="revenue-chart-filters">
            <select
              value={revenueSession}
              onChange={e => setRevenueSession(e.target.value)}
              className="revenue-filter-select"
            >
              <option value="">Session</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={revenueTerm}
              onChange={e => setRevenueTerm(e.target.value)}
              className="revenue-filter-select"
            >
              <option value="">Term</option>
              {termsForYear.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
        </div>

        {revenueLoading ? (
          <div className="revenue-chart-loading">
            <Loader2 size={24} className="spinning" />
            <span>Loading revenue data...</span>
          </div>
        ) : revenueData && revenueData.classes && revenueData.classes.length > 0 ? (
          <>
            <div className="revenue-chart-container">
              <ResponsiveContainer width="100%" height={Math.max(300, revenueData.classes.length * 50)}>
                <BarChart
                  data={revenueData.classes}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis
                    type="number"
                    tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`}
                    tick={{ fontSize: 11 }}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={100}
                    tick={{ fontSize: 12 }}
                  />
                  <Tooltip
                    formatter={(value, name) => [formatMoney(value), name]}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Legend />
                  <Bar
                    dataKey="collected"
                    name="Collected"
                    stackId="revenue"
                    fill="#10b981"
                    radius={[0, 0, 0, 0]}
                  />
                  <Bar
                    dataKey="outstanding"
                    name="Outstanding"
                    stackId="revenue"
                    fill="#f59e0b"
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div className="revenue-summary-footer">
              <div className="revenue-summary-item">
                <span className="revenue-summary-label">Total Collected</span>
                <span className="revenue-summary-value collected">{formatMoney(revenueData.total_collected)}</span>
              </div>
              <div className="revenue-summary-item">
                <span className="revenue-summary-label">Total Outstanding</span>
                <span className="revenue-summary-value outstanding">{formatMoney(revenueData.total_outstanding)}</span>
              </div>
              <div className="revenue-summary-item total">
                <span className="revenue-summary-label">Grand Total</span>
                <span className="revenue-summary-value">{formatMoney(revenueData.total_fees)}</span>
              </div>
            </div>
          </>
        ) : (
          <div className="revenue-chart-empty">
            <DollarSign size={40} />
            <p>No fee data available for {revenueTerm} {revenueSession}</p>
          </div>
        )}
      </div>

      {/* Attendance Analytics Section */}
      <div className="proprietor-chart-card attendance-analytics-card">
        <div className="attendance-chart-header">
          <h3>Attendance Analytics</h3>
          <div className="attendance-chart-filters">
            <select
              value={attendanceSession}
              onChange={e => setAttendanceSession(e.target.value)}
              className="attendance-filter-select"
            >
              <option value="">Session</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={attendanceTerm}
              onChange={e => setAttendanceTerm(e.target.value)}
              className="attendance-filter-select"
            >
              <option value="">Term</option>
              {sessions.filter(s => s.academic_year === attendanceSession).map(s => (
                <option key={s.term} value={s.term}>{s.term}</option>
              ))}
            </select>
          </div>
        </div>

        {attendanceLoading ? (
          <div className="attendance-chart-loading">
            <Loader2 size={24} className="spinning" />
            <span>Loading attendance data...</span>
          </div>
        ) : attendanceData && attendanceData.total_students > 0 ? (
          <>
            {/* Attendance Summary Cards */}
            <div className="attendance-summary-cards">
              <div className="attendance-stat-card rate">
                <div className="attendance-stat-icon">
                  <CalendarCheck size={24} />
                </div>
                <div className="attendance-stat-info">
                  <span className="attendance-stat-value">{attendanceData.average_rate}%</span>
                  <span className="attendance-stat-label">Average Attendance Rate</span>
                </div>
              </div>
              <div className="attendance-stat-card at-risk" onClick={() => setShowAtRiskStudents(!showAtRiskStudents)}>
                <div className="attendance-stat-icon warning">
                  <UserX size={24} />
                </div>
                <div className="attendance-stat-info">
                  <span className="attendance-stat-value">{attendanceData.students_at_risk}</span>
                  <span className="attendance-stat-label">
                    Students Below {attendanceData.pass_threshold}%
                    {attendanceData.students_at_risk > 0 && <span className="tap-hint">(tap to view)</span>}
                  </span>
                </div>
              </div>
              <div className="attendance-stat-card total">
                <div className="attendance-stat-icon">
                  <Users size={24} />
                </div>
                <div className="attendance-stat-info">
                  <span className="attendance-stat-value">{attendanceData.total_students}</span>
                  <span className="attendance-stat-label">Total Students Tracked</span>
                </div>
              </div>
            </div>

            {/* At-Risk Students List (expandable) */}
            {showAtRiskStudents && attendanceData.at_risk_students && attendanceData.at_risk_students.length > 0 && (
              <div className="at-risk-students-section">
                <h4>Students Below {attendanceData.pass_threshold}% Attendance</h4>
                <div className="at-risk-students-list">
                  {attendanceData.at_risk_students.map((student, idx) => (
                    <div key={student.id} className="at-risk-student-item">
                      <span className="at-risk-rank">{idx + 1}</span>
                      <div className="at-risk-student-info">
                        <span className="at-risk-student-name">{student.name}</span>
                        <span className="at-risk-student-class">{student.class}</span>
                      </div>
                      <div className="at-risk-student-stats">
                        <span className="at-risk-rate">{student.attendance_rate}%</span>
                        <span className="at-risk-days">{student.present_days}/{student.total_days} days</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Classes by Attendance Chart */}
            {attendanceData.classes && attendanceData.classes.length > 0 && (
              <div className="attendance-chart-section">
                <h4>Classes by Attendance Rate (Lowest First)</h4>
                <div className="attendance-chart-container">
                  <ResponsiveContainer width="100%" height={Math.max(250, attendanceData.classes.length * 45)}>
                    <BarChart
                      data={attendanceData.classes}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 10, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis
                        type="number"
                        domain={[0, 100]}
                        tickFormatter={(v) => `${v}%`}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        width={100}
                        tick={{ fontSize: 12 }}
                      />
                      <Tooltip
                        formatter={(value) => [`${value}%`, 'Attendance Rate']}
                        labelStyle={{ fontWeight: 600 }}
                      />
                      <Bar
                        dataKey="attendance_rate"
                        name="Attendance Rate"
                        fill={(entry) => entry.attendance_rate < 50 ? '#ef4444' : entry.attendance_rate < 70 ? '#f59e0b' : '#10b981'}
                        radius={[0, 4, 4, 0]}
                      >
                        {attendanceData.classes.map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={entry.attendance_rate < 50 ? '#ef4444' : entry.attendance_rate < 70 ? '#f59e0b' : '#10b981'}
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div className="attendance-legend">
                  <span className="legend-item"><span className="legend-color good"></span> Good (70%+)</span>
                  <span className="legend-item"><span className="legend-color warning"></span> Warning (50-70%)</span>
                  <span className="legend-item"><span className="legend-color danger"></span> Critical (&lt;50%)</span>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="attendance-chart-empty">
            <CalendarCheck size={40} />
            <p>No attendance data available for {attendanceTerm} {attendanceSession}</p>
          </div>
        )}
      </div>

      {/* Data Quality / Inspection Readiness Section */}
      <div className="proprietor-chart-card data-quality-card">
        <div className="data-quality-header">
          <h3>Data Quality & Inspection Readiness</h3>
          <div className="data-quality-filters">
            <select
              value={dataQualitySession}
              onChange={e => setDataQualitySession(e.target.value)}
              className="data-quality-filter-select"
            >
              <option value="">Session</option>
              {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
            </select>
            <select
              value={dataQualityTerm}
              onChange={e => setDataQualityTerm(e.target.value)}
              className="data-quality-filter-select"
            >
              <option value="">Term</option>
              {sessions.filter(s => s.academic_year === dataQualitySession).map(s => (
                <option key={s.term} value={s.term}>{s.term}</option>
              ))}
            </select>
          </div>
        </div>

        {dataQualityLoading ? (
          <div className="data-quality-loading">
            <Loader2 size={24} className="spinning" />
            <span>Analyzing data quality...</span>
          </div>
        ) : dataQualityData ? (
          <div className="data-quality-content">
            {/* Health Score Circle */}
            <div className="data-quality-score-section">
              <div className={`health-score-circle ${
                dataQualityData.health_score >= 80 ? 'excellent' :
                dataQualityData.health_score >= 60 ? 'good' :
                dataQualityData.health_score >= 40 ? 'fair' : 'poor'
              }`}>
                <svg viewBox="0 0 100 100" className="health-score-svg">
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="#e2e8f0"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50" cy="50" r="45"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${dataQualityData.health_score * 2.83} 283`}
                    transform="rotate(-90 50 50)"
                  />
                </svg>
                <div className="health-score-value">
                  <span className="score-number">{dataQualityData.health_score}</span>
                  <span className="score-label">Health Score</span>
                </div>
              </div>
              <div className="health-score-legend">
                {dataQualityData.health_score >= 80 ? (
                  <span className="legend-status excellent"><CheckCircle2 size={16} /> Excellent - Ready for inspection</span>
                ) : dataQualityData.health_score >= 60 ? (
                  <span className="legend-status good"><ShieldAlert size={16} /> Good - Minor issues to address</span>
                ) : dataQualityData.health_score >= 40 ? (
                  <span className="legend-status fair"><AlertCircle size={16} /> Fair - Several issues need attention</span>
                ) : (
                  <span className="legend-status poor"><FileWarning size={16} /> Poor - Critical issues found</span>
                )}
              </div>
            </div>

            {/* Issue Cards Grid */}
            {dataQualityData.issues && dataQualityData.issues.length > 0 ? (
              <div className="data-quality-issues-grid">
                {dataQualityData.issues.map((issue, idx) => (
                  <div key={idx} className={`data-quality-issue-card severity-${issue.severity}`}>
                    <div className="issue-card-icon">
                      {issue.category === 'incomplete_students' && <UserMinus size={24} />}
                      {issue.category === 'missing_attendance' && <CalendarCheck size={24} />}
                      {issue.category === 'unsubmitted_results' && <ClipboardX size={24} />}
                      {issue.category === 'inactive_teachers' && <UserX size={24} />}
                      {issue.category === 'orphan_students' && <UsersRound size={24} />}
                    </div>
                    <div className="issue-card-content">
                      <div className="issue-card-header">
                        <span className="issue-count">{issue.count}</span>
                        <span className={`issue-severity-badge ${issue.severity}`}>
                          {issue.severity}
                        </span>
                      </div>
                      <h4 className="issue-label">{issue.label}</h4>
                      {issue.details && issue.details.length > 0 && (
                        <ul className="issue-details">
                          {issue.details.map((detail, i) => (
                            <li key={i}>{detail}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="data-quality-all-clear">
                <CheckCircle2 size={48} />
                <p>All records are complete and up to date!</p>
              </div>
            )}

            {/* Summary Footer */}
            <div className="data-quality-summary">
              <span className="summary-item">
                <strong>{dataQualityData.total_issues}</strong> total issues found
              </span>
              <span className="summary-divider">|</span>
              <span className="summary-item">
                {dataQualityTerm} {dataQualitySession}
              </span>
            </div>
          </div>
        ) : (
          <div className="data-quality-empty">
            <ShieldAlert size={40} />
            <p>Unable to analyze data quality</p>
          </div>
        )}
      </div>
    </div>
  );
}

/* ========== Session Selector ========== */
function SessionSelector({ label, session, term, onSessionChange, onTermChange, sessions }) {
  const uniqueYears = [...new Set(sessions.map(s => s.academic_year))];
  const termsForYear = sessions.filter(s => s.academic_year === session).map(s => s.term);

  const handleSessionChange = (newSession) => {
    onSessionChange(newSession);
    // Auto-select first available term when session changes
    if (newSession) {
      const availableTerms = sessions.filter(s => s.academic_year === newSession).map(s => s.term);
      if (availableTerms.length > 0) {
        onTermChange(availableTerms[0]);
      } else {
        onTermChange('');
      }
    } else {
      onTermChange('');
    }
  };

  return (
    <div className="session-selector">
      <span className="session-selector-label">{label}</span>
      <select value={session || ''} onChange={e => handleSessionChange(e.target.value)}>
        <option value="">Select session</option>
        {uniqueYears.map(y => <option key={y} value={y}>{y}</option>)}
      </select>
      <select value={term || ''} onChange={e => onTermChange(e.target.value)}>
        <option value="">Select term</option>
        {termsForYear.map(t => <option key={t} value={t}>{t}</option>)}
      </select>
    </div>
  );
}

/* ========== Performance Tab ========== */
function PerformanceTab() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState('');
  const [compareSession, setCompareSession] = useState('');
  const [compareTerm, setCompareTerm] = useState('');
  const [data, setData] = useState(null);
  const [detailsData, setDetailsData] = useState(null);
  const [failedStudents, setFailedStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [showFailed, setShowFailed] = useState(false);
  const [failedLoading, setFailedLoading] = useState(false);
  const [showTopPerformers, setShowTopPerformers] = useState(false);
  const [showAtRisk, setShowAtRisk] = useState(false);
  const [showTeacherPerf, setShowTeacherPerf] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setCurrentSession(d.current_session || '');
        setCurrentTerm(d.current_term || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchPerformance = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/performance/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchPerformance();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  // Fetch detailed performance data
  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchDetails = async () => {
      setDetailsLoading(true);
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/performance-details/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
        setDetailsData(await res.json());
      } catch (e) {
        console.error(e);
      } finally {
        setDetailsLoading(false);
      }
    };
    fetchDetails();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  const loadFailedStudents = async () => {
    setFailedLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const res = await fetch(
        buildApiUrl(`proprietor/failed-students/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`),
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const d = await res.json();
      setFailedStudents(d.students || []);
      setShowFailed(true);
    } catch (e) {
      console.error(e);
    } finally {
      setFailedLoading(false);
    }
  };

  if (loading) return <LoadingSpinner />;

  const current = data?.current;
  const comparison = data?.comparison;

  const comparisonChartData = current && comparison ? [
    {
      label: 'Passed',
      [current.term]: current.passed,
      [comparison.term + ' (prev)']: comparison.passed,
    },
    {
      label: 'Failed',
      [current.term]: current.failed,
      [comparison.term + ' (prev)']: comparison.failed,
    },
  ] : null;

  const GRADE_COLORS = {
    'A': '#10b981', 'B': '#3b82f6', 'C': '#f59e0b', 'D': '#f97316', 'F': '#ef4444'
  };

  return (
    <div className="proprietor-tab-content">
      <div className="proprietor-filters">
        <SessionSelector
          label="Current"
          session={currentSession} term={currentTerm}
          onSessionChange={setCurrentSession} onTermChange={setCurrentTerm}
          sessions={sessions}
        />
        <SessionSelector
          label="Compare with"
          session={compareSession} term={compareTerm}
          onSessionChange={setCompareSession} onTermChange={setCompareTerm}
          sessions={sessions}
        />
      </div>

      {current && current.total_students > 0 ? (
        <>
          {/* Main Stats */}
          <div className="proprietor-stat-cards">
            <StatCardWithDelta label="Total Students" value={current.total_students} prevValue={comparison?.total_students} color="#3b82f6" />
            <StatCardWithDelta label="Pass Rate" value={`${current.pass_rate}%`} rawValue={current.pass_rate} prevValue={comparison?.pass_rate} color="#10b981" suffix="%" />
            <StatCardWithDelta label="Failed" value={current.failed} prevValue={comparison?.failed} color="#ef4444" invertDelta />
            <StatCardWithDelta label="Avg Score" value={current.average_score} prevValue={comparison?.average_score} color="#f59e0b" />
          </div>

          {/* Pass/Fail Comparison Chart */}
          {comparisonChartData && (
            <div className="proprietor-chart-card">
              <h3>Pass/Fail Comparison</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={comparisonChartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey={current.term} fill="#3b82f6" radius={[4, 4, 0, 0]} />
                  <Bar dataKey={comparison.term + ' (prev)'} fill="#93c5fd" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {detailsLoading ? (
            <div className="proprietor-loading" style={{ padding: '2rem' }}>
              <Loader2 size={24} className="spinning" />
              <p>Loading detailed analytics...</p>
            </div>
          ) : detailsData && (
            <>
              {/* Performance Trends (Line Chart) */}
              {detailsData.performance_trends && detailsData.performance_trends.length > 1 && (
                <div className="proprietor-chart-card">
                  <h3><TrendingUp size={18} /> Performance Trends</h3>
                  <ResponsiveContainer width="100%" height={300}>
                    <LineChart data={detailsData.performance_trends}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <Tooltip formatter={(value, name) => [name === 'pass_rate' ? `${value}%` : value, name === 'pass_rate' ? 'Pass Rate' : 'Avg Score']} />
                      <Legend />
                      <Line type="monotone" dataKey="pass_rate" name="Pass Rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                      <Line type="monotone" dataKey="average_score" name="Avg Score" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Grade Distribution & Exam vs CA Row */}
              <div className="proprietor-charts-row">
                {/* Grade Distribution */}
                {detailsData.grade_distribution && detailsData.grade_distribution.length > 0 && (
                  <div className="proprietor-chart-card">
                    <h3>Grade Distribution {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                    <ResponsiveContainer width="100%" height={250}>
                      <PieChart>
                        <Pie
                          data={detailsData.grade_distribution.filter(g => g.count > 0)}
                          cx="50%"
                          cy="50%"
                          outerRadius={80}
                          dataKey="count"
                          label={({ grade, count, percent }) => `${grade}: ${count} (${(percent * 100).toFixed(0)}%)`}
                          labelLine={false}
                        >
                          {detailsData.grade_distribution.filter(g => g.count > 0).map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={GRADE_COLORS[entry.grade] || COLORS[index % COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip formatter={(value) => [value, 'Students']} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div className="grade-legend">
                      {detailsData.grade_distribution.map((g, idx) => {
                        const prevCount = detailsData.comparison?.grade_distribution?.[g.grade];
                        const delta = prevCount !== undefined ? g.count - prevCount : null;
                        return (
                          <span key={idx} className="grade-legend-item">
                            <span className="grade-dot" style={{ backgroundColor: GRADE_COLORS[g.grade] || '#94a3b8' }} />
                            {g.grade}: {g.count}
                            {delta !== null && delta !== 0 && (
                              <span className={`grade-delta ${delta > 0 ? (g.grade === 'F' ? 'negative' : 'positive') : (g.grade === 'F' ? 'positive' : 'negative')}`}>
                                {delta > 0 ? '↑' : '↓'}{Math.abs(delta)}
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Exam vs CA Analysis */}
                {detailsData.exam_vs_ca && (
                  <div className="proprietor-chart-card">
                    <h3>Exam vs Continuous Assessment {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                    <div className="exam-ca-comparison">
                      <div className="exam-ca-bars">
                        <div className="exam-ca-item">
                          <div className="exam-ca-label">
                            <span>Exam ({detailsData.exam_vs_ca.exam_weight}%)</span>
                            <span className="exam-ca-value">
                              {detailsData.exam_vs_ca.exam_average}%
                              {detailsData.comparison?.exam_vs_ca && (
                                <DeltaBadge value={detailsData.exam_vs_ca.exam_average - detailsData.comparison.exam_vs_ca.exam_average} suffix="%" />
                              )}
                            </span>
                          </div>
                          <div className="exam-ca-bar">
                            <div className="exam-ca-fill exam" style={{ width: `${detailsData.exam_vs_ca.exam_average}%` }} />
                          </div>
                        </div>
                        <div className="exam-ca-item">
                          <div className="exam-ca-label">
                            <span>CA ({detailsData.exam_vs_ca.ca_weight}%)</span>
                            <span className="exam-ca-value">
                              {detailsData.exam_vs_ca.ca_average}%
                              {detailsData.comparison?.exam_vs_ca && (
                                <DeltaBadge value={detailsData.exam_vs_ca.ca_average - detailsData.comparison.exam_vs_ca.ca_average} suffix="%" />
                              )}
                            </span>
                          </div>
                          <div className="exam-ca-bar">
                            <div className="exam-ca-fill ca" style={{ width: `${detailsData.exam_vs_ca.ca_average}%` }} />
                          </div>
                        </div>
                      </div>
                      <div className="ca-breakdown">
                        <h4>CA Breakdown</h4>
                        <div className="ca-components">
                          <span>Test: {detailsData.exam_vs_ca.components.test}% (weight: {detailsData.exam_vs_ca.component_weights.test}%)</span>
                          <span>Assignment: {detailsData.exam_vs_ca.components.assignment}% (weight: {detailsData.exam_vs_ca.component_weights.assignment}%)</span>
                          <span>Attendance: {detailsData.exam_vs_ca.components.attendance}% (weight: {detailsData.exam_vs_ca.component_weights.attendance}%)</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Performance by Class */}
              {detailsData.performance_by_class && detailsData.performance_by_class.length > 0 && (
                <div className="proprietor-chart-card">
                  <h3>Performance by Class {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                  <div className="performance-table-container">
                    <table className="proprietor-table performance-table">
                      <thead>
                        <tr>
                          <th>Rank</th>
                          <th>Class</th>
                          <th>Students</th>
                          <th>Passed</th>
                          <th>Failed</th>
                          <th>Pass Rate</th>
                          <th>Avg Score</th>
                        </tr>
                      </thead>
                      <tbody>
                        {detailsData.performance_by_class.map((cls, idx) => {
                          const comp = detailsData.comparison?.by_class?.[cls.class_name];
                          const passRateDelta = comp ? cls.pass_rate - comp.pass_rate : null;
                          const avgDelta = comp ? cls.average_score - comp.average_score : null;
                          return (
                            <tr key={idx} className={idx < 3 ? 'top-rank' : ''}>
                              <td><span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span></td>
                              <td className="class-name">{cls.class_name}</td>
                              <td>{cls.total_students}</td>
                              <td className="passed">{cls.passed}</td>
                              <td className="failed">{cls.failed}</td>
                              <td>
                                <span className={`rate-badge ${cls.pass_rate >= 70 ? 'good' : cls.pass_rate >= 50 ? 'warning' : 'danger'}`}>{cls.pass_rate}%</span>
                                {passRateDelta !== null && <DeltaBadge value={passRateDelta} suffix="%" />}
                              </td>
                              <td className="avg-score">
                                {cls.average_score}%
                                {avgDelta !== null && <DeltaBadge value={avgDelta} suffix="%" />}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Performance by Subject */}
              {detailsData.performance_by_subject && detailsData.performance_by_subject.length > 0 && (
                <div className="proprietor-chart-card">
                  <h3>Performance by Subject {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                  <ResponsiveContainer width="100%" height={Math.max(300, detailsData.performance_by_subject.length * (detailsData.comparison ? 45 : 35))}>
                    <BarChart
                      data={detailsData.performance_by_subject.slice(0, 8).map(s => ({
                        ...s,
                        prev_average: detailsData.comparison?.by_subject?.[s.subject_name]?.average_score || 0,
                      }))}
                      layout="vertical"
                      margin={{ top: 10, right: 30, left: 100, bottom: 10 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                      <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                      <YAxis type="category" dataKey="subject_name" tick={{ fontSize: 11 }} width={90} />
                      <Tooltip formatter={(value, name) => [`${value}%`, name === 'prev_average' ? `Prev Term` : 'Current']} />
                      {detailsData.comparison && (
                        <Legend formatter={(value) => value === 'prev_average' ? compareTerm : currentTerm} />
                      )}
                      <Bar dataKey="average_score" name={currentTerm || 'Current'} fill="#3b82f6" radius={[0, 4, 4, 0]} />
                      {detailsData.comparison && (
                        <Bar dataKey="prev_average" name={compareTerm || 'Previous'} fill="#93c5fd" radius={[0, 4, 4, 0]} />
                      )}
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Performance by Department */}
              {detailsData.performance_by_department && detailsData.performance_by_department.length > 0 && (
                <div className="proprietor-chart-card">
                  <h3>Performance by Department {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                  <div className="department-comparison">
                    {detailsData.performance_by_department.map((dept, idx) => {
                      const comp = detailsData.comparison?.by_department?.[dept.department];
                      const passRateDelta = comp ? dept.pass_rate - comp.pass_rate : null;
                      const avgDelta = comp ? dept.average_score - comp.average_score : null;
                      return (
                        <div key={idx} className="department-card">
                          <h4>{dept.department}</h4>
                          <div className="department-stats">
                            <div className="dept-stat">
                              <span className="dept-stat-value">{dept.total_students}</span>
                              <span className="dept-stat-label">Students</span>
                            </div>
                            <div className="dept-stat highlight">
                              <span className="dept-stat-value">{dept.pass_rate}%</span>
                              {passRateDelta !== null && <DeltaBadge value={passRateDelta} suffix="%" />}
                              <span className="dept-stat-label">Pass Rate</span>
                            </div>
                            <div className="dept-stat">
                              <span className="dept-stat-value">{dept.average_score}%</span>
                              {avgDelta !== null && <DeltaBadge value={avgDelta} suffix="%" />}
                              <span className="dept-stat-label">Avg Score</span>
                            </div>
                          </div>
                          <div className="dept-bar">
                            <div className="dept-bar-fill" style={{ width: `${dept.pass_rate}%`, backgroundColor: dept.pass_rate >= 70 ? '#10b981' : dept.pass_rate >= 50 ? '#f59e0b' : '#ef4444' }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Action Buttons Row */}
              <div className="proprietor-action-row">
                <button className="proprietor-drill-btn" onClick={() => setShowTopPerformers(!showTopPerformers)}>
                  <Trophy size={16} /> {showTopPerformers ? 'Hide' : 'View'} Top Performers
                </button>
                <button className="proprietor-drill-btn warning" onClick={() => setShowAtRisk(!showAtRisk)}>
                  <AlertCircle size={16} /> {showAtRisk ? 'Hide' : 'View'} At-Risk Students
                </button>
                <button className="proprietor-drill-btn" onClick={loadFailedStudents} disabled={failedLoading}>
                  {failedLoading ? <><Loader2 size={16} className="spinning" /> Loading...</> : <><UserX size={16} /> View Failed Students</>}
                </button>
                <button className="proprietor-drill-btn secondary" onClick={() => setShowTeacherPerf(!showTeacherPerf)}>
                  <UserCheck size={16} /> {showTeacherPerf ? 'Hide' : 'View'} Teacher Performance
                </button>
              </div>

              {/* Top Performers Table */}
              {showTopPerformers && detailsData.top_performers && detailsData.top_performers.length > 0 && (
                <div className="proprietor-table-card">
                  <h3><Trophy size={18} /> Top 20 Performers</h3>
                  <table className="proprietor-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Department</th>
                        <th>Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.top_performers.map((s) => (
                        <tr key={s.student_id} className={s.rank <= 3 ? 'top-rank' : ''}>
                          <td><span className={`rank-badge rank-${s.rank}`}>{s.rank}</span></td>
                          <td>{s.name}</td>
                          <td>{s.class}</td>
                          <td>{s.department || '-'}</td>
                          <td className="score-cell passed">{s.average_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* At-Risk Students Table */}
              {showAtRisk && detailsData.students_at_risk && detailsData.students_at_risk.length > 0 && (
                <div className="proprietor-table-card warning-card">
                  <h3><AlertCircle size={18} /> Students at Risk (40-50%)</h3>
                  <p className="table-description">These students are borderline and may fail if not supported.</p>
                  <table className="proprietor-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Class</th>
                        <th>Department</th>
                        <th>Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.students_at_risk.map((s, i) => (
                        <tr key={s.student_id}>
                          <td>{i + 1}</td>
                          <td>{s.name}</td>
                          <td>{s.class}</td>
                          <td>{s.department || '-'}</td>
                          <td className="score-cell warning">{s.average_score}%</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Teacher Performance Table */}
              {showTeacherPerf && detailsData.teacher_performance && detailsData.teacher_performance.length > 0 && (
                <div className="proprietor-table-card">
                  <h3><UserCheck size={18} /> Teacher Performance {detailsData.comparison && <span className="comparison-label">vs {detailsData.comparison.term}</span>}</h3>
                  <table className="proprietor-table">
                    <thead>
                      <tr>
                        <th>Rank</th>
                        <th>Teacher</th>
                        <th>Subjects</th>
                        <th>Students Graded</th>
                        <th>Pass Rate</th>
                        <th>Avg Score</th>
                      </tr>
                    </thead>
                    <tbody>
                      {detailsData.teacher_performance.map((t, idx) => {
                        const comp = detailsData.comparison?.by_teacher?.[t.teacher_id];
                        const passRateDelta = comp ? t.pass_rate - comp.pass_rate : null;
                        const avgDelta = comp ? t.average_score - comp.average_score : null;
                        return (
                          <tr key={t.teacher_id}>
                            <td><span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span></td>
                            <td>{t.teacher_name}</td>
                            <td>{t.subjects_count}</td>
                            <td>{t.students_graded}</td>
                            <td>
                              <span className={`rate-badge ${t.pass_rate >= 70 ? 'good' : t.pass_rate >= 50 ? 'warning' : 'danger'}`}>{t.pass_rate}%</span>
                              {passRateDelta !== null && <DeltaBadge value={passRateDelta} suffix="%" />}
                            </td>
                            <td className="avg-score">
                              {t.average_score}%
                              {avgDelta !== null && <DeltaBadge value={avgDelta} suffix="%" />}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}

          {/* Failed Students Table */}
          {showFailed && (
            <div className="proprietor-table-card danger-card">
              <h3>Failed Students ({failedStudents.length})</h3>
              {failedStudents.length === 0 ? (
                <p className="proprietor-empty">No failed students found for this term.</p>
              ) : (
                <table className="proprietor-table">
                  <thead>
                    <tr>
                      <th>#</th>
                      <th>Name</th>
                      <th>Class</th>
                      <th>Department</th>
                      <th>Avg Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {failedStudents.map((s, i) => (
                      <tr key={s.id}>
                        <td>{i + 1}</td>
                        <td>{s.name}</td>
                        <td>{s.class}</td>
                        <td>{s.department || '-'}</td>
                        <td className="score-cell failed">{s.average_score}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="proprietor-empty-state">
          <BarChart3 size={48} />
          <p>No performance data available for the selected term.</p>
        </div>
      )}
    </div>
  );
}

/* ========== Revenue Tab ========== */
function RevenueTab() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState('');
  const [compareSession, setCompareSession] = useState('');
  const [compareTerm, setCompareTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showDebtors, setShowDebtors] = useState(false);
  const [showPayments, setShowPayments] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setCurrentSession(d.current_session || '');
        setCurrentTerm(d.current_term || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchRevenue = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/revenue-details/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), {
          headers: { Authorization: `Bearer ${token}` },
        });
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchRevenue();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  if (loading) return <LoadingSpinner />;

  const overview = data?.overview;
  const comparison = data?.comparison;
  const formatMoney = (val) => `₦${Number(val || 0).toLocaleString()}`;

  const CHART_COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="proprietor-tab-content">
      <div className="proprietor-filters">
        <SessionSelector
          label="Current"
          session={currentSession} term={currentTerm}
          onSessionChange={setCurrentSession} onTermChange={setCurrentTerm}
          sessions={sessions}
        />
        <SessionSelector
          label="Compare with"
          session={compareSession} term={compareTerm}
          onSessionChange={setCompareSession} onTermChange={setCompareTerm}
          sessions={sessions}
        />
      </div>

      {overview && overview.total_expected > 0 ? (
        <>
          {/* Overview Stats */}
          <div className="proprietor-stat-cards">
            <StatCardWithDelta label="Expected Revenue" value={formatMoney(overview.total_expected)} rawValue={overview.total_expected} prevValue={comparison?.total_expected} color="#3b82f6" isMoney />
            <StatCardWithDelta label="Collected" value={formatMoney(overview.total_collected)} rawValue={overview.total_collected} prevValue={comparison?.total_collected} color="#10b981" isMoney />
            <StatCardWithDelta label="Outstanding" value={formatMoney(overview.outstanding)} rawValue={overview.outstanding} prevValue={comparison?.outstanding} color="#ef4444" invertDelta isMoney />
            <StatCardWithDelta label="Collection Rate" value={`${overview.collection_rate}%`} rawValue={overview.collection_rate} prevValue={comparison?.collection_rate} color="#f59e0b" suffix="%" />
          </div>

          {/* Payment Status Breakdown */}
          <div className="revenue-status-cards">
            <div className="revenue-status-card paid">
              <span className="status-count">{overview.fully_paid}</span>
              <span className="status-label">Fully Paid</span>
              {comparison && <DeltaBadge value={overview.fully_paid - comparison.fully_paid} />}
            </div>
            <div className="revenue-status-card partial">
              <span className="status-count">{overview.partial_paid}</span>
              <span className="status-label">Partial</span>
              {comparison && <DeltaBadge value={overview.partial_paid - comparison.partial_paid} invert />}
            </div>
            <div className="revenue-status-card unpaid">
              <span className="status-count">{overview.unpaid}</span>
              <span className="status-label">Unpaid</span>
              {comparison && <DeltaBadge value={overview.unpaid - comparison.unpaid} invert />}
            </div>
          </div>

          {/* Charts Row */}
          <div className="proprietor-charts-row">
            {/* Collection Trend */}
            {data.collection_trend && data.collection_trend.length > 0 && (
              <div className="proprietor-chart-card">
                <h3>Collection Trend (Last 30 Days)</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.collection_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                    <Tooltip formatter={(v) => formatMoney(v)} labelFormatter={(l) => `Date: ${l}`} />
                    <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Fee Type Breakdown */}
            {data.fee_type_breakdown && data.fee_type_breakdown.length > 0 && (
              <div className="proprietor-chart-card">
                <h3>Revenue by Fee Type</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={data.fee_type_breakdown.filter(f => f.collected > 0)}
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      dataKey="collected"
                      label={({ fee_name, percent }) => `${fee_name.slice(0, 10)}${fee_name.length > 10 ? '...' : ''}: ${(percent * 100).toFixed(0)}%`}
                      labelLine={false}
                    >
                      {data.fee_type_breakdown.filter(f => f.collected > 0).map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v) => formatMoney(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Revenue by Class */}
          {data.revenue_by_class && data.revenue_by_class.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Revenue by Class</h3>
              <ResponsiveContainer width="100%" height={Math.max(300, data.revenue_by_class.length * 40)}>
                <BarChart
                  data={data.revenue_by_class.slice(0, 10)}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" tickFormatter={(v) => `₦${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="class_name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip formatter={(v) => formatMoney(v)} />
                  <Legend />
                  <Bar dataKey="collected" name="Collected" fill="#10b981" stackId="a" />
                  <Bar dataKey="outstanding" name="Outstanding" fill="#fca5a5" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Class Collection Rates Table */}
          {data.class_collection_rates && data.class_collection_rates.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Class Collection Rates (Ranked)</h3>
              <div className="performance-table-container">
                <table className="proprietor-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Class</th>
                      <th>Students</th>
                      <th>Expected</th>
                      <th>Collected</th>
                      <th>Outstanding</th>
                      <th>Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.class_collection_rates.map((cls, idx) => (
                      <tr key={idx}>
                        <td><span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span></td>
                        <td>{cls.class_name}</td>
                        <td>{cls.student_count}</td>
                        <td>{formatMoney(cls.expected)}</td>
                        <td className="passed">{formatMoney(cls.collected)}</td>
                        <td className="failed">{formatMoney(cls.outstanding)}</td>
                        <td>
                          <span className={`rate-badge ${cls.collection_rate >= 80 ? 'good' : cls.collection_rate >= 50 ? 'warning' : 'danger'}`}>
                            {cls.collection_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Aging Report */}
          {data.aging_report && data.aging_report.some(a => a.count > 0) && (
            <div className="proprietor-chart-card">
              <h3>Aging Report (Outstanding Fees)</h3>
              <div className="aging-report-grid">
                {data.aging_report.map((bucket, idx) => (
                  <div key={idx} className={`aging-bucket ${bucket.count > 0 ? 'has-data' : ''}`}>
                    <span className="aging-label">{bucket.label}</span>
                    <span className="aging-count">{bucket.count} students</span>
                    <span className="aging-amount">{formatMoney(bucket.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="proprietor-action-row">
            <button className="proprietor-drill-btn danger" onClick={() => setShowDebtors(!showDebtors)}>
              <AlertCircle size={16} /> {showDebtors ? 'Hide' : 'View'} Top Debtors
            </button>
            <button className="proprietor-drill-btn" onClick={() => setShowPayments(!showPayments)}>
              <Activity size={16} /> {showPayments ? 'Hide' : 'View'} Recent Payments
            </button>
          </div>

          {/* Top Debtors Table */}
          {showDebtors && data.top_debtors && data.top_debtors.length > 0 && (
            <div className="proprietor-table-card danger-card">
              <h3>Top Debtors</h3>
              <table className="proprietor-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Fees Owed</th>
                    <th>Outstanding</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_debtors.map((debtor, idx) => (
                    <tr key={debtor.student_id}>
                      <td>{idx + 1}</td>
                      <td>{debtor.student_name}</td>
                      <td>{debtor.class_name}</td>
                      <td>{debtor.fees_count}</td>
                      <td className="failed">{formatMoney(debtor.total_outstanding)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent Payments Table */}
          {showPayments && data.recent_payments && data.recent_payments.length > 0 && (
            <div className="proprietor-table-card">
              <h3>Recent Payments</h3>
              <table className="proprietor-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Student</th>
                    <th>Fee</th>
                    <th>Amount</th>
                    <th>Method</th>
                  </tr>
                </thead>
                <tbody>
                  {data.recent_payments.map((payment, idx) => (
                    <tr key={idx}>
                      <td>{new Date(payment.date).toLocaleDateString()}</td>
                      <td>{payment.student_name}</td>
                      <td>{payment.fee_name}</td>
                      <td className="passed">{formatMoney(payment.amount)}</td>
                      <td>{payment.payment_method}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Fee Type Breakdown Table */}
          {data.fee_type_breakdown && data.fee_type_breakdown.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Fee Type Breakdown</h3>
              <div className="performance-table-container">
                <table className="proprietor-table">
                  <thead>
                    <tr>
                      <th>Fee Type</th>
                      <th>Students</th>
                      <th>Expected</th>
                      <th>Collected</th>
                      <th>Outstanding</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.fee_type_breakdown.map((fee, idx) => (
                      <tr key={idx}>
                        <td>{fee.fee_name}</td>
                        <td>{fee.student_count}</td>
                        <td>{formatMoney(fee.expected)}</td>
                        <td className="passed">{formatMoney(fee.collected)}</td>
                        <td className="failed">{formatMoney(fee.outstanding)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="proprietor-empty-state">
          <DollarSign size={48} />
          <p>No revenue data available for the selected term.</p>
        </div>
      )}
    </div>
  );
}

/* ========== Attendance Tab ========== */
function AttendanceTab() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState('');
  const [compareSession, setCompareSession] = useState('');
  const [compareTerm, setCompareTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showAbsentees, setShowAbsentees] = useState(false);
  const [showTopAttendees, setShowTopAttendees] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setCurrentSession(d.current_session || '');
        setCurrentTerm(d.current_term || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/attendance-details/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  if (loading) return <LoadingSpinner />;

  const overview = data?.overview;
  const comparison = data?.comparison;

  const ATTENDANCE_COLORS = {
    excellent: '#10b981',
    good: '#3b82f6',
    atRisk: '#f59e0b',
    chronic: '#ef4444',
  };

  return (
    <div className="proprietor-tab-content">
      <div className="proprietor-filters">
        <SessionSelector
          label="Current"
          session={currentSession} term={currentTerm}
          onSessionChange={setCurrentSession} onTermChange={setCurrentTerm}
          sessions={sessions}
        />
        <SessionSelector
          label="Compare with"
          session={compareSession} term={compareTerm}
          onSessionChange={setCompareSession} onTermChange={setCompareTerm}
          sessions={sessions}
        />
      </div>

      {overview && overview.total_students > 0 ? (
        <>
          {/* Overview Stats */}
          <div className="proprietor-stat-cards">
            <StatCardWithDelta label="Average Rate" value={`${overview.average_rate}%`} rawValue={overview.average_rate} prevValue={comparison?.average_rate} color="#3b82f6" suffix="%" />
            <StatCardWithDelta label="Total Students" value={overview.total_students} prevValue={comparison?.total_students} color="#10b981" />
            <StatCardWithDelta label="Excellent (90%+)" value={overview.excellent_count} prevValue={comparison?.excellent_count} color="#10b981" />
            <StatCardWithDelta label="Chronic Absent" value={overview.chronic_absent_count} prevValue={comparison?.chronic_absent_count} color="#ef4444" invertDelta />
          </div>

          {/* Attendance Status Breakdown */}
          <div className="attendance-status-cards">
            <div className="attendance-status-card excellent">
              <span className="status-icon"><CheckCircle2 size={20} /></span>
              <span className="status-count">{overview.excellent_count}</span>
              <span className="status-label">Excellent (90%+)</span>
            </div>
            <div className="attendance-status-card good">
              <span className="status-icon"><CheckCircle2 size={20} /></span>
              <span className="status-count">{overview.good_count}</span>
              <span className="status-label">Good (75-89%)</span>
            </div>
            <div className="attendance-status-card at-risk">
              <span className="status-icon"><AlertCircle size={20} /></span>
              <span className="status-count">{overview.at_risk_count}</span>
              <span className="status-label">At Risk (50-74%)</span>
            </div>
            <div className="attendance-status-card chronic">
              <span className="status-icon"><UserX size={20} /></span>
              <span className="status-count">{overview.chronic_absent_count}</span>
              <span className="status-label">Chronic (&lt;50%)</span>
            </div>
          </div>

          {/* Charts Row */}
          <div className="proprietor-charts-row">
            {/* Daily Pattern */}
            {data.daily_pattern && data.daily_pattern.length > 0 && (
              <div className="proprietor-chart-card">
                <h3>Daily Attendance Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.daily_pattern}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={(d) => d.slice(5)} />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                    <Line type="monotone" dataKey="rate" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Weekly Pattern */}
            {data.weekly_pattern && data.weekly_pattern.length > 0 && (
              <div className="proprietor-chart-card">
                <h3>Attendance by Day of Week</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={data.weekly_pattern}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="day" />
                    <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(v) => [`${v}%`, 'Average Rate']} />
                    <Bar dataKey="rate" fill="#3b82f6" radius={[4, 4, 0, 0]}>
                      {data.weekly_pattern.map((entry, index) => (
                        <Cell key={index} fill={entry.rate >= 90 ? '#10b981' : entry.rate >= 75 ? '#3b82f6' : entry.rate >= 50 ? '#f59e0b' : '#ef4444'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Attendance Trend */}
          {data.attendance_trend && data.attendance_trend.length > 1 && (
            <div className="proprietor-chart-card">
              <h3><TrendingUp size={18} /> Attendance Trend Over Terms</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.attendance_trend}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="label" />
                  <YAxis domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Attendance Rate']} />
                  <Line type="monotone" dataKey="rate" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Attendance by Class */}
          {data.attendance_by_class && data.attendance_by_class.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Attendance by Class (Ranked)</h3>
              <div className="performance-table-container">
                <table className="proprietor-table">
                  <thead>
                    <tr>
                      <th>Rank</th>
                      <th>Class</th>
                      <th>Students</th>
                      <th>Attendance Rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.attendance_by_class.map((cls, idx) => (
                      <tr key={idx}>
                        <td><span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span></td>
                        <td>{cls.class_name}</td>
                        <td>{cls.student_count}</td>
                        <td>
                          <span className={`rate-badge ${cls.attendance_rate >= 90 ? 'good' : cls.attendance_rate >= 75 ? 'warning' : 'danger'}`}>
                            {cls.attendance_rate}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="proprietor-action-row">
            <button className="proprietor-drill-btn danger" onClick={() => setShowAbsentees(!showAbsentees)}>
              <UserX size={16} /> {showAbsentees ? 'Hide' : 'View'} Chronic Absentees
            </button>
            <button className="proprietor-drill-btn" onClick={() => setShowTopAttendees(!showTopAttendees)}>
              <Trophy size={16} /> {showTopAttendees ? 'Hide' : 'View'} Top Attendees
            </button>
          </div>

          {/* Chronic Absentees Table */}
          {showAbsentees && data.chronic_absentees && data.chronic_absentees.length > 0 && (
            <div className="proprietor-table-card danger-card">
              <h3>Chronic Absentees (Below 50%)</h3>
              <table className="proprietor-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Present</th>
                    <th>Total Days</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.chronic_absentees.map((s, idx) => (
                    <tr key={s.student_id}>
                      <td>{idx + 1}</td>
                      <td>{s.name}</td>
                      <td>{s.class_name}</td>
                      <td>{s.present_days}</td>
                      <td>{s.total_days}</td>
                      <td className="failed">{s.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Top Attendees Table */}
          {showTopAttendees && data.top_attendees && data.top_attendees.length > 0 && (
            <div className="proprietor-table-card">
              <h3><Trophy size={18} /> Top Attendees</h3>
              <table className="proprietor-table">
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>Student</th>
                    <th>Class</th>
                    <th>Present</th>
                    <th>Total Days</th>
                    <th>Rate</th>
                  </tr>
                </thead>
                <tbody>
                  {data.top_attendees.map((s, idx) => (
                    <tr key={s.student_id} className={idx < 3 ? 'top-rank' : ''}>
                      <td><span className={`rank-badge rank-${idx + 1}`}>{idx + 1}</span></td>
                      <td>{s.name}</td>
                      <td>{s.class_name}</td>
                      <td>{s.present_days}</td>
                      <td>{s.total_days}</td>
                      <td className="passed">{s.rate}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <div className="proprietor-empty-state">
          <CalendarDays size={48} />
          <p>No attendance data available for the selected term.</p>
        </div>
      )}
    </div>
  );
}

/* ========== Staff Tab ========== */
function StaffTab() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState('');
  const [compareSession, setCompareSession] = useState('');
  const [compareTerm, setCompareTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showWorkload, setShowWorkload] = useState(false);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setCurrentSession(d.current_session || '');
        setCurrentTerm(d.current_term || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/staff-enrollment/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  if (loading) return <LoadingSpinner />;

  const staff = data?.staff_overview;
  const comparison = data?.comparison;

  const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899' };

  return (
    <div className="proprietor-tab-content">
      <div className="proprietor-filters">
        <SessionSelector
          label="Current"
          session={currentSession} term={currentTerm}
          onSessionChange={setCurrentSession} onTermChange={setCurrentTerm}
          sessions={sessions}
        />
        <SessionSelector
          label="Compare with"
          session={compareSession} term={compareTerm}
          onSessionChange={setCompareSession} onTermChange={setCompareTerm}
          sessions={sessions}
        />
      </div>

      {staff && (
        <>
          {/* Staff Stats */}
          <div className="proprietor-stat-cards">
            <StatCardWithDelta label="Total Teachers" value={staff.total_teachers} prevValue={comparison?.total_teachers} color="#3b82f6" />
            <StatCardWithDelta label="Total Staff" value={staff.total_staff} color="#10b981" />
            <StatCardWithDelta label="Teacher:Student Ratio" value={`1:${data.teacher_student_ratio}`} rawValue={data.teacher_student_ratio} prevValue={comparison?.teacher_student_ratio} color="#f59e0b" invertDelta />
            <StatCardWithDelta label="Inactive Teachers" value={staff.inactive_teachers} prevValue={comparison?.inactive_teachers} color="#ef4444" invertDelta />
          </div>

          {/* Teacher Gender Distribution */}
          <div className="proprietor-charts-row">
            <div className="proprietor-chart-card">
              <h3>Teacher Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Male', value: staff.teacher_gender.male },
                      { name: 'Female', value: staff.teacher_gender.female },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={70}
                    dataKey="value"
                    label={({ name, value }) => `${name}: ${value}`}
                  >
                    <Cell fill={GENDER_COLORS.male} />
                    <Cell fill={GENDER_COLORS.female} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Staff Summary */}
            <div className="proprietor-chart-card">
              <h3>Staff Summary</h3>
              <div className="staff-summary-grid">
                <div className="staff-summary-item">
                  <span className="summary-icon teachers"><UserCheck size={24} /></span>
                  <span className="summary-count">{staff.total_teachers}</span>
                  <span className="summary-label">Teachers</span>
                </div>
                <div className="staff-summary-item">
                  <span className="summary-icon principals"><GraduationCap size={24} /></span>
                  <span className="summary-count">{staff.total_principals}</span>
                  <span className="summary-label">Principals</span>
                </div>
                <div className="staff-summary-item">
                  <span className="summary-icon admins"><Building2 size={24} /></span>
                  <span className="summary-count">{staff.total_admins}</span>
                  <span className="summary-label">Admins</span>
                </div>
              </div>
            </div>
          </div>

          {/* Issues Section */}
          {(data.teachers_without_subjects?.length > 0 || data.subjects_without_teachers?.length > 0) && (
            <div className="staff-issues-section">
              {data.teachers_without_subjects?.length > 0 && (
                <div className="staff-issue-card warning">
                  <h4><AlertCircle size={16} /> Teachers Without Subjects ({data.teachers_without_subjects.length})</h4>
                  <ul>
                    {data.teachers_without_subjects.slice(0, 5).map(t => (
                      <li key={t.teacher_id}>{t.teacher_name}</li>
                    ))}
                    {data.teachers_without_subjects.length > 5 && <li>...and {data.teachers_without_subjects.length - 5} more</li>}
                  </ul>
                </div>
              )}
              {data.subjects_without_teachers?.length > 0 && (
                <div className="staff-issue-card danger">
                  <h4><AlertCircle size={16} /> Subjects Without Teachers ({data.subjects_without_teachers.length})</h4>
                  <ul>
                    {data.subjects_without_teachers.slice(0, 5).map((s, idx) => (
                      <li key={idx}>{s.subject_name} ({s.class_name})</li>
                    ))}
                    {data.subjects_without_teachers.length > 5 && <li>...and {data.subjects_without_teachers.length - 5} more</li>}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Teacher Workload Button */}
          <div className="proprietor-action-row">
            <button className="proprietor-drill-btn" onClick={() => setShowWorkload(!showWorkload)}>
              <Briefcase size={16} /> {showWorkload ? 'Hide' : 'View'} Teacher Workload
            </button>
          </div>

          {/* Teacher Workload Table */}
          {showWorkload && data.teacher_workload && data.teacher_workload.length > 0 && (
            <div className="proprietor-table-card">
              <h3>Teacher Workload Distribution</h3>
              <table className="proprietor-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>Teacher</th>
                    <th>Subjects</th>
                    <th>Classes</th>
                    <th>Students</th>
                  </tr>
                </thead>
                <tbody>
                  {data.teacher_workload.map((t, idx) => (
                    <tr key={t.teacher_id}>
                      <td>{idx + 1}</td>
                      <td>{t.teacher_name}</td>
                      <td>{t.subjects_count}</td>
                      <td>{t.classes_count}</td>
                      <td>{t.students_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ========== Enrollment Tab ========== */
function EnrollmentTab() {
  const [sessions, setSessions] = useState([]);
  const [currentSession, setCurrentSession] = useState('');
  const [currentTerm, setCurrentTerm] = useState('');
  const [compareSession, setCompareSession] = useState('');
  const [compareTerm, setCompareTerm] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        const res = await fetch(buildApiUrl('proprietor/sessions/'), {
          headers: { Authorization: `Bearer ${token}` },
        });
        const d = await res.json();
        setSessions(d.sessions || []);
        setCurrentSession(d.current_session || '');
        setCurrentTerm(d.current_term || '');
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!currentSession || !currentTerm) return;
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('accessToken');
        let url = `proprietor/staff-enrollment/?session=${encodeURIComponent(currentSession)}&term=${encodeURIComponent(currentTerm)}`;
        if (compareSession && compareTerm) {
          url += `&compare_session=${encodeURIComponent(compareSession)}&compare_term=${encodeURIComponent(compareTerm)}`;
        }
        const res = await fetch(buildApiUrl(url), { headers: { Authorization: `Bearer ${token}` } });
        setData(await res.json());
      } catch (e) {
        console.error(e);
      }
    };
    fetchData();
  }, [currentSession, currentTerm, compareSession, compareTerm]);

  if (loading) return <LoadingSpinner />;

  const enrollment = data?.enrollment_overview;
  const comparison = data?.comparison;

  const GENDER_COLORS = { male: '#3b82f6', female: '#ec4899', unspecified: '#94a3b8' };

  return (
    <div className="proprietor-tab-content">
      <div className="proprietor-filters">
        <SessionSelector
          label="Current"
          session={currentSession} term={currentTerm}
          onSessionChange={setCurrentSession} onTermChange={setCurrentTerm}
          sessions={sessions}
        />
        <SessionSelector
          label="Compare with"
          session={compareSession} term={compareTerm}
          onSessionChange={setCompareSession} onTermChange={setCompareTerm}
          sessions={sessions}
        />
      </div>

      {enrollment && (
        <>
          {/* Enrollment Stats */}
          <div className="proprietor-stat-cards">
            <StatCardWithDelta label="Total Students" value={enrollment.total_students} prevValue={comparison?.total_students} color="#3b82f6" />
            <StatCardWithDelta label="Male" value={enrollment.student_gender.male} prevValue={comparison?.student_gender?.male} color="#0ea5e9" />
            <StatCardWithDelta label="Female" value={enrollment.student_gender.female} prevValue={comparison?.student_gender?.female} color="#ec4899" />
            <StatCardWithDelta label="Without Class" value={enrollment.students_no_class} prevValue={comparison?.students_no_class} color="#ef4444" invertDelta />
          </div>

          {/* Charts Row */}
          <div className="proprietor-charts-row">
            {/* Gender Distribution */}
            <div className="proprietor-chart-card">
              <h3>Student Gender Distribution</h3>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={[
                      { name: 'Male', value: enrollment.student_gender.male },
                      { name: 'Female', value: enrollment.student_gender.female },
                      { name: 'Unspecified', value: enrollment.student_gender.unspecified },
                    ].filter(d => d.value > 0)}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    <Cell fill={GENDER_COLORS.male} />
                    <Cell fill={GENDER_COLORS.female} />
                    <Cell fill={GENDER_COLORS.unspecified} />
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Enrollment Trend */}
            {data.enrollment_trend && data.enrollment_trend.length > 1 && (
              <div className="proprietor-chart-card">
                <h3>Enrollment Trend</h3>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={data.enrollment_trend}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="label" />
                    <YAxis />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#3b82f6" strokeWidth={2} dot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>

          {/* Students by Class */}
          {data.students_by_class && data.students_by_class.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Students by Class</h3>
              <ResponsiveContainer width="100%" height={Math.max(300, data.students_by_class.length * 35)}>
                <BarChart
                  data={data.students_by_class}
                  layout="vertical"
                  margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
                >
                  <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="class_name" tick={{ fontSize: 11 }} width={70} />
                  <Tooltip />
                  <Bar dataKey="student_count" name="Students" fill="#3b82f6" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Students by Department */}
          {data.students_by_department && data.students_by_department.length > 0 && (
            <div className="proprietor-chart-card">
              <h3>Students by Department</h3>
              <div className="department-comparison">
                {data.students_by_department.map((dept, idx) => (
                  <div key={idx} className="department-card">
                    <h4>{dept.department}</h4>
                    <div className="department-stats">
                      <div className="dept-stat highlight">
                        <span className="dept-stat-value">{dept.student_count}</span>
                        <span className="dept-stat-label">Students</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ========== Announcements Tab ========== */
function AnnouncementsTab() {
  return <Announcements />;
}

/* ========== Shared Components ========== */
function DeltaBadge({ value, suffix = '', invert = false }) {
  if (value === null || value === undefined || value === 0) return null;
  const isPositive = invert ? value < 0 : value > 0;
  const isNegative = invert ? value > 0 : value < 0;
  return (
    <span className={`delta-badge ${isPositive ? 'positive' : ''} ${isNegative ? 'negative' : ''}`}>
      {value > 0 ? '↑' : '↓'}{Math.abs(value).toFixed(1)}{suffix}
    </span>
  );
}

function StatCardWithDelta({ label, value, rawValue, prevValue, color, invertDelta, isMoney, suffix }) {
  const numValue = rawValue !== undefined ? rawValue : (typeof value === 'number' ? value : null);
  let deltaVal = null;
  let deltaText = '';
  if (numValue !== null && prevValue !== undefined && prevValue !== null) {
    deltaVal = numValue - prevValue;
    if (isMoney) {
      deltaText = `₦${Math.abs(deltaVal).toLocaleString()}`;
    } else if (suffix) {
      deltaText = `${Math.abs(deltaVal).toFixed(1)}${suffix}`;
    } else {
      deltaText = `${Math.abs(deltaVal)}`;
    }
  }

  const isPositive = invertDelta ? deltaVal < 0 : deltaVal > 0;
  const isNegative = invertDelta ? deltaVal > 0 : deltaVal < 0;

  return (
    <div className="proprietor-stat-card" style={{ borderLeftColor: color }}>
      <div className="stat-card-info">
        <span className="stat-card-value">{value}</span>
        <span className="stat-card-label">{label}</span>
        {deltaVal !== null && deltaVal !== 0 && (
          <span className={`stat-card-delta ${isPositive ? 'positive' : ''} ${isNegative ? 'negative' : ''}`}>
            {deltaVal > 0 ? '▲' : '▼'} {deltaText}
          </span>
        )}
      </div>
    </div>
  );
}

function LoadingSpinner() {
  return (
    <div className="proprietor-loading">
      <Loader2 size={32} className="spinning" />
      <p>Loading...</p>
    </div>
  );
}

function ErrorMessage({ message }) {
  return (
    <div className="proprietor-error">
      <AlertCircle size={24} />
      <p>{message}</p>
    </div>
  );
}

export default ProprietorDashboard;
