import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { PowerIcon, ComputerDesktopIcon } from '@heroicons/react/24/outline';
import webSocketService from './websocketService';
import { WorkstationQuickToggleProps, WorkstationStatus } from '../types/workstation';

const WorkstationQuickToggle: React.FC<WorkstationQuickToggleProps> = ({
  wsname,
  showLabel = true,
  size = 'md',
  onStatusChange
}) => {
  const [status, setStatus] = useState<WorkstationStatus | null>(null);
  const [isToggling, setIsToggling] = useState(false);
  const [error, setError] = useState<string>('');

  // Size configurations
  const sizeClasses = {
    sm: {
      button: 'px-2 py-1 text-xs',
      icon: 'h-3 w-3',
      spinner: 'h-3 w-3'
    },
    md: {
      button: 'px-3 py-1.5 text-sm',
      icon: 'h-4 w-4',
      spinner: 'h-4 w-4'
    },
    lg: {
      button: 'px-4 py-2 text-base',
      icon: 'h-5 w-5',
      spinner: 'h-5 w-5'
    }
  };

  // Memoize size configuration and status calculations at the top level
  const currentSize = useMemo(() => sizeClasses[size], [size]);
  
  const { isOn, isConnected } = useMemo(() => ({
    isOn: status?.status === 'ON',
    isConnected: status?.connected || false
  }), [status]);

  // Fetch workstation status
  const fetchStatus = useCallback(async () => {
    try {
      const response = await webSocketService.getWorkstationStatus(wsname);
      setStatus(response);
      setError('');
    } catch (err) {
      console.error('Error fetching workstation status:', err);
      setError('Failed to fetch status');
    }
  }, [wsname]);

  // Handle status toggle
  const handleToggle = useCallback(async () => {
    if (!status || isToggling) return;

    const newStatus = status.status === 'ON' ? 'OFF' : 'ON';
    setIsToggling(true);
    setError('');

    try {
      await webSocketService.updateWorkstationStatus(wsname, newStatus);
      await fetchStatus();
      
      if (onStatusChange) {
        onStatusChange(wsname, newStatus);
      }
    } catch (err) {
      console.error('Error toggling workstation status:', err);
      setError('Failed to toggle status');
    } finally {
      setIsToggling(false);
    }
  }, [status, isToggling, wsname, onStatusChange, fetchStatus]);

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
  }, [wsname, fetchStatus]);

  if (!status) {
    return (
      <div className={`inline-flex items-center ${currentSize.button} text-gray-500`}>
        <div className={`animate-spin rounded-full ${currentSize.spinner} border-b-2 border-gray-500`}></div>
        {showLabel && <span className="ml-2">Loading...</span>}
      </div>
    );
  }

  return (
    <div className="inline-flex items-center space-x-2">
      <button
        onClick={handleToggle}
        disabled={isToggling}
        className={`
          inline-flex items-center font-medium rounded-md
          focus:outline-none focus:ring-2 focus:ring-offset-1
          transition-colors disabled:opacity-50 disabled:cursor-not-allowed
          ${currentSize.button}
          ${isOn 
            ? 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500' 
            : 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
          }
        `}
        title={`${wsname}: ${isOn ? 'ON' : 'OFF'}${isConnected ? ' (Connected)' : ''}`}
      >
        {isToggling ? (
          <div className={`animate-spin rounded-full ${currentSize.spinner} border-b-2 border-current`}></div>
        ) : (
          <>
            <PowerIcon className={currentSize.icon} />
            {showLabel && (
              <span className="ml-1.5">
                {isOn ? 'ON' : 'OFF'}
              </span>
            )}
          </>
        )}
      </button>

      {isConnected && (
        <span className="inline-flex items-center" title="Connected">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
        </span>
      )}

      {error && (
        <span className="text-xs text-red-600">{error}</span>
      )}
    </div>
  );
};

export default React.memo(WorkstationQuickToggle);