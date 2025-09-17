import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  DocumentTextIcon,
  CpuChipIcon,
  LinkIcon,
  TrashIcon,
  CloudArrowDownIcon,
  CloudArrowUpIcon,
  PlusIcon,
  PlayIcon,
  MagnifyingGlassPlusIcon,
  MagnifyingGlassMinusIcon
} from '@heroicons/react/24/outline';

interface Position {
  x: number;
  y: number;
}

interface MapNode {
  id: string;
  type: 'MAP' | 'PROGRAM';
  position: Position;
  data: {
    name: string;
    file?: string;  // for MAP
    path?: string;  // for PROGRAM
  };
}

interface Connection {
  id: string;
  source: string;
  target: string;
  type: 'orthogonal';
  data: {
    key: string;
    parameters: Record<string, string>;
  };
  path?: Position[];  // Calculated path for orthogonal routing
}

interface MapLinkData {
  version: string;
  nodes: MapNode[];
  connections: Connection[];
}

interface MapLinkProps {
  isDarkMode: boolean;
}

const MapLink: React.FC<MapLinkProps> = ({ isDarkMode }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<MapNode[]>([]);
  const [connections, setConnections] = useState<Connection[]>([]);
  const [selectedNode, setSelectedNode] = useState<string | null>(null);
  const [selectedConnection, setSelectedConnection] = useState<string | null>(null);
  const [draggedNode, setDraggedNode] = useState<string | null>(null);
  const [dragOffset, setDragOffset] = useState<Position>({ x: 0, y: 0 });
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectingFrom, setConnectingFrom] = useState<string | null>(null);
  const [tempConnectionEnd, setTempConnectionEnd] = useState<Position | null>(null);
  const [nodeCounter, setNodeCounter] = useState(0);
  const [connectionCounter, setConnectionCounter] = useState(0);
  const [smedFiles, setSmedFiles] = useState<string[]>([]);
  const [programs, setPrograms] = useState<string[]>([]);
  const [javaClasses, setJavaClasses] = useState<string[]>([]);
  const [statusMessage, setStatusMessage] = useState('노드를 추가하고 연결하여 맵과 프로그램의 관계를 정의하세요.');
  const [zoom, setZoom] = useState(1);
  const [isMouseInCanvas, setIsMouseInCanvas] = useState(false);

  // Node properties for selected node
  const [nodeProperties, setNodeProperties] = useState({
    name: '',
    file: '',
    path: ''
  });

  // Connection properties for selected connection
  const [connectionProperties, setConnectionProperties] = useState({
    key: 'Enter',
    parameters: {} as Record<string, string>
  });

  const NODE_WIDTH = 120;
  const NODE_HEIGHT = 60;
  const NODE_RADIUS = 8;

  useEffect(() => {
    loadSmedFiles();
    loadPrograms();
    loadJavaClasses();
    loadMapLinkData();
  }, []);

  useEffect(() => {
    drawCanvas();
  }, [nodes, connections, selectedNode, selectedConnection, tempConnectionEnd]);

  const loadSmedFiles = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/smed/files');
      if (response.ok) {
        const data = await response.json();
        setSmedFiles(data.files || []);
      }
    } catch (error) {
      console.error('Failed to load SMED files:', error);
    }
  };

  const loadPrograms = async () => {
    // Load program list from smed_pgm.json
    try {
      const response = await fetch('/src/smed_pgm.json');
      if (response.ok) {
        const data = await response.json();
        const programList = Object.values(data.programs || {}).map((p: any) => p.PGM);
        setPrograms(programList);
      }
    } catch (error) {
      // Fallback to sample programs
      setPrograms(['LoginProgram', 'MenuProgram', 'DataProcessor', 'ReportGenerator']);
    }
  };

  const loadJavaClasses = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/java/classes');
      if (response.ok) {
        const data = await response.json();
        setJavaClasses(data.classes || []);
      } else {
        // Fallback to local directory structure
        const fallbackClasses = [
          'com.openasp.common.InputParser',
          'com.openasp.common.JSONResponse',
          'com.openasp.core.PGM1',
          'com.openasp.core.PGM2',
          'com.openasp.launcher.OpenASPLauncher',
          'com.openasp.login.LoginProgram',
          'com.openasp.menu.MenuProgram',
          'com.openasp.system.LogoutProgram',
          'com.openasp.system.SystemInfo',
          'com.openasp.user.UserManagement'
        ];
        setJavaClasses(fallbackClasses);
      }
    } catch (error) {
      console.error('Failed to load Java classes:', error);
      // Use fallback classes based on directory analysis
      const fallbackClasses = [
        'com.openasp.common.InputParser',
        'com.openasp.common.JSONResponse', 
        'com.openasp.core.PGM1',
        'com.openasp.core.PGM2',
        'com.openasp.launcher.OpenASPLauncher',
        'com.openasp.login.LoginProgram',
        'com.openasp.menu.MenuProgram',
        'com.openasp.system.LogoutProgram',
        'com.openasp.system.SystemInfo',
        'com.openasp.user.UserManagement'
      ];
      setJavaClasses(fallbackClasses);
    }
  };

  const loadMapLinkData = () => {
    const saved = localStorage.getItem('mapLinkData');
    if (saved) {
      try {
        const data: MapLinkData = JSON.parse(saved);
        setNodes(data.nodes);
        setConnections(data.connections);
        
        // Update counters
        const maxNodeId = Math.max(...data.nodes.map(n => parseInt(n.id.split('-')[1]) || 0), 0);
        const maxConnId = Math.max(...data.connections.map(c => parseInt(c.id.split('-')[1]) || 0), 0);
        setNodeCounter(maxNodeId);
        setConnectionCounter(maxConnId);
      } catch (error) {
        console.error('Failed to load map link data:', error);
      }
    }
  };

  const saveMapLinkData = () => {
    const data: MapLinkData = {
      version: '1.0',
      nodes,
      connections
    };
    
    localStorage.setItem('mapLinkData', JSON.stringify(data));
    
    // Also download as file
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'maplink_data.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    
    setStatusMessage('맵 링크 데이터가 저장되었습니다.');
  };

  const createNode = (type: 'MAP' | 'PROGRAM', position: Position) => {
    const newCounter = nodeCounter + 1;
    setNodeCounter(newCounter);
    
    const newNode: MapNode = {
      id: `node-${newCounter}`,
      type,
      position,
      data: {
        name: type === 'MAP' ? 'New Map' : 'New Program',
        ...(type === 'MAP' ? { file: '' } : { path: '' })
      }
    };
    
    setNodes([...nodes, newNode]);
    setSelectedNode(newNode.id);
    updateNodeProperties(newNode);
    setStatusMessage(`${type} 노드가 추가되었습니다.`);
  };

  const updateNodeProperties = (node: MapNode) => {
    setNodeProperties({
      name: node.data.name,
      file: node.data.file || '',
      path: node.data.path || ''
    });
  };

  const updateConnectionProperties = (connection: Connection) => {
    setConnectionProperties({
      key: connection.data.key,
      parameters: connection.data.parameters
    });
  };

  const handleNodePropertyChange = (property: string, value: string) => {
    setNodeProperties(prev => ({ ...prev, [property]: value }));
    
    if (selectedNode) {
      setNodes(nodes.map(node => {
        if (node.id === selectedNode) {
          return {
            ...node,
            data: {
              ...node.data,
              [property]: value
            }
          };
        }
        return node;
      }));
    }
  };

  const handleConnectionPropertyChange = (property: string, value: any) => {
    setConnectionProperties(prev => ({ ...prev, [property]: value }));
    
    if (selectedConnection) {
      setConnections(connections.map(conn => {
        if (conn.id === selectedConnection) {
          return {
            ...conn,
            data: {
              ...conn.data,
              [property]: value
            }
          };
        }
        return conn;
      }));
    }
  };

  const drawCanvas = () => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;

    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Set styles
    ctx.strokeStyle = isDarkMode ? '#4ade80' : '#16a34a';
    ctx.fillStyle = isDarkMode ? '#4ade80' : '#16a34a';
    ctx.lineWidth = 2;

    // Draw connections
    connections.forEach(connection => {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      
      if (sourceNode && targetNode) {
        const isSelected = connection.id === selectedConnection;
        ctx.strokeStyle = isSelected ? '#facc15' : (isDarkMode ? '#4ade80' : '#16a34a');
        ctx.lineWidth = isSelected ? 3 : 2;
        
        drawOrthogonalConnection(
          ctx,
          sourceNode.position,
          targetNode.position,
          NODE_WIDTH,
          NODE_HEIGHT
        );
        
        // Draw connection label
        const midX = (sourceNode.position.x + targetNode.position.x) / 2 + NODE_WIDTH / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 + NODE_HEIGHT / 2;
        
        ctx.fillStyle = isDarkMode ? '#ffffff' : '#000000';
        ctx.font = '12px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(connection.data.key, midX, midY - 5);
      }
    });

    // Draw temporary connection while connecting
    if (isConnecting && connectingFrom && tempConnectionEnd) {
      const sourceNode = nodes.find(n => n.id === connectingFrom);
      if (sourceNode) {
        ctx.strokeStyle = '#60a5fa';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        
        drawOrthogonalConnection(
          ctx,
          sourceNode.position,
          { x: tempConnectionEnd.x - NODE_WIDTH / 2, y: tempConnectionEnd.y - NODE_HEIGHT / 2 },
          NODE_WIDTH,
          NODE_HEIGHT
        );
        
        ctx.setLineDash([]);
      }
    }

    // Draw nodes
    nodes.forEach(node => {
      const isSelected = node.id === selectedNode;
      const isDragged = node.id === draggedNode;
      
      // Node shadow
      if (isSelected || isDragged) {
        ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetX = 2;
        ctx.shadowOffsetY = 2;
      }
      
      // Node background
      ctx.fillStyle = node.type === 'MAP' 
        ? (isDarkMode ? '#1e40af' : '#3b82f6')
        : (isDarkMode ? '#7c3aed' : '#8b5cf6');
      
      if (isSelected) {
        ctx.fillStyle = node.type === 'MAP' 
          ? (isDarkMode ? '#2563eb' : '#60a5fa')
          : (isDarkMode ? '#8b5cf6' : '#a78bfa');
      }
      
      // Draw rounded rectangle
      drawRoundedRect(
        ctx,
        node.position.x,
        node.position.y,
        NODE_WIDTH,
        NODE_HEIGHT,
        NODE_RADIUS
      );
      
      ctx.fill();
      
      // Reset shadow
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetX = 0;
      ctx.shadowOffsetY = 0;
      
      // Node border
      ctx.strokeStyle = isSelected ? '#facc15' : (isDarkMode ? '#ffffff' : '#000000');
      ctx.lineWidth = isSelected ? 3 : 1;
      drawRoundedRect(
        ctx,
        node.position.x,
        node.position.y,
        NODE_WIDTH,
        NODE_HEIGHT,
        NODE_RADIUS
      );
      ctx.stroke();
      
      // Node icon
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 20px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(
        node.type === 'MAP' ? '📄' : '⚙️',
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2 - 10
      );
      
      // Node label
      ctx.font = '12px monospace';
      ctx.fillText(
        node.data.name,
        node.position.x + NODE_WIDTH / 2,
        node.position.y + NODE_HEIGHT / 2 + 15
      );
    });
  };

  const drawRoundedRect = (
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    width: number,
    height: number,
    radius: number
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
  };

  const drawOrthogonalConnection = (
    ctx: CanvasRenderingContext2D,
    start: Position,
    end: Position,
    nodeWidth: number,
    nodeHeight: number
  ) => {
    const startX = start.x + nodeWidth / 2;
    const startY = start.y + nodeHeight / 2;
    const endX = end.x + nodeWidth / 2;
    const endY = end.y + nodeHeight / 2;
    
    ctx.beginPath();
    ctx.moveTo(startX, startY);
    
    // Simple orthogonal routing
    const midX = (startX + endX) / 2;
    
    ctx.lineTo(midX, startY);
    ctx.lineTo(midX, endY);
    ctx.lineTo(endX, endY);
    
    ctx.stroke();
    
    // Draw arrow at the end
    const arrowSize = 8;
    ctx.beginPath();
    ctx.moveTo(endX, endY);
    ctx.lineTo(endX - arrowSize, endY - arrowSize);
    ctx.lineTo(endX - arrowSize, endY + arrowSize);
    ctx.closePath();
    ctx.fill();
  };

  const handleCanvasMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    // Check if clicking on a node
    const clickedNode = nodes.find(node => 
      x >= node.position.x &&
      x <= node.position.x + NODE_WIDTH &&
      y >= node.position.y &&
      y <= node.position.y + NODE_HEIGHT
    );
    
    if (clickedNode) {
      if (e.shiftKey) {
        // Start connection mode
        setIsConnecting(true);
        setConnectingFrom(clickedNode.id);
        setSelectedConnection(null);
        setStatusMessage('연결할 대상 노드를 클릭하세요.');
      } else {
        // Start dragging
        setSelectedNode(clickedNode.id);
        setSelectedConnection(null);
        setDraggedNode(clickedNode.id);
        setDragOffset({
          x: x - clickedNode.position.x,
          y: y - clickedNode.position.y
        });
        updateNodeProperties(clickedNode);
      }
    } else {
      // Check if clicking on a connection
      const clickedConnection = findConnectionAtPoint(x, y);
      if (clickedConnection) {
        setSelectedConnection(clickedConnection.id);
        setSelectedNode(null);
        updateConnectionProperties(clickedConnection);
      } else {
        // Clear selection and stop connecting
        setSelectedNode(null);
        setSelectedConnection(null);
        if (isConnecting) {
          setIsConnecting(false);
          setConnectingFrom(null);
          setTempConnectionEnd(null);
          setStatusMessage('연결 생성이 취소되었습니다.');
        }
      }
    }
  };

  const handleCanvasMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isConnecting) {
      setTempConnectionEnd({ x, y });
    } else if (draggedNode) {
      setNodes(nodes.map(node => {
        if (node.id === draggedNode) {
          return {
            ...node,
            position: {
              x: x - dragOffset.x,
              y: y - dragOffset.y
            }
          };
        }
        return node;
      }));
    }
  };

  const handleCanvasMouseUp = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    if (isConnecting && connectingFrom) {
      // Check if releasing on a node
      const targetNode = nodes.find(node => 
        x >= node.position.x &&
        x <= node.position.x + NODE_WIDTH &&
        y >= node.position.y &&
        y <= node.position.y + NODE_HEIGHT
      );
      
      if (targetNode && targetNode.id !== connectingFrom) {
        // Check if connection already exists
        const existingConnection = connections.find(conn => 
          (conn.source === connectingFrom && conn.target === targetNode.id) ||
          (conn.source === targetNode.id && conn.target === connectingFrom)
        );
        
        if (!existingConnection) {
          // Create connection
          const newCounter = connectionCounter + 1;
          setConnectionCounter(newCounter);
          
          const newConnection: Connection = {
            id: `conn-${newCounter}`,
            source: connectingFrom,
            target: targetNode.id,
            type: 'orthogonal',
            data: {
              key: 'Enter',
              parameters: {}
            }
          };
          
          setConnections([...connections, newConnection]);
          setSelectedConnection(newConnection.id);
          updateConnectionProperties(newConnection);
          setStatusMessage('연결이 생성되었습니다.');
        } else {
          setStatusMessage('이미 연결된 노드입니다.');
        }
      } else {
        setStatusMessage('연결 생성이 취소되었습니다.');
      }
      
      setIsConnecting(false);
      setConnectingFrom(null);
      setTempConnectionEnd(null);
    }
    
    // Clear drag state
    if (draggedNode) {
      setDraggedNode(null);
      setStatusMessage('노드 이동이 완료되었습니다.');
    }
  };

  const findConnectionAtPoint = (x: number, y: number): Connection | null => {
    // Simple hit detection for connections (can be improved)
    for (const connection of connections) {
      const sourceNode = nodes.find(n => n.id === connection.source);
      const targetNode = nodes.find(n => n.id === connection.target);
      
      if (sourceNode && targetNode) {
        const midX = (sourceNode.position.x + targetNode.position.x) / 2 + NODE_WIDTH / 2;
        const midY = (sourceNode.position.y + targetNode.position.y) / 2 + NODE_HEIGHT / 2;
        
        // Check if click is near the middle of the connection
        if (Math.abs(x - midX) < 20 && Math.abs(y - midY) < 20) {
          return connection;
        }
      }
    }
    
    return null;
  };

  const deleteSelected = () => {
    if (selectedNode) {
      // Remove node and its connections
      setNodes(nodes.filter(n => n.id !== selectedNode));
      setConnections(connections.filter(c => c.source !== selectedNode && c.target !== selectedNode));
      setSelectedNode(null);
      setStatusMessage('노드가 삭제되었습니다.');
    } else if (selectedConnection) {
      // Remove connection
      setConnections(connections.filter(c => c.id !== selectedConnection));
      setSelectedConnection(null);
      setStatusMessage('연결이 삭제되었습니다.');
    }
  };

  const clearAll = () => {
    if (window.confirm('모든 노드와 연결을 삭제하시겠습니까?')) {
      setNodes([]);
      setConnections([]);
      setSelectedNode(null);
      setSelectedConnection(null);
      setNodeCounter(0);
      setConnectionCounter(0);
      setStatusMessage('모든 노드와 연결이 삭제되었습니다.');
    }
  };

  const addParameterField = () => {
    if (selectedConnection) {
      const paramName = prompt('파라미터 이름을 입력하세요:');
      if (paramName) {
        handleConnectionPropertyChange('parameters', {
          ...connectionProperties.parameters,
          [paramName]: ''
        });
      }
    }
  };

  const updateParameter = (key: string, value: string) => {
    handleConnectionPropertyChange('parameters', {
      ...connectionProperties.parameters,
      [key]: value
    });
  };

  const deleteParameter = (key: string) => {
    const newParams = { ...connectionProperties.parameters };
    delete newParams[key];
    handleConnectionPropertyChange('parameters', newParams);
  };

  return (
    <div className="h-full bg-gray-900 text-white p-6 overflow-hidden">
      <div className="h-full flex flex-col">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-bold mb-2">MapLink - 객체 연결 관리</h1>
          <p className="text-gray-400">SMED 맵과 프로그램 간의 연결 관계를 정의하고 키 바인딩을 설정하세요</p>
        </div>

        {/* Toolbar */}
        <div className="bg-gray-800 rounded-lg p-4 mb-6">
          <div className="flex flex-wrap gap-4 items-center">
            {/* Node buttons */}
            <button
              onClick={() => {
                const pos = { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 };
                createNode('MAP', pos);
              }}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded flex items-center gap-2 transition-colors"
            >
              <DocumentTextIcon className="w-4 h-4" />
              MAP 추가
            </button>
            
            <button
              onClick={() => {
                const pos = { x: 50 + Math.random() * 200, y: 50 + Math.random() * 200 };
                createNode('PROGRAM', pos);
              }}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded flex items-center gap-2 transition-colors"
            >
              <CpuChipIcon className="w-4 h-4" />
              PROGRAM 추가
            </button>

            <div className="h-6 w-px bg-gray-600" />

            <span className="text-sm text-gray-400">
              Shift+클릭으로 노드 연결
            </span>

            {/* Action buttons */}
            <div className="flex gap-2 ml-auto">
              <button
                onClick={saveMapLinkData}
                className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded flex items-center gap-2 transition-colors"
              >
                <CloudArrowDownIcon className="w-4 h-4" />
                저장
              </button>
              
              <button
                onClick={deleteSelected}
                disabled={!selectedNode && !selectedConnection}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 rounded flex items-center gap-2 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                선택 삭제
              </button>
              
              <button
                onClick={clearAll}
                className="px-4 py-2 bg-red-800 hover:bg-red-900 rounded flex items-center gap-2 transition-colors"
              >
                <TrashIcon className="w-4 h-4" />
                전체 삭제
              </button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 flex gap-6 overflow-hidden">
          {/* Canvas */}
          <div className="flex-1 bg-gray-800 rounded-lg overflow-hidden relative" ref={containerRef}>
            {/* Zoom Controls */}
            <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
              <button
                onMouseEnter={() => setZoom(prev => Math.min(prev + 0.1, 2.0))}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                title="확대 (마우스 오버)"
              >
                <MagnifyingGlassPlusIcon className="w-4 h-4" />
              </button>
              <button
                onMouseEnter={() => setZoom(prev => Math.max(prev - 0.1, 0.5))}
                className="p-2 bg-gray-700 hover:bg-gray-600 rounded text-white transition-colors"
                title="축소 (마우스 오버)"
              >
                <MagnifyingGlassMinusIcon className="w-4 h-4" />
              </button>
              <div className="text-xs text-gray-300 text-center px-2 py-1 bg-gray-700 rounded">
                {Math.round(zoom * 100)}%
              </div>
            </div>
            
            <canvas
              ref={canvasRef}
              width={1200}
              height={600}
              className="w-full h-full cursor-pointer"
              style={{ transform: `scale(${zoom})`, transformOrigin: 'top left' }}
              onMouseDown={handleCanvasMouseDown}
              onMouseMove={handleCanvasMouseMove}
              onMouseUp={handleCanvasMouseUp}
              onMouseEnter={() => setIsMouseInCanvas(true)}
              onMouseLeave={() => {
                setIsMouseInCanvas(false);
                setDraggedNode(null);
                if (isConnecting) {
                  setIsConnecting(false);
                  setConnectingFrom(null);
                  setTempConnectionEnd(null);
                  setStatusMessage('연결 생성이 취소되었습니다.');
                }
              }}
            />
          </div>

          {/* Properties Panel */}
          <div className="w-80 bg-gray-800 rounded-lg p-4 overflow-y-auto">
            {selectedNode && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  {nodes.find(n => n.id === selectedNode)?.type === 'MAP' ? (
                    <>
                      <DocumentTextIcon className="w-5 h-5 text-blue-400" />
                      MAP 속성
                    </>
                  ) : (
                    <>
                      <CpuChipIcon className="w-5 h-5 text-purple-400" />
                      PROGRAM 속성
                    </>
                  )}
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">이름</label>
                    <input
                      type="text"
                      value={nodeProperties.name}
                      onChange={(e) => handleNodePropertyChange('name', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    />
                  </div>
                  
                  {nodes.find(n => n.id === selectedNode)?.type === 'MAP' ? (
                    <div>
                      <label className="block text-sm font-medium mb-1">SMED 파일</label>
                      <select
                        value={nodeProperties.file}
                        onChange={(e) => handleNodePropertyChange('file', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                      >
                        <option value="">선택하세요</option>
                        {smedFiles.map(file => (
                          <option key={file} value={file}>{file}</option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <div>
                      <label className="block text-sm font-medium mb-1">프로그램 경로</label>
                      <select
                        value={nodeProperties.path}
                        onChange={(e) => handleNodePropertyChange('path', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white mb-2"
                      >
                        <option value="">Java 클래스 선택</option>
                        {javaClasses.map(className => (
                          <option key={className} value={className}>{className}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={nodeProperties.path}
                        onChange={(e) => handleNodePropertyChange('path', e.target.value)}
                        className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                        placeholder="com.example.Program 또는 위에서 선택"
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
            
            {selectedConnection && (
              <div>
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <LinkIcon className="w-5 h-5 text-green-400" />
                  연결 속성
                </h3>
                
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium mb-1">트리거 키</label>
                    <select
                      value={connectionProperties.key}
                      onChange={(e) => handleConnectionPropertyChange('key', e.target.value)}
                      className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded text-white"
                    >
                      <option value="Enter">Enter</option>
                      <option value="F1">F1</option>
                      <option value="F2">F2</option>
                      <option value="F3">F3</option>
                      <option value="F4">F4</option>
                      <option value="F5">F5</option>
                      <option value="F6">F6</option>
                      <option value="F7">F7</option>
                      <option value="F8">F8</option>
                      <option value="F9">F9</option>
                      <option value="F10">F10</option>
                      <option value="F11">F11</option>
                      <option value="F12">F12</option>
                    </select>
                  </div>
                  
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">파라미터</label>
                      <button
                        onClick={addParameterField}
                        className="px-2 py-1 bg-blue-600 hover:bg-blue-700 rounded text-xs flex items-center gap-1"
                      >
                        <PlusIcon className="w-3 h-3" />
                        추가
                      </button>
                    </div>
                    
                    <div className="space-y-2">
                      {Object.entries(connectionProperties.parameters).map(([key, value]) => (
                        <div key={key} className="flex gap-2">
                          <input
                            type="text"
                            value={key}
                            readOnly
                            className="flex-1 px-2 py-1 bg-gray-600 border border-gray-500 rounded text-sm"
                          />
                          <input
                            type="text"
                            value={value}
                            onChange={(e) => updateParameter(key, e.target.value)}
                            placeholder="필드명"
                            className="flex-1 px-2 py-1 bg-gray-700 border border-gray-600 rounded text-sm"
                          />
                          <button
                            onClick={() => deleteParameter(key)}
                            className="px-2 py-1 bg-red-600 hover:bg-red-700 rounded text-xs"
                          >
                            <TrashIcon className="w-3 h-3" />
                          </button>
                        </div>
                      ))}
                      
                      {Object.keys(connectionProperties.parameters).length === 0 && (
                        <p className="text-sm text-gray-400">파라미터가 없습니다</p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {!selectedNode && !selectedConnection && (
              <div className="text-center text-gray-400">
                <p className="mb-4">노드나 연결을 선택하여 속성을 편집하세요</p>
                <p className="text-sm">
                  • 노드 추가: 상단 버튼 클릭<br />
                  • 노드 이동: 드래그<br />
                  • 연결 생성: Shift+클릭<br />
                  • 삭제: 선택 후 삭제 버튼
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Status Bar */}
        <div className="mt-4 bg-gray-800 rounded px-4 py-2 text-sm text-gray-300 flex justify-between items-center">
          <span>{statusMessage}</span>
          <div className="flex items-center gap-4 text-xs">
            <span>노드: {nodes.length}</span>
            <span>연결: {connections.length}</span>
            <span>확대/축소: {Math.round(zoom * 100)}%</span>
            {isMouseInCanvas && <span className="text-green-400">• 활성</span>}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MapLink;