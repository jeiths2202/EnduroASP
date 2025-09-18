import type { NextApiRequest, NextApiResponse } from 'next';

interface HealthResponse {
  status: 'healthy' | 'unhealthy';
  timestamp: string;
  version: string;
  uptime: number;
  services: {
    [key: string]: 'up' | 'down';
  };
}

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<HealthResponse>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    res.status(405).end(`Method ${req.method} Not Allowed`);
    return;
  }

  const uptime = process.uptime();
  
  // Mock service health checks
  const services = {
    'python-service': 'up' as const,
    'cobol-service': 'up' as const,
    'dataset-service': 'up' as const,
  };

  const allServicesUp = Object.values(services).every(status => status === 'up');

  res.status(200).json({
    status: allServicesUp ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    uptime,
    services,
  });
}