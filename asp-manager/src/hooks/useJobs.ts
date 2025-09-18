import { useState, useCallback } from 'react';
import { APP_CONFIG } from '../config/app';

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

interface JobInfo {
  jobid: string;
  jobname: string;
  status: string;
  user: string;
  sbmdt: string;
}

export const useJobs = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [sortField, setSortField] = useState<string>('start_time');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedJobLog, setSelectedJobLog] = useState<{job: Job, log: string} | null>(null);
  const [selectedJobInfo, setSelectedJobInfo] = useState<{jobInfo: JobInfo, logContent: string} | null>(null);
  const [isLoadingJobInfo, setIsLoadingJobInfo] = useState(false);

  const fetchJobs = useCallback(async () => {
    try {
      const response = await fetch(`${APP_CONFIG.api.baseUrl}/api/jobs`);
      if (response.ok) {
        const data = await response.json();
        setJobs(data.jobs || []);
      }
    } catch (error) {
      console.error('Error fetching jobs:', error);
    }
  }, []);

  const handleSort = useCallback((field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField, sortDirection]);

  const getSortedJobs = useCallback(() => {
    const sorted = [...jobs].sort((a, b) => {
      let aValue: any = a[sortField as keyof Job] || '';
      let bValue: any = b[sortField as keyof Job] || '';

      switch (sortField) {
        case 'priority':
          aValue = Number(aValue) || 0;
          bValue = Number(bValue) || 0;
          break;
        case 'start_time':
        case 'cpu_time':
          aValue = new Date(aValue).getTime() || 0;
          bValue = new Date(bValue).getTime() || 0;
          break;
        default:
          aValue = String(aValue).toLowerCase();
          bValue = String(bValue).toLowerCase();
      }

      if (sortDirection === 'asc') {
        return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
      } else {
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      }
    });

    return sorted;
  }, [jobs, sortField, sortDirection]);

  const fetchJobLog = useCallback(async (job: Job) => {
    try {
      const response = await fetch(`${APP_CONFIG.api.baseUrl}/api/jobs/${job.id}/log`);
      if (response.ok) {
        const logData = await response.text();
        setSelectedJobLog({ job, log: logData });
      } else {
        setSelectedJobLog({ job, log: 'Error fetching job log.' });
      }
    } catch (error) {
      console.error('Error fetching job log:', error);
      setSelectedJobLog({ job, log: 'Error fetching job log.' });
    }
  }, []);

  const fetchJobInfo = useCallback(async (job: Job) => {
    setIsLoadingJobInfo(true);
    try {
      // Fetch JOBINFO from PostgreSQL
      const jobInfoResponse = await fetch(`${APP_CONFIG.api.baseUrl}/api/jobinfo/${job.id}`);
      let jobInfo: JobInfo | null = null;
      
      if (jobInfoResponse.ok) {
        jobInfo = await jobInfoResponse.json();
      }

      // Fallback to local data if not found in database
      if (!jobInfo) {
        const fallbackJobInfo: JobInfo = {
          jobid: job.id,
          jobname: job.name,
          status: job.status,
          user: job.user,
          sbmdt: job.start_time
        };
        setSelectedJobInfo({ 
          jobInfo: fallbackJobInfo, 
          logContent: 'ジョブ情報の取得に失敗しました。' 
        });
      } else {
        setSelectedJobInfo({ 
          jobInfo, 
          logContent: 'ジョブ詳細情報が正常に取得されました。' 
        });
      }
    } catch (error) {
      console.error('Error fetching job info:', error);
      const fallbackJobInfo: JobInfo = {
        jobid: job.id,
        jobname: job.name,
        status: job.status,
        user: job.user,
        sbmdt: job.start_time
      };
      setSelectedJobInfo({ 
        jobInfo: fallbackJobInfo, 
        logContent: 'ジョブ情報の取得に失敗しました。' 
      });
    } finally {
      setIsLoadingJobInfo(false);
    }
  }, []);

  const handleJobAction = useCallback(async (jobId: string, action: string) => {
    try {
      const response = await fetch(`${APP_CONFIG.api.baseUrl}/api/jobs/${jobId}/${action}`, {
        method: 'POST',
      });
      if (response.ok) {
        console.log(`Job ${jobId}: ${action} action successful`);
        await fetchJobs();
      }
    } catch (error) {
      console.error(`Error ${action}ing job:`, error);
    }
  }, [fetchJobs]);

  const handleDeleteJob = useCallback(async (jobId: string) => {
    try {
      const response = await fetch(`${APP_CONFIG.api.baseUrl}/api/jobs/${jobId}`, {
        method: 'DELETE'
      });
      
      if (response.ok) {
        console.log(`Job ${jobId}: deleted successfully`);
        await fetchJobs();
        
        // Close JOBINFO modal if it's open for this job
        if (selectedJobInfo && selectedJobInfo.jobInfo.jobid === jobId) {
          setSelectedJobInfo(null);
        }
      }
    } catch (error) {
      console.error('Error deleting job:', error);
    }
  }, [fetchJobs, selectedJobInfo]);

  return {
    jobs,
    sortField,
    sortDirection,
    selectedJobLog,
    selectedJobInfo,
    isLoadingJobInfo,
    fetchJobs,
    handleSort,
    getSortedJobs,
    fetchJobLog,
    fetchJobInfo,
    handleJobAction,
    handleDeleteJob,
    setSelectedJobLog,
    setSelectedJobInfo
  };
};