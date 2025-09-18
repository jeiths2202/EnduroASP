import type { NextApiRequest, NextApiResponse } from 'next';
import { execSync } from 'child_process';
import { readFileSync } from 'fs';

interface SystemMetrics {
  timestamp: string;
  cpu: {
    usage: number;
    loadAverage: number[];
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
    cached: number;
    usage: number;
  };
  disk: {
    total: number;
    used: number;
    free: number;
    usage: number;
  };
  network: {
    bytesReceived: number;
    bytesSent: number;
    packetsReceived: number;
    packetsSent: number;
  };
  process: {
    pid: number;
    memoryUsage: number;
    cpuUsage: number;
    uptime: number;
  };
  application: {
    activeConnections: number;
    requestsPerMinute: number;
    averageResponseTime: number;
    errorRate: number;
    version: string;
  };
}

interface MetricHistory {
  timestamp: string;
  metrics: SystemMetrics;
}

// In-memory storage for demo (use database/time-series DB in production)
const metricsHistory: MetricHistory[] = [];
const MAX_HISTORY = 100;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SystemMetrics | { history: MetricHistory[] } | { error: string }>
) {
  if (req.method === 'GET') {
    return getSystemMetrics(req, res);
  } else {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function getSystemMetrics(
  req: NextApiRequest,
  res: NextApiResponse<SystemMetrics | { history: MetricHistory[] } | { error: string }>
) {
  try {
    const includeHistory = req.query.history === 'true';
    const timeRange = req.query.timeRange as string || '1h';

    // Collect current system metrics
    const metrics = await collectSystemMetrics();

    // Store in history
    const historyEntry: MetricHistory = {
      timestamp: metrics.timestamp,
      metrics
    };

    metricsHistory.unshift(historyEntry);
    if (metricsHistory.length > MAX_HISTORY) {
      metricsHistory.pop();
    }

    if (includeHistory) {
      // Filter history based on time range
      const filteredHistory = filterHistoryByTimeRange(metricsHistory, timeRange);
      return res.status(200).json({ history: filteredHistory });
    }

    return res.status(200).json(metrics);

  } catch (error) {
    console.error('Error collecting system metrics:', error);
    return res.status(500).json({ error: 'Failed to collect system metrics' });
  }
}

async function collectSystemMetrics(): Promise<SystemMetrics> {
  const timestamp = new Date().toISOString();

  try {
    // CPU Metrics
    const cpuMetrics = await getCpuMetrics();
    
    // Memory Metrics
    const memoryMetrics = await getMemoryMetrics();
    
    // Disk Metrics
    const diskMetrics = await getDiskMetrics();
    
    // Network Metrics
    const networkMetrics = await getNetworkMetrics();
    
    // Process Metrics
    const processMetrics = getProcessMetrics();
    
    // Application Metrics
    const applicationMetrics = await getApplicationMetrics();

    return {
      timestamp,
      cpu: cpuMetrics,
      memory: memoryMetrics,
      disk: diskMetrics,
      network: networkMetrics,
      process: processMetrics,
      application: applicationMetrics
    };

  } catch (error) {
    console.error('Error in collectSystemMetrics:', error);
    // Return mock data for demo purposes
    return getMockMetrics(timestamp);
  }
}

async function getCpuMetrics() {
  try {
    // Get CPU usage (Linux/Unix)
    const cpuInfo = execSync("grep 'cpu ' /proc/stat || echo 'cpu 0 0 0 0 0 0 0'", { encoding: 'utf8' });
    const loadAvg = execSync("uptime | awk -F'load average:' '{print $2}' || echo '0.0, 0.0, 0.0'", { encoding: 'utf8' });
    const cores = execSync("nproc || echo '4'", { encoding: 'utf8' });

    // Calculate CPU usage percentage
    const usage = Math.random() * 30 + 10; // Mock data for demo

    return {
      usage: Math.round(usage * 100) / 100,
      loadAverage: loadAvg.trim().split(',').map(x => parseFloat(x.trim())),
      cores: parseInt(cores.trim())
    };
  } catch (error) {
    return {
      usage: Math.random() * 30 + 10,
      loadAverage: [0.5, 0.7, 0.9],
      cores: 4
    };
  }
}

async function getMemoryMetrics() {
  try {
    const memInfo = readFileSync('/proc/meminfo', 'utf8');
    const lines = memInfo.split('\n');
    
    const getMemValue = (key: string) => {
      const line = lines.find(l => l.startsWith(key));
      return line ? parseInt(line.split(/\s+/)[1]) * 1024 : 0; // Convert KB to bytes
    };

    const total = getMemValue('MemTotal');
    const free = getMemValue('MemFree');
    const cached = getMemValue('Cached');
    const used = total - free;

    return {
      total,
      used,
      free,
      cached,
      usage: Math.round((used / total) * 100 * 100) / 100
    };
  } catch (error) {
    // Mock data for demo
    const total = 8 * 1024 * 1024 * 1024; // 8GB
    const used = total * (0.3 + Math.random() * 0.4); // 30-70% usage
    const free = total - used;
    const cached = total * 0.1;

    return {
      total,
      used: Math.round(used),
      free: Math.round(free),
      cached: Math.round(cached),
      usage: Math.round((used / total) * 100 * 100) / 100
    };
  }
}

async function getDiskMetrics() {
  try {
    const diskUsage = execSync("df -B1 / | tail -1 | awk '{print $2, $3, $4}'", { encoding: 'utf8' });
    const [total, used, free] = diskUsage.trim().split(' ').map(Number);

    return {
      total,
      used,
      free,
      usage: Math.round((used / total) * 100 * 100) / 100
    };
  } catch (error) {
    // Mock data for demo
    const total = 100 * 1024 * 1024 * 1024; // 100GB
    const used = total * (0.4 + Math.random() * 0.3); // 40-70% usage
    const free = total - used;

    return {
      total,
      used: Math.round(used),
      free: Math.round(free),
      usage: Math.round((used / total) * 100 * 100) / 100
    };
  }
}

async function getNetworkMetrics() {
  try {
    const networkStats = execSync("cat /proc/net/dev | grep 'eth0\\|ens'", { encoding: 'utf8' });
    // Parse network statistics (simplified for demo)
    
    return {
      bytesReceived: Math.round(Math.random() * 1000000000), // Mock data
      bytesSent: Math.round(Math.random() * 1000000000),
      packetsReceived: Math.round(Math.random() * 1000000),
      packetsSent: Math.round(Math.random() * 1000000)
    };
  } catch (error) {
    return {
      bytesReceived: Math.round(Math.random() * 1000000000),
      bytesSent: Math.round(Math.random() * 1000000000),
      packetsReceived: Math.round(Math.random() * 1000000),
      packetsSent: Math.round(Math.random() * 1000000)
    };
  }
}

function getProcessMetrics() {
  const memoryUsage = process.memoryUsage();
  
  return {
    pid: process.pid,
    memoryUsage: memoryUsage.heapUsed,
    cpuUsage: Math.random() * 10 + 2, // Mock CPU usage for this process
    uptime: process.uptime()
  };
}

async function getApplicationMetrics() {
  // Mock application-specific metrics
  return {
    activeConnections: Math.round(Math.random() * 100 + 10),
    requestsPerMinute: Math.round(Math.random() * 1000 + 100),
    averageResponseTime: Math.round((Math.random() * 200 + 50) * 100) / 100,
    errorRate: Math.round(Math.random() * 2 * 100) / 100,
    version: '1.0.0'
  };
}

function getMockMetrics(timestamp: string): SystemMetrics {
  return {
    timestamp,
    cpu: {
      usage: Math.round((Math.random() * 30 + 10) * 100) / 100,
      loadAverage: [
        Math.round(Math.random() * 2 * 100) / 100,
        Math.round(Math.random() * 2 * 100) / 100,
        Math.round(Math.random() * 2 * 100) / 100
      ],
      cores: 4
    },
    memory: {
      total: 8589934592, // 8GB
      used: Math.round(8589934592 * (0.3 + Math.random() * 0.4)),
      free: 0,
      cached: Math.round(8589934592 * 0.1),
      usage: Math.round((0.3 + Math.random() * 0.4) * 100 * 100) / 100
    },
    disk: {
      total: 107374182400, // 100GB
      used: Math.round(107374182400 * (0.4 + Math.random() * 0.3)),
      free: 0,
      usage: Math.round((0.4 + Math.random() * 0.3) * 100 * 100) / 100
    },
    network: {
      bytesReceived: Math.round(Math.random() * 1000000000),
      bytesSent: Math.round(Math.random() * 1000000000),
      packetsReceived: Math.round(Math.random() * 1000000),
      packetsSent: Math.round(Math.random() * 1000000)
    },
    process: {
      pid: process.pid,
      memoryUsage: process.memoryUsage().heapUsed,
      cpuUsage: Math.round((Math.random() * 10 + 2) * 100) / 100,
      uptime: process.uptime()
    },
    application: {
      activeConnections: Math.round(Math.random() * 100 + 10),
      requestsPerMinute: Math.round(Math.random() * 1000 + 100),
      averageResponseTime: Math.round((Math.random() * 200 + 50) * 100) / 100,
      errorRate: Math.round(Math.random() * 2 * 100) / 100,
      version: '1.0.0'
    }
  };
}

function filterHistoryByTimeRange(history: MetricHistory[], timeRange: string): MetricHistory[] {
  const now = new Date();
  let cutoffTime = new Date();

  switch (timeRange) {
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
    default:
      cutoffTime.setHours(now.getHours() - 1);
  }

  return history.filter(entry => new Date(entry.timestamp) >= cutoffTime);
}