export const formatLockTime = (lockTime: string): string => {
  if (!lockTime) return '';
  
  try {
    const date = new Date(lockTime);
    return date.toLocaleString();
  } catch {
    return lockTime;
  }
};

export const getStatusColor = (status: string) => {
  switch (status) {
    case 'running': return 'text-green-400 bg-green-900/20';
    case 'completed': return 'text-blue-400 bg-blue-900/20';
    case 'failed': return 'text-red-400 bg-red-900/20';
    case 'pending': return 'text-yellow-400 bg-yellow-900/20';
    case 'held': return 'text-gray-400 bg-gray-900/20';
    default: return 'text-gray-400 bg-gray-900/20';
  }
};

export const extractProgramFromJobName = (jobName: string): string => {
  const match = jobName.match(/JOB_([A-Z0-9]+)_\d+/);
  return match ? match[1] : jobName.replace('JOB_', '').split('_')[0];
};

export const calculateRunningTime = (startTime: string): string => {
  if (!startTime) return '00:00:00';
  
  const now = new Date();
  const start = new Date();
  const [hours, minutes, seconds] = startTime.split(':').map(Number);
  start.setHours(hours, minutes, seconds);
  
  const diff = Math.floor((now.getTime() - start.getTime()) / 1000);
  const h = Math.floor(diff / 3600);
  const m = Math.floor((diff % 3600) / 60);
  const s = diff % 60;
  
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};