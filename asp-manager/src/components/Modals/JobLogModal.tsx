import React from 'react';

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

interface JobLogData {
  job: Job;
  log: string;
}

interface JobLogModalProps {
  selectedJobLog: JobLogData | null;
  onClose: () => void;
  onRefresh: (job: Job) => void;
}

const JobLogModal: React.FC<JobLogModalProps> = ({
  selectedJobLog,
  onClose,
  onRefresh
}) => {
  if (!selectedJobLog) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl h-3/4 border border-gray-700 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">
            JOBログ: {selectedJobLog.job.name} ({selectedJobLog.job.id})
          </h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 bg-gray-900 rounded p-4 overflow-auto">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
            {selectedJobLog.log}
          </pre>
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <button 
            onClick={() => onRefresh(selectedJobLog.job)}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            更新
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default JobLogModal;