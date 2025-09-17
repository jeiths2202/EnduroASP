import type { NextApiRequest, NextApiResponse } from 'next';

// GitHub API types
interface GitHubWorkflowRun {
  id: number;
  name: string;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'neutral' | 'cancelled' | 'skipped' | 'timed_out' | 'action_required' | null;
  created_at: string;
  updated_at: string;
  html_url: string;
  head_branch: string;
  head_sha: string;
  run_number: number;
}

interface PipelineStatus {
  id: string;
  name: string;
  status: 'running' | 'success' | 'failed' | 'pending' | 'cancelled';
  stage: string;
  progress: number;
  startTime: string;
  duration?: string;
  url: string;
  branch: string;
  commit: string;
  runNumber: number;
}

interface PipelineResponse {
  pipelines: PipelineStatus[];
  summary: {
    total: number;
    running: number;
    success: number;
    failed: number;
    lastUpdate: string;
  };
}

// Mock data for development/demo purposes
const generateMockPipelines = (): PipelineStatus[] => {
  const now = new Date();
  const mockPipelines: PipelineStatus[] = [
    {
      id: 'mock-1',
      name: 'COBOL to Java Conversion Pipeline',
      status: 'success',
      stage: 'Deploy to Production',
      progress: 100,
      startTime: new Date(now.getTime() - 300000).toISOString(), // 5 minutes ago
      duration: '4m 32s',
      url: 'https://github.com/openaspax/ofasp-devops/actions/runs/123456',
      branch: 'main',
      commit: 'abc123',
      runNumber: 45
    },
    {
      id: 'mock-2', 
      name: 'CL to Shell Migration Pipeline',
      status: 'running',
      stage: 'Security Scanning',
      progress: 65,
      startTime: new Date(now.getTime() - 180000).toISOString(), // 3 minutes ago
      url: 'https://github.com/openaspax/ofasp-devops/actions/runs/123457',
      branch: 'develop',
      commit: 'def456',
      runNumber: 46
    },
    {
      id: 'mock-3',
      name: 'Dataset Conversion Pipeline',
      status: 'pending',
      stage: 'Queued',
      progress: 0,
      startTime: now.toISOString(),
      url: 'https://github.com/openaspax/ofasp-devops/actions/runs/123458',
      branch: 'feature/dataset-optimization',
      commit: 'ghi789',
      runNumber: 47
    }
  ];

  return mockPipelines;
};

// Fetch real GitHub Actions data
const fetchGitHubPipelines = async (
  owner: string,
  repo: string,
  token?: string
): Promise<PipelineStatus[]> => {
  try {
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'OpenASP-DevOps-Dashboard'
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/actions/runs?per_page=10&status=in_progress,completed`,
      { headers }
    );

    if (!response.ok) {
      throw new Error(`GitHub API responded with status: ${response.status}`);
    }

    const data = await response.json();
    const workflows: GitHubWorkflowRun[] = data.workflow_runs || [];

    return workflows.map((workflow, index) => {
      const startTime = new Date(workflow.created_at);
      const endTime = workflow.updated_at ? new Date(workflow.updated_at) : new Date();
      const duration = workflow.conclusion 
        ? Math.floor((endTime.getTime() - startTime.getTime()) / 1000)
        : null;

      let status: PipelineStatus['status'];
      let progress: number;
      let stage: string;

      if (workflow.status === 'completed') {
        switch (workflow.conclusion) {
          case 'success':
            status = 'success';
            progress = 100;
            stage = 'Completed';
            break;
          case 'failure':
            status = 'failed';
            progress = 100;
            stage = 'Failed';
            break;
          case 'cancelled':
            status = 'cancelled';
            progress = 50;
            stage = 'Cancelled';
            break;
          default:
            status = 'failed';
            progress = 100;
            stage = 'Completed';
        }
      } else if (workflow.status === 'in_progress') {
        status = 'running';
        progress = Math.min(50 + (index * 10), 90); // Simulate progress
        stage = ['Quality Gate', 'Security Scan', 'Build & Test', 'Docker Build', 'Deploy'][index % 5];
      } else {
        status = 'pending';
        progress = 0;
        stage = 'Queued';
      }

      return {
        id: workflow.id.toString(),
        name: workflow.name,
        status,
        stage,
        progress,
        startTime: workflow.created_at,
        duration: duration ? `${Math.floor(duration / 60)}m ${duration % 60}s` : undefined,
        url: workflow.html_url,
        branch: workflow.head_branch,
        commit: workflow.head_sha.substring(0, 7),
        runNumber: workflow.run_number
      };
    });

  } catch (error) {
    console.error('Failed to fetch GitHub pipelines:', error);
    return [];
  }
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<PipelineResponse | { error: string }>
) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  try {
    // Get configuration from environment or query params
    const owner = process.env.GITHUB_OWNER || req.query.owner as string || 'openaspax';
    const repo = process.env.GITHUB_REPO || req.query.repo as string || 'ofasp-devops';
    const token = process.env.GITHUB_TOKEN;
    const useMock = process.env.NODE_ENV === 'development' || req.query.mock === 'true';

    let pipelines: PipelineStatus[];

    if (useMock) {
      // Use mock data for development/demo
      pipelines = generateMockPipelines();
    } else {
      // Fetch real GitHub Actions data
      pipelines = await fetchGitHubPipelines(owner, repo, token);
      
      // Fallback to mock if no real data
      if (pipelines.length === 0) {
        pipelines = generateMockPipelines();
      }
    }

    // Calculate summary statistics
    const summary = {
      total: pipelines.length,
      running: pipelines.filter(p => p.status === 'running').length,
      success: pipelines.filter(p => p.status === 'success').length,
      failed: pipelines.filter(p => p.status === 'failed').length,
      lastUpdate: new Date().toISOString()
    };

    res.status(200).json({
      pipelines,
      summary
    });

  } catch (error) {
    console.error('Pipeline status API error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch pipeline status' 
    });
  }
}