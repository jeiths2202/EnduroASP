import type { NextApiRequest, NextApiResponse } from 'next';

interface RollbackRequest {
  environment: 'staging' | 'production';
  targetVersion?: string;
  rollbackType: 'previous_version' | 'specific_version' | 'emergency_rollback';
  reason: string;
  skipHealthChecks?: boolean;
}

interface RollbackResponse {
  success: boolean;
  rollbackId: string;
  message: string;
  currentVersion?: string;
  targetVersion?: string;
  estimatedDuration?: string;
  githubActionUrl?: string;
  error?: string;
}

interface RollbackHistory {
  id: string;
  timestamp: string;
  environment: string;
  fromVersion: string;
  toVersion: string;
  reason: string;
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
  duration?: string;
  initiatedBy: string;
}

// In-memory store for demo (use database in production)
const rollbackHistory: RollbackHistory[] = [
  {
    id: 'rb-20240120-001',
    timestamp: '2024-01-20T10:30:00Z',
    environment: 'production',
    fromVersion: 'v1.2.5',
    toVersion: 'v1.2.4',
    reason: 'Critical payment processing bug',
    status: 'completed',
    duration: '4m 32s',
    initiatedBy: 'ops-team'
  },
  {
    id: 'rb-20240119-002', 
    timestamp: '2024-01-19T14:15:00Z',
    environment: 'staging',
    fromVersion: 'v1.2.4',
    toVersion: 'v1.2.3',
    reason: 'Performance regression detected',
    status: 'completed',
    duration: '2m 18s',
    initiatedBy: 'developer'
  }
];

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<RollbackResponse | { rollbacks: RollbackHistory[] } | { error: string }>
) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    return getRollbackHistory(req, res);
  } else if (req.method === 'POST') {
    return initiateRollback(req, res);
  } else {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function getRollbackHistory(
  req: NextApiRequest,
  res: NextApiResponse<{ rollbacks: RollbackHistory[] } | { error: string }>
) {
  try {
    const environment = req.query.environment as string;
    const limit = Math.min(parseInt(req.query.limit as string) || 10, 100);

    let filteredHistory = rollbackHistory;

    // Filter by environment if specified
    if (environment && ['staging', 'production'].includes(environment)) {
      filteredHistory = rollbackHistory.filter(rb => rb.environment === environment);
    }

    // Limit results
    const limitedHistory = filteredHistory
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      .slice(0, limit);

    return res.status(200).json({
      rollbacks: limitedHistory
    });

  } catch (error) {
    console.error('Error fetching rollback history:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function initiateRollback(
  req: NextApiRequest,
  res: NextApiResponse<RollbackResponse>
) {
  try {
    const rollbackRequest: RollbackRequest = req.body;

    // Validate request
    const validation = validateRollbackRequest(rollbackRequest);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        rollbackId: '',
        message: validation.message!,
        error: validation.message
      });
    }

    // Generate rollback ID
    const rollbackId = `rb-${new Date().toISOString().split('T')[0].replace(/-/g, '')}-${Date.now().toString().slice(-3)}`;

    // Get current version (mock data)
    const currentVersion = getCurrentVersion(rollbackRequest.environment);
    
    // Determine target version
    let targetVersion = rollbackRequest.targetVersion;
    if (rollbackRequest.rollbackType === 'previous_version' || !targetVersion) {
      targetVersion = getPreviousVersion(currentVersion);
    }

    // Check if rollback is needed
    if (currentVersion === targetVersion) {
      return res.status(400).json({
        success: false,
        rollbackId,
        message: `Already running target version ${targetVersion}`,
        currentVersion,
        targetVersion,
        error: 'No rollback needed'
      });
    }

    // Add to rollback history
    const rollbackRecord: RollbackHistory = {
      id: rollbackId,
      timestamp: new Date().toISOString(),
      environment: rollbackRequest.environment,
      fromVersion: currentVersion,
      toVersion: targetVersion,
      reason: rollbackRequest.reason,
      status: 'pending',
      initiatedBy: req.headers['x-user'] as string || 'api-user'
    };

    rollbackHistory.unshift(rollbackRecord);

    // In a real implementation, this would:
    // 1. Trigger GitHub Actions workflow
    // 2. Update deployment system
    // 3. Send notifications
    // 4. Create deployment records

    // Mock GitHub Actions trigger
    const githubActionUrl = await triggerRollbackWorkflow(rollbackRequest, rollbackId);

    // Estimate duration based on environment and rollback type
    const estimatedDuration = estimateRollbackDuration(rollbackRequest);

    // Update status to in_progress
    const recordIndex = rollbackHistory.findIndex(rb => rb.id === rollbackId);
    if (recordIndex !== -1) {
      rollbackHistory[recordIndex].status = 'in_progress';
    }

    return res.status(200).json({
      success: true,
      rollbackId,
      message: `Rollback initiated successfully for ${rollbackRequest.environment}`,
      currentVersion,
      targetVersion,
      estimatedDuration,
      githubActionUrl
    });

  } catch (error) {
    console.error('Error initiating rollback:', error);
    return res.status(500).json({
      success: false,
      rollbackId: '',
      message: 'Failed to initiate rollback',
      error: 'Internal server error'
    });
  }
}

