import type { NextApiRequest, NextApiResponse } from 'next';
import pipelineStateManager from '../../services/pipelineStateManager';

// API endpoint for real-time pipeline flow visualization
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Get current pipeline state from state manager
    const currentPipeline = pipelineStateManager.getCurrentPipeline();
    
    if (!currentPipeline) {
      // Return idle state if no pipeline is running
      return res.status(200).json({
        error: 'No active pipeline',
        message: 'No pipeline is currently running'
      });
    }

    // Transform pipeline state to match frontend expectations
    const pipelineStatus: any = {};
    
    // Add pipeline metadata
    const metadata = {
      pipelineId: currentPipeline.id,
      status: currentPipeline.status,
      currentStep: currentPipeline.currentStep,
      startTime: currentPipeline.startTime,
      endTime: currentPipeline.endTime,
      trigger: currentPipeline.trigger
    };

    // Convert step states to API format
    Object.keys(currentPipeline.steps).forEach(stepId => {
      const step = currentPipeline.steps[stepId];
      pipelineStatus[stepId] = {
        status: step.status,
        progress: step.progress || 0,
        duration: step.duration,
        details: step.details || `${stepId.replace('-', ' ')} step`,
        startTime: step.startTime,
        endTime: step.endTime,
        error: step.error
      };
    });

    // Add pipeline statistics
    const statistics = pipelineStateManager.getStatistics();

    res.status(200).json({
      ...pipelineStatus,
      _metadata: metadata,
      _statistics: statistics,
      _timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('[PIPELINE-FLOW-STATUS] Error fetching pipeline state:', error);
    res.status(500).json({ 
      error: 'Internal server error',
      message: 'Failed to fetch pipeline status'
    });
  }
}