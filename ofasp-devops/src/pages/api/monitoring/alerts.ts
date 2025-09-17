import type { NextApiRequest, NextApiResponse } from 'next';

interface Alert {
  id: string;
  timestamp: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  status: 'active' | 'resolved' | 'acknowledged' | 'silenced';
  source: string;
  title: string;
  description: string;
  metric?: {
    name: string;
    value: number;
    threshold: number;
    unit: string;
  };
  actions?: {
    acknowledge: boolean;
    resolve: boolean;
    silence: boolean;
  };
  resolvedAt?: string;
  acknowledgedBy?: string;
  tags: string[];
}

interface AlertRule {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  metric: string;
  condition: 'greater_than' | 'less_than' | 'equals' | 'not_equals';
  threshold: number;
  duration: number; // seconds
  severity: Alert['severity'];
  tags: string[];
  notifications: {
    slack: boolean;
    email: boolean;
    webhook: boolean;
  };
}

interface AlertSummary {
  total: number;
  active: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  resolved: number;
  acknowledged: number;
}

// Mock alert data
let mockAlerts: Alert[] = [
  {
    id: 'alert_001',
    timestamp: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    severity: 'critical',
    status: 'active',
    source: 'system-metrics',
    title: 'High CPU Usage',
    description: 'CPU usage has exceeded 90% for more than 5 minutes',
    metric: {
      name: 'cpu_usage',
      value: 92.5,
      threshold: 90,
      unit: '%'
    },
    actions: { acknowledge: true, resolve: true, silence: true },
    tags: ['cpu', 'performance', 'system']
  },
  {
    id: 'alert_002',
    timestamp: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    severity: 'high',
    status: 'acknowledged',
    source: 'deployment',
    title: 'Deployment Failure',
    description: 'Production deployment failed with exit code 1',
    acknowledgedBy: 'ops-team',
    actions: { acknowledge: false, resolve: true, silence: true },
    tags: ['deployment', 'production', 'failure']
  },
  {
    id: 'alert_003',
    timestamp: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
    severity: 'medium',
    status: 'resolved',
    source: 'application',
    title: 'High Response Time',
    description: 'API response time exceeded 2 seconds for 3 consecutive requests',
    metric: {
      name: 'response_time',
      value: 2.8,
      threshold: 2.0,
      unit: 's'
    },
    resolvedAt: new Date(Date.now() - 300000).toISOString(),
    tags: ['api', 'performance', 'response-time']
  },
  {
    id: 'alert_004',
    timestamp: new Date(Date.now() - 1200000).toISOString(), // 20 minutes ago
    severity: 'low',
    status: 'active',
    source: 'monitoring',
    title: 'Disk Space Warning',
    description: 'Disk usage is above 80%',
    metric: {
      name: 'disk_usage',
      value: 85.2,
      threshold: 80,
      unit: '%'
    },
    actions: { acknowledge: true, resolve: true, silence: true },
    tags: ['disk', 'storage', 'warning']
  }
];

