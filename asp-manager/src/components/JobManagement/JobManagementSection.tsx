import React from 'react';
import {
  PlayIcon,
  StopIcon,
  PauseIcon,
  DocumentTextIcon,
  TrashIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { getStatusColor } from '../../utils/displayHelpers';

interface Job {
  id: string;
  name: string;
  status: string;
  user: string;
  start_time: string;
  cpu_time: string;
  priority: number;
  program?: string;
  library?: string;
  volume?: string;
}

interface JobManagementSectionProps {
  jobs: Job[];
  getSortedJobs: () => Job[];
  fetchJobs: () => void;
  handleSort: (field: string) => void;
  handleJobAction: (jobId: string, action: string) => void;
  fetchJobInfo: (job: Job) => Promise<void>;
  fetchJobLog: (job: Job) => Promise<void>;
  handleDeleteJob: (jobId: string) => void;
  sortField: string;
  sortDirection: 'asc' | 'desc';
}

const JobManagementSection: React.FC<JobManagementSectionProps> = ({
  jobs,
  getSortedJobs,
  fetchJobs,
  handleSort,
  handleJobAction,
  fetchJobInfo,
  fetchJobLog,
  handleDeleteJob,
  sortField,
  sortDirection
}) => {
  const getSortIcon = (field: string) => {
    if (sortField !== field) {
      return null;
    }
    return sortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 inline ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">ジョブ管理</h3>
        <div className="flex space-x-2 items-center">
          <span className="text-sm text-gray-400">
            総件数: {jobs.length}件
          </span>
          <button 
            onClick={fetchJobs}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            更新
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('id')}
              >
                <div className="flex items-center">
                  ジョブID
                  {getSortIcon('id')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('name')}
              >
                <div className="flex items-center">
                  名前
                  {getSortIcon('name')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('status')}
              >
                <div className="flex items-center">
                  ステータス
                  {getSortIcon('status')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('user')}
              >
                <div className="flex items-center">
                  ユーザー
                  {getSortIcon('user')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('start_time')}
              >
                <div className="flex items-center">
                  開始時刻
                  {getSortIcon('start_time')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">CPU時間</th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleSort('priority')}
              >
                <div className="flex items-center">
                  優先度
                  {getSortIcon('priority')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">アクション</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {getSortedJobs().map((job) => (
              <tr 
                key={job.id} 
                className="hover:bg-gray-750 cursor-pointer"
                onDoubleClick={() => fetchJobInfo(job)}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{job.id}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white">{job.name}</td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(job.status)}`}>
                    {job.status.toUpperCase()}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.user}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.start_time}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.cpu_time}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{job.priority}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    {job.status === 'running' && (
                      <>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobAction(job.id, 'hold');
                          }}
                          className="text-yellow-400 hover:text-yellow-300"
                          title="Hold"
                        >
                          <PauseIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleJobAction(job.id, 'cancel');
                          }}
                          className="text-red-400 hover:text-red-300"
                          title="Cancel"
                        >
                          <StopIcon className="w-4 h-4" />
                        </button>
                      </>
                    )}
                    {job.status === 'held' && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJobAction(job.id, 'resume');
                        }}
                        className="text-green-400 hover:text-green-300"
                        title="Resume"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    )}
                    {(job.status === 'pending' || job.status === 'error' || job.status === 'completed') && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleJobAction(job.id, 'start');
                        }}
                        className="text-blue-400 hover:text-blue-300"
                        title={job.status === 'pending' ? 'Start' : 'Restart'}
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        fetchJobLog(job);
                      }}
                      className="text-blue-400 hover:text-blue-300"
                      title="View Log"
                    >
                      <DocumentTextIcon className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteJob(job.id);
                      }}
                      className="text-red-400 hover:text-red-300"
                      title="Delete"
                    >
                      <TrashIcon className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {jobs.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            現在実行中のジョブはありません
          </div>
        )}
      </div>
    </div>
  );
};

export default JobManagementSection;