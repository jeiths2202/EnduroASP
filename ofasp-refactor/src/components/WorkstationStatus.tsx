import React, { useState, useEffect } from 'react';
import { 
  ComputerDesktopIcon, 
  SignalIcon, 
  SignalSlashIcon,
  UserIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import webSocketService from './websocketService';

interface WorkstationStatusProps {
  wsname?: string;
  user?: string;
  terminalId?: string;
  compact?: boolean;
}

const WorkstationStatus: React.FC<WorkstationStatusProps> = ({
  wsname,
  user,
  terminalId,
  compact = false
}) => {
  const [isConnected, setIsConnected] = useState(false);
  const [currentWsname, setCurrentWsname] = useState(wsname || webSocketService.getWorkstationName());
  const [currentUser, setCurrentUser] = useState(user || webSocketService.getUser());
  const [currentTerminalId, setCurrentTerminalId] = useState(terminalId || webSocketService.getTerminalId());
  const [lastActivity, setLastActivity] = useState<Date>(new Date());
  const [workstationStatus, setWorkstationStatus] = useState<'ON' | 'OFF' | 'UNKNOWN'>('UNKNOWN');

  useEffect(() => {
    // Update connection status
    const updateConnectionStatus = () => {
      setIsConnected(webSocketService.isConnected());
      setCurrentWsname(webSocketService.getWorkstationName());
      setCurrentUser(webSocketService.getUser());
      setCurrentTerminalId(webSocketService.getTerminalId());
      setLastActivity(new Date());
    };

    // Set up WebSocket event listeners
    const handleConnected = () => {
      updateConnectionStatus();
    };

    const handleDisconnected = () => {
      setIsConnected(false);
    };

    const handleTerminalRegistered = (data: any) => {
      updateConnectionStatus();
      setWorkstationStatus('ON');
    };

    const handleRegistrationError = (data: { error: string }) => {
      console.error('Workstation registration error:', data.error);
      setWorkstationStatus('OFF');
    };

    const handleWorkstationStatusChanged = (data: { wsname: string; status: string }) => {
      if (data.wsname === currentWsname) {
        setWorkstationStatus(data.status as 'ON' | 'OFF');
      }
    };

    const handleWorkstationDisabled = (data: { wsname: string }) => {
      if (data.wsname === currentWsname) {
        setWorkstationStatus('OFF');
      }
    };

    const handleSmedDisplay = () => {
      setLastActivity(new Date());
    };

    // Register event listeners
    webSocketService.on('connected', handleConnected);
    webSocketService.on('disconnected', handleDisconnected);
    webSocketService.on('terminal_registered', handleTerminalRegistered);
    webSocketService.on('registration_error', handleRegistrationError);
    webSocketService.on('workstation_status_changed', handleWorkstationStatusChanged);
    webSocketService.on('workstation_disabled', handleWorkstationDisabled);
    webSocketService.on('smed_display', handleSmedDisplay);

    // Initial status update
    updateConnectionStatus();

    // Cleanup
    return () => {
      webSocketService.off('connected', handleConnected);
      webSocketService.off('disconnected', handleDisconnected);
      webSocketService.off('terminal_registered', handleTerminalRegistered);
      webSocketService.off('registration_error', handleRegistrationError);
      webSocketService.off('workstation_status_changed', handleWorkstationStatusChanged);
      webSocketService.off('workstation_disabled', handleWorkstationDisabled);
      webSocketService.off('smed_display', handleSmedDisplay);
    };
  }, [currentWsname]);

  const getConnectionIcon = () => {
    if (isConnected && workstationStatus === 'ON') {
      return <SignalIcon className="h-4 w-4 text-green-500" />;
    } else {
      return <SignalSlashIcon className="h-4 w-4 text-red-500" />;
    }
  };

  const getStatusColor = () => {
    if (isConnected && workstationStatus === 'ON') {
      return 'text-green-600 bg-green-50 border-green-200';
    } else if (workstationStatus === 'OFF') {
      return 'text-red-600 bg-red-50 border-red-200';
    } else {
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  const getStatusText = () => {
    if (isConnected && workstationStatus === 'ON') {
      return 'Online';
    } else if (workstationStatus === 'OFF') {
      return 'Disabled';
    } else if (!isConnected) {
      return 'Disconnected';
    } else {
      return 'Connecting...';
    }
  };

  const formatLastActivity = () => {
    const now = new Date();
    const diff = now.getTime() - lastActivity.getTime();
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) {
      return 'Just now';
    } else if (minutes < 60) {
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(minutes / 60);
      return `${hours}h ago`;
    }
  };

  if (compact) {
    return (
      <div className={`inline-flex items-center space-x-2 px-2 py-1 rounded-md border text-xs ${getStatusColor()}`}>
        <ComputerDesktopIcon className="h-3 w-3" />
        <span className="font-medium">{currentWsname}</span>
        {getConnectionIcon()}
      </div>
    );
  }

  return (
    <div className={`flex items-center space-x-3 p-3 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-center space-x-2">
        <ComputerDesktopIcon className="h-5 w-5" />
        <div>
          <div className="font-medium text-sm">{currentWsname}</div>
          <div className="text-xs opacity-75">{getStatusText()}</div>
        </div>
      </div>

      <div className="flex items-center space-x-1">
        {getConnectionIcon()}
      </div>

      {currentUser && currentUser !== 'unknown' && (
        <div className="flex items-center space-x-1 text-xs">
          <UserIcon className="h-3 w-3" />
          <span>{currentUser}</span>
        </div>
      )}

      {currentTerminalId && currentTerminalId !== 'webui' && (
        <div className="text-xs opacity-75">
          Terminal: {currentTerminalId}
        </div>
      )}

      <div className="flex items-center space-x-1 text-xs opacity-75">
        <ClockIcon className="h-3 w-3" />
        <span>{formatLastActivity()}</span>
      </div>
    </div>
  );
};

export default WorkstationStatus;