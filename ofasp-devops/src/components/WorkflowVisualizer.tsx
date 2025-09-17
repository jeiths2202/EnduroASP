import React, { useState, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';
// Real-time workflow data fetching
const fetchWorkflowData = async () => {
  const response = await fetch('/api/workflow-data');
  if (!response.ok) {
    throw new Error('Failed to fetch workflow data');
  }
  return response.json();
};

interface Job {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  needs: string[];
  steps: Step[];
  startTime?: string;
  endTime?: string;
  duration?: number;
}

interface Step {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed' | 'skipped';
  startTime?: string;
  endTime?: string;
  logs?: string[];
}

interface WorkflowRun {
  id: string;
  name: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  jobs: Job[];
  trigger: string;
  startTime: string;
  endTime?: string;
}

const WorkflowVisualizer: React.FC = () => {
  const { t } = useI18n();
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [selectedRun, setSelectedRun] = useState<string | null>(null);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<string>('');

  // Sample ABEND auto-fix workflow data
  const sampleWorkflow: WorkflowRun = {
    id: 'abend-autofix-001',
    name: 'ABEND Auto-Fix Pipeline',
    status: 'completed',
    trigger: 'ABEND CEE3204S detected',
    startTime: '2025-08-22T06:50:44Z',
    endTime: '2025-08-22T06:50:46Z',
    jobs: [
      {
        id: 'detect-and-analyze',
        name: '🔍 Detect and Analyze ABEND',
        status: 'completed',
        needs: [],
        startTime: '2025-08-22T06:50:44Z',
        endTime: '2025-08-22T06:50:45Z',
        duration: 1000,
        steps: [
          { id: 'checkout', name: 'Checkout Code', status: 'completed' },
          { id: 'setup-python', name: 'Setup Python', status: 'completed' },
          { id: 'analyze', name: 'Analyze ABEND Logs', status: 'completed' },
          { id: 'backup', name: 'Create Backup', status: 'completed' }
        ]
      },
      {
        id: 'auto-fix',
        name: '🔧 Auto-Fix ABEND',
        status: 'completed',
        needs: ['detect-and-analyze'],
        startTime: '2025-08-22T06:50:45Z',
        endTime: '2025-08-22T06:50:46Z',
        duration: 1000,
        steps: [
          { id: 'apply-fix', name: 'Apply F3 Key Fix', status: 'completed' },
          { id: 'setup-java', name: 'Setup Java', status: 'completed' },
          { id: 'compile', name: 'Compile Fixed Code', status: 'completed' },
          { id: 'test', name: 'Test Fixed Code', status: 'completed' }
        ]
      },
      {
        id: 'deploy',
        name: '🚀 Deploy Fixed Code',
        status: 'completed',
        needs: ['auto-fix'],
        startTime: '2025-08-22T06:50:46Z',
        endTime: '2025-08-22T06:50:46Z',
        duration: 500,
        steps: [
          { id: 'deploy', name: 'Deploy to Production', status: 'completed' },
          { id: 'restart', name: 'Restart Services', status: 'completed' },
          { id: 'verify', name: 'Verify Fix Deployment', status: 'completed' }
        ]
      },
      {
        id: 'notify',
        name: '📢 Notify Fix Completion',
        status: 'completed',
        needs: ['detect-and-analyze', 'auto-fix', 'deploy'],
        startTime: '2025-08-22T06:50:46Z',
        endTime: '2025-08-22T06:50:46Z',
        duration: 200,
        steps: [
          { id: 'log-results', name: 'Log Fix Results', status: 'completed' },
          { id: 'update-monitoring', name: 'Update Monitoring', status: 'completed' }
        ]
      }
    ]
  };

  // Load real-time workflow data
  const loadWorkflowData = async () => {
    try {
      setIsLoading(true);
      const workflows = await fetchWorkflowData();
      setWorkflowRuns(workflows);
      if (workflows.length > 0) {
        setSelectedRun(workflows[0].id);
      }
      setLastUpdate(new Date().toLocaleTimeString());
    } catch (error) {
      console.error('Failed to load workflow data:', error);
      // Fallback to sample data
      setWorkflowRuns([sampleWorkflow]);
      setSelectedRun(sampleWorkflow.id);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial load
    loadWorkflowData();
    
    // Set up periodic refresh every 10 seconds
    const interval = setInterval(loadWorkflowData, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-green-500';
      case 'in_progress': return 'bg-blue-500 animate-pulse';
      case 'failed': return 'bg-red-500';
      case 'pending': return 'bg-gray-400';
      case 'skipped': return 'bg-yellow-500';
      default: return 'bg-gray-300';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'in_progress': return '🔄';
      case 'failed': return '❌';
      case 'pending': return '⏳';
      case 'skipped': return '⏭️';
      default: return '❓';
    }
  };

  const calculateJobPosition = (job: Job, allJobs: Job[]) => {
    const levels: string[][] = [[]];
    const visited = new Set<string>();
    
    const addToLevel = (jobId: string, level: number) => {
      if (visited.has(jobId)) return;
      visited.add(jobId);
      
      if (!levels[level]) levels[level] = [];
      levels[level].push(jobId);
      
      const currentJob = allJobs.find(j => j.id === jobId);
      if (currentJob) {
        const dependents = allJobs.filter(j => j.needs.includes(jobId));
        dependents.forEach(dep => addToLevel(dep.id, level + 1));
      }
    };
    
    // Start with jobs that have no dependencies
    allJobs.filter(j => j.needs.length === 0).forEach(j => addToLevel(j.id, 0));
    
    // Find job's level
    const level = levels.findIndex(levelJobs => levelJobs.includes(job.id));
    const positionInLevel = levels[level]?.indexOf(job.id) || 0;
    
    return { level, positionInLevel, totalLevels: levels.length };
  };

  const renderJobGraph = (workflow: WorkflowRun) => {
    return (
      <div className="relative p-8 bg-gray-50 rounded-lg overflow-auto">
        <h3 className="text-lg font-semibold mb-4">Job Dependency Graph</h3>
        
        <div className="relative" style={{ minHeight: '400px', minWidth: '800px' }}>
          {workflow.jobs.map((job) => {
            const { level, positionInLevel } = calculateJobPosition(job, workflow.jobs);
            const x = level * 200 + 100;
            const y = positionInLevel * 120 + 50;
            
            return (
              <div key={job.id}>
                {/* Job Node */}
                <div
                  className={`absolute w-40 h-20 rounded-lg border-2 border-gray-300 bg-white shadow-lg cursor-pointer hover:shadow-xl transition-all ${
                    selectedJob === job.id ? 'border-blue-500 ring-2 ring-blue-200' : ''
                  }`}
                  style={{ left: x, top: y }}
                  onClick={() => setSelectedJob(selectedJob === job.id ? null : job.id)}
                >
                  <div className="p-2 h-full flex flex-col justify-center">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`w-3 h-3 rounded-full ${getStatusColor(job.status)}`}></span>
                      <span className="text-xs text-gray-500">
                        {job.duration ? `${job.duration}ms` : ''}
                      </span>
                    </div>
                    <div className="text-sm font-medium text-center leading-tight">
                      {job.name}
                    </div>
                    <div className="text-xs text-gray-500 text-center mt-1">
                      {getStatusIcon(job.status)} {job.status}
                    </div>
                  </div>
                </div>
                
                {/* Dependencies Arrows */}
                {job.needs.map((needsJobId) => {
                  const needsJob = workflow.jobs.find(j => j.id === needsJobId);
                  if (!needsJob) return null;
                  
                  const needsPos = calculateJobPosition(needsJob, workflow.jobs);
                  const fromX = needsPos.level * 200 + 240; // End of needs job
                  const fromY = needsPos.positionInLevel * 120 + 100; // Center of needs job
                  const toX = x; // Start of current job
                  const toY = y + 40; // Center of current job
                  
                  return (
                    <svg
                      key={`${needsJobId}-${job.id}`}
                      className="absolute pointer-events-none"
                      style={{ left: 0, top: 0, width: '100%', height: '100%' }}
                    >
                      <defs>
                        <marker
                          id={`arrowhead-${needsJobId}-${job.id}`}
                          markerWidth="10"
                          markerHeight="7"
                          refX="9"
                          refY="3.5"
                          orient="auto"
                        >
                          <polygon
                            points="0 0, 10 3.5, 0 7"
                            fill="#6B7280"
                          />
                        </marker>
                      </defs>
                      <line
                        x1={fromX}
                        y1={fromY}
                        x2={toX - 10}
                        y2={toY}
                        stroke="#6B7280"
                        strokeWidth="2"
                        markerEnd={`url(#arrowhead-${needsJobId}-${job.id})`}
                      />
                    </svg>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderJobDetails = (job: Job) => {
    return (
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <h4 className="text-lg font-semibold mb-4 flex items-center">
          <span className={`w-4 h-4 rounded-full ${getStatusColor(job.status)} mr-2`}></span>
          {job.name}
        </h4>
        
        <div className="grid grid-cols-2 gap-4 mb-4">
          <div>
            <p className="text-sm text-gray-600">Status</p>
            <p className="font-medium">{getStatusIcon(job.status)} {job.status}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Duration</p>
            <p className="font-medium">{job.duration ? `${job.duration}ms` : 'N/A'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Dependencies</p>
            <p className="font-medium">{job.needs.length > 0 ? job.needs.join(', ') : 'None'}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Steps</p>
            <p className="font-medium">{job.steps.length} steps</p>
          </div>
        </div>
        
        <div>
          <h5 className="font-medium mb-2">Steps:</h5>
          <div className="space-y-2">
            {job.steps.map((step) => (
              <div key={step.id} className="flex items-center p-2 bg-gray-50 rounded">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(step.status)} mr-3`}></span>
                <span className="flex-1">{step.name}</span>
                <span className="text-sm text-gray-500">{getStatusIcon(step.status)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const selectedWorkflow = workflowRuns.find(w => w.id === selectedRun);
  const selectedJobData = selectedWorkflow?.jobs.find(j => j.id === selectedJob);

  return (
    <div className="space-y-6">
      <div className="bg-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold">CI/CD Workflow Visualizer</h2>
          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <div className={`w-2 h-2 rounded-full ${isLoading ? 'bg-yellow-500 animate-pulse' : 'bg-green-500'}`}></div>
              <span className="text-sm text-gray-600">
                {isLoading ? 'Loading...' : 'Live'}
              </span>
            </div>
            {lastUpdate && (
              <span className="text-xs text-gray-500">
                Last update: {lastUpdate}
              </span>
            )}
            <button
              onClick={loadWorkflowData}
              disabled={isLoading}
              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Refresh'}
            </button>
          </div>
        </div>
        
        {/* Workflow Selector */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Select Workflow Run
          </label>
          <select
            value={selectedRun || ''}
            onChange={(e) => setSelectedRun(e.target.value)}
            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          >
            {workflowRuns.map((run) => (
              <option key={run.id} value={run.id}>
                {run.name} - {run.trigger} ({run.status})
              </option>
            ))}
          </select>
        </div>

        {/* Workflow Summary */}
        {selectedWorkflow && (
          <div className="grid grid-cols-4 gap-4 mb-6 p-4 bg-gray-50 rounded-lg">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-medium flex items-center">
                <span className={`w-3 h-3 rounded-full ${getStatusColor(selectedWorkflow.status)} mr-2`}></span>
                {selectedWorkflow.status}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Jobs</p>
              <p className="font-medium">{selectedWorkflow.jobs.length}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Trigger</p>
              <p className="font-medium">{selectedWorkflow.trigger}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Duration</p>
              <p className="font-medium">
                {selectedWorkflow.endTime ? 
                  `${new Date(selectedWorkflow.endTime).getTime() - new Date(selectedWorkflow.startTime).getTime()}ms` : 
                  'Running...'
                }
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Job Dependency Graph */}
      {selectedWorkflow && renderJobGraph(selectedWorkflow)}

      {/* Job Details */}
      {selectedJobData && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Job Details</h3>
          {renderJobDetails(selectedJobData)}
        </div>
      )}

      {/* Legend */}
      <div className="bg-white p-4 rounded-lg shadow-lg">
        <h3 className="font-semibold mb-2">Status Legend</h3>
        <div className="flex flex-wrap gap-4">
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-green-500 mr-2"></span>
            <span className="text-sm">Completed</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-blue-500 mr-2"></span>
            <span className="text-sm">In Progress</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-red-500 mr-2"></span>
            <span className="text-sm">Failed</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-gray-400 mr-2"></span>
            <span className="text-sm">Pending</span>
          </div>
          <div className="flex items-center">
            <span className="w-3 h-3 rounded-full bg-yellow-500 mr-2"></span>
            <span className="text-sm">Skipped</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkflowVisualizer;