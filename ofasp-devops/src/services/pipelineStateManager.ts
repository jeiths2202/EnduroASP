// Pipeline State Management Service
// Centralized state management for DevOps CI/CD Pipeline

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
}

export interface PipelineStepState {
  status: 'idle' | 'running' | 'success' | 'failed' | 'warning';
  progress?: number;
  startTime?: string;
  endTime?: string;
  duration?: string;
  details?: string;
  error?: string;
}

export interface PipelineState {
  id: string;
  status: 'idle' | 'running' | 'success' | 'failed';
  currentStep: string | null;
  steps: {
    [key: string]: PipelineStepState;
  };
  trigger: {
    type: 'commit' | 'manual';
    commit?: GitCommit;
    branch?: string;
    author?: string;
  };
  startTime?: string;
  endTime?: string;
}

// Pipeline step definitions with metadata
export const PIPELINE_STEPS = [
  { id: 'commit', name: 'Code Commit', type: 'process', estimatedTime: 2000 },
  { id: 'build-artifact', name: 'Build Artifact', type: 'artifact', estimatedTime: 5000 },
  { id: 'build', name: 'Build Check', type: 'process', estimatedTime: 3000 },
  { id: 'build-decision', name: 'Build Success?', type: 'decision', estimatedTime: 1000 },
  { id: 'test', name: 'Testing', type: 'process', estimatedTime: 8000 },
  { id: 'test-decision', name: 'Tests Pass?', type: 'decision', estimatedTime: 1000 },
  { id: 'security', name: 'Security Scan', type: 'process', estimatedTime: 4000 },
  { id: 'security-decision', name: 'Security Pass?', type: 'decision', estimatedTime: 1000 },
  { id: 'deploy', name: 'Deploy', type: 'process', estimatedTime: 6000 },
  { id: 'deploy-decision', name: 'Deploy Success?', type: 'decision', estimatedTime: 1000 },
  { id: 'production', name: 'Production Ready', type: 'process', estimatedTime: 2000 }
];

// External system nodes
export const EXTERNAL_NODES = [
  { id: 'devops-docs', name: 'DevOps Docs', details: 'DevOps documentation and policies' },
  { id: 'ci-cd-tools', name: 'CI/CD Tools', details: 'Jenkins, GitHub Actions, GitLab CI' },
  { id: 'infrastructure', name: 'Infrastructure', details: 'AWS, Kubernetes, Docker' },
  { id: 'monitoring', name: 'Monitoring', details: 'Prometheus, Grafana, ELK Stack' }
];

class PipelineStateManager {
  private currentPipeline: PipelineState | null = null;
  private pipelineHistory: PipelineState[] = [];
  private readonly maxHistorySize = 50;

  // Get current pipeline state
  getCurrentPipeline(): PipelineState | null {
    return this.currentPipeline;
  }

  // Get pipeline history
  getPipelineHistory(limit: number = 10): PipelineState[] {
    return this.pipelineHistory.slice(0, Math.min(limit, this.maxHistorySize));
  }

  // Create new pipeline execution
  createPipeline(trigger: PipelineState['trigger']): PipelineState {
    const pipelineId = `pipeline-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const newPipeline: PipelineState = {
      id: pipelineId,
      status: 'running',
      currentStep: null,
      steps: {},
      trigger,
      startTime: new Date().toISOString()
    };

    // Initialize all steps as idle
    PIPELINE_STEPS.forEach(step => {
      newPipeline.steps[step.id] = {
        status: 'idle',
        progress: 0
      };
    });

    // Initialize external nodes
    EXTERNAL_NODES.forEach(node => {
      newPipeline.steps[node.id] = {
        status: 'idle',
        details: node.details
      };
    });

    // Archive current pipeline if exists
    if (this.currentPipeline) {
      this.pipelineHistory.unshift(this.currentPipeline);
      if (this.pipelineHistory.length > this.maxHistorySize) {
        this.pipelineHistory.pop();
      }
    }

    this.currentPipeline = newPipeline;
    console.log(`[PIPELINE-STATE] Created new pipeline: ${pipelineId}`);
    
    return newPipeline;
  }

  // Update step state
  updateStepState(stepId: string, update: Partial<PipelineStepState>): void {
    if (!this.currentPipeline) {
      console.error('[PIPELINE-STATE] No current pipeline to update');
      return;
    }

    const currentStep = this.currentPipeline.steps[stepId];
    if (!currentStep) {
      console.error(`[PIPELINE-STATE] Step not found: ${stepId}`);
      return;
    }

    this.currentPipeline.steps[stepId] = {
      ...currentStep,
      ...update
    };

    // Calculate duration if endTime is set
    if (update.endTime && currentStep.startTime) {
      const start = new Date(currentStep.startTime).getTime();
      const end = new Date(update.endTime).getTime();
      const durationMs = end - start;
      this.currentPipeline.steps[stepId].duration = this.formatDuration(durationMs);
    }

    console.log(`[PIPELINE-STATE] Updated step ${stepId}:`, update);
  }

  // Set current step
  setCurrentStep(stepId: string | null): void {
    if (!this.currentPipeline) return;
    
    this.currentPipeline.currentStep = stepId;
    console.log(`[PIPELINE-STATE] Set current step: ${stepId}`);
  }

  // Complete pipeline
  completePipeline(status: 'success' | 'failed', error?: string): void {
    if (!this.currentPipeline) return;

    this.currentPipeline.status = status;
    this.currentPipeline.currentStep = null;
    this.currentPipeline.endTime = new Date().toISOString();

    if (error) {
      console.error(`[PIPELINE-STATE] Pipeline failed: ${error}`);
    } else {
      console.log(`[PIPELINE-STATE] Pipeline completed: ${status}`);
    }
  }

  // Reset pipeline (create idle state)
  resetPipeline(): void {
    const resetPipeline: PipelineState = {
      id: 'idle-state',
      status: 'idle',
      currentStep: null,
      steps: {},
      trigger: {
        type: 'manual'
      }
    };

    // Initialize all steps as idle
    PIPELINE_STEPS.forEach(step => {
      resetPipeline.steps[step.id] = {
        status: 'idle',
        progress: 0
      };
    });

    // Initialize external nodes
    EXTERNAL_NODES.forEach(node => {
      resetPipeline.steps[node.id] = {
        status: 'idle',
        details: node.details
      };
    });

    this.currentPipeline = resetPipeline;
    console.log('[PIPELINE-STATE] Pipeline reset to idle state');
  }

  // Get step configuration
  getStepConfig(stepId: string) {
    return PIPELINE_STEPS.find(step => step.id === stepId);
  }

  // Format duration helper
  private formatDuration(ms: number): string {
    if (ms < 1000) return `${ms}ms`;
    if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.floor(ms / 60000)}m ${Math.floor((ms % 60000) / 1000)}s`;
  }

  // Get pipeline statistics
  getStatistics() {
    const history = this.pipelineHistory;
    const total = history.length;
    const successful = history.filter(p => p.status === 'success').length;
    const failed = history.filter(p => p.status === 'failed').length;
    
    return {
      total,
      successful,
      failed,
      successRate: total > 0 ? (successful / total * 100).toFixed(1) : '0'
    };
  }
}

// Singleton instance
const pipelineStateManager = new PipelineStateManager();

// Initialize with idle state
pipelineStateManager.resetPipeline();

export default pipelineStateManager;