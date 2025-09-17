import React from 'react';
import MonitoringDashboard from '../components/MonitoringDashboard';

interface MonitoringPageProps {
  isDarkMode: boolean;
}

const MonitoringPage: React.FC<MonitoringPageProps> = ({ isDarkMode }) => {
  return (
    <div className="h-full">
      <MonitoringDashboard isDarkMode={isDarkMode} />
    </div>
  );
};

export default MonitoringPage;