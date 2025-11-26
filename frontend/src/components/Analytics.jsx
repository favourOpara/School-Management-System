import React from 'react';
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