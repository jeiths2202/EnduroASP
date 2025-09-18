import React, { useState, useEffect, useRef, useCallback } from 'react';
import './SmedPositionDisplay.css';
import webSocketService from './websocketService';
import { 
  SmedPositionDisplayProps, 
  PositionField, 
  GridPosition,
  PositionRenderRequest,
  PositionRenderResponse,
  SMED_POSITION_CONSTANTS,
  isPositionField,
  isPositionRenderResponse
} from '../types/smedPosition';

// Error Boundary Component for robust error handling
class SmedPositionDisplayErrorBoundary extends React.Component<
  { children: React.ReactNode; onError?: (error: Error) => void },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('SmedPositionDisplay Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="smed-position-display error-state">
          <div className="error-message">
            <h3>⚠️ SMED Position Display Error</h3>
            <p>An error occurred while rendering the position-based SMED display.</p>
            <details>
              <summary>Error Details</summary>
              <pre>{this.state.error?.toString()}</pre>
            </details>
            <button onClick={() => this.setState({ hasError: false, error: undefined })}>
              Try Again
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

const SmedPositionDisplay: React.FC<SmedPositionDisplayProps> = ({
  mapName,
  mapData = [],
  initialData = [],
  onDataChange,
  onKeyEvent,
  isDarkMode = false
}) => {
  // 24x80 터미널 그리드 초기화
  const [grid, setGrid] = useState<string[][]>(() => {
    return Array(SMED_POSITION_CONSTANTS.GRID.ROWS)
      .fill(null)
      .map(() => Array(SMED_POSITION_CONSTANTS.GRID.COLS).fill(SMED_POSITION_CONSTANTS.ENCODING.EMPTY_CHAR));
  });
  
  // Position-based 데이터 저장 (인덱스 기반)
  const [fieldData, setFieldData] = useState<string[]>(initialData);
  
  // 현재 포커스된 필드 인덱스
  const [focusedFieldIndex, setFocusedFieldIndex] = useState<number | null>(null);
  
  // 커서 위치
  const [cursorPosition, setCursorPosition] = useState<GridPosition>({ row: 0, col: 0 });
  
  // 그리드 준비 상태
  const [isGridReady, setIsGridReady] = useState(false);
  
  // WebSocket 연결 상태
  const [isConnected, setIsConnected] = useState(false);
  
  // 로딩 상태
  const [isLoading, setIsLoading] = useState(false);
  
  const gridRef = useRef<HTMLDivElement>(null);

  // Helper function to check if character is full-width (Japanese/Chinese/Korean)
  const isFullWidth = useCallback((char: string): boolean => {
    if (!char) return false;
    const code = char.charCodeAt(0);
    return (
      (code >= 0x1100 && code <= 0x11FF) || // Hangul Jamo
      (code >= 0x2E80 && code <= 0x2FDF) || // CJK Radicals
      (code >= 0x3000 && code <= 0x303F) || // CJK Symbols and Punctuation
      (code >= 0x3040 && code <= 0x309F) || // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) || // Katakana
      (code >= 0x3100 && code <= 0x31BF) || // Bopomofo
      (code >= 0x3200 && code <= 0x32FF) || // Enclosed CJK
      (code >= 0x3300 && code <= 0x33FF) || // CJK Compatibility
      (code >= 0x3400 && code <= 0x4DBF) || // CJK Extension A
      (code >= 0x4E00 && code <= 0x9FFF) || // CJK Unified Ideographs
      (code >= 0xA000 && code <= 0xA48F) || // Yi Syllables
      (code >= 0xAC00 && code <= 0xD7AF) || // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) || // CJK Compatibility Ideographs
      (code >= 0xFE30 && code <= 0xFE4F) || // CJK Compatibility Forms
      (code >= 0xFF00 && code <= 0xFF60) || // Fullwidth Forms
      (code >= 0xFFE0 && code <= 0xFFEF)    // Halfwidth Forms
    );
  }, []);

  // Initialize grid with position-based field rendering
  useEffect(() => {
    console.log(`SmedPositionDisplay: Initializing grid with ${mapData.length} position fields`);
    
    const newGrid: string[][] = Array(SMED_POSITION_CONSTANTS.GRID.ROWS)
      .fill(null)
      .map(() => Array(SMED_POSITION_CONSTANTS.GRID.COLS).fill(SMED_POSITION_CONSTANTS.ENCODING.EMPTY_CHAR));
    
    // Validate mapData array
    if (!Array.isArray(mapData)) {
      console.error('SmedPositionDisplay: mapData is not an array:', mapData);
      setGrid(newGrid);
      setIsGridReady(true);
      return;
    }

    // Process each position field with index-based data matching
    mapData.forEach((field, index) => {
      if (!isPositionField(field)) {
        console.warn(`SmedPositionDisplay: Skipping invalid field at index ${index}:`, field);
        return;
      }

      const row = field.row - 1; // Convert to 0-based index
      const col = field.col - 1;
      
      // Bounds checking
      if (row < 0 || row >= SMED_POSITION_CONSTANTS.GRID.ROWS || 
          col < 0 || col >= SMED_POSITION_CONSTANTS.GRID.COLS) {
        console.warn(`SmedPositionDisplay: Field ${index} position out of bounds - row: ${row + 1}, col: ${col + 1}`);
        return;
      }

      // Get data for this field by index
      const fieldValue = fieldData[index] || '';
      const fieldLength = Math.min(field.length, SMED_POSITION_CONSTANTS.GRID.COLS - col); // Ensure field fits in grid
      
      // Render field with proper full-width character handling
      let gridCol = col;
      const displayValue = fieldValue.padEnd(fieldLength, SMED_POSITION_CONSTANTS.ENCODING.FILL_CHAR); // Pad with underscores for empty spaces
      
      for (let i = 0; i < fieldLength && gridCol < SMED_POSITION_CONSTANTS.GRID.COLS; i++) {
        const char = displayValue[i] || SMED_POSITION_CONSTANTS.ENCODING.FILL_CHAR;
        
        // Place character in grid
        if (row >= 0 && row < SMED_POSITION_CONSTANTS.GRID.ROWS && 
            gridCol >= 0 && gridCol < SMED_POSITION_CONSTANTS.GRID.COLS) {
          newGrid[row][gridCol] = char;
        }
        
        // Handle full-width characters
        if (isFullWidth(char)) {
          gridCol += 2; // Full-width characters take 2 columns
          if (gridCol > 0 && gridCol <= SMED_POSITION_CONSTANTS.GRID.COLS && 
              row >= 0 && row < SMED_POSITION_CONSTANTS.GRID.ROWS) {
            newGrid[row][gridCol - 1] = SMED_POSITION_CONSTANTS.ENCODING.FULL_WIDTH_PLACEHOLDER; // Mark the second half as empty
          }
        } else {
          gridCol += 1; // Half-width characters take 1 column
        }
      }
    });
    
    setGrid(newGrid);
    setIsGridReady(true);
    console.log(`SmedPositionDisplay: Grid initialization completed with ${mapData.length} fields`);
  }, [mapData, fieldData, isFullWidth]);

  // WebSocket connection and event handling
  useEffect(() => {
    const handleWebSocketConnection = () => {
      setIsConnected(webSocketService.isConnected());
    };

    const handleSmedDataReceived = (data: any) => {
      console.log('SmedPositionDisplay: SMED data received:', data);
      
      // Handle position-based API response
      if (data.map_file === mapName && data.fields) {
        // Check if this is position-based data
        if (Array.isArray(data.fields) && data.fields.length > 0) {
          // If fields contain position data, use as mapData
          if (data.fields[0].row !== undefined && data.fields[0].col !== undefined) {
            // This is position field data, not value data
            console.log('SmedPositionDisplay: Received position field definitions');
            return;
          }
          
          // This is field value data - update fieldData
          const newFieldData = data.fields.map((field: any) => field || '');
          setFieldData(newFieldData);
          
          if (onDataChange) {
            onDataChange(newFieldData);
          }
        }
      }
    };

    // Setup WebSocket event listeners
    webSocketService.on('hub_connected', handleWebSocketConnection);
    webSocketService.on('hub_disconnected', handleWebSocketConnection);
    webSocketService.on('smed_data_received', handleSmedDataReceived);

    // Initial connection check
    handleWebSocketConnection();

    // Cleanup on unmount
    return () => {
      webSocketService.off('hub_connected', handleWebSocketConnection);
      webSocketService.off('hub_disconnected', handleWebSocketConnection);
      webSocketService.off('smed_data_received', handleSmedDataReceived);
    };
  }, [mapName, onDataChange]);

  // Handle keyboard input
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    // Handle function keys (F1-F12)
    if (e.key.startsWith('F') && e.key.length >= 2) {
      e.preventDefault();
      
      if (onKeyEvent) {
        onKeyEvent(e.key, fieldData);
      }
      
      // Send key event through WebSocket
      if (isConnected) {
        webSocketService.sendKeyEventToHub(e.key, {});
      }
      
      return;
    }
    
    if (focusedFieldIndex === null) return;
    
    const currentValue = fieldData[focusedFieldIndex] || '';
    const field = mapData[focusedFieldIndex];
    
    if (!field) return;
    
    switch (e.key) {
      case 'Enter':
        e.preventDefault();
        if (onKeyEvent) {
          onKeyEvent('ENTER', fieldData);
        }
        
        // Send data through WebSocket
        if (isConnected) {
          webSocketService.sendKeyEventToHub('ENTER', {});
        }
        break;
        
      case 'Tab':
        e.preventDefault();
        // Move to next field
        const nextIndex = (focusedFieldIndex + 1) % mapData.length;
        setFocusedFieldIndex(nextIndex);
        
        if (mapData[nextIndex]) {
          setCursorPosition({ 
            row: mapData[nextIndex].row - 1, 
            col: mapData[nextIndex].col - 1 
          });
        }
        break;
        
      case 'Backspace':
        e.preventDefault();
        if (currentValue.length > 0) {
          const newValue = currentValue.slice(0, -1);
          updateFieldData(focusedFieldIndex, newValue);
        }
        break;
        
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Handle cursor movement within field bounds
        e.preventDefault();
        break;
        
      default:
        // Handle character input
        if (e.key.length === 1 && currentValue.length < field.length) {
          e.preventDefault();
          const newValue = currentValue + e.key;
          updateFieldData(focusedFieldIndex, newValue);
        }
    }
  }, [focusedFieldIndex, fieldData, mapData, onKeyEvent, isConnected]);

  // Update field data and notify parent
  const updateFieldData = useCallback((index: number, value: string) => {
    const newFieldData = [...fieldData];
    newFieldData[index] = value;
    setFieldData(newFieldData);
    
    if (onDataChange) {
      onDataChange(newFieldData);
    }
  }, [fieldData, onDataChange]);

  // Handle click on field
  const handleCellClick = useCallback((row: number, col: number) => {
    // Find which field was clicked based on position
    const clickedFieldIndex = mapData.findIndex(field => {
      if (!field) return false;
      
      const fieldRow = field.row - 1;
      const fieldCol = field.col - 1;
      
      return row === fieldRow && 
             col >= fieldCol && 
             col < fieldCol + field.length;
    });
    
    if (clickedFieldIndex >= 0) {
      setFocusedFieldIndex(clickedFieldIndex);
      setCursorPosition({ row, col });
    }
  }, [mapData]);

  // Render character with appropriate styling
  const renderChar = useCallback((char: string, row: number, col: number) => {
    // Skip empty cells (used for second half of full-width characters)
    if (char === '') {
      return null;
    }
    
    // Check if this position is part of a field
    const fieldIndex = mapData.findIndex(field => {
      if (!field) return false;
      
      const fieldRow = field.row - 1;
      const fieldCol = field.col - 1;
      
      return row === fieldRow && 
             col >= fieldCol && 
             col < fieldCol + field.length;
    });
    
    const isField = fieldIndex >= 0;
    const isFocused = isField && fieldIndex === focusedFieldIndex;
    const isCursor = isFocused && row === cursorPosition.row && col === cursorPosition.col;
    const isFullWidthChar = isFullWidth(char);
    
    let className = 'grid-char';
    if (isField) {
      className += ' input-field';
    }
    if (isFocused) {
      className += ' focused-field';
    }
    if (isCursor) {
      className += ' cursor';
    }
    if (isFullWidthChar) {
      className += ' full-width';
    }
    
    const cellStyle = isFullWidthChar ? {
      width: '20px', // Double width for full-width characters (2 * 10px)
      textAlign: 'left' as const
    } : {};
    
    return (
      <span
        key={`${row}-${col}`}
        className={className}
        style={cellStyle}
        onClick={() => handleCellClick(row, col)}
      >
        {char}
      </span>
    );
  }, [mapData, focusedFieldIndex, cursorPosition, isFullWidth, handleCellClick]);

  // Fetch position-based data from API
  const fetchPositionData = useCallback(async () => {
    if (!mapName) return;
    
    setIsLoading(true);
    try {
      const requestData: PositionRenderRequest = {
        map_name: mapName,
        field_data: fieldData,
        terminal_id: webSocketService.getTerminalId(),
        wsname: webSocketService.getWorkstationName()
      };

      const response = await fetch(
        `http://localhost:8000${SMED_POSITION_CONSTANTS.API.POSITION_RENDER}`, 
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(requestData),
        }
      );
      
      if (response.ok) {
        const result: PositionRenderResponse = await response.json();
        console.log('SmedPositionDisplay: Position render API response:', result);
        
        // Validate and handle API response
        if (isPositionRenderResponse(result) && result.success && result.data) {
          // Update field data if provided
          if (Array.isArray(result.data)) {
            setFieldData(result.data);
            if (onDataChange) {
              onDataChange(result.data);
            }
          }
        } else if (result.error) {
          console.error('SmedPositionDisplay: API returned error:', result.error);
        }
      } else {
        console.error('SmedPositionDisplay: API error:', response.status, response.statusText);
      }
    } catch (error) {
      console.error('SmedPositionDisplay: Fetch error:', error);
    } finally {
      setIsLoading(false);
    }
  }, [mapName, fieldData, onDataChange]);

  // Auto-fetch data when component mounts
  useEffect(() => {
    if (mapName && mapData.length > 0) {
      fetchPositionData();
    }
  }, [mapName, mapData.length]); // Only fetch when mapName or mapData structure changes

  // Show loading state if grid is not ready
  if (!isGridReady || !Array.isArray(grid) || grid.length === 0) {
    return (
      <div className={`smed-position-display ${isDarkMode ? 'dark-mode' : ''}`} 
           onKeyDown={handleKeyDown} 
           tabIndex={0}>
        {mapName && <div className="map-header">Position Map: {mapName}</div>}
        <div className="loading-message">
          <p>📊 Loading Position-based SMED display...</p>
          <p>Grid: {Array.isArray(grid) ? `${grid.length} rows initialized` : 'initializing...'}</p>
          <p>Fields: {mapData.length} position fields</p>
          <p>Data: {fieldData.length} field values</p>
          <p>Ready: {isGridReady ? 'Yes' : 'No'}</p>
          <div className="loading-spinner"></div>
        </div>
      </div>
    );
  }

  return (
    <SmedPositionDisplayErrorBoundary onError={(error) => {
      console.error('SmedPositionDisplay caught error:', error);
    }}>
      <div className={`smed-position-display ${isDarkMode ? 'dark-mode' : ''}`} 
           onKeyDown={handleKeyDown} 
           tabIndex={0}>
        {mapName && <div className="map-header">Position Map: {mapName}</div>}
        
        <div className="terminal-grid" ref={gridRef}>
          {grid.map((row, rowIndex) => {
            // Safety check to ensure row is an array
            if (!Array.isArray(row)) {
              console.error(`SmedPositionDisplay: Row ${rowIndex} is not an array:`, row);
              return (
                <div key={rowIndex} className="grid-row error-row">
                  <span>Row {rowIndex + 1}: Invalid data</span>
                </div>
              );
            }
            
            return (
              <div key={rowIndex} className="grid-row">
                {row.map((char, colIndex) => {
                  try {
                    return renderChar(char, rowIndex, colIndex);
                  } catch (error) {
                    console.error(`SmedPositionDisplay: Error rendering char at ${rowIndex},${colIndex}:`, error);
                    return <span key={colIndex} className="grid-char error-char">?</span>;
                  }
                })}
              </div>
            );
          })}
        </div>
        
        <div className="status-bar">
          <div className="status-section">
            <span>Pos: {cursorPosition.row + 1},{cursorPosition.col + 1}</span>
            <span>{focusedFieldIndex !== null ? `Field: ${focusedFieldIndex + 1}` : 'Ready'}</span>
          </div>
          <div className="status-section">
            <span>Fields: {mapData.length}</span>
            <span>Data: {fieldData.length}</span>
            <span className={`connection-status ${isConnected ? 'connected' : 'disconnected'}`}>
              {isConnected ? '🟢 Connected' : '🔴 Disconnected'}
            </span>
          </div>
          <div className="status-section">
            <span>F3=Exit | Enter=Submit | Tab=Next</span>
            {isLoading && <span className="loading-indicator">⏳ Loading...</span>}
          </div>
        </div>
      </div>
    </SmedPositionDisplayErrorBoundary>
  );
};

export default SmedPositionDisplay;