function validateRollbackRequest(request: RollbackRequest): { valid: boolean; message?: string } {
  if (!request.environment || !['staging', 'production'].includes(request.environment)) {
    return { valid: false, message: 'Invalid or missing environment' };
  }

  if (!request.rollbackType || !['previous_version', 'specific_version', 'emergency_rollback'].includes(request.rollbackType)) {
    return { valid: false, message: 'Invalid or missing rollback type' };
  }

  if (!request.reason || request.reason.trim().length < 10) {
    return { valid: false, message: 'Reason must be at least 10 characters long' };
  }

  if (request.rollbackType === 'specific_version' && !request.targetVersion) {
    return { valid: false, message: 'Target version is required for specific version rollback' };
  }

  if (request.targetVersion && !/^v\d+\.\d+\.\d+$/.test(request.targetVersion)) {
    return { valid: false, message: 'Invalid version format. Expected: vX.Y.Z' };
  }

  // Production rollback additional validations
  if (request.environment === 'production') {
    if (request.rollbackType === 'emergency_rollback' && !request.skipHealthChecks) {
      // Emergency rollbacks should typically skip health checks for speed
    }
  }

  return { valid: true };
}

function getCurrentVersion(environment: string): string {
  // Mock current version data
  const versions = {
    'production': 'v1.2.5',
    'staging': 'v1.2.6'
  };
  return versions[environment as keyof typeof versions] || 'v1.0.0';
}

function getPreviousVersion(currentVersion: string): string {
  // Simple logic to get previous version (decrement patch version)
  const match = currentVersion.match(/^v(\d+)\.(\d+)\.(\d+)$/);
  if (match) {
    const [, major, minor, patch] = match;
    const prevPatch = Math.max(0, parseInt(patch) - 1);
    return `v${major}.${minor}.${prevPatch}`;
  }
  return 'v1.0.0';
}

async function triggerRollbackWorkflow(request: RollbackRequest, rollbackId: string): Promise<string> {
  // In a real implementation, this would trigger the GitHub Actions workflow
  // using the GitHub API or webhook

  const mockWorkflowUrl = `https://github.com/your-org/ofasp-devops/actions/runs/${Date.now()}`;
  
  console.log(`[MOCK] Triggering rollback workflow for ${rollbackId}:`);
  console.log(`  Environment: ${request.environment}`);
  console.log(`  Target Version: ${request.targetVersion}`);
  console.log(`  Reason: ${request.reason}`);
  console.log(`  Workflow URL: ${mockWorkflowUrl}`);

  // Mock API call to GitHub Actions
  // const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });
  // const workflowRun = await octokit.rest.actions.createWorkflowDispatch({
  //   owner: 'your-org',
  //   repo: 'ofasp-devops',
  //   workflow_id: 'rollback-automation.yml',
  //   ref: 'main',
  //   inputs: {
  //     environment: request.environment,
  //     rollback_type: request.rollbackType,
  //     target_version: request.targetVersion || '',
  //     reason: request.reason
  //   }
  // });

  return mockWorkflowUrl;
}

function estimateRollbackDuration(request: RollbackRequest): string {
  // Estimate duration based on environment and rollback type
  const baseDuration = {
    'staging': 120, // 2 minutes base
    'production': 300 // 5 minutes base
  };

  const typeMultiplier = {
    'previous_version': 1.0,
    'specific_version': 1.2,
    'emergency_rollback': 0.8 // Faster due to skipped checks
  };

  const base = baseDuration[request.environment as keyof typeof baseDuration] || 180;
  const multiplier = typeMultiplier[request.rollbackType as keyof typeof typeMultiplier] || 1.0;
  
  const estimatedSeconds = Math.round(base * multiplier);
  const minutes = Math.floor(estimatedSeconds / 60);
  const seconds = estimatedSeconds % 60;

  return `${minutes}m ${seconds}s`;
}