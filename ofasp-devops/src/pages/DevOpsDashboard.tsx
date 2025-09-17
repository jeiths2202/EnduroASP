import React, { useState, useEffect } from 'react';
import {
  ChartBarIcon,
  CodeBracketIcon,
  RocketLaunchIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ClockIcon,
  BuildingOfficeIcon,
  CpuChipIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';
import DevOpsPipelineFlow from '../components/DevOpsPipelineFlow';
import AbendTestFlow from '../components/AbendTestFlow';

interface DevOpsDashboardProps {
  isDarkMode: boolean;
}

interface PipelineStatus {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'pending';
  stage: string;
  progress: number;
  startTime: string;
  duration?: string;
}

interface MetricData {
  label: string;
  value: string;
  trend: 'up' | 'down' | 'stable';
  color: string;
}

const DevOpsDashboard: React.FC<DevOpsDashboardProps> = ({ isDarkMode }) => {
  const { t } = useI18n();
  const [pipelines, setPipelines] = useState<PipelineStatus[]>([
    {
      id: '1',
      name: 'COBOL to Java Conversion',
      status: 'success',
      stage: 'Deploy',
      progress: 100,
      startTime: '10:30 AM',
      duration: '3m 45s'
    },
    {
      id: '2',
      name: 'CL to Shell Migration',
      status: 'running',
      stage: 'Testing',
      progress: 65,
      startTime: '10:45 AM'
    },
    {
      id: '3',
      name: 'Dataset Conversion Pipeline',
      status: 'pending',
      stage: 'Queue',
      progress: 0,
      startTime: '11:00 AM'
    }
  ]);

  const [metrics, setMetrics] = useState<MetricData[]>([
    { label: 'Conversion Success Rate', value: '94.2%', trend: 'up', color: 'green' },
    { label: 'Average Build Time', value: '2m 31s', trend: 'down', color: 'blue' },
    { label: 'Active Pipelines', value: '12', trend: 'up', color: 'purple' },
    { label: 'Deploy Success Rate', value: '98.7%', trend: 'stable', color: 'emerald' }
  ]);

  const [realtimeActivity, setRealtimeActivity] = useState([
    '10:52 AM - COBOL conversion completed for payroll.cbl',
    '10:51 AM - CL script test passed: batch_process.cl',
    '10:50 AM - Dataset conversion started: employee_data.dat',
    '10:49 AM - Build artifact deployed to staging',
    '10:48 AM - Performance tests passed for inventory module'
  ]);

  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate pipeline updates
      setPipelines(prev => prev.map(pipeline => {
        if (pipeline.status === 'running') {
          const newProgress = Math.min(pipeline.progress + Math.random() * 10, 100);
          return {
            ...pipeline,
            progress: newProgress,
            status: newProgress >= 100 ? 'success' : 'running',
            stage: newProgress >= 100 ? 'Deploy' : pipeline.stage,
            duration: newProgress >= 100 ? `${Math.floor(Math.random() * 5) + 2}m ${Math.floor(Math.random() * 60)}s` : undefined
          };
        }
        return pipeline;
      }));

      // Simulate new activity
      const activities = [
        'Unit tests passed for converted COBOL module',
        'Integration test completed successfully',
        'Code quality check passed',
        'Security scan completed - no vulnerabilities',
        'Performance benchmark exceeded expectations',
        'Deployment to production environment started'
      ];
      
      setRealtimeActivity(prev => {
        const newActivity = `${new Date().toLocaleTimeString('en-US', { 
          hour: '2-digit', 
          minute: '2-digit', 
          hour12: true 
        })} - ${activities[Math.floor(Math.random() * activities.length)]}`;
        return [newActivity, ...prev.slice(0, 4)];
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'success':
        return <CheckCircleIcon className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <ExclamationTriangleIcon className="w-5 h-5 text-red-500" />;
      case 'running':
        return <ArrowPathIcon className="w-5 h-5 text-blue-500 animate-spin" />;
      default:
        return <ClockIcon className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'success': return 'bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100';
      case 'failed': return 'bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100';
      case 'running': return 'bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100';
      default: return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100';
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return '↗️';
      case 'down': return '↘️';
      default: return '→';
    }
  };

  return (
    <div className="h-full p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <BuildingOfficeIcon className="w-8 h-8 text-blue-600 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              DevOps Dashboard
            </h1>
            <p className="text-gray-600 dark:text-gray-400">
              Real-time CI/CD Pipeline Monitoring & Legacy System Modernization
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2 px-4 py-2 bg-green-100 dark:bg-green-800 rounded-lg">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
          <span className="text-green-800 dark:text-green-100 font-medium">System Operational</span>
        </div>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {metrics.map((metric, index) => (
          <div key={index} className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  {metric.label}
                </p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-2">
                  {metric.value}
                </p>
              </div>
              <div className="text-2xl">
                {getTrendIcon(metric.trend)}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Pipeline Status */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <RocketLaunchIcon className="w-6 h-6 text-blue-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Active Pipelines
              </h2>
            </div>
          </div>
          <div className="p-6 space-y-4">
            {pipelines.map((pipeline) => (
              <div key={pipeline.id} className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                <div className="flex items-center space-x-3">
                  {getStatusIcon(pipeline.status)}
                  <div>
                    <p className="font-medium text-gray-900 dark:text-white">
                      {pipeline.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      {pipeline.stage} • Started {pipeline.startTime}
                      {pipeline.duration && ` • ${pipeline.duration}`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(pipeline.status)}`}>
                    {pipeline.status.toUpperCase()}
                  </span>
                  <div className="w-16 bg-gray-200 dark:bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                      style={{ width: `${pipeline.progress}%` }}
                    ></div>
                  </div>
                  <span className="text-sm text-gray-600 dark:text-gray-400 w-10">
                    {pipeline.progress}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Real-time Activity Feed */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center">
              <ChartBarIcon className="w-6 h-6 text-green-600 mr-2" />
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                Real-time Activity
              </h2>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-3 max-h-64 overflow-y-auto">
              {realtimeActivity.map((activity, index) => (
                <div key={index} className="flex items-start space-x-3 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
                  <div className="w-2 h-2 bg-green-500 rounded-full mt-2 flex-shrink-0"></div>
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    {activity}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* DevOps Pipeline Flow Visualizer */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <RocketLaunchIcon className="w-6 h-6 text-blue-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Pipeline Flow
          </h2>
        </div>
        <div className="h-[600px]">
          <DevOpsPipelineFlow isDarkMode={isDarkMode} />
        </div>
      </div>

      {/* ABEND Auto-Fix Test Scenario */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <ExclamationTriangleIcon className="w-6 h-6 text-red-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            ABEND Auto-Fix Integration Test
          </h2>
          <span className="ml-3 px-2 py-1 bg-red-100 text-red-800 dark:bg-red-800 dark:text-red-100 text-xs font-medium rounded-full">
            Live Testing
          </span>
        </div>
        <div className="h-[450px]">
          <AbendTestFlow isDarkMode={isDarkMode} />
        </div>
      </div>


      {/* System Architecture Overview */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center mb-6">
          <CpuChipIcon className="w-6 h-6 text-purple-600 mr-2" />
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            DevOps Architecture
          </h2>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="text-center p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <CodeBracketIcon className="w-12 h-12 text-blue-600 mx-auto mb-3" />
            <h3 className="font-semibold text-blue-900 dark:text-blue-100">Source Conversion</h3>
            <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
              COBOL → Java/C/Python<br/>
              CL → Shell/JavaScript<br/>
              Dataset → Modern Formats
            </p>
          </div>
          
          <div className="text-center p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <RocketLaunchIcon className="w-12 h-12 text-green-600 mx-auto mb-3" />
            <h3 className="font-semibold text-green-900 dark:text-green-100">CI/CD Pipeline</h3>
            <p className="text-sm text-green-700 dark:text-green-300 mt-2">
              Automated Testing<br/>
              Build & Deploy<br/>
              Quality Gates
            </p>
          </div>
          
          <div className="text-center p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
            <ChartBarIcon className="w-12 h-12 text-purple-600 mx-auto mb-3" />
            <h3 className="font-semibold text-purple-900 dark:text-purple-100">Monitoring</h3>
            <p className="text-sm text-purple-700 dark:text-purple-300 mt-2">
              Real-time Metrics<br/>
              Performance Tracking<br/>
              Error Detection
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevOpsDashboard;