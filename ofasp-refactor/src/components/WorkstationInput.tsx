import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { ComputerDesktopIcon, CheckCircleIcon, XCircleIcon, PowerIcon } from '@heroicons/react/24/outline';
import { WorkstationInputProps, WorkstationStatus } from '../types/workstation';

const WorkstationInput: React.FC<WorkstationInputProps> = ({
  defaultWsname = 'WSNAME00',
  onWsnameChange,
  disabled = false,
  showStatus = true,
  allowEnableDisable = false,
  onStatusToggle
}) => {
  const [wsname, setWsname] = useState(defaultWsname);
  const [status, setStatus] = useState<WorkstationStatus | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationError, setValidationError] = useState<string>('');
  const [isToggling, setIsToggling] = useState(false);
  const debounceTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Validate workstation name format
  const validateWsname = (name: string): boolean => {
    if (!name || typeof name !== 'string') return false;
    if (name.length > 8) return false;
    if (!/^[A-Za-z][A-Za-z0-9]*$/.test(name)) return false;
    return true;
  };

  // Check workstation status from server
  const checkWorkstationStatus = useCallback(async (wsnameToCheck: string) => {
    if (!validateWsname(wsnameToCheck)) {
      setValidationError('Invalid format: Must start with letter, max 8 alphanumeric chars');
      setStatus(null);
      return;
    }

    setIsValidating(true);
    setValidationError('');

    try {
      const response = await fetch(`http://localhost:8000/api/workstation/${wsnameToCheck}/status`);
      
      if (response.ok) {
        const statusData = await response.json();
        setStatus(statusData);
        
        // Remove validation error for disabled workstations in auth context
        // if (statusData.status === 'OFF' && !allowEnableDisable) {
        //   setValidationError('Workstation is currently disabled');
        // }
      } else if (response.status === 404) {
        // Workstation doesn't exist - this is okay, it will be auto-registered
        setStatus(null);
        setValidationError('');
      } else {
        const errorData = await response.json();
        setValidationError(errorData.error || 'Failed to check workstation status');
        setStatus(null);
      }
    } catch (error) {
      console.error('Error checking workstation status:', error);
      setValidationError('Network error - server may be unavailable');
      setStatus(null);
    } finally {
      setIsValidating(false);
    }
  }, [allowEnableDisable]);

  // Handle input change with proper debouncing
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const newWsname = e.target.value.toUpperCase();
    console.log('[WorkstationInput] Input changed:', newWsname);
    setWsname(newWsname);
    
    // Clear existing timeout
    if (debounceTimeoutRef.current) {
      clearTimeout(debounceTimeoutRef.current);
    }
    
    if (newWsname) {
      // Set new debounced validation
      debounceTimeoutRef.current = setTimeout(() => {
        checkWorkstationStatus(newWsname);
      }, 500);
    } else {
      setStatus(null);
      setValidationError('');
    }
  }, [checkWorkstationStatus]);

  // Handle status toggle
  const handleStatusToggle = useCallback(async () => {
    if (!status || !onStatusToggle || isToggling) return;
    
    const newStatus = status.status === 'ON' ? 'OFF' : 'ON';
    setIsToggling(true);
    
    try {
      await onStatusToggle(status.wsname, newStatus);
      // Re-check status after toggle
      await checkWorkstationStatus(wsname);
    } catch (error) {
      console.error('Error toggling status:', error);
      setValidationError('Failed to toggle workstation status');
    } finally {
      setIsToggling(false);
    }
  }, [status, onStatusToggle, wsname, checkWorkstationStatus]);

  // Effect to notify parent of validation changes
  useEffect(() => {
    const isValid = validateWsname(wsname) && 
                   !validationError;
    onWsnameChange(wsname, isValid);
  }, [wsname, validationError, onWsnameChange]);

  // Effect to check initial workstation status
  useEffect(() => {
    if (wsname) {
      checkWorkstationStatus(wsname);
    }
    
    // Cleanup timeout on unmount
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, [checkWorkstationStatus]);
  
  // Effect to handle wsname changes from props (only when component mounts)
  useEffect(() => {
    setWsname(defaultWsname);
  }, [defaultWsname]);

  const statusIcon = useMemo(() => {
    if (isValidating) {
      return (
        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600"></div>
      );
    }
    
    if (validationError) {
      return <XCircleIcon className="h-5 w-5 text-red-500" />;
    }
    
    if (status) {
      if (status.status === 'ON' && status.connected) {
        return <CheckCircleIcon className="h-5 w-5 text-green-500" />;
      } else if (status.status === 'ON') {
        return <CheckCircleIcon className="h-5 w-5 text-yellow-500" />;
      } else {
        return <XCircleIcon className="h-5 w-5 text-red-500" />;
      }
    }
    
    return <ComputerDesktopIcon className="h-5 w-5 text-gray-400" />;
  }, [isValidating, validationError, status]);

  const statusText = useMemo(() => {
    if (isValidating) return 'Checking...';
    if (validationError) return validationError;
    
    if (status) {
      if (status.status === 'ON' && status.connected) {
        return 'Active & Connected';
      } else if (status.status === 'ON') {
        return 'Active (Not Connected)';
      } else {
        return allowEnableDisable ? 'Disabled (Click to enable)' : 'Disabled';
      }
    }
    
    return 'New workstation (will be registered)';
  }, [isValidating, validationError, status, allowEnableDisable]);

  const statusColor = useMemo(() => {
    if (validationError) return 'text-red-600';
    if (status?.status === 'ON' && status?.connected) return 'text-green-600';
    if (status?.status === 'ON') return 'text-yellow-600';
    if (status?.status === 'OFF') return 'text-red-600';
    return 'text-gray-500';
  }, [validationError, status]);

  return (
    <div className="space-y-2">
      <label htmlFor="wsname" className="block text-sm font-medium text-gray-700">
        Workstation Name
      </label>
      
      <div className="relative">
        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
          <ComputerDesktopIcon className="h-5 w-5 text-gray-400" />
        </div>
        
        <input
          type="text"
          id="wsname"
          name="wsname"
          value={wsname}
          onChange={handleInputChange}
          disabled={disabled}
          placeholder="WSNAME00"
          maxLength={8}
          autoFocus
          className={`block w-full pl-10 pr-12 py-2 border rounded-md shadow-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm ${
            validationError 
              ? 'border-red-300 text-red-900 placeholder-red-300' 
              : 'border-gray-300 text-gray-900 placeholder-gray-500'
          } ${disabled ? 'bg-gray-100 cursor-not-allowed' : 'bg-white'}`}
        />
        
        <div className="absolute inset-y-0 right-0 pr-3 flex items-center">
          {statusIcon}
        </div>
      </div>
      
      {showStatus && (
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`text-xs ${statusColor}`}>
              {statusText}
            </div>
            
            {status && (
              <div className="text-xs text-gray-400">
                Last updated: {new Date(status.updated_at).toLocaleString()}
              </div>
            )}
          </div>
          
          {allowEnableDisable && status && onStatusToggle && (
            <button
              onClick={handleStatusToggle}
              disabled={isToggling}
              className={`inline-flex items-center px-2 py-1 text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-1 transition-colors ${
                status.status === 'ON'
                  ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
                  : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isToggling ? (
                <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current"></div>
              ) : (
                <>
                  <PowerIcon className="h-3 w-3 mr-1" />
                  {status.status === 'ON' ? 'Disable' : 'Enable'}
                </>
              )}
            </button>
          )}
        </div>
      )}
      
      <div className="text-xs text-gray-500">
        Format: Start with letter, max 8 alphanumeric characters
      </div>
    </div>
  );
};

export default React.memo(WorkstationInput);