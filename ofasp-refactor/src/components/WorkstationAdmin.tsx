import React, { useState, useEffect } from 'react';
import {
  ComputerDesktopIcon,
  PlusIcon,
  PowerIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  XCircleIcon,
  SignalIcon,
  WifiIcon
} from '@heroicons/react/24/outline';
import webSocketService from './websocketService';
import WorkstationInput from './WorkstationInput';

interface Workstation {
  wsname: string;
  status: 'ON' | 'OFF';
  connected: boolean;
  created_at: string;
  updated_at: string;
}

const WorkstationAdmin: React.FC = () => {
  const [workstations, setWorkstations] = useState<Workstation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newWsname, setNewWsname] = useState('');
  const [isNewWsnameValid, setIsNewWsnameValid] = useState(false);
  const [processingActions, setProcessingActions] = useState<Set<string>>(new Set());

  // Fetch workstations from server
  const fetchWorkstations = async () => {
    try {
      setLoading(true);
      setError('');
      const response = await webSocketService.listWorkstations();
      setWorkstations(response.workstations || []);
    } catch (err) {
      setError('Failed to fetch workstations. Please check server connection.');
      console.error('Error fetching workstations:', err);
    } finally {
      setLoading(false);
    }
  };

  // Add new workstation
  const handleAddWorkstation = async () => {
    if (!isNewWsnameValid || !newWsname) return;

    try {
      setProcessingActions(prev => new Set(prev).add('add'));
      await webSocketService.registerWorkstation(newWsname, 'OFF');
      setNewWsname('');
      setShowAddForm(false);
      await fetchWorkstations();
    } catch (err) {
      setError('Failed to add workstation');
      console.error('Error adding workstation:', err);
    } finally {
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete('add');
        return next;
      });
    }
  };

  // Toggle workstation status
  const handleToggleStatus = async (wsname: string, currentStatus: 'ON' | 'OFF') => {
    const newStatus = currentStatus === 'ON' ? 'OFF' : 'ON';
    
    try {
      setProcessingActions(prev => new Set(prev).add(wsname));
      await webSocketService.updateWorkstationStatus(wsname, newStatus);
      await fetchWorkstations();
    } catch (err) {
      setError(`Failed to ${newStatus === 'ON' ? 'enable' : 'disable'} workstation ${wsname}`);
      console.error('Error toggling workstation status:', err);
    } finally {
      setProcessingActions(prev => {
        const next = new Set(prev);
        next.delete(wsname);
        return next;
      });
    }
  };

  // Handle workstation name input
  const handleWsnameChange = (wsname: string, isValid: boolean) => {
    setNewWsname(wsname);
    setIsNewWsnameValid(isValid);
  };

  // Set up real-time updates
  useEffect(() => {
    const handleWorkstationStatusChanged = () => {
      fetchWorkstations();
    };

    webSocketService.on('workstation_status_changed', handleWorkstationStatusChanged);

    return () => {
      webSocketService.off('workstation_status_changed', handleWorkstationStatusChanged);
    };
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchWorkstations();
  }, []);

  const getStatusBadge = (workstation: Workstation) => {
    if (workstation.status === 'ON' && workstation.connected) {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          <CheckCircleIcon className="w-3 h-3 mr-1" />
          Active
        </span>
      );
    } else if (workstation.status === 'ON') {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
          <ExclamationTriangleIcon className="w-3 h-3 mr-1" />
          Enabled
        </span>
      );
    } else {
      return (
        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          <XCircleIcon className="w-3 h-3 mr-1" />
          Disabled
        </span>
      );
    }
  };

  const getConnectionIcon = (workstation: Workstation) => {
    return workstation.connected ? (
      <SignalIcon className="h-4 w-4 text-green-500" title="Connected" />
    ) : (
      <WifiIcon className="h-4 w-4 text-gray-400 opacity-50" title="Not Connected" />
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2 text-gray-600">Loading workstations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-medium text-gray-900">Workstation Management</h2>
          <p className="text-sm text-gray-500">
            Manage workstation registration and status
          </p>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={fetchWorkstations}
            disabled={loading}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
          >
            <ArrowPathIcon className="h-4 w-4 mr-1" />
            Refresh
          </button>
          <button
            onClick={() => setShowAddForm(!showAddForm)}
            className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
          >
            <PlusIcon className="h-4 w-4 mr-1" />
            Add Workstation
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-red-50 p-4">
          <div className="flex">
            <ExclamationTriangleIcon className="h-5 w-5 text-red-400" />
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Error</h3>
              <div className="mt-2 text-sm text-red-700">{error}</div>
            </div>
          </div>
        </div>
      )}

      {showAddForm && (
        <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
          <h3 className="text-md font-medium text-gray-900 mb-4">Add New Workstation</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <WorkstationInput
              defaultWsname=""
              onWsnameChange={handleWsnameChange}
              showStatus={false}
            />
            <div className="flex items-end space-x-2">
              <button
                onClick={handleAddWorkstation}
                disabled={!isNewWsnameValid || processingActions.has('add')}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {processingActions.has('add') ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-1"></div>
                ) : (
                  <PlusIcon className="h-4 w-4 mr-1" />
                )}
                Add
              </button>
              <button
                onClick={() => {
                  setShowAddForm(false);
                  setNewWsname('');
                }}
                className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {workstations.length === 0 ? (
            <li className="px-6 py-8 text-center text-gray-500">
              <ComputerDesktopIcon className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-2 text-sm font-medium text-gray-900">No workstations</h3>
              <p className="mt-1 text-sm text-gray-500">
                Get started by adding a new workstation.
              </p>
            </li>
          ) : (
            workstations.map((workstation) => (
              <li key={workstation.wsname} className="px-6 py-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <ComputerDesktopIcon className="h-6 w-6 text-gray-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center space-x-2">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {workstation.wsname}
                        </p>
                        {getConnectionIcon(workstation)}
                      </div>
                      <div className="flex items-center space-x-4 text-xs text-gray-500">
                        <span>Created: {new Date(workstation.created_at).toLocaleDateString()}</span>
                        <span>Last Update: {new Date(workstation.updated_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    {getStatusBadge(workstation)}
                    <button
                      onClick={() => handleToggleStatus(workstation.wsname, workstation.status)}
                      disabled={processingActions.has(workstation.wsname)}
                      className={`inline-flex items-center px-3 py-1 border border-transparent text-xs font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed ${
                        workstation.status === 'ON'
                          ? 'text-red-700 bg-red-100 hover:bg-red-200 focus:ring-red-500'
                          : 'text-green-700 bg-green-100 hover:bg-green-200 focus:ring-green-500'
                      }`}
                    >
                      {processingActions.has(workstation.wsname) ? (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-current mr-1"></div>
                      ) : (
                        <PowerIcon className="h-3 w-3 mr-1" />
                      )}
                      {workstation.status === 'ON' ? 'Disable' : 'Enable'}
                    </button>
                  </div>
                </div>
              </li>
            ))
          )}
        </ul>
      </div>

      {workstations.length > 0 && (
        <div className="text-sm text-gray-500">
          Total workstations: {workstations.length} | 
          Active: {workstations.filter(w => w.status === 'ON').length} | 
          Connected: {workstations.filter(w => w.connected).length}
        </div>
      )}
    </div>
  );
};

export default WorkstationAdmin;