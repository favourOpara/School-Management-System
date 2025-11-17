import React, { useState, useEffect } from 'react';
import DashboardFeesCard from './DashboardFeesCard';
import DashboardAttendanceCard from './DashboardAttendanceCard';
import DashboardTestsCard from './DashboardTestsCard';
import DashboardExamsCard from './DashboardExamsCard';
import DashboardReportAccessCard from './DashboardReportAccessCard';
import DashboardReportSentCard from './DashboardReportSentCard';
import DashboardSubjectGradingCard from './DashboardSubjectGradingCard';
import './Analytics.css';

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const Analytics = () => {
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const storedUserName = localStorage.getItem('userName') || 'Admin';
    setUserName(storedUserName);
  }, []);

  return (
    <div className="analytics-container">
      <h2 className="analytics-greeting">{getGreeting()}, {userName} 😊</h2>
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