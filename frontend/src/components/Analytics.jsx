import React from 'react';
import DashboardFeesCard from './DashboardFeesCard';
import DashboardAttendanceCard from './DashboardAttendanceCard';
import DashboardTestsCard from './DashboardTestsCard';
import './Analytics.css';

const Analytics = () => (
  <div className="analytics-container">
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
    </div>
  </div>
);

export default Analytics;