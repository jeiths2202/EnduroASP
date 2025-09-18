import type { NextApiRequest, NextApiResponse } from 'next';

interface DeploymentEvent {
  id: string;
  timestamp: string;
  type: 'deployment_started' | 'deployment_completed' | 'deployment_failed' | 'rollback_initiated';
  environment: 'staging' | 'production';
  version: string;
  commit: string;
  branch: string;
  author: string;
  metadata?: Record<string, any>;
}

interface WebhookPayload {
  action: string;
  deployment: {
    id: number;
    sha: string;
    ref: string;
    environment: string;
    creator: {
      login: string;
    };
    created_at: string;
  };
  deployment_status?: {
    state: string;
    target_url?: string;
    description?: string;
  };
}

// In-memory store for demo purposes (use Redis/Database in production)
const deploymentEvents: DeploymentEvent[] = [];
const MAX_EVENTS = 100;

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    return handleDeploymentWebhook(req, res);
  } else if (req.method === 'GET') {
    return getDeploymentEvents(req, res);
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function handleDeploymentWebhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify GitHub webhook signature in production
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;

    if (!event) {
      return res.status(400).json({ error: 'Missing GitHub event header' });
    }

    console.log(`Received GitHub webhook: ${event}`);

    let deploymentEvent: DeploymentEvent | null = null;

    if (event === 'deployment') {
      const payload: WebhookPayload = req.body;
      
      deploymentEvent = {
        id: `deploy-${payload.deployment.id}`,
        timestamp: payload.deployment.created_at,
        type: 'deployment_started',
        environment: payload.deployment.environment as 'staging' | 'production',
        version: payload.deployment.sha.substring(0, 7),
        commit: payload.deployment.sha,
        branch: payload.deployment.ref,
        author: payload.deployment.creator.login,
        metadata: {
          deploymentId: payload.deployment.id,
          fullSha: payload.deployment.sha
        }
      };
    } else if (event === 'deployment_status') {
      const payload: WebhookPayload = req.body;
      
      let type: DeploymentEvent['type'];
      switch (payload.deployment_status?.state) {
        case 'success':
          type = 'deployment_completed';
          break;
        case 'failure':
        case 'error':
          type = 'deployment_failed';
          break;
        default:
          type = 'deployment_started';
      }

      deploymentEvent = {
        id: `deploy-status-${payload.deployment.id}`,
        timestamp: new Date().toISOString(),
        type,
        environment: payload.deployment.environment as 'staging' | 'production',
        version: payload.deployment.sha.substring(0, 7),
        commit: payload.deployment.sha,
        branch: payload.deployment.ref,
        author: payload.deployment.creator.login,
        metadata: {
          deploymentId: payload.deployment.id,
          state: payload.deployment_status?.state,
          targetUrl: payload.deployment_status?.target_url,
          description: payload.deployment_status?.description
        }
      };
    }

    if (deploymentEvent) {
      // Add to events store
      deploymentEvents.unshift(deploymentEvent);
      
      // Keep only the latest events
      if (deploymentEvents.length > MAX_EVENTS) {
        deploymentEvents.splice(MAX_EVENTS);
      }

      console.log(`Added deployment event: ${deploymentEvent.type} for ${deploymentEvent.environment}`);

      // Here you would typically:
      // 1. Store in database
      // 2. Send real-time notifications (WebSockets/SSE)
      // 3. Trigger monitoring alerts
      // 4. Update deployment dashboard

      // Send Slack notification (mock)
      await sendSlackNotification(deploymentEvent);
    }

    return res.status(200).json({ 
      message: 'Webhook processed successfully',
      event: deploymentEvent 
    });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getDeploymentEvents(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
    const environment = req.query.environment as string;

    let events = deploymentEvents;

    // Filter by environment if specified
    if (environment && ['staging', 'production'].includes(environment)) {
      events = events.filter(e => e.environment === environment);
    }

    // Limit results
    events = events.slice(0, limit);

    // Add some mock events if empty (for demo)
    if (events.length === 0) {
      events = generateMockDeploymentEvents();
    }

    return res.status(200).json({
      events,
      total: events.length,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error fetching deployment events:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Mock notification function
async function sendSlackNotification(event: DeploymentEvent) {
  // In production, this would send to actual Slack webhook
  console.log(`[SLACK] ${getSlackMessage(event)}`);
}

function getSlackMessage(event: DeploymentEvent): string {
  const emoji = {
    deployment_started: '🚀',
    deployment_completed: '✅',
    deployment_failed: '❌',
    rollback_initiated: '🔄'
  };

  const baseMessage = `${emoji[event.type]} *${event.type.replace('_', ' ').toUpperCase()}*`;
  const details = `Environment: *${event.environment}*\nVersion: \`${event.version}\`\nBranch: \`${event.branch}\`\nAuthor: ${event.author}`;

  return `${baseMessage}\n${details}`;
}

// Generate mock events for demo
function generateMockDeploymentEvents(): DeploymentEvent[] {
  const now = new Date();
  return [
    {
      id: 'mock-deploy-1',
      timestamp: new Date(now.getTime() - 300000).toISOString(), // 5 minutes ago
      type: 'deployment_completed',
      environment: 'production',
      version: 'abc123',
      commit: 'abc123456789',
      branch: 'main',
      author: 'developer',
      metadata: { deploymentId: 12345 }
    },
    {
      id: 'mock-deploy-2',
      timestamp: new Date(now.getTime() - 600000).toISOString(), // 10 minutes ago
      type: 'deployment_started',
      environment: 'staging',
      version: 'def456',
      commit: 'def456789012',
      branch: 'develop',
      author: 'devops-bot',
      metadata: { deploymentId: 12346 }
    },
    {
      id: 'mock-deploy-3',
      timestamp: new Date(now.getTime() - 900000).toISOString(), // 15 minutes ago
      type: 'deployment_failed',
      environment: 'staging',
      version: 'ghi789',
      commit: 'ghi789012345',
      branch: 'feature/hotfix',
      author: 'developer',
      metadata: { 
        deploymentId: 12347,
        description: 'Database migration failed'
      }
    }
  ];
}