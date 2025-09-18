import React, { useState, useEffect, useRef } from 'react';
import './SmedMapDisplay.css';

// Error Boundary Component for robust error handling
class SmedDisplayErrorBoundary extends React.Component<
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
    console.error('SmedMapDisplay Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="smed-map-display error-state">
          <div className="error-message">
            <h3>⚠️ SMED Display Error</h3>
            <p>An error occurred while rendering the SMED display.</p>
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

interface SmedField {
  name: string;
  row: number;
  col: number;
  length: number;
  value?: string;
  prompt?: string;
  type?: string;
}

interface SmedMapDisplayProps {
  fields: SmedField[];
  onSubmit?: (fieldValues: Record<string, string>) => void;
  onClose?: () => void;
  onKeyEvent?: (key: string, fieldValues: Record<string, string>) => Promise<any>;
  mapName?: string;
}

const SmedMapDisplay: React.FC<SmedMapDisplayProps> = ({ fields, onSubmit, onClose, onKeyEvent, mapName }) => {
  const [grid, setGrid] = useState<string[][]>(() => {
    // Initialize grid immediately to prevent loading state
    return Array(24).fill(null).map(() => Array(80).fill(' '));
  });
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [cursorPosition, setCursorPosition] = useState({ row: 0, col: 0 });
  const [isGridReady, setIsGridReady] = useState(false);
  const [hasInputFields, setHasInputFields] = useState(false);
  const gridRef = useRef<HTMLDivElement>(null);

  // Helper function to check if character is full-width (Japanese/Chinese)
  const isFullWidth = (char: string): boolean => {
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
  };

  // Initialize 24x80 grid with proper full-width character handling
  useEffect(() => {
    console.log(`SmedMapDisplay: Starting grid initialization with ${Array.isArray(fields) ? fields.length : 'invalid'} fields`);
    
    const newGrid: string[][] = Array(24).fill(null).map(() => Array(80).fill(' '));
    
    // Validate fields array
    if (!Array.isArray(fields)) {
      console.error('SmedMapDisplay: fields is not an array:', fields);
      setGrid(newGrid);
      setIsGridReady(true); // Still mark as ready even with no valid fields
      setHasInputFields(false);
      return;
    }
    
    if (fields.length === 0) {
      console.warn('SmedMapDisplay: Empty fields array received');
      setGrid(newGrid);
      setIsGridReady(true);
      setHasInputFields(false);
      return;
    }
    
    // Filter out invalid fields before processing
    const validFields = fields.filter(field => {
      if (!field || typeof field.row !== 'number' || typeof field.col !== 'number') {
        console.warn('SmedMapDisplay: Skipping invalid field data:', field);
        return false;
      }
      
      const row = field.row - 1; // Convert to 0-based index
      const col = field.col - 1;
      
      // Bounds checking for row and col
      if (row < 0 || row >= 24 || col < 0 || col >= 80) {
        console.warn(`SmedMapDisplay: Skipping field - position out of bounds - row: ${row + 1}, col: ${col + 1}, field:`, field);
        return false;
      }
      
      return true;
    });
    
    console.log(`SmedMapDisplay: Processing ${validFields.length} valid fields out of ${fields.length} total fields`);
    
    // Check if there are any input fields (fields without prompt)
    const inputFields = validFields.filter(field => !field.prompt);
    const hasInputs = inputFields.length > 0;
    setHasInputFields(hasInputs);
    
    console.log(`SmedMapDisplay: Found ${inputFields.length} input fields. HasInputFields: ${hasInputs}`);
    
    // Place valid fields on the grid
    validFields.forEach(field => {
      const row = field.row - 1; // Convert to 0-based index
      let col = field.col - 1;
      
      // Place prompt or value (output field)
      if (field.prompt && typeof field.prompt === 'string') {
        // Output field - display prompt text
        let gridCol = col;
        const safePrompt = field.prompt.slice(0, Math.min(field.prompt.length, 80 - col)); // Truncate if too long
        
        for (let i = 0; i < safePrompt.length && gridCol < 80; i++) {
          const char = safePrompt[i];
          
          // Ensure we don't exceed grid bounds
          if (row >= 0 && row < 24 && gridCol >= 0 && gridCol < 80) {
            newGrid[row][gridCol] = char;
          }
          
          // If this is a full-width character, skip the next column
          if (isFullWidth(char)) {
            gridCol += 2; // Full-width characters take 2 columns
            if (gridCol > 0 && gridCol <= 80 && row >= 0 && row < 24) {
              newGrid[row][gridCol - 1] = ''; // Mark the second half as empty
            }
          } else {
            gridCol += 1; // Half-width characters take 1 column
          }
        }
      } else if (field.value && typeof field.value === 'string') {
        // Output field with data value - display the actual data
        let gridCol = col;
        const safeValue = field.value.slice(0, Math.min(field.value.length, 80 - col)); // Truncate if too long
        
        for (let i = 0; i < safeValue.length && gridCol < 80; i++) {
          const char = safeValue[i];
          
          // Ensure we don't exceed grid bounds
          if (row >= 0 && row < 24 && gridCol >= 0 && gridCol < 80) {
            newGrid[row][gridCol] = char;
          }
          
          // If this is a full-width character, skip the next column
          if (isFullWidth(char)) {
            gridCol += 2; // Full-width characters take 2 columns
            if (gridCol > 0 && gridCol <= 80 && row >= 0 && row < 24) {
              newGrid[row][gridCol - 1] = ''; // Mark the second half as empty
            }
          } else {
            gridCol += 1; // Half-width characters take 1 column
          }
        }
      }
      
      // Initialize field value
      if (!field.prompt) {
        // Input field
        const value = fieldValues[field.name] || field.value || '';
        const fieldLength = typeof field.length === 'number' && field.length > 0 ? Math.min(field.length, 80 - col) : Math.min(10, 80 - col);
        const paddedValue = value.toString().padEnd(fieldLength, '_');
        let gridCol = col;
        
        for (let i = 0; i < fieldLength && gridCol < 80; i++) {
          const char = paddedValue[i] || '_';
          
          // Ensure we don't exceed grid bounds
          if (row >= 0 && row < 24 && gridCol >= 0 && gridCol < 80) {
            newGrid[row][gridCol] = char;
          }
          
          // If this is a full-width character, skip the next column
          if (isFullWidth(char)) {
            gridCol += 2;
            if (gridCol > 0 && gridCol <= 80 && row >= 0 && row < 24) {
              newGrid[row][gridCol - 1] = '';
            }
          } else {
            gridCol += 1;
          }
        }
      }
    });
    
    setGrid(newGrid);
    setIsGridReady(true);
    
    // Only auto-focus on first input field if there are input fields
    if (hasInputs) {
      const sortedInputFields = inputFields.sort((a, b) => {
        if (a.row !== b.row) return a.row - b.row;
        return a.col - b.col;
      });
      
      if (sortedInputFields.length > 0) {
        const firstInputField = sortedInputFields[0];
        console.log(`SmedMapDisplay: Setting focus to first input field: ${firstInputField.name} at (${firstInputField.row}, ${firstInputField.col})`);
        setFocusedField(firstInputField.name);
        setCursorPosition({ row: firstInputField.row - 1, col: firstInputField.col - 1 });
      }
    } else {
      // No input fields - don't set any focus or cursor
      console.log('SmedMapDisplay: No input fields found - display only mode');
      setFocusedField(null);
      setCursorPosition({ row: -1, col: -1 }); // Set invalid position to avoid cursor display
    }
    
    console.log(`SmedMapDisplay: Grid initialization completed with ${validFields.length} valid fields, hasInputs: ${hasInputs}`);
  }, [fields, fieldValues]);

  // Focus the grid container when a field is focused (only if there are input fields)
  useEffect(() => {
    if (focusedField && hasInputFields && gridRef.current) {
      console.log(`SmedMapDisplay: Focusing grid container for field: ${focusedField}`);
      gridRef.current.focus();
    }
  }, [focusedField, hasInputFields]);

  // Handle keyboard input
  const handleKeyDown = async (e: React.KeyboardEvent) => {
    // Handle function keys (F1-F12)
    if (e.key.startsWith('F') && e.key.length >= 2) {
      e.preventDefault();
      
      // If onKeyEvent is provided, send the key event to the application
      if (onKeyEvent) {
        try {
          const response = await onKeyEvent(e.key, fieldValues);
          
          // Handle response from application
          if (response && response.action) {
            switch (response.action) {
              case 'close':
                if (onClose) onClose();
                break;
              case 'submit':
                if (onSubmit) onSubmit(fieldValues);
                break;
              case 'update_fields':
                if (response.fieldValues) {
                  setFieldValues(response.fieldValues);
                }
                break;
              // Add more actions as needed
            }
          }
        } catch (error) {
          console.error('Error handling key event:', error);
        }
      } else {
        // Fallback behavior if no onKeyEvent handler
        if (e.key === 'F3' && onClose) {
          onClose();
        }
      }
      return;
    }
    
    // Only handle input if there are input fields and a field is focused
    if (!hasInputFields || !focusedField) return;
    
    const field = fields.find(f => f.name === focusedField);
    if (!field || field.prompt) return; // Only handle input fields
    
    const currentValue = fieldValues[focusedField] || '';
    
    switch (e.key) {
      case 'Enter':
        if (onSubmit) {
          onSubmit(fieldValues);
        }
        break;
        
      case 'Tab':
        e.preventDefault();
        // Find next input field
        const inputFields = fields.filter(f => !f.prompt).sort((a, b) => {
          if (a.row !== b.row) return a.row - b.row;
          return a.col - b.col;
        });
        const currentIndex = inputFields.findIndex(f => f.name === focusedField);
        const nextField = inputFields[(currentIndex + 1) % inputFields.length];
        if (nextField) {
          setFocusedField(nextField.name);
          setCursorPosition({ row: nextField.row - 1, col: nextField.col - 1 });
        }
        break;
        
      case 'Backspace':
        if (currentValue.length > 0) {
          setFieldValues({
            ...fieldValues,
            [focusedField]: currentValue.slice(0, -1)
          });
        }
        break;
        
      case 'ArrowLeft':
      case 'ArrowRight':
      case 'ArrowUp':
      case 'ArrowDown':
        // Handle cursor movement within field bounds
        break;
        
      default:
        // Handle character input
        if (e.key.length === 1 && currentValue.length < field.length) {
          setFieldValues({
            ...fieldValues,
            [focusedField]: currentValue + e.key
          });
        }
    }
  };

  // Handle click on field (only if there are input fields)
  const handleCellClick = (row: number, col: number) => {
    if (!hasInputFields) return; // Don't allow clicking if no input fields
    // Find which field was clicked
    const clickedField = fields.find(field => {
      // Validate field data
      if (!field || typeof field.row !== 'number' || typeof field.col !== 'number' || typeof field.length !== 'number') {
        return false;
      }
      
      const fieldRow = field.row - 1;
      const fieldCol = field.col - 1;
      return !field.prompt && // Only input fields are clickable
             row === fieldRow && 
             col >= fieldCol && 
             col < fieldCol + field.length;
    });
    
    if (clickedField) {
      setFocusedField(clickedField.name);
      setCursorPosition({ row, col });
    }
  };

  // Render character with appropriate styling
  const renderChar = (char: string, row: number, col: number) => {
    // Skip empty cells (used for second half of full-width characters)
    if (char === '') {
      return null;
    }
    
    // Check if this position is part of a field
    const field = fields.find(f => {
      // Validate field data
      if (!f || typeof f.row !== 'number' || typeof f.col !== 'number' || typeof f.length !== 'number') {
        return false;
      }
      
      const fieldRow = f.row - 1;
      const fieldCol = f.col - 1;
      return row === fieldRow && col >= fieldCol && col < fieldCol + f.length;
    });
    
    const isInputField = field && !field.prompt;
    const isFocused = hasInputFields && field && field.name === focusedField;
    // Only show cursor if there are input fields, focused, and cursor position is valid
    const isCursor = hasInputFields && isFocused && row === cursorPosition.row && col === cursorPosition.col && cursorPosition.row >= 0 && cursorPosition.col >= 0;
    const isFullWidthChar = isFullWidth(char);
    
    let className = 'grid-char';
    if (isInputField) {
      className += ' input-field';
    }
    if (isFocused) {
      className += ' focused-field';
    }
    if (isCursor) {
      className += ' cursor-no-blink'; // Use new class without blinking
    }
    if (isFullWidthChar) {
      className += ' full-width';
    }
    
    const cellStyle = isFullWidthChar ? {
      width: '1.2em', // Double width for full-width characters
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
  };

  // Show loading state only if grid is not ready and we have no valid data
  if (!isGridReady || !Array.isArray(grid) || grid.length === 0) {
    console.log('SmedMapDisplay: Grid not ready yet, showing loading state', {
      isGridReady,
      gridIsArray: Array.isArray(grid),
      gridLength: grid?.length,
      fieldsLength: Array.isArray(fields) ? fields.length : 'not array'
    });
    
    return (
      <div className="smed-map-display" onKeyDown={handleKeyDown} tabIndex={0}>
        {mapName && <div className="map-header">Map: {mapName}</div>}
        <div className="loading-message">
          <p>📊 Loading SMED display...</p>
          <p>Grid: {Array.isArray(grid) ? `${grid.length} rows initialized` : 'initializing...'}</p>
          <p>Fields: {Array.isArray(fields) ? `${fields.length} fields received` : 'waiting for data...'}</p>
          <p>Ready: {isGridReady ? 'Yes' : 'No'}</p>
          <div className="loading-spinner"></div>
          <button onClick={onClose} style={{marginTop: '10px'}}>Close</button>
        </div>
      </div>
    );
  }

  return (
    <SmedDisplayErrorBoundary onError={(error) => {
      console.error('SmedMapDisplay caught error:', error);
      // Optionally notify parent component of error
    }}>
      <div className="smed-map-display" onKeyDown={handleKeyDown} tabIndex={0}>
        {mapName && <div className="map-header">Map: {mapName}</div>}
        <div className="terminal-grid" ref={gridRef}>
          {grid.map((row, rowIndex) => {
            // Safety check to ensure row is an array
            if (!Array.isArray(row)) {
              console.error(`SmedMapDisplay: Row ${rowIndex} is not an array:`, row);
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
                    console.error(`SmedMapDisplay: Error rendering char at ${rowIndex},${colIndex}:`, error);
                    return <span key={colIndex} className="grid-char error-char">?</span>;
                  }
                })}
              </div>
            );
          })}
        </div>
      </div>
    </SmedDisplayErrorBoundary>
  );
};

export default SmedMapDisplay;