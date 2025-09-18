import React, { useState, useEffect, useRef, useCallback } from 'react';
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
    console.error('SmedMapDisplay SVG Error Boundary caught an error:', error, errorInfo);
    this.props.onError?.(error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="smed-display-svg-error">
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

const SmedMapDisplay: React.FC<SmedMapDisplayProps> = ({ 
  fields, 
  onSubmit, 
  onClose, 
  onKeyEvent, 
  mapName 
}) => {
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [hasInputFields, setHasInputFields] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const inputRefs = useRef<Map<string, HTMLInputElement>>(new Map());

  // Terminal dimensions - dynamically calculated
  const TERMINAL_ROWS = 24;
  const TERMINAL_COLS = 80;
  
  // Calculate responsive dimensions based on container
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 1200, height: 720 });
  
  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const container = containerRef.current;
        
        // Get available viewport dimensions
        const viewportHeight = window.innerHeight;
        const viewportWidth = window.innerWidth;
        
        // Account for header height (approximately 70px) and padding
        const headerHeight = 70;
        const padding = 32;
        const statusBarHeight = 60; // Bottom status bar if present
        
        const availableWidth = Math.min(viewportWidth - padding, container.clientWidth - padding);
        const availableHeight = Math.min(viewportHeight - headerHeight - statusBarHeight - padding, container.clientHeight - padding);
        
        // Calculate optimal dimensions while maintaining 80:24 aspect ratio
        const aspectRatio = 80 / 24; // Terminal aspect ratio (3.33:1)
        
        // Try to fit width first, then adjust height
        let width = availableWidth;
        let height = width / aspectRatio;
        
        // If height doesn't fit, fit height and adjust width
        if (height > availableHeight) {
          height = availableHeight;
          width = height * aspectRatio;
        }
        
        // Ensure minimum dimensions for 24x80 terminal readability
        width = Math.max(width, 800);
        height = Math.max(height, 240);
        
        // Maximum dimensions to prevent oversizing
        width = Math.min(width, 1600);
        height = Math.min(height, 480);
        
        setDimensions({ width, height });
      }
    };
    
    updateDimensions();
    window.addEventListener('resize', updateDimensions);
    
    return () => {
      window.removeEventListener('resize', updateDimensions);
    };
  }, []);
  
  const SVG_WIDTH = dimensions.width;
  const SVG_HEIGHT = dimensions.height;
  const CHAR_WIDTH = SVG_WIDTH / TERMINAL_COLS;
  const CHAR_HEIGHT = SVG_HEIGHT / TERMINAL_ROWS;

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

  // Calculate text width considering full-width characters
  const calculateTextWidth = (text: string): number => {
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      width += isFullWidth(text[i]) ? 2 : 1;
    }
    return width;
  };

  // Initialize field values and check for input fields
  useEffect(() => {
    console.log(`SmedMapDisplay: Starting SVG initialization with ${Array.isArray(fields) ? fields.length : 'invalid'} fields`);
    
    const initialValues: Record<string, string> = {};
    let hasInput = false;

    // Validate fields array
    if (!Array.isArray(fields)) {
      console.error('SmedMapDisplay: fields is not an array:', fields);
      setFieldValues(initialValues);
      setHasInputFields(false);
      setIsReady(true);
      return;
    }

    fields.forEach((field) => {
      if (field.type === 'input' || field.name.includes('INPUT') || field.name.includes('SEL') || !field.prompt) {
        initialValues[field.name] = field.value || '';
        hasInput = true;
      } else {
        initialValues[field.name] = field.value || field.prompt || '';
      }
    });

    setFieldValues(initialValues);
    setHasInputFields(hasInput);
    setIsReady(true);

    if (hasInput) {
      const firstInputField = fields.find(f => 
        f.type === 'input' || f.name.includes('INPUT') || f.name.includes('SEL') || !f.prompt
      );
      if (firstInputField) {
        console.log(`SmedMapDisplay: Setting focus to first input field: ${firstInputField.name}`);
        setFocusedField(firstInputField.name);
      }
    } else {
      console.log('SmedMapDisplay: No input fields found - display only mode');
    }

    console.log(`SmedMapDisplay: SVG initialization completed with ${fields.length} fields, hasInputs: ${hasInput}`);
  }, [fields]);

  // Handle field value changes
  const handleFieldChange = useCallback((fieldName: string, value: string) => {
    setFieldValues(prev => ({
      ...prev,
      [fieldName]: value
    }));
  }, []);

  // Handle keyboard events
  const handleKeyDown = useCallback(async (e: React.KeyboardEvent) => {
    // DEBUG: Log ALL keyboard events to see what's being captured
    console.log(`[SMED KeyDown DEBUG] ALL KEYS: Key="${e.key}", Code="${e.code}", KeyCode="${e.keyCode}"`);
    
    // Handle function keys (F1-F12) and alternative keys for blocked function keys
    const isFunctionKey = e.key.startsWith('F') && e.key.length >= 2;
    const isEscapeAsF3 = e.key === 'Escape'; // Escape as alternative to F3
    
    if (isFunctionKey || isEscapeAsF3) {
      e.preventDefault();
      
      // Map Escape to F3 as alternative
      const actualKey = isEscapeAsF3 ? 'F3' : e.key;
      
      console.log(`[SMED KeyDown DEBUG] Processing function key: ${actualKey} (original: ${e.key})`);
      console.log(`[SMED KeyDown DEBUG] Current field values:`, fieldValues);
      console.log(`[SMED KeyDown DEBUG] onKeyEvent handler exists:`, !!onKeyEvent);
      
      // If onKeyEvent is provided, send the key event to the application
      if (onKeyEvent) {
        try {
          console.log(`[SMED KeyDown DEBUG] Calling onKeyEvent for ${actualKey}...`);
          const response = await onKeyEvent(actualKey, fieldValues);
          console.log(`[SMED KeyDown DEBUG] Response received for ${actualKey}:`, response);
          
          // Handle response from application
          if (response && response.action) {
            console.log(`[SMED KeyDown DEBUG] Processing response action: ${response.action}`);
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
              case 'waiting_for_next_screen':
                console.log(`[SMED KeyDown DEBUG] ${e.key} - waiting for next screen from server`);
                break;
            }
          } else {
            console.log(`[SMED KeyDown DEBUG] No action in response for ${actualKey}, response:`, response);
          }
        } catch (error) {
          console.error(`[SMED KeyDown ERROR] Error handling ${actualKey} event:`, error);
        }
      } else {
        // Fallback behavior if no onKeyEvent handler
        console.log(`[SMED KeyDown DEBUG] No onKeyEvent handler, using fallback for ${actualKey}`);
        if (actualKey === 'F3' && onClose) {
          onClose();
        }
      }
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      if (onSubmit) {
        onSubmit(fieldValues);
      }
    } else if (e.key === 'Escape' || e.key === 'F3') {
      e.preventDefault();
      if (onKeyEvent) {
        await onKeyEvent(e.key, fieldValues);
      }
    }
  }, [fieldValues, onSubmit, onKeyEvent]);

  // Focus management
  useEffect(() => {
    if (focusedField && inputRefs.current.has(focusedField)) {
      const input = inputRefs.current.get(focusedField);
      if (input) {
        setTimeout(() => input.focus(), 100);
      }
    }
  }, [focusedField]);

  // Document-level key event listener to catch F3 key before browser handles it
  useEffect(() => {
    const documentKeyHandler = (e: KeyboardEvent) => {
      // Log ALL function keys at document level for debugging
      if (e.key.startsWith('F')) {
        console.log(`[DOCUMENT KEY DEBUG] Function key detected: Key="${e.key}", Code="${e.code}", KeyCode="${e.keyCode}"`);
      }
      
      // Try to capture F3 with multiple approaches
      if (e.key === 'F3' || e.code === 'F3' || e.keyCode === 114) {
        console.log(`[DOCUMENT KEY DEBUG] *** F3 KEY DETECTED - MULTIPLE CHECKS ***`);
        console.log(`[DOCUMENT KEY DEBUG] e.key: ${e.key}, e.code: ${e.code}, e.keyCode: ${e.keyCode}`);
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        
        // Trigger the React handleKeyDown manually for F3
        const syntheticEvent = {
          key: 'F3',
          code: 'F3',
          keyCode: 114,
          preventDefault: () => {},
          stopPropagation: () => {}
        } as React.KeyboardEvent;
        
        console.log(`[DOCUMENT KEY DEBUG] Triggering synthetic F3 event`);
        handleKeyDown(syntheticEvent);
        return false;
      }
    };

    // Try multiple event listener strategies
    document.addEventListener('keydown', documentKeyHandler, { capture: true, passive: false });
    window.addEventListener('keydown', documentKeyHandler, { capture: true, passive: false });
    
    return () => {
      document.removeEventListener('keydown', documentKeyHandler, { capture: true });
      window.removeEventListener('keydown', documentKeyHandler, { capture: true });
    };
  }, [handleKeyDown, fieldValues, onKeyEvent]);

  // Render field content
  const renderFieldContent = (field: SmedField) => {
    const x = field.col * CHAR_WIDTH;
    const y = (field.row + 1) * CHAR_HEIGHT - 5; // Adjust for text baseline
    const isInputField = field.type === 'input' || field.name.includes('INPUT') || field.name.includes('SEL') || !field.prompt;
    const fieldValue = fieldValues[field.name] || '';
    const displayText = isInputField ? fieldValue : (field.prompt || fieldValue);

    if (isInputField) {
      return (
        <g key={field.name}>
          {/* Input field background with premium styling */}
          <rect
            x={x - 2}
            y={y - CHAR_HEIGHT + 5}
            width={field.length * CHAR_WIDTH + 4}
            height={CHAR_HEIGHT}
            fill="url(#inputFieldGradient)"
            stroke="url(#inputFieldStroke)"
            strokeWidth="1"
            rx="4"
            className="smed-input-field-bg"
          />
          
          {/* Input field glow effect */}
          <rect
            x={x - 4}
            y={y - CHAR_HEIGHT + 3}
            width={field.length * CHAR_WIDTH + 8}
            height={CHAR_HEIGHT + 4}
            fill="none"
            stroke="url(#inputFieldGlow)"
            strokeWidth="1"
            rx="6"
            opacity="0.6"
            className="smed-input-field-glow"
          />
          
          {/* Foreign object for HTML input */}
          <foreignObject
            x={x}
            y={y - CHAR_HEIGHT + 5}
            width={field.length * CHAR_WIDTH}
            height={CHAR_HEIGHT}
          >
            <input
              ref={(el) => {
                if (el) {
                  inputRefs.current.set(field.name, el);
                } else {
                  inputRefs.current.delete(field.name);
                }
              }}
              type="text"
              value={fieldValue}
              onChange={(e) => handleFieldChange(field.name, e.target.value)}
              onKeyDown={handleKeyDown}
              onFocus={() => setFocusedField(field.name)}
              maxLength={field.length}
              className="smed-svg-input"
              style={{
                width: '100%',
                height: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#00ff00',
                fontFamily: 'Monaco, "Lucida Console", monospace',
                fontSize: `${Math.floor(CHAR_HEIGHT * 0.7)}px`,
                padding: '2px 4px',
              }}
            />
          </foreignObject>
        </g>
      );
    } else {
      // Static text with premium styling
      const textColor = field.type === 'static' ? '#00ff88' : '#ffffff';
      const isBold = field.name.includes('TITLE') || field.name.includes('HEADER');
      
      return (
        <g key={field.name}>
          {/* Text shadow for depth */}
          <text
            x={x + 1}
            y={y + 1}
            fontFamily="Monaco, 'Lucida Console', monospace"
            fontSize={Math.floor(CHAR_HEIGHT * 0.7)}
            fill="rgba(0, 0, 0, 0.5)"
            fontWeight={isBold ? 'bold' : 'normal'}
          >
            {displayText}
          </text>
          
          {/* Main text */}
          <text
            x={x}
            y={y}
            fontFamily="Monaco, 'Lucida Console', monospace"
            fontSize={Math.floor(CHAR_HEIGHT * 0.7)}
            fill={textColor}
            fontWeight={isBold ? 'bold' : 'normal'}
            className="smed-static-text"
          >
            {displayText}
          </text>
          
          {/* Highlight effect for important fields */}
          {isBold && (
            <rect
              x={x - 4}
              y={y - CHAR_HEIGHT + 5}
              width={calculateTextWidth(displayText) * CHAR_WIDTH + 8}
              height={CHAR_HEIGHT}
              fill="none"
              stroke="url(#titleHighlight)"
              strokeWidth="1"
              rx="3"
              opacity="0.3"
            />
          )}
        </g>
      );
    }
  };

  if (!isReady) {
    return (
      <div className="smed-loading-container">
        <div className="smed-loading-spinner"></div>
        <p>Loading SMED Display...</p>
      </div>
    );
  }

  return (
    <SmedDisplayErrorBoundary>
      <div className="smed-svg-premium-container">
        <div className="smed-svg-display-area" ref={containerRef}>
          <svg
            ref={svgRef}
            width={SVG_WIDTH}
            height={SVG_HEIGHT}
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            className="smed-svg-canvas"
            onKeyDown={handleKeyDown}
            tabIndex={0}
          >
            {/* Define gradients and effects */}
            <defs>
              {/* Background gradient */}
              <linearGradient id="terminalBackground" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#0a0a0a" />
                <stop offset="50%" stopColor="#1a1a1a" />
                <stop offset="100%" stopColor="#0a0a0a" />
              </linearGradient>
              
              {/* Input field gradient */}
              <linearGradient id="inputFieldGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 255, 0, 0.1)" />
                <stop offset="50%" stopColor="rgba(0, 255, 0, 0.05)" />
                <stop offset="100%" stopColor="rgba(0, 255, 0, 0.1)" />
              </linearGradient>
              
              {/* Input field stroke */}
              <linearGradient id="inputFieldStroke" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#00ff00" />
                <stop offset="50%" stopColor="#00cc00" />
                <stop offset="100%" stopColor="#00ff00" />
              </linearGradient>
              
              {/* Input field glow */}
              <linearGradient id="inputFieldGlow" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="rgba(0, 255, 0, 0.6)" />
                <stop offset="50%" stopColor="rgba(0, 255, 0, 0.2)" />
                <stop offset="100%" stopColor="rgba(0, 255, 0, 0.6)" />
              </linearGradient>
              
              {/* Title highlight */}
              <linearGradient id="titleHighlight" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="rgba(0, 255, 136, 0.3)" />
                <stop offset="50%" stopColor="rgba(0, 255, 136, 0.6)" />
                <stop offset="100%" stopColor="rgba(0, 255, 136, 0.3)" />
              </linearGradient>
              
              {/* Scan line effect */}
              <pattern id="scanLines" patternUnits="userSpaceOnUse" width="100%" height="4">
                <rect width="100%" height="2" fill="rgba(0, 255, 0, 0.02)" />
                <rect y="2" width="100%" height="2" fill="transparent" />
              </pattern>
              
              {/* Terminal border glow */}
              <filter id="terminalGlow">
                <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
                <feMerge> 
                  <feMergeNode in="coloredBlur"/>
                  <feMergeNode in="SourceGraphic"/>
                </feMerge>
              </filter>
            </defs>
            
            {/* Terminal background */}
            <rect
              width="100%"
              height="100%"
              fill="url(#terminalBackground)"
              className="smed-terminal-bg"
            />
            
            {/* Scan line overlay */}
            <rect
              width="100%"
              height="100%"
              fill="url(#scanLines)"
              opacity="0.7"
              className="smed-scan-lines"
            />
            
            {/* Terminal border */}
            <rect
              x="5"
              y="5"
              width={SVG_WIDTH - 10}
              height={SVG_HEIGHT - 10}
              fill="none"
              stroke="#00ff00"
              strokeWidth="2"
              rx="8"
              filter="url(#terminalGlow)"
              className="smed-terminal-border"
            />
            
            {/* Corner indicators */}
            <g className="smed-corner-indicators">
              <circle cx="20" cy="20" r="3" fill="#00ff88" opacity="0.8" />
              <circle cx={SVG_WIDTH - 20} cy="20" r="3" fill="#00ff88" opacity="0.8" />
              <circle cx="20" cy={SVG_HEIGHT - 20} r="3" fill="#00ff88" opacity="0.8" />
              <circle cx={SVG_WIDTH - 20} cy={SVG_HEIGHT - 20} r="3" fill="#00ff88" opacity="0.8" />
            </g>
            
            {/* Render all fields */}
            <g className="smed-fields-container">
              {fields.map(renderFieldContent)}
            </g>
            
            {/* Status bar with close button */}
            <g className="smed-status-bar">
              <rect
                x="5"
                y={SVG_HEIGHT - 35}
                width={SVG_WIDTH - 10}
                height="25"
                fill="rgba(0, 0, 0, 0.7)"
                stroke="rgba(0, 255, 0, 0.3)"
                strokeWidth="1"
                rx="3"
              />
              
              {/* Windows-style close button */}
              <g className="smed-close-button" style={{ cursor: 'pointer' }} onClick={onClose}>
                {/* Close button background */}
                <rect
                  x={SVG_WIDTH - 45}
                  y={SVG_HEIGHT - 32}
                  width="35"
                  height="19"
                  fill="rgba(255, 0, 0, 0.2)"
                  stroke="rgba(255, 0, 0, 0.5)"
                  strokeWidth="1"
                  rx="3"
                  className="close-button-bg"
                />
                
                {/* Close X symbol */}
                <text
                  x={SVG_WIDTH - 27}
                  y={SVG_HEIGHT - 19}
                  fontFamily="Arial, sans-serif"
                  fontSize="14"
                  fontWeight="bold"
                  fill="#ff6b6b"
                  textAnchor="middle"
                  className="close-button-text"
                >
                  ✕
                </text>
              </g>
              
              {/* Terminal title text */}
              <text
                x="15"
                y={SVG_HEIGHT - 17}
                fontFamily="Monaco, 'Lucida Console', monospace"
                fontSize="12"
                fill="#00ff88"
              >
                SMED Terminal - Click ✕ to close
              </text>
            </g>
          </svg>
        </div>
        
      </div>
    </SmedDisplayErrorBoundary>
  );
};

export default SmedMapDisplay;