const mockAlertRules: AlertRule[] = [
  {
    id: 'rule_001',
    name: 'High CPU Usage',
    description: 'Alert when CPU usage exceeds threshold',
    enabled: true,
    metric: 'cpu_usage',
    condition: 'greater_than',
    threshold: 90,
    duration: 300,
    severity: 'critical',
    tags: ['cpu', 'system'],
    notifications: { slack: true, email: true, webhook: false }
  },
  {
    id: 'rule_002',
    name: 'Memory Usage Critical',
    description: 'Alert when memory usage exceeds 95%',
    enabled: true,
    metric: 'memory_usage',
    condition: 'greater_than',
    threshold: 95,
    duration: 180,
    severity: 'critical',
    tags: ['memory', 'system'],
    notifications: { slack: true, email: true, webhook: true }
  },
  {
    id: 'rule_003',
    name: 'Deployment Failure',
    description: 'Alert when deployment fails',
    enabled: true,
    metric: 'deployment_status',
    condition: 'equals',
    threshold: 0, // 0 = failed, 1 = success
    duration: 0,
    severity: 'high',
    tags: ['deployment', 'ci-cd'],
    notifications: { slack: true, email: true, webhook: false }
  },
  {
    id: 'rule_004',
    name: 'API Response Time',
    description: 'Alert when API response time is high',
    enabled: true,
    metric: 'response_time',
    condition: 'greater_than',
    threshold: 2.0,
    duration: 60,
    severity: 'medium',
    tags: ['api', 'performance'],
    notifications: { slack: true, email: false, webhook: false }
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const { method, query } = req;

  switch (method) {
    case 'GET':
      if (query.rules === 'true') {
        return getAlertRules(req, res);
      }
      return getAlerts(req, res);
    
    case 'POST':
      return createAlert(req, res);
    
    case 'PUT':
      return updateAlert(req, res);
    
    case 'DELETE':
      return deleteAlert(req, res);
    
    default:
      res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
      return res.status(405).json({ error: `Method ${method} Not Allowed` });
  }
}

async function getAlerts(req: NextApiRequest, res: NextApiResponse) {
  try {
    const {
      severity,
      status,
      source,
      timeRange = '24h',
      limit = '50',
      offset = '0'
    } = req.query;

    let filteredAlerts = [...mockAlerts];

    // Apply filters
    if (severity && severity !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert => alert.severity === severity);
    }

    if (status && status !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert => alert.status === status);
    }

    if (source && source !== 'all') {
      filteredAlerts = filteredAlerts.filter(alert => alert.source === source);
    }

    // Time range filter
    if (timeRange !== 'all') {
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
      }

      filteredAlerts = filteredAlerts.filter(alert => 
        new Date(alert.timestamp) >= cutoffTime
      );
    }

    // Sort by timestamp (newest first)
    filteredAlerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Pagination
    const limitNum = parseInt(limit as string);
    const offsetNum = parseInt(offset as string);
    const total = filteredAlerts.length;
    const paginatedAlerts = filteredAlerts.slice(offsetNum, offsetNum + limitNum);

    // Calculate summary
    const summary: AlertSummary = {
      total: filteredAlerts.length,
      active: filteredAlerts.filter(a => a.status === 'active').length,
      critical: filteredAlerts.filter(a => a.severity === 'critical').length,
      high: filteredAlerts.filter(a => a.severity === 'high').length,
      medium: filteredAlerts.filter(a => a.severity === 'medium').length,
      low: filteredAlerts.filter(a => a.severity === 'low').length,
      resolved: filteredAlerts.filter(a => a.status === 'resolved').length,
      acknowledged: filteredAlerts.filter(a => a.status === 'acknowledged').length
    };

    return res.status(200).json({
      alerts: paginatedAlerts,
      total,
      summary
    });

  } catch (error) {
    console.error('Error fetching alerts:', error);
    return res.status(500).json({ error: 'Failed to fetch alerts' });
  }
}

async function getAlertRules(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { enabled } = req.query;

    let rules = [...mockAlertRules];

    if (enabled !== undefined) {
      rules = rules.filter(rule => rule.enabled === (enabled === 'true'));
    }

    return res.status(200).json({ rules });

  } catch (error) {
    console.error('Error fetching alert rules:', error);
    return res.status(500).json({ error: 'Failed to fetch alert rules' });
  }
}

async function createAlert(req: NextApiRequest, res: NextApiResponse) {
  try {
    const alertData = req.body;

    const newAlert: Alert = {
      id: `alert_${Date.now()}`,
      timestamp: new Date().toISOString(),
      status: 'active',
      actions: { acknowledge: true, resolve: true, silence: true },
      ...alertData
    };

    mockAlerts.unshift(newAlert);

    // Simulate sending notifications
    console.log(`🚨 New ${newAlert.severity} alert: ${newAlert.title}`);

    return res.status(201).json({ alert: newAlert });

  } catch (error) {
    console.error('Error creating alert:', error);
    return res.status(500).json({ error: 'Failed to create alert' });
  }
}

async function updateAlert(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;
    const updates = req.body;

    const alertIndex = mockAlerts.findIndex(alert => alert.id === id);
    
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    // Handle specific actions
    if (updates.action) {
      switch (updates.action) {
        case 'acknowledge':
          mockAlerts[alertIndex].status = 'acknowledged';
          mockAlerts[alertIndex].acknowledgedBy = updates.acknowledgedBy || 'user';
          break;
        case 'resolve':
          mockAlerts[alertIndex].status = 'resolved';
          mockAlerts[alertIndex].resolvedAt = new Date().toISOString();
          break;
        case 'silence':
          mockAlerts[alertIndex].status = 'silenced';
          break;
      }
    } else {
      // General update
      mockAlerts[alertIndex] = { ...mockAlerts[alertIndex], ...updates };
    }

    console.log(`🔄 Alert ${id} updated: ${updates.action || 'modified'}`);

    return res.status(200).json({ alert: mockAlerts[alertIndex] });

  } catch (error) {
    console.error('Error updating alert:', error);
    return res.status(500).json({ error: 'Failed to update alert' });
  }
}

async function deleteAlert(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { id } = req.query;

    const alertIndex = mockAlerts.findIndex(alert => alert.id === id);
    
    if (alertIndex === -1) {
      return res.status(404).json({ error: 'Alert not found' });
    }

    const deletedAlert = mockAlerts.splice(alertIndex, 1)[0];

    console.log(`🗑️ Alert ${id} deleted: ${deletedAlert.title}`);

    return res.status(200).json({ message: 'Alert deleted successfully' });

  } catch (error) {
    console.error('Error deleting alert:', error);
    return res.status(500).json({ error: 'Failed to delete alert' });
  }
}