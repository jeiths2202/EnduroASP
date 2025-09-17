import type { NextApiRequest, NextApiResponse } from 'next';
import { readFileSync, statSync } from 'fs';
import { join } from 'path';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'error' | 'warn' | 'info' | 'debug';
  source: string;
  message: string;
  metadata?: Record<string, any>;
  stackTrace?: string;
}

interface LogQuery {
  level?: string;
  source?: string;
  timeRange?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

interface LogResponse {
  logs: LogEntry[];
  total: number;
  summary: {
    totalLogs: number;
    errorCount: number;
    warnCount: number;
    infoCount: number;
    debugCount: number;
    timeRange: string;
  };
}

// Mock log data for demonstration
const generateMockLogs = (count: number = 50): LogEntry[] => {
  const levels: Array<'error' | 'warn' | 'info' | 'debug'> = ['error', 'warn', 'info', 'debug'];
  const sources = [
    'api/pipeline-status',
    'api/deployment-webhook', 
    'api/rollback',
    'components/RealTimePipelineMonitor',
    'pages/DevOpsDashboard',
    'docker/container',
    'nginx/proxy',
    'database/connection',
    'auth/middleware',
    'notification/service'
  ];

  const messages = {
    error: [
      'Database connection timeout after 30 seconds',
      'Failed to authenticate user with invalid token',
      'Pipeline deployment failed: container build error',
      'Memory limit exceeded in process worker',
      'Network connection refused by upstream server',
      'File system permissions denied for log directory',
      'Invalid JSON payload in webhook request',
      'Redis cache connection lost',
      'SSL certificate verification failed',
      'Rollback operation encountered critical error'
    ],
    warn: [
      'High CPU usage detected: 85% for 2 minutes',
      'API response time exceeding 2 seconds',
      'Memory usage above 70% threshold',
      'Disk space running low: 15% remaining',
      'Failed authentication attempt from IP 192.168.1.100',
      'Rate limit approaching for API endpoint',
      'Cache miss ratio above 40%',
      'Database connection pool nearly exhausted',
      'Background job queue length growing',
      'SSL certificate expires in 30 days'
    ],
    info: [
      'Pipeline deployment completed successfully',
      'User authentication successful',
      'Backup operation completed',
      'Cache cleared and rebuilt',
      'New deployment version v1.2.5 started',
      'Health check passed for all services',
      'Log rotation completed',
      'Database maintenance completed',
      'Configuration reloaded successfully',
      'Monitoring alert resolved'
    ],
    debug: [
      'Processing webhook payload for deployment',
      'Loading configuration from environment variables',
      'Establishing database connection pool',
      'Initializing monitoring service',
      'Starting background job processor',
      'Loading user permissions from cache',
      'Validating API request parameters',
      'Executing database migration',
      'Processing notification queue',
      'Refreshing authentication tokens'
    ]
  };

  const logs: LogEntry[] = [];
  
  for (let i = 0; i < count; i++) {
    const level = levels[Math.floor(Math.random() * levels.length)];
    const source = sources[Math.floor(Math.random() * sources.length)];
    const message = messages[level][Math.floor(Math.random() * messages[level].length)];
    
    const timestamp = new Date(Date.now() - Math.random() * 24 * 60 * 60 * 1000).toISOString();
    
    const logEntry: LogEntry = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp,
      level,
      source,
      message,
      metadata: {
        requestId: `req_${Math.random().toString(36).substr(2, 12)}`,
        userId: level !== 'debug' ? `user_${Math.floor(Math.random() * 1000)}` : undefined,
        duration: Math.round(Math.random() * 1000),
        statusCode: level === 'error' ? (400 + Math.floor(Math.random() * 100)) : 200
      }
    };

    // Add stack trace for error logs
    if (level === 'error' && Math.random() > 0.5) {
      logEntry.stackTrace = [
        `Error: ${message}`,
        `    at processRequest (/app/src/api/handler.js:45:12)`,
        `    at Router.handle (/app/node_modules/express/lib/router/index.js:281:3)`,
        `    at next (/app/node_modules/express/lib/router/index.js:161:11)`,
        `    at middleware (/app/src/middleware/auth.js:23:5)`
      ].join('\n');
    }

    logs.push(logEntry);
  }

  // Sort by timestamp (newest first)
  return logs.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<LogResponse | { error: string }>
) {
  if (req.method === 'GET') {
    return getLogs(req, res);
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function getLogs(
  req: NextApiRequest,
  res: NextApiResponse<LogResponse | { error: string }>
) {
  try {
    const query: LogQuery = {
      level: req.query.level as string,
      source: req.query.source as string,
      timeRange: req.query.timeRange as string || '1h',
      search: req.query.search as string,
      limit: parseInt(req.query.limit as string) || 100,
      offset: parseInt(req.query.offset as string) || 0
    };

    // Generate mock logs (in production, read from log files or database)
    let allLogs = generateMockLogs(200);

    // Apply filters
    let filteredLogs = applyFilters(allLogs, query);

    // Calculate summary
    const summary = calculateLogSummary(filteredLogs, query.timeRange);

    // Apply pagination
    const total = filteredLogs.length;
    const paginatedLogs = filteredLogs.slice(query.offset, query.offset + query.limit);

    const response: LogResponse = {
      logs: paginatedLogs,
      total,
      summary
    };

    return res.status(200).json(response);

  } catch (error) {
    console.error('Error fetching logs:', error);
    return res.status(500).json({ error: 'Failed to fetch logs' });
  }
}

function applyFilters(logs: LogEntry[], query: LogQuery): LogEntry[] {
  let filtered = [...logs];

  // Filter by level
  if (query.level && query.level !== 'all') {
    filtered = filtered.filter(log => log.level === query.level);
  }

  // Filter by source
  if (query.source && query.source !== 'all') {
    filtered = filtered.filter(log => log.source.includes(query.source));
  }

  // Filter by time range
  if (query.timeRange && query.timeRange !== 'all') {
    const now = new Date();
    let cutoffTime = new Date();

    switch (query.timeRange) {
      case '1h':
        cutoffTime.setHours(now.getHours() - 1);
        break;
      case '6h':
        cutoffTime.setHours(now.getHours() - 6);
        break;
      case '24h':
        cutoffTime.setHours(now.getHours() - 24);
        break;
      case '7d':
        cutoffTime.setDate(now.getDate() - 7);
        break;
      case '30d':
        cutoffTime.setDate(now.getDate() - 30);
        break;
    }

    filtered = filtered.filter(log => new Date(log.timestamp) >= cutoffTime);
  }

  // Filter by search term
  if (query.search) {
    const searchTerm = query.search.toLowerCase();
    filtered = filtered.filter(log => 
      log.message.toLowerCase().includes(searchTerm) ||
      log.source.toLowerCase().includes(searchTerm) ||
      (log.stackTrace && log.stackTrace.toLowerCase().includes(searchTerm))
    );
  }

  return filtered;
}

function calculateLogSummary(logs: LogEntry[], timeRange: string) {
  const counts = logs.reduce((acc, log) => {
    acc[log.level] = (acc[log.level] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return {
    totalLogs: logs.length,
    errorCount: counts.error || 0,
    warnCount: counts.warn || 0,
    infoCount: counts.info || 0,
    debugCount: counts.debug || 0,
    timeRange
  };
}