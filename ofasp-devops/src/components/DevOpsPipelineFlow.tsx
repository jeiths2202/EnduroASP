import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

interface PipelineNode {
  id: string;
  label: string;
  type: 'process' | 'decision' | 'artifact' | 'external';
  status: 'idle' | 'running' | 'success' | 'failed' | 'warning';
  position: { x: number; y: number };
  details?: string;
  progress?: number;
  duration?: string;
}

interface PipelineEdge {
  from: string;
  to: string;
  type: 'success' | 'failure' | 'feedback' | 'standard';
  label?: string;
  animated?: boolean;
}

interface DevOpsPipelineFlowProps {
  isDarkMode?: boolean;
  onNodeClick?: (nodeId: string) => void;
}

const DevOpsPipelineFlow: React.FC<DevOpsPipelineFlowProps> = ({ isDarkMode = false, onNodeClick }) => {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const [nodes, setNodes] = useState<PipelineNode[]>([]);
  const [edges, setEdges] = useState<PipelineEdge[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Initialize pipeline structure
  useEffect(() => {
    const pipelineNodes: PipelineNode[] = [
      // Main Flow - moved down to create more space from stage labels
      { id: 'commit', label: 'Code Commit', type: 'process', status: 'idle', position: { x: 350, y: 250 } },
      { id: 'build-artifact', label: 'Build Artifact', type: 'artifact', status: 'idle', position: { x: 500, y: 250 } },
      { id: 'build', label: 'Build Check', type: 'process', status: 'idle', position: { x: 650, y: 250 } },
      { id: 'build-decision', label: 'Build Success?', type: 'decision', status: 'idle', position: { x: 740, y: 250 } },
      { id: 'test', label: 'Testing', type: 'process', status: 'idle', position: { x: 830, y: 250 } },
      { id: 'test-decision', label: 'Tests Pass?', type: 'decision', status: 'idle', position: { x: 920, y: 250 } },
      { id: 'security', label: 'Security Scan', type: 'process', status: 'idle', position: { x: 1010, y: 250 } },
      { id: 'security-decision', label: 'Security Pass?', type: 'decision', status: 'idle', position: { x: 1100, y: 250 } },
      { id: 'deploy', label: 'Deploy', type: 'process', status: 'idle', position: { x: 1190, y: 250 } },
      { id: 'deploy-decision', label: 'Deploy Success?', type: 'decision', status: 'idle', position: { x: 1280, y: 250 } },
      { id: 'production', label: 'Production Ready', type: 'process', status: 'idle', position: { x: 1380, y: 250 } },
      
      // External Inputs - CI/CD Tools moved further down to point at Build Artifact box
      { id: 'devops-docs', label: 'DevOps Docs', type: 'external', status: 'idle', position: { x: 280, y: 400 } },
      { id: 'ci-cd-tools', label: 'CI/CD Tools', type: 'external', status: 'idle', position: { x: 400, y: 600 } },
      { id: 'infrastructure', label: 'Infrastructure', type: 'external', status: 'idle', position: { x: 1010, y: 400 } },
      { id: 'monitoring', label: 'Monitoring', type: 'external', status: 'idle', position: { x: 1350, y: 475 } }
    ];

    const pipelineEdges: PipelineEdge[] = [
      // Main flow - direct connection from commit to build, bypassing build-artifact visually
      { from: 'commit', to: 'build', type: 'standard' },
      { from: 'build', to: 'build-decision', type: 'standard' },
      { from: 'build-decision', to: 'test', type: 'success', label: 'Yes' },
      { from: 'test', to: 'test-decision', type: 'standard' },
      { from: 'test-decision', to: 'security', type: 'success', label: 'Yes' },
      { from: 'security', to: 'security-decision', type: 'standard' },
      { from: 'security-decision', to: 'deploy', type: 'success', label: 'Yes' },
      { from: 'deploy', to: 'deploy-decision', type: 'standard' },
      { from: 'deploy-decision', to: 'production', type: 'success', label: 'Yes' },
      
      // Failure feedback loops - all point to Build Artifact node (dashed box)
      { from: 'build-decision', to: 'build-artifact', type: 'failure', label: 'No' },
      { from: 'test-decision', to: 'build-artifact', type: 'failure', label: 'No' },
      { from: 'security-decision', to: 'build-artifact', type: 'failure', label: 'No' },
      { from: 'deploy-decision', to: 'build-artifact', type: 'failure', label: 'No' },
      
      // External connections
      { from: 'devops-docs', to: 'commit', type: 'standard' },
      { from: 'ci-cd-tools', to: 'build-artifact', type: 'standard' },
      { from: 'infrastructure', to: 'security', type: 'standard' },
      { from: 'monitoring', to: 'deploy', type: 'standard' }
    ];

    setNodes(pipelineNodes);
    setEdges(pipelineEdges);
  }, []);

  // Fetch real-time pipeline status
  useEffect(() => {
    const fetchPipelineStatus = async () => {
      try {
        const response = await fetch('/api/pipeline-flow-status');
        if (response.ok) {
          const data = await response.json();
          
          // Check if there's an active pipeline
          if (data.error || !data._metadata) {
            console.log('[PIPELINE-UI] No active pipeline, showing idle state');
            return;
          }

          const metadata = data._metadata;
          const steps = data;

          // Update nodes with real-time status
          setNodes(prevNodes => 
            prevNodes.map(node => {
              const stepData = steps[node.id];
              if (!stepData) return node;

              return {
                ...node,
                status: stepData.status || 'idle',
                progress: stepData.progress || 0,
                duration: stepData.duration,
                details: stepData.details || node.details
              };
            })
          );

          // Update edges with animation for current step
          if (metadata.currentStep) {
            setEdges(prevEdges =>
              prevEdges.map(edge => ({
                ...edge,
                animated: edge.from === metadata.currentStep || edge.to === metadata.currentStep
              }))
            );
          } else {
            // Clear all animations when pipeline is complete/failed
            setEdges(prevEdges =>
              prevEdges.map(edge => ({
                ...edge,
                animated: false
              }))
            );
          }

          console.log(`[PIPELINE-UI] Updated status - Pipeline: ${metadata.pipelineId}, Current Step: ${metadata.currentStep}, Status: ${metadata.status}`);
        }
      } catch (error) {
        console.error('Failed to fetch pipeline status:', error);
      }
    };

    // Initial fetch
    fetchPipelineStatus();

    // Set up polling every 2 seconds for more responsive UI
    const interval = setInterval(fetchPipelineStatus, 2000);

    return () => clearInterval(interval);
  }, []);


  const handleNodeClick = (nodeId: string) => {
    setSelectedNode(nodeId);
    if (onNodeClick) {
      onNodeClick(nodeId);
    }
  };

  const handleNodeHover = (nodeId: string, event: React.MouseEvent) => {
    setHoveredNode(nodeId);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 10
      });
      setShowTooltip(true);
    }
  };

  const handleNodeLeave = () => {
    setHoveredNode(null);
    setShowTooltip(false);
  };

  const getNodeColor = (node: PipelineNode) => {
    if (node.type === 'external') return isDarkMode ? '#6b7280' : '#e5e7eb';
    
    switch (node.status) {
      case 'running': return isDarkMode ? '#60a5fa' : '#3b82f6';
      case 'success': return isDarkMode ? '#34d399' : '#10b981';
      case 'failed': return isDarkMode ? '#f87171' : '#ef4444';
      case 'warning': return isDarkMode ? '#fbbf24' : '#f59e0b';
      default: return node.type === 'decision' ? (isDarkMode ? '#f472b6' : '#f472b6') : (isDarkMode ? '#60a5fa' : '#3b82f6');
    }
  };

  const getNodeStroke = (node: PipelineNode) => {
    if (node.id === selectedNode) return isDarkMode ? '#3b82f6' : '#1e40af';
    if (node.type === 'external') return isDarkMode ? '#d1d5db' : '#9ca3af';
    
    switch (node.status) {
      case 'running': return isDarkMode ? '#3b82f6' : '#1e40af';
      case 'success': return isDarkMode ? '#10b981' : '#059669';
      case 'failed': return isDarkMode ? '#ef4444' : '#dc2626';
      case 'warning': return isDarkMode ? '#f59e0b' : '#d97706';
      default: return node.type === 'decision' ? (isDarkMode ? '#ec4899' : '#be185d') : (isDarkMode ? '#3b82f6' : '#1e40af');
    }
  };

  const getEdgeColor = (edge: PipelineEdge) => {
    switch (edge.type) {
      case 'success': return isDarkMode ? '#34d399' : '#10b981';
      case 'failure': return isDarkMode ? '#f87171' : '#ef4444';
      case 'feedback': return isDarkMode ? '#fbbf24' : '#f59e0b';
      default: return isDarkMode ? '#9ca3af' : '#374151';
    }
  };

  const renderNode = (node: PipelineNode) => {
    const isHovered = hoveredNode === node.id;
    const isSelected = selectedNode === node.id;
    const scale = isHovered ? 1.05 : 1;

    if (node.type === 'decision') {
      // Diamond shape for decision nodes
      return (
        <g
          key={node.id}
          transform={`translate(${node.position.x}, ${node.position.y})`}
          onClick={() => handleNodeClick(node.id)}
          onMouseEnter={(e) => handleNodeHover(node.id, e)}
          onMouseLeave={handleNodeLeave}
          style={{ cursor: 'pointer' }}
        >
          <g transform={`scale(${scale})`}>
            <rect
              x="-20"
              y="-20"
              width="40"
              height="40"
              fill={getNodeColor(node)}
              stroke={getNodeStroke(node)}
              strokeWidth={isSelected ? 3 : 2}
              transform="rotate(45)"
              className={node.status === 'running' ? 'animate-pulse' : ''}
            />
            <text
              x="0"
              y="5"
              textAnchor="middle"
              className="text-xs font-semibold"
              fill={isDarkMode ? "#f3f4f6" : "#1f2937"}
            >
              {node.label.split(' ')[0]}
            </text>
            <text
              x="0"
              y="18"
              textAnchor="middle"
              className="text-xs font-semibold"
              fill={isDarkMode ? "#f3f4f6" : "#1f2937"}
            >
              {node.label.split(' ')[1]}
            </text>
          </g>
        </g>
      );
    } else if (node.type === 'artifact') {
      // Enhanced artifact box with AI Verification section
      return (
        <g
          key={node.id}
          transform={`translate(${node.position.x}, ${node.position.y})`}
          onClick={() => handleNodeClick(node.id)}
          onMouseEnter={(e) => handleNodeHover(node.id, e)}
          onMouseLeave={handleNodeLeave}
          style={{ cursor: 'pointer' }}
        >
          {/* Main artifact box - extended downward to red bar position */}
          <rect
            x="-100"
            y="-90"
            width="200"
            height="340"
            fill="none"
            stroke="#6b7280"
            strokeWidth="2"
            strokeDasharray="5,5"
          />
          
          {/* Artifact title */}
          <rect
            x="-90"
            y="-80"
            width="180"
            height="22"
            fill="#f9fafb"
            stroke="#d1d5db"
          />
          <text
            x="0"
            y="-64"
            textAnchor="middle"
            className="text-sm font-semibold"
            fill="#000000"
          >
            {node.label}
          </text>
          
          {/* Standard build items with better spacing */}
          <text x="-85" y="-42" className="text-xs" fill={isDarkMode ? "#ffffff" : "#000000"}>• Dependencies</text>
          <text x="-85" y="-30" className="text-xs" fill={isDarkMode ? "#ffffff" : "#000000"}>• Compiled Code</text>
          <text x="-85" y="-18" className="text-xs" fill={isDarkMode ? "#ffffff" : "#000000"}>• Build Output</text>
          
          {/* AI Verification separator line - moved down */}
          <line
            x1="-90"
            y1="10"
            x2="90"
            y2="10"
            stroke="#1e40af"
            strokeWidth="2"
          />
          
          {/* AI Verification section title - moved down */}
          <text
            x="0"
            y="30"
            textAnchor="middle"
            className="text-sm font-semibold"
            fill={isDarkMode ? "#ffffff" : "#000000"}
          >
            🤖 AI Verification
          </text>
          
          {/* AI verification items in vertical layout with optimized spacing */}
          <g className={node.status === 'running' ? 'animate-pulse' : ''}>
            {/* Code Quality AI Analysis */}
            <rect x="-85" y="55" width="170" height="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="4"/>
            <text x="-80" y="68" className="text-xs" fill="#000000">🤖 Code Quality AI Analysis</text>
            
            {/* Security AI Pre-scan */}
            <rect x="-85" y="90" width="170" height="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="4"/>
            <text x="-80" y="103" className="text-xs" fill="#000000">🤖 Security AI Pre-scan</text>
            
            {/* Performance AI Check */}
            <rect x="-85" y="125" width="170" height="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="4"/>
            <text x="-80" y="138" className="text-xs" fill="#000000">🤖 Performance AI Check</text>
            
            {/* Architecture AI Review */}
            <rect x="-85" y="160" width="170" height="20" fill="#dbeafe" stroke="#3b82f6" strokeWidth="1" rx="4"/>
            <text x="-80" y="173" className="text-xs" fill="#000000">🤖 Architecture AI Review</text>
          </g>
          
          {/* Progress indicator (green bar) - positioned below AI items */}
          {node.progress !== undefined && (
            <rect
              x="-90"
              y="195"
              width={180 * (node.progress / 100)}
              height="10"
              fill="#10b981"
              rx="2"
            />
          )}
        </g>
      );
    } else {
      // Circle for process nodes
      return (
        <g
          key={node.id}
          transform={`translate(${node.position.x}, ${node.position.y})`}
          onClick={() => handleNodeClick(node.id)}
          onMouseEnter={(e) => handleNodeHover(node.id, e)}
          onMouseLeave={handleNodeLeave}
          style={{ cursor: 'pointer' }}
        >
          <g transform={`scale(${scale})`}>
            <circle
              r={node.type === 'external' ? 40 : 30}
              fill={getNodeColor(node)}
              stroke={getNodeStroke(node)}
              strokeWidth={isSelected ? 3 : 2}
              className={node.status === 'running' ? 'animate-pulse' : ''}
            />
            {(() => {
              const words = node.label.split(' ');
              if (words.length === 2) {
                return (
                  <>
                    <text
                      y="-2"
                      textAnchor="middle"
                      className={`text-xs font-semibold ${node.type === 'external' ? (isDarkMode ? 'text-white' : 'text-gray-700') : 'text-white'}`}
                    >
                      {words[0]}
                    </text>
                    <text
                      y="12"
                      textAnchor="middle"
                      className={`text-xs font-semibold ${node.type === 'external' ? (isDarkMode ? 'text-white' : 'text-gray-700') : 'text-white'}`}
                    >
                      {words[1]}
                    </text>
                  </>
                );
              } else {
                return (
                  <text
                    y="5"
                    textAnchor="middle"
                    className={`text-xs font-semibold ${node.type === 'external' ? (isDarkMode ? 'text-white' : 'text-gray-700') : 'text-white'}`}
                  >
                    {node.label}
                  </text>
                );
              }
            })()}
            {node.progress !== undefined && node.type !== 'external' && (
              <>
                <circle
                  r="25"
                  fill="none"
                  stroke="rgba(255,255,255,0.3)"
                  strokeWidth="4"
                />
                <circle
                  r="25"
                  fill="none"
                  stroke="white"
                  strokeWidth="4"
                  strokeDasharray={`${2 * Math.PI * 25 * (node.progress / 100)} ${2 * Math.PI * 25}`}
                  transform="rotate(-90)"
                  style={{ transition: 'stroke-dasharray 0.5s ease' }}
                />
              </>
            )}
          </g>
        </g>
      );
    }
  };

  const renderEdge = (edge: PipelineEdge) => {
    const fromNode = nodes.find(n => n.id === edge.from);
    const toNode = nodes.find(n => n.id === edge.to);
    
    if (!fromNode || !toNode) return null;

    const dx = toNode.position.x - fromNode.position.x;
    const dy = toNode.position.y - fromNode.position.y;
    const angle = Math.atan2(dy, dx);
    
    // Calculate edge endpoints
    const fromRadius = fromNode.type === 'external' ? 40 : 30;
    let toRadius = toNode.type === 'external' ? 40 : 30;
    
    // Special handling for CI/CD Tools to Build Artifact - point to the dashed box edge
    let x1 = fromNode.position.x + fromRadius * Math.cos(angle);
    let y1 = fromNode.position.y + fromRadius * Math.sin(angle);
    let x2 = toNode.position.x - toRadius * Math.cos(angle);
    let y2 = toNode.position.y - toRadius * Math.sin(angle);
    
    // Special handling for connections pointing to Build Artifact node (dashed box)
    if (edge.to === 'build-artifact') {
      if (edge.from === 'ci-cd-tools') {
        // CI/CD Tools points to the green bar at bottom of the dashed artifact box
        x2 = toNode.position.x;       // Center horizontally
        y2 = toNode.position.y + 195; // Point to green bar area (progress indicator position y=195)
      } else if (edge.type === 'failure') {
        // All failure paths point to the right edge of the Build Artifact dashed box
        x2 = toNode.position.x + 100; // Right edge of the 200px wide box
        y2 = toNode.position.y + 170; // Bottom edge - this will be overridden by the failure path logic
      }
    }

    // Path for feedback loops - changed to dotted straight lines with different offsets
    if (edge.type === 'failure' || edge.type === 'feedback') {
      // Calculate different Y offsets for each failure path to avoid overlap and ensure they reach Build Artifact box
      let yOffset = 100;
      const failureEdgeColors = {
        'build-decision': '#ef4444',    // Red
        'test-decision': '#f97316',     // Orange  
        'security-decision': '#d946ef', // Magenta
        'deploy-decision': '#6366f1'    // Indigo
      };
      
      // Different Y offsets for each failure type - staggered to avoid overlap
      if (edge.from === 'build-decision') yOffset = 400;      // Closest to Build Artifact
      else if (edge.from === 'test-decision') yOffset = 420;   // Slightly lower
      else if (edge.from === 'security-decision') yOffset = 440; // Lower still
      else if (edge.from === 'deploy-decision') yOffset = 460;   // Lowest
      
      const edgeColor = failureEdgeColors[edge.from as keyof typeof failureEdgeColors] || getEdgeColor(edge);
      
      return (
        <g key={`${edge.from}-${edge.to}`}>
          {/* Vertical line down from decision node */}
          <line
            x1={x1}
            y1={y1}
            x2={x1}
            y2={yOffset}
            stroke={edgeColor}
            strokeWidth="2"
            strokeDasharray="5,5"
            className={edge.animated ? 'animate-pulse' : ''}
          />
          {/* Horizontal line across to Build Artifact area */}
          <line
            x1={x1}
            y1={yOffset}
            x2={x2}
            y2={yOffset}
            stroke={edgeColor}
            strokeWidth="2"
            strokeDasharray="5,5"
            className={edge.animated ? 'animate-pulse' : ''}
          />
          {/* Vertical line up to Build Artifact box edge (stops at box boundary) - no arrowhead */}
          <line
            x1={x2}
            y1={yOffset}
            x2={x2}
            y2={toNode.position.y + 170}
            stroke={edgeColor}
            strokeWidth="2"
            strokeDasharray="5,5"
            className={edge.animated ? 'animate-pulse' : ''}
          />
          {edge.label && (
            <text
              x={(x1 + x2) / 2}
              y={yOffset - 5}
              textAnchor="middle"
              className="text-xs font-medium"
              fill={edgeColor}
            >
              {edge.label} → Build Artifact
            </text>
          )}
        </g>
      );
    }

    return (
      <g key={`${edge.from}-${edge.to}`}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={getEdgeColor(edge)}
          strokeWidth="2"
          markerEnd={`url(#arrowhead-${edge.type})`}
          className={edge.animated ? 'animate-pulse' : ''}
        />
        {edge.label && (
          <text
            x={(x1 + x2) / 2}
            y={(y1 + y2) / 2 - 5}
            textAnchor="middle"
            className="text-xs"
            fill={getEdgeColor(edge)}
          >
            {edge.label}
          </text>
        )}
      </g>
    );
  };

  const hoveredNodeData = nodes.find(n => n.id === hoveredNode);

  return (
    <div className="relative w-full h-full">

      {/* SVG Container */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 1600 700"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Define arrow markers */}
        <defs>
          {/* Standard markers */}
          {['standard', 'success', 'failure', 'feedback'].map(type => (
            <marker
              key={`arrowhead-${type}`}
              id={`arrowhead-${type}`}
              markerWidth="10"
              markerHeight="7"
              refX="10"
              refY="3.5"
              orient="auto"
            >
              <polygon
                points="0 0, 10 3.5, 0 7"
                fill={type === 'success' ? '#10b981' : type === 'failure' ? '#ef4444' : type === 'feedback' ? '#f59e0b' : '#374151'}
              />
            </marker>
          ))}
          
          {/* Failure-specific markers with different colors */}
          <marker
            id="arrowhead-failure-build-decision"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#ef4444" />
          </marker>
          <marker
            id="arrowhead-failure-test-decision"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#f97316" />
          </marker>
          <marker
            id="arrowhead-failure-security-decision"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#d946ef" />
          </marker>
          <marker
            id="arrowhead-failure-deploy-decision"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon points="0 0, 10 3.5, 0 7" fill="#6366f1" />
          </marker>
        </defs>

        {/* Title */}
        <text x="800" y="30" textAnchor="middle" className="text-2xl font-bold" fill={isDarkMode ? "#f1f5f9" : "#1e293b"}>
          DevOps CI/CD Pipeline Workflow
        </text>

        {/* Subtitle */}
        <text x="800" y="55" textAnchor="middle" className="text-sm" fill={isDarkMode ? "#9ca3af" : "#6b7280"}>
          Real-time Pipeline Execution Monitor
        </text>

        {/* Render edges */}
        {edges.map(edge => renderEdge(edge))}

        {/* Render nodes */}
        {nodes.map(node => renderNode(node))}

        {/* Stage labels - adjusted to new node positions */}
        <text x="350" y="100" textAnchor="middle" className="text-sm font-semibold" fill={isDarkMode ? "#60a5fa" : "#3b82f6"}>
          CI/CD Pipeline Stages
        </text>
        <text x="350" y="120" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#d1d5db" : "#6b7280"}>
          1. Source Control
        </text>
        <text x="500" y="120" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#d1d5db" : "#6b7280"}>
          2. Build & AI Verify
        </text>
        <text x="830" y="120" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#d1d5db" : "#6b7280"}>
          3. Automated Testing
        </text>
        <text x="1010" y="120" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#d1d5db" : "#6b7280"}>
          4. Security & Quality
        </text>
        <text x="1190" y="120" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#d1d5db" : "#6b7280"}>
          5. Deployment
        </text>

        {/* Feedback loop label */}
        <text x="850" y="520" textAnchor="middle" className="text-xs" fill={isDarkMode ? "#fbbf24" : "#f59e0b"}>
          Feedback loops for continuous improvement
        </text>
      </svg>

      {/* Tooltip */}
      {showTooltip && hoveredNodeData && (
        <div
          className="absolute bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm z-20 pointer-events-none max-w-sm"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y
          }}
        >
          <div className="font-semibold mb-1">{hoveredNodeData.label}</div>
          <div className="text-xs space-y-1">
            <div>Status: {hoveredNodeData.status}</div>
            {hoveredNodeData.progress !== undefined && (
              <div>Progress: {hoveredNodeData.progress}%</div>
            )}
            {hoveredNodeData.duration && (
              <div>Duration: {hoveredNodeData.duration}</div>
            )}
            
            {/* AI Verification Details for Build Artifact */}
            {hoveredNodeData.id === 'build-artifact' && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                <div className="text-blue-300 font-medium mb-2">🤖 AI Verification Details:</div>
                <div className="space-y-2 text-xs">
                  <div>
                    <span className="text-blue-200">Code Quality AI Analysis:</span> Automated code review using ML algorithms to detect code smells, maintainability issues, and best practice violations
                  </div>
                  <div>
                    <span className="text-blue-200">Security AI Pre-scan:</span> AI-powered static analysis to identify potential security vulnerabilities before detailed security testing
                  </div>
                  <div>
                    <span className="text-blue-200">Performance AI Check:</span> Machine learning-based performance prediction and optimization suggestions
                  </div>
                  <div>
                    <span className="text-blue-200">Architecture AI Review:</span> AI analysis of code architecture patterns and structural integrity
                  </div>
                </div>
              </div>
            )}
            
            {hoveredNodeData.details && hoveredNodeData.id !== 'build-artifact' && (
              <div className="mt-2 pt-2 border-t border-gray-700">
                {hoveredNodeData.details}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Legend */}
      <div className={`absolute bottom-4 left-4 backdrop-blur-sm rounded-lg shadow-lg p-4 max-w-xs border ${isDarkMode ? 'bg-gray-800/95 border-gray-600' : 'bg-white/95 border-gray-200'}`}>
        <h4 className={`font-semibold text-sm mb-3 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>Legend</h4>
        <div className="grid grid-cols-1 gap-3 text-xs">
          <div className="space-y-2">
            <div className={`font-medium text-xs mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Node Types:</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-blue-500"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Process Node</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-pink-500 transform rotate-45"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Decision Point</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-dashed border-gray-500"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Artifact with AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded-full bg-gray-300"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>External Input</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className={`font-medium text-xs mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>🤖 AI Verification:</div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-blue-200 border border-blue-400 rounded-sm"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Quality AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-blue-200 border border-blue-400 rounded-sm"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Security AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-blue-200 border border-blue-400 rounded-sm"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Performance AI</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-2 bg-blue-200 border border-blue-400 rounded-sm"></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Architecture AI</span>
            </div>
          </div>
          
          <div className="space-y-2">
            <div className={`font-medium text-xs mb-1 ${isDarkMode ? 'text-gray-200' : 'text-gray-900'}`}>Failure Routes:</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-red-500" style={{borderStyle: 'dashed', borderWidth: '1px 0'}}></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Build Fails</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-orange-500" style={{borderStyle: 'dashed', borderWidth: '1px 0'}}></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Test Fails</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-fuchsia-500" style={{borderStyle: 'dashed', borderWidth: '1px 0'}}></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Security Fails</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-1 bg-indigo-500" style={{borderStyle: 'dashed', borderWidth: '1px 0'}}></div>
              <span className={isDarkMode ? 'text-gray-300' : 'text-gray-700'}>Deploy Fails</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevOpsPipelineFlow;