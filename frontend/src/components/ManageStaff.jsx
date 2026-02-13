import React, { useState } from 'react';
import { useSchool } from '../contexts/SchoolContext';
import { AlertCircle } from 'lucide-react';
import StaffScheduleGroups from './StaffScheduleGroups';
import StaffRecords from './StaffRecords';
import StaffSettings from './StaffSettings';
import './ManageStaff.css';

const ManageStaff = () => {
  const { hasFeature } = useSchool();
  const [activeSubTab, setActiveSubTab] = useState('schedule-groups');

  if (!hasFeature('staff_management')) {
    return (
      <div className="manage-staff-upgrade-prompt">
        <AlertCircle size={48} />
        <h3>Feature Not Available</h3>
        <p>
          Staff Management (Book On/Off) is available on Premium and Custom plans.
          Upgrade your subscription to access this feature.
        </p>
      </div>
    );
  }

  return (
    <div className="manage-staff-container">
      <h2>Manage Staff</h2>
      <div className="manage-staff-tabs">
        <button
          className={activeSubTab === 'schedule-groups' ? 'active' : ''}
          onClick={() => setActiveSubTab('schedule-groups')}
        >
          Schedule Groups
        </button>
        <button
          className={activeSubTab === 'records' ? 'active' : ''}
          onClick={() => setActiveSubTab('records')}
        >
          Staff Records
        </button>
        <button
          className={activeSubTab === 'settings' ? 'active' : ''}
          onClick={() => setActiveSubTab('settings')}
        >
          Settings
        </button>
      </div>
      <div className="manage-staff-content">
        {activeSubTab === 'schedule-groups' && <StaffScheduleGroups />}
        {activeSubTab === 'records' && <StaffRecords />}
        {activeSubTab === 'settings' && <StaffSettings />}
      </div>
    </div>
  );
};

export default ManageStaff;
