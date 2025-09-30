import React from 'react';
import DashboardFeesCard from './DashboardFeesCard';
import DashboardAttendanceCard from './DashboardAttendanceCard';
import './Analytics.css';

const Analytics = () => (
  <div className="analytics-container">
    <div className="dashboard-cards-wrapper">
      <DashboardFeesCard />
      <DashboardAttendanceCard />
    </div>
  </div>
);

export default Analytics;