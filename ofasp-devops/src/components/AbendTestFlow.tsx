import React, { useState, useEffect, useRef } from 'react';
import { useI18n } from '../hooks/useI18n';

interface TestStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  message?: string;
  startTime?: string;
  endTime?: string;
  duration?: number;
}

interface TestScenarioStatus {
  isRunning: boolean;
  currentStep: number;
  totalSteps: number;
  steps: TestStep[];
  startTime?: string;
  endTime?: string;
  overallStatus: 'idle' | 'running' | 'success' | 'failed';
}

interface AbendTestFlowProps {
  isDarkMode?: boolean;
}

const AbendTestFlow: React.FC<AbendTestFlowProps> = ({ isDarkMode = false }) => {
  const { t } = useI18n();
  const svgRef = useRef<SVGSVGElement>(null);
  const [testStatus, setTestStatus] = useState<TestScenarioStatus | null>(null);
  const [selectedStep, setSelectedStep] = useState<string | null>(null);
  const [hoveredStep, setHoveredStep] = useState<string | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [tooltipPosition, setTooltipPosition] = useState({ x: 0, y: 0 });

  // Step positions for visualization
  const stepPositions = [
    { x: 150, y: 200 },  // F3 Check
    { x: 300, y: 200 },  // Zabbix Monitor
    { x: 450, y: 200 },  // DevOps Logs
    { x: 600, y: 200 },  // Backup Verify
    { x: 750, y: 200 },  // Compile Verify
    { x: 900, y: 200 },  // F3 Test
    { x: 1050, y: 200 }  // Summary
  ];

  // Fetch test status
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await fetch('/api/abend-test-scenario');
        if (response.ok) {
          const data = await response.json();
          setTestStatus(data);
        }
      } catch (error) {
        console.error('Failed to fetch test status:', error);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []);

  // Start test scenario
  const startTestScenario = async () => {
    try {
      const response = await fetch('/api/abend-test-scenario?action=start', {
        method: 'POST'
      });
      if (response.ok) {
        const data = await response.json();
        setTestStatus(data.status);
      }
    } catch (error) {
      console.error('Failed to start test scenario:', error);
    }
  };

  const getStepColor = (step: TestStep) => {
    switch (step.status) {
      case 'running': return '#3b82f6'; // Blue
      case 'success': return '#10b981'; // Green
      case 'failed': return '#ef4444';  // Red
      default: return '#6b7280';        // Gray
    }
  };

  const getStepStroke = (step: TestStep) => {
    switch (step.status) {
      case 'running': return '#1e40af';
      case 'success': return '#059669';
      case 'failed': return '#dc2626';
      default: return '#4b5563';
    }
  };

  const getStatusIcon = (step: TestStep) => {
    switch (step.status) {
      case 'running': return '🔄';
      case 'success': return '✅';
      case 'failed': return '❌';
      default: return '⏳';
    }
  };

  const handleStepHover = (stepId: string, event: React.MouseEvent) => {
    setHoveredStep(stepId);
    const rect = svgRef.current?.getBoundingClientRect();
    if (rect) {
      setTooltipPosition({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top - 10
      });
      setShowTooltip(true);
    }
  };

  const handleStepLeave = () => {
    setHoveredStep(null);
    setShowTooltip(false);
  };

  const renderStep = (step: TestStep, index: number) => {
    const position = stepPositions[index];
    const isHovered = hoveredStep === step.id;
    const isSelected = selectedStep === step.id;
    const scale = isHovered ? 1.05 : 1;

    return (
      <g
        key={step.id}
        transform={`translate(${position.x}, ${position.y})`}
        onClick={() => setSelectedStep(selectedStep === step.id ? null : step.id)}
        onMouseEnter={(e) => handleStepHover(step.id, e)}
        onMouseLeave={handleStepLeave}
        style={{ cursor: 'pointer' }}
      >
        <g transform={`scale(${scale})`}>
          <circle
            r="35"
            fill={getStepColor(step)}
            stroke={getStepStroke(step)}
            strokeWidth={isSelected ? 3 : 2}
            className={step.status === 'running' ? 'animate-pulse' : ''}
          />
          <text
            y="-5"
            textAnchor="middle"
            className="text-xs font-semibold fill-white"
          >
            Step {index + 1}
          </text>
          <text
            y="8"
            textAnchor="middle"
            className="text-xs font-semibold fill-white"
          >
            {getStatusIcon(step)}
          </text>
          {step.status === 'running' && (
            <circle
              r="30"
              fill="none"
              stroke="rgba(255,255,255,0.5)"
              strokeWidth="3"
              strokeDasharray="10 5"
              className="animate-spin"
              style={{ transformOrigin: 'center' }}
            />
          )}
        </g>
        {/* Step label */}
        <text
          y="60"
          textAnchor="middle"
          className="text-xs font-medium"
          fill={isDarkMode ? '#e5e7eb' : '#374151'}
        >
          {step.name.split(' ')[0]}
        </text>
        <text
          y="75"
          textAnchor="middle"
          className="text-xs"
          fill={isDarkMode ? '#9ca3af' : '#6b7280'}
        >
          {step.name.split(' ').slice(1).join(' ')}
        </text>
      </g>
    );
  };

  const renderConnection = (fromIndex: number, toIndex: number) => {
    const from = stepPositions[fromIndex];
    const to = stepPositions[toIndex];
    
    const x1 = from.x + 35;
    const y1 = from.y;
    const x2 = to.x - 35;
    const y2 = to.y;

    // Determine line style based on step status
    const fromStep = testStatus?.steps[fromIndex];
    const toStep = testStatus?.steps[toIndex];
    
    let strokeColor = '#6b7280';
    let strokeDasharray = 'none';
    let animated = false;

    if (fromStep?.status === 'success' && toStep?.status === 'running') {
      strokeColor = '#3b82f6';
      animated = true;
    } else if (fromStep?.status === 'success' && toStep?.status === 'success') {
      strokeColor = '#10b981';
    } else if (fromStep?.status === 'failed') {
      strokeColor = '#ef4444';
      strokeDasharray = '5,5';
    }

    return (
      <g key={`connection-${fromIndex}-${toIndex}`}>
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={strokeColor}
          strokeWidth="3"
          strokeDasharray={strokeDasharray}
          markerEnd="url(#arrowhead)"
          className={animated ? 'animate-pulse' : ''}
        />
      </g>
    );
  };

  const hoveredStepData = testStatus?.steps.find(s => s.id === hoveredStep);

  if (!testStatus) {
    return <div>Loading test scenario status...</div>;
  }

  return (
    <div className="relative w-full h-full">
      {/* Control Panel */}
      <div className="absolute top-4 right-4 z-10 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 space-y-3">
        <h3 className={`font-semibold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>ABEND Test Control</h3>
        <div className="space-y-2">
          <button
            onClick={startTestScenario}
            disabled={testStatus.isRunning}
            className={`w-full px-4 py-2 rounded text-sm font-medium transition-colors ${
              testStatus.isRunning
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                : 'bg-red-500 text-white hover:bg-red-600'
            }`}
          >
            {testStatus.isRunning ? 'Test Running...' : 'Start ABEND Test'}
          </button>
          
          <div className="text-xs space-y-1">
            <div>Status: <span className={`font-semibold ${
              testStatus.overallStatus === 'success' ? 'text-green-600' :
              testStatus.overallStatus === 'failed' ? 'text-red-600' :
              testStatus.overallStatus === 'running' ? 'text-blue-600' : 'text-gray-600'
            }`}>{testStatus.overallStatus.toUpperCase()}</span></div>
            <div>Progress: {testStatus.currentStep}/{testStatus.totalSteps}</div>
            {testStatus.startTime && (
              <div>Started: {new Date(testStatus.startTime).toLocaleTimeString()}</div>
            )}
          </div>
        </div>
      </div>

      {/* SVG Container */}
      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox="0 0 1200 400"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Define arrow markers */}
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="10"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#6b7280"
            />
          </marker>
        </defs>

        {/* Title */}
        <text x="600" y="30" textAnchor="middle" className="text-xl font-bold" fill={isDarkMode ? '#e5e7eb' : '#1e293b'}>
          ABEND Auto-Fix Test Scenario
        </text>

        <text x="600" y="55" textAnchor="middle" className="text-sm" fill={isDarkMode ? '#9ca3af' : '#6b7280'}>
          End-to-End ABEND Detection and Auto-Fix Pipeline Testing
        </text>

        {/* Render connections */}
        {stepPositions.slice(0, -1).map((_, index) => 
          renderConnection(index, index + 1)
        )}

        {/* Render steps */}
        {testStatus.steps.map((step, index) => renderStep(step, index))}

        {/* Timeline indicator */}
        <text x="600" y="350" textAnchor="middle" className="text-xs" fill={isDarkMode ? '#9ca3af' : '#6b7280'}>
          Each step runs for 5-10 seconds with real system verification
        </text>
      </svg>

      {/* Tooltip */}
      {showTooltip && hoveredStepData && (
        <div
          className="absolute bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm z-20 pointer-events-none"
          style={{
            left: tooltipPosition.x + 10,
            top: tooltipPosition.y
          }}
        >
          <div className="font-semibold mb-1">{hoveredStepData.name}</div>
          <div className="text-xs space-y-1">
            <div>Status: {hoveredStepData.status}</div>
            {hoveredStepData.message && (
              <div>Details: {hoveredStepData.message}</div>
            )}
            {hoveredStepData.startTime && (
              <div>Started: {new Date(hoveredStepData.startTime).toLocaleTimeString()}</div>
            )}
            {hoveredStepData.duration && (
              <div>Duration: {hoveredStepData.duration}ms</div>
            )}
          </div>
        </div>
      )}

      {/* Step Details Panel */}
      {selectedStep && (
        <div className="absolute bottom-4 left-4 right-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-4 z-10">
          {(() => {
            const step = testStatus.steps.find(s => s.id === selectedStep);
            if (!step) return null;
            
            return (
              <div>
                <h4 className="font-semibold text-lg mb-2 flex items-center">
                  <span className="mr-2">{getStatusIcon(step)}</span>
                  {step.name}
                </h4>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <span className="text-gray-600 dark:text-gray-400">Status:</span>
                    <div className={`font-medium ${
                      step.status === 'success' ? 'text-green-600' :
                      step.status === 'failed' ? 'text-red-600' :
                      step.status === 'running' ? 'text-blue-600' : 'text-gray-600'
                    }`}>
                      {step.status.toUpperCase()}
                    </div>
                  </div>
                  {step.startTime && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Started:</span>
                      <div className="font-medium">{new Date(step.startTime).toLocaleTimeString()}</div>
                    </div>
                  )}
                  {step.duration && (
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Duration:</span>
                      <div className="font-medium">{(step.duration / 1000).toFixed(1)}s</div>
                    </div>
                  )}
                  <div>
                    <button
                      onClick={() => setSelectedStep(null)}
                      className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                    >
                      ✕ Close
                    </button>
                  </div>
                </div>
                {step.message && (
                  <div className="mt-3 p-3 bg-gray-50 dark:bg-gray-700 rounded">
                    <span className="text-gray-600 dark:text-gray-400 text-sm">Details:</span>
                    <p className="text-sm mt-1">{step.message}</p>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* Legend */}
      <div className="absolute bottom-4 left-4 bg-white dark:bg-gray-800 rounded-lg shadow-lg p-3">
        <h4 className={`font-semibold text-sm mb-2 ${isDarkMode ? 'text-white' : 'text-black'}`}>Status Legend</h4>
        <div className="space-y-1 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500"></div>
            <span className={isDarkMode ? 'text-white' : 'text-black'}>Pending</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 animate-pulse"></div>
            <span className={isDarkMode ? 'text-white' : 'text-black'}>Running</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className={isDarkMode ? 'text-white' : 'text-black'}>Success</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className={isDarkMode ? 'text-white' : 'text-black'}>Failed</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AbendTestFlow;