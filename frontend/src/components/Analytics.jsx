import React from 'react';
import { Bot, Sparkles } from 'lucide-react';
import DashboardFeesCard from './DashboardFeesCard';
import DashboardAttendanceCard from './DashboardAttendanceCard';
import DashboardTestsCard from './DashboardTestsCard';
import DashboardExamsCard from './DashboardExamsCard';
import DashboardReportAccessCard from './DashboardReportAccessCard';
import DashboardReportSentCard from './DashboardReportSentCard';
import DashboardSubjectGradingCard from './DashboardSubjectGradingCard';
import './Analytics.css';

const Analytics = () => {
  return (
    <div className="analytics-container">
      {/* Welcome Section */}
      <div className="analytics-welcome-section">
        <div className="welcome-content-wrapper">
          <div className="welcome-robot-icon">
            <Bot size={48} strokeWidth={1.5} />
            <Sparkles className="sparkle-icon sparkle-1" size={16} />
            <Sparkles className="sparkle-icon sparkle-2" size={14} />
            <Sparkles className="sparkle-icon sparkle-3" size={12} />
          </div>
          <div className="welcome-text-content">
            <h1 className="analytics-welcome-title">Welcome to Your Dashboard</h1>
            <p className="analytics-welcome-subtitle">
              Manage your school activities efficiently from one centralized platform.
              Monitor key metrics, track performance, and access essential tools below.
            </p>
          </div>
        </div>
      </div>

      <div className="dashboard-cards-grid">
      <div className="grid-item">
        <DashboardAttendanceCard />
      </div>
      <div className="grid-item">
        <DashboardFeesCard />
      </div>
      <div className="grid-item">
        <DashboardTestsCard />
      </div>
      <div className="grid-item">
        <DashboardExamsCard />
      </div>
      <div className="grid-item">
        <DashboardReportAccessCard />
      </div>
      <div className="grid-item">
        <DashboardReportSentCard />
      </div>
      <div className="grid-item grid-item-full-width">
        <DashboardSubjectGradingCard />
      </div>
    </div>
  </div>
  );
};

export default Analytics;