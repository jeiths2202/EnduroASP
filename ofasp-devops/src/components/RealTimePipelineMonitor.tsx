import React, { useState, useEffect } from 'react';
import {
  CheckCircleIcon,
  XCircleIcon,
  ClockIcon,
  ArrowPathIcon,
  ExternalLinkIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';

interface PipelineStatus {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'pending' | 'cancelled';
  stage: string;
  progress: number;
  startTime: string;
  duration?: string;
  url: string;
  branch: string;
  commit: string;
  runNumber: number;
}

interface PipelineSummary {
  total: number;
  running: number;
  success: number;
  failed: number;
  lastUpdate: string;
}

interface RealTimePipelineMonitorProps {
  isDarkMode: boolean;
}

const RealTimePipelineMonitor: React.FC<RealTimePipelineMonitorProps> = ({ isDarkMode }) => {
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([]);
  const [summary, setSummary] = useState<PipelineSummary>({
    total: 0,
    running: 0,
    success: 0,
    failed: 0,
    lastUpdate: new Date().toISOString()
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastFetch, setLastFetch] = useState<Date | null>(null);

  const fetchPipelineStatus = async () => {
    try {
      const response = await fetch('/api/pipeline-status');
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      
      setPipelines(data.pipelines);
      setSummary(data.summary);
      setError(null);
      setLastFetch(new Date());
    } catch (error) {
      console.error('Failed to fetch pipeline status:', error);
      setError('Failed to fetch pipeline status');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPipelineStatus();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchPipelineStatus, 30000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircleIcon className="w-5 h-5 text-red-500" />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      case 'cancelled':
        return <XCircleIcon className="w-5 h-5 text-gray-500" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
      case 'cancelled': return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
      default: return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-100';
    }
  };

  const formatTime = (isoString: string) => {
    const date = new Date(isoString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  const getSuccessRate = () => {
    if (summary.total === 0) return 0;
    return ((summary.success / summary.total) * 100).toFixed(1);
  };

  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="animate-pulse">
          <div className="h-6 bg-gray-200 dark:bg-gray-600 rounded w-1/4 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-gray-200 dark:bg-gray-600 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Pipelines</p>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{summary.total}</p>
            </div>
            <ChartBarIcon className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Running</p>
              <p className="text-2xl font-bold text-blue-600">{summary.running}</p>
            </div>
            <ArrowPathIcon className="w-8 h-8 text-blue-600 animate-spin" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Success Rate</p>
              <p className="text-2xl font-bold text-green-600">{getSuccessRate()}%</p>
            </div>
            <CheckCircleIcon className="w-8 h-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-4 border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Failed</p>
              <p className="text-2xl font-bold text-red-600">{summary.failed}</p>
            </div>
            <XCircleIcon className="w-8 h-8 text-red-600" />
          </div>
        </div>
      </div>

      {/* Pipeline List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Real-time Pipeline Status
            </h2>
            <div className="flex items-center space-x-2">
              <div className="flex items-center text-sm text-gray-500 dark:text-gray-400">
                <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                Live
              </div>
              {lastFetch && (
                <span className="text-sm text-gray-500 dark:text-gray-400">
                  Updated {formatTime(lastFetch.toISOString())}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="p-6">
          {error ? (
            <div className="text-center py-8">
              <XCircleIcon className="w-12 h-12 text-red-500 mx-auto mb-4" />
              <p className="text-red-600 dark:text-red-400">{error}</p>
              <button
                onClick={fetchPipelineStatus}
                className="mt-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : pipelines.length === 0 ? (
            <div className="text-center py-8">
              <ClockIcon className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">No pipelines found</p>
            </div>
          ) : (
            <div className="space-y-4">
              {pipelines.map((pipeline) => (
                <div key={pipeline.id} className="border border-gray-200 dark:border-gray-600 rounded-lg p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-4 flex-1">
                      {getStatusIcon(pipeline.status)}
                      
                      <div className="flex-1">
                        <div className="flex items-center space-x-2">
                          <h3 className="font-medium text-gray-900 dark:text-white">
                            {pipeline.name}
                          </h3>
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            #{pipeline.runNumber}
                          </span>
                        </div>
                        
                        <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                          <span>{pipeline.stage}</span>
                          <span>•</span>
                          <span>{pipeline.branch}</span>
                          <span>•</span>
                          <span>{pipeline.commit}</span>
                          <span>•</span>
                          <span>{formatTime(pipeline.startTime)}</span>
                          {pipeline.duration && (
                            <>
                              <span>•</span>
                              <span>{pipeline.duration}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center space-x-4">
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pipeline.status)}`}>
                          {pipeline.status.toUpperCase()}
                        </span>
                        <div className="w-20 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                          <div 
                            className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                            style={{ width: `${pipeline.progress}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600 dark:text-gray-400 w-10 text-right">
                          {pipeline.progress}%
                        </span>
                      </div>

                      <a
                        href={pipeline.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        title="View in GitHub"
                      >
                        <ExternalLinkIcon className="w-4 h-4" />
                      </a>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RealTimePipelineMonitor;