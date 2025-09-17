import React, { useState, useEffect } from 'react';
import { 
  ComputerDesktopIcon, 
  PowerIcon, 
  SignalIcon, 
  CheckCircleIcon,
  XCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import webSocketService from './websocketService';

interface WorkstationStatusCardProps {
  wsname: string;
  showControls?: boolean;
  className?: string;
}

interface WorkstationStatus {
  wsname: string;
  status: 'ON' | 'OFF';
  connected: boolean;
  created_at: string;
  updated_at: string;
}

const WorkstationStatusCard: React.FC<WorkstationStatusCardProps> = ({
  wsname,
  showControls = true,
  className = ''
}) => {
  const [status, setStatus] = useState<WorkstationStatus | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string>('');
  const [loading, setLoading] = useState(true);

  // Fetch workstation status
  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await webSocketService.getWorkstationStatus(wsname);
      setStatus(response);
      setError('');
    } catch (err) {
      console.error('Error fetching workstation status:', err);
      setError('Failed to fetch status');
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  // Handle status toggle
  const handleToggle = async () => {
    if (!status || isToggling) return;

    const newStatus = status.status === 'ON' ? 'OFF' : 'ON';
    setIsToggling(true);
    setError('');

    try {
      await webSocketService.updateWorkstationStatus(wsname, newStatus);
      await fetchStatus();
    } catch (err) {
      console.error('Error toggling workstation status:', err);
      setError('Failed to toggle status');
    } finally {
      setIsToggling(false);
    }
  };

  // Listen for status changes
  useEffect(() => {
    const handleStatusChanged = (data: { wsname: string; status: string }) => {
      if (data.wsname === wsname) {
        fetchStatus();
      }
    };

    webSocketService.on('workstation_status_changed', handleStatusChanged);
    
    // Initial fetch
    fetchStatus();

    return () => {
      webSocketService.off('workstation_status_changed', handleStatusChanged);
    };
  }, [wsname]);

  const getStatusColor = () => {
    if (!status) return 'border-gray-300';
    if (status.status === 'ON' && status.connected) return 'border-green-500 bg-green-50';
    if (status.status === 'ON') return 'border-yellow-500 bg-yellow-50';
    return 'border-red-500 bg-red-50';
  };

  const getStatusIcon = () => {
    if (loading) {
      return <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>;
    }
    
    if (!status) {
      return <XCircleIcon className="h-6 w-6 text-gray-400" />;
    }

    if (status.status === 'ON' && status.connected) {
      return <CheckCircleIcon className="h-6 w-6 text-green-500" />;
    } else if (status.status === 'ON') {
      return <ExclamationTriangleIcon className="h-6 w-6 text-yellow-500" />;
    } else {
      return <XCircleIcon className="h-6 w-6 text-red-500" />;
    }
  };

  const getStatusText = () => {
    if (loading) return 'Loading...';
    if (error) return error;
    if (!status) return 'Not found';
    
    if (status.status === 'ON' && status.connected) {
      return 'Active & Connected';
    } else if (status.status === 'ON') {
      return 'Active (Disconnected)';
    } else {
      return 'Disabled';
    }
  };

  return (
    <div className={`bg-white rounded-lg border-2 ${getStatusColor()} p-4 ${className}`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-3">
          <ComputerDesktopIcon className="h-8 w-8 text-gray-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{wsname}</h3>
            <div className="flex items-center space-x-2">
              {getStatusIcon()}
              <span className={`text-sm font-medium ${
                status?.status === 'ON' && status?.connected ? 'text-green-700' :
                status?.status === 'ON' ? 'text-yellow-700' : 'text-red-700'
              }`}>
                {getStatusText()}
              </span>
            </div>
          </div>
        </div>
        
        {status?.connected && (
          <div className="flex items-center space-x-1 text-green-600">
            <SignalIcon className="h-4 w-4" />
            <span className="text-xs font-medium">LIVE</span>
          </div>
        )}
      </div>

      {status && (
        <div className="text-xs text-gray-500 mb-3">
          <div>Created: {new Date(status.created_at).toLocaleDateString()}</div>
          <div>Last Update: {new Date(status.updated_at).toLocaleString()}</div>
        </div>
      )}

      {showControls && status && (
        <div className="flex items-center justify-between">
          <button
            onClick={handleToggle}
            disabled={isToggling}
            className={`
              inline-flex items-center px-4 py-2 text-sm font-medium rounded-md
              focus:outline-none focus:ring-2 focus:ring-offset-2
              transition-colors disabled:opacity-50 disabled:cursor-not-allowed
              ${status.status === 'ON'
                ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
                : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
              }
            `}
          >
            {isToggling ? (
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-current mr-2"></div>
            ) : (
              <PowerIcon className="h-4 w-4 mr-2" />
            )}
            {status.status === 'ON' ? 'Disable' : 'Enable'}
          </button>

          {error && (
            <span className="text-xs text-red-600">{error}</span>
          )}
        </div>
      )}

      {!status && !loading && (
        <div className="text-center py-4">
          <p className="text-gray-500 text-sm">Workstation not found</p>
          <p className="text-gray-400 text-xs mt-1">
            Will be auto-registered when first accessed
          </p>
        </div>
      )}
    </div>
  );
};

export default WorkstationStatusCard;