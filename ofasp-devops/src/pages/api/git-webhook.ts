import type { NextApiRequest, NextApiResponse } from 'next';
import pipelineStateManager, { PIPELINE_STEPS } from '../../services/pipelineStateManager';

interface GitCommit {
  id: string;
  message: string;
  author: {
    name: string;
    email: string;
    username?: string;
  };
  timestamp: string;
  url: string;
  added: string[];
  modified: string[];
  removed: string[];
}

interface GitPushPayload {
  ref: string;
  before: string;
  after: string;
  pusher: {
    name: string;
    email: string;
  };
  repository: {
    name: string;
    full_name: string;
    html_url: string;
  };
  commits: GitCommit[];
  head_commit: GitCommit;
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method === 'POST') {
    return handleGitWebhook(req, res);
  } else if (req.method === 'GET') {
    return getPipelineState(req, res);
  } else {
    res.setHeader('Allow', ['POST', 'GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }
}

async function handleGitWebhook(
  req: NextApiRequest,
  res: NextApiResponse
) {
  try {
    // Verify GitHub webhook signature in production
    const signature = req.headers['x-hub-signature-256'] as string;
    const event = req.headers['x-github-event'] as string;
    
    console.log(`[GIT-WEBHOOK] Received event: ${event}`);

    if (event !== 'push') {
      console.log(`[GIT-WEBHOOK] Ignoring non-push event: ${event}`);
      return res.status(200).json({ message: 'Event ignored' });
    }

    const payload: GitPushPayload = req.body;

    // Skip if no commits or if it's a branch deletion
    if (!payload.commits || payload.commits.length === 0 || payload.after === '0000000000000000000000000000000000000000') {
      console.log('[GIT-WEBHOOK] No commits or branch deletion, ignoring');
      return res.status(200).json({ message: 'No commits to process' });
    }

    const branch = payload.ref.replace('refs/heads/', '');
    const headCommit = payload.head_commit;

    console.log(`[GIT-WEBHOOK] Processing push to branch: ${branch}`);
    console.log(`[GIT-WEBHOOK] Latest commit: ${headCommit.id.substring(0, 7)} - ${headCommit.message}`);

    // Create new pipeline using state manager
    const pipeline = pipelineStateManager.createPipeline({
      type: 'commit',
      commit: headCommit,
      branch: branch,
      author: headCommit.author.name
    });

    console.log(`[GIT-WEBHOOK] Started pipeline: ${pipeline.id}`);

    // Start pipeline execution in the background
    executePipeline();

    return res.status(200).json({ 
      message: 'Pipeline started successfully',
      pipelineId: pipeline.id,
      commit: {
        id: headCommit.id.substring(0, 7),
        message: headCommit.message,
        author: headCommit.author.name,
        branch: branch
      }
    });

  } catch (error) {
    console.error('[GIT-WEBHOOK] Error processing webhook:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function getPipelineState(
  req: NextApiRequest,
  res: NextApiResponse
) {
  const pipeline = pipelineStateManager.getCurrentPipeline();
  const statistics = pipelineStateManager.getStatistics();
  
  return res.status(200).json({
    pipeline,
    statistics,
    timestamp: new Date().toISOString()
  });
}

// Enhanced pipeline execution logic using state manager
async function executePipeline() {
  const pipeline = pipelineStateManager.getCurrentPipeline();
  if (!pipeline) {
    console.error('[PIPELINE] No active pipeline to execute');
    return;
  }

  console.log(`[PIPELINE] Starting execution for: ${pipeline.id}`);
  
  try {
    // Execute pipeline steps sequentially
    for (const stepConfig of PIPELINE_STEPS) {
      const stepId = stepConfig.id;
      
      // Set current step
      pipelineStateManager.setCurrentStep(stepId);
      
      // Start step execution
      pipelineStateManager.updateStepState(stepId, {
        status: 'running',
        progress: 0,
        startTime: new Date().toISOString(),
        details: getStepStartMessage(stepId, pipeline.trigger)
      });

      console.log(`[PIPELINE] Starting step: ${stepId}`);

      // Simulate step execution with realistic timing
      const executionTime = stepConfig.estimatedTime + (Math.random() * 1000 - 500); // ±500ms variance
      await sleep(executionTime);

      // Simulate failure chance (3% for process steps, 0% for decisions)
      const shouldFail = !stepConfig.type.includes('decision') && Math.random() < 0.03;
      
      if (shouldFail) {
        // Step failed
        pipelineStateManager.updateStepState(stepId, {
          status: 'failed',
          progress: 0,
          endTime: new Date().toISOString(),
          error: `${stepConfig.name} failed - ${getRandomFailureReason(stepId)}`,
          details: `❌ ${stepConfig.name} failed: ${getRandomFailureReason(stepId)}`
        });
        
        pipelineStateManager.completePipeline('failed', `Pipeline failed at ${stepConfig.name}`);
        console.log(`[PIPELINE] Failed at step: ${stepId}`);
        return;
      } else {
        // Step succeeded
        pipelineStateManager.updateStepState(stepId, {
          status: 'success',
          progress: 100,
          endTime: new Date().toISOString(),
          details: getStepSuccessMessage(stepId, stepConfig.name)
        });
        
        console.log(`[PIPELINE] Completed step: ${stepId}`);
      }

      // Small delay between steps for better visualization
      await sleep(500);
    }

    // Pipeline completed successfully
    pipelineStateManager.completePipeline('success');
    console.log(`[PIPELINE] Completed successfully: ${pipeline.id}`);

  } catch (error) {
    console.error('[PIPELINE] Execution error:', error);
    pipelineStateManager.completePipeline('failed', `Execution error: ${error}`);
  }
}

// Helper functions for realistic step messages
function getStepStartMessage(stepId: string, trigger: any): string {
  const messages: { [key: string]: string } = {
    'commit': `📝 Processing commit: ${trigger.commit?.message?.substring(0, 60)}...`,
    'build-artifact': '🔨 Installing dependencies and compiling source code...',
    'build': '🏗️ Running build verification and quality checks...',
    'build-decision': '✅ Validating build results...',
    'test': '🧪 Running unit tests, integration tests, and coverage analysis...',
    'test-decision': '📊 Analyzing test results and coverage metrics...',
    'security': '🔒 Performing security scan and vulnerability assessment...',
    'security-decision': '🛡️ Reviewing security scan results...',
    'deploy': '🚀 Deploying to staging environment and running smoke tests...',
    'deploy-decision': '✔️ Verifying deployment health and performance...',
    'production': '🌟 Promoting to production and updating monitoring...'
  };
  
  return messages[stepId] || `Processing ${stepId.replace('-', ' ')}...`;
}

function getStepSuccessMessage(stepId: string, stepName: string): string {
  const messages: { [key: string]: string } = {
    'commit': '✅ Commit processed and validated successfully',
    'build-artifact': '✅ Dependencies installed, code compiled, artifacts generated',
    'build': '✅ Build completed with no errors, all quality gates passed',
    'build-decision': '✅ Build validation successful',
    'test': '✅ All tests passed - Unit: 100%, Integration: 100%, Coverage: 95%+',
    'test-decision': '✅ Test results approved, coverage meets requirements',
    'security': '✅ Security scan completed - No vulnerabilities found, Grade: A',
    'security-decision': '✅ Security review passed, ready for deployment',
    'deploy': '✅ Deployment successful, all health checks passed',
    'deploy-decision': '✅ Deployment verified, performance metrics nominal',
    'production': '✅ Production deployment complete, monitoring active'
  };
  
  return messages[stepId] || `✅ ${stepName} completed successfully`;
}

function getRandomFailureReason(stepId: string): string {
  const failureReasons: { [key: string]: string[] } = {
    'commit': ['Invalid syntax detected', 'Merge conflicts found'],
    'build-artifact': ['Dependency resolution failed', 'Compilation error in module'],
    'build': ['Build script failed', 'Missing configuration file'],
    'test': ['Unit test failures detected', 'Integration test timeout'],
    'security': ['Critical vulnerability found', 'Security policy violation'],
    'deploy': ['Deployment script failed', 'Environment not available'],
    'production': ['Health check failed', 'Database connection timeout']
  };
  
  const reasons = failureReasons[stepId] || ['Unknown error occurred'];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

// Utility function for delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}