import type { NextApiRequest, NextApiResponse } from 'next';
import pipelineStateManager from '../../services/pipelineStateManager';

// Manual pipeline trigger API for testing purposes
export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse
) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Check if there's already an active pipeline
    const currentPipeline = pipelineStateManager.getCurrentPipeline();
    if (currentPipeline && currentPipeline.status === 'running') {
      return res.status(409).json({
        error: 'Pipeline already running',
        message: `Pipeline ${currentPipeline.id} is currently running`,
        currentPipeline: {
          id: currentPipeline.id,
          status: currentPipeline.status,
          currentStep: currentPipeline.currentStep,
          startTime: currentPipeline.startTime
        }
      });
    }

    // Get manual trigger parameters
    const { 
      message = 'Manual pipeline trigger',
      author = 'Developer',
      branch = 'main'
    } = req.body;

    console.log('[MANUAL-TRIGGER] Starting manual pipeline execution');

    // Create mock commit for manual trigger
    const mockCommit = {
      id: `manual-${Date.now().toString(36)}${Math.random().toString(36).substr(2, 5)}`,
      message,
      author: {
        name: author,
        email: `${author.toLowerCase().replace(/\s+/g, '.')}@example.com`,
        username: author.toLowerCase().replace(/\s+/g, '')
      },
      timestamp: new Date().toISOString(),
      url: '#manual-trigger'
    };

    // Create new pipeline
    const pipeline = pipelineStateManager.createPipeline({
      type: 'manual',
      commit: mockCommit,
      branch,
      author
    });

    console.log(`[MANUAL-TRIGGER] Created pipeline: ${pipeline.id}`);

    // Start pipeline execution
    executePipelineAsync();

    return res.status(200).json({
      message: 'Pipeline started successfully',
      pipelineId: pipeline.id,
      trigger: {
        type: 'manual',
        author,
        branch,
        message
      },
      startTime: pipeline.startTime
    });

  } catch (error) {
    console.error('[MANUAL-TRIGGER] Error starting pipeline:', error);
    return res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to start pipeline'
    });
  }
}

// Async pipeline execution (same logic as git-webhook)
async function executePipelineAsync() {
  // Import pipeline steps
  const { PIPELINE_STEPS } = await import('../../services/pipelineStateManager');
  
  const pipeline = pipelineStateManager.getCurrentPipeline();
  if (!pipeline) {
    console.error('[MANUAL-PIPELINE] No active pipeline to execute');
    return;
  }

  console.log(`[MANUAL-PIPELINE] Starting execution for: ${pipeline.id}`);
  
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

      console.log(`[MANUAL-PIPELINE] Starting step: ${stepId}`);

      // Simulate step execution with realistic timing
      const executionTime = stepConfig.estimatedTime + (Math.random() * 1000 - 500);
      await sleep(executionTime);

      // Simulate failure chance (5% for manual testing)
      const shouldFail = !stepConfig.type.includes('decision') && Math.random() < 0.05;
      
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
        console.log(`[MANUAL-PIPELINE] Failed at step: ${stepId}`);
        return;
      } else {
        // Step succeeded
        pipelineStateManager.updateStepState(stepId, {
          status: 'success',
          progress: 100,
          endTime: new Date().toISOString(),
          details: getStepSuccessMessage(stepId, stepConfig.name)
        });
        
        console.log(`[MANUAL-PIPELINE] Completed step: ${stepId}`);
      }

      // Small delay between steps for better visualization
      await sleep(500);
    }

    // Pipeline completed successfully
    pipelineStateManager.completePipeline('success');
    console.log(`[MANUAL-PIPELINE] Completed successfully: ${pipeline.id}`);

  } catch (error) {
    console.error('[MANUAL-PIPELINE] Execution error:', error);
    pipelineStateManager.completePipeline('failed', `Execution error: ${error}`);
  }
}

// Helper functions (duplicated from git-webhook for now)
function getStepStartMessage(stepId: string, trigger: any): string {
  const messages: { [key: string]: string } = {
    'commit': `📝 Processing manual trigger: ${trigger.commit?.message?.substring(0, 60)}...`,
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
    'commit': '✅ Manual trigger processed successfully',
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

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}