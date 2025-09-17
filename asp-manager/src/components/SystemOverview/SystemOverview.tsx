import React from 'react';
import { 
  CpuChipIcon, 
  CircleStackIcon, 
  ServerIcon, 
  ClockIcon,
  ExclamationTriangleIcon 
} from '@heroicons/react/24/outline';

interface SystemData {
  system_info: {
    cpu_percent: number;
    memory_percent: number;
    disk_percent: number;
    process_count: number;
    uptime: string;
  };
  alerts?: Array<{
    type: string;
    message: string;
  }>;
}

interface SystemOverviewProps {
  systemData: SystemData | null;
  loading: boolean;
}

const SystemOverview: React.FC<SystemOverviewProps> = ({ systemData, loading }) => {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading system data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* System Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">CPU Usage</p>
              <p className="text-2xl font-semibold text-white">{systemData?.system_info.cpu_percent.toFixed(1)}%</p>
            </div>
            <CpuChipIcon className="w-8 h-8 text-blue-400" />
          </div>
          <div className="mt-4 bg-gray-700 rounded-full h-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${systemData?.system_info.cpu_percent}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Memory</p>
              <p className="text-2xl font-semibold text-white">{systemData?.system_info.memory_percent.toFixed(1)}%</p>
            </div>
            <CircleStackIcon className="w-8 h-8 text-green-400" />
          </div>
          <div className="mt-4 bg-gray-700 rounded-full h-2">
            <div 
              className="bg-green-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${systemData?.system_info.memory_percent}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Disk Usage</p>
              <p className="text-2xl font-semibold text-white">{systemData?.system_info.disk_percent.toFixed(1)}%</p>
            </div>
            <ServerIcon className="w-8 h-8 text-purple-400" />
          </div>
          <div className="mt-4 bg-gray-700 rounded-full h-2">
            <div 
              className="bg-purple-400 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${systemData?.system_info.disk_percent}%` }}
            />
          </div>
        </div>

        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-400 text-sm">Processes</p>
              <p className="text-2xl font-semibold text-white">{systemData?.system_info.process_count}</p>
            </div>
            <ClockIcon className="w-8 h-8 text-orange-400" />
          </div>
          <p className="text-sm text-gray-400 mt-2">Uptime: {systemData?.system_info.uptime}</p>
        </div>
      </div>

      {/* Alerts */}
      {systemData?.alerts && systemData.alerts.length > 0 && (
        <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
          <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-400" />
            System Alerts
          </h3>
          <div className="space-y-2">
            {systemData.alerts.map((alert, index) => (
              <div key={index} className={`p-3 rounded border-l-4 ${
                alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-400' : 'bg-blue-900/20 border-blue-400'
              }`}>
                <p className="text-white">{alert.message}</p>
                <p className="text-xs text-gray-400 mt-1">Type: {alert.type}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemOverview;