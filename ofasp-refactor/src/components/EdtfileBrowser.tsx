import React, { useState, useEffect, useCallback, useRef } from 'react';
import './EdtfileBrowser.css';

interface EdtfileBrowserProps {
  isDarkMode: boolean;
  onClose: () => void;
  fileData: {
    filename: string;
    records: Array<{
      number: number;
      data: string;
      rawBytes: number[];
    }>;
    rectype: string;
    reclen: number;
    encoding: string;
  };
}

const EdtfileBrowser: React.FC<EdtfileBrowserProps> = ({ 
  isDarkMode, 
  onClose, 
  fileData 
}) => {
  // DEBUG: Log file data on component mount
  useEffect(() => {
    console.log('[DEBUG] EdtfileBrowser: File data received:', fileData);
    console.log('[DEBUG] EdtfileBrowser: Records count:', fileData.records.length);
    
    if (fileData.records.length > 0) {
      const firstRecord = fileData.records[0];
      console.log('[DEBUG] EdtfileBrowser: First record:', firstRecord);
      console.log('[DEBUG] EdtfileBrowser: First record data:', firstRecord.data);
      console.log('[DEBUG] EdtfileBrowser: First record rawBytes length:', firstRecord.rawBytes.length);
      
      // Check for Unicode characters in first record data
      for (let i = 0; i < Math.min(firstRecord.data.length, 20); i++) {
        const char = firstRecord.data[i];
        const code = char.charCodeAt(0);
        if (code > 127) {
          console.log(`[DEBUG] EdtfileBrowser: Unicode char at pos ${i}: U+${code.toString(16).toUpperCase().padStart(4, '0')} = '${char}'`);
        }
      }
    }
  }, [fileData]);
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [hexOverlay, setHexOverlay] = useState(false);
  const [commandMode, setCommandMode] = useState(false);
  const [command, setCommand] = useState('');
  const [zoomLevel, setZoomLevel] = useState(100); // 100% = normal size
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dataAreaRef = useRef<HTMLDivElement>(null);

  // Zoom functions
  const zoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(200, prev + 10)); // Max 200%
  }, []);

  const zoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(50, prev - 10)); // Min 50%
  }, []);

  const resetZoom = useCallback(() => {
    setZoomLevel(100);
  }, []);

  // Current hex value at cursor position
  const getCurrentHexValue = useCallback(() => {
    if (cursorRow >= fileData.records.length) return null;
    
    const record = fileData.records[cursorRow];
    if (!record.data || cursorCol >= record.data.length) {
      // Calculate byte position up to cursor
      let bytePosition = 0;
      if (record.data) {
        for (let i = 0; i < Math.min(cursorCol, record.data.length); i++) {
          const charCode = record.data.charCodeAt(i);
          // Full-width characters (Japanese, etc.) take 2 bytes in SJIS
          bytePosition += charCode > 127 ? 2 : 1;
        }
      }
      
      return {
        position: bytePosition + 1, // Start from 1, not 0
        hex: '--',
        decimal: 0,
        char: ''
      };
    }
    
    // Calculate byte position up to current cursor
    let bytePosition = 0;
    for (let i = 0; i < cursorCol; i++) {
      const charCode = record.data.charCodeAt(i);
      // Full-width characters (Japanese, etc.) take 2 bytes in SJIS
      bytePosition += charCode > 127 ? 2 : 1;
    }
    
    // Get the character from the Unicode string
    const char = record.data[cursorCol];
    const charCode = char.charCodeAt(0);
    
    return {
      position: bytePosition + 1, // Start from 1, not 0
      hex: charCode.toString(16).toUpperCase().padStart(4, '0'), // Use 4 digits for Unicode
      decimal: charCode,
      char: char
    };
  }, [cursorRow, cursorCol, fileData.records]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (showHelp) {
      // Close help on any key
      setShowHelp(false);
      return;
    }

    if (commandMode) {
      if (e.key === 'Escape') {
        setCommandMode(false);
        setCommand('');
      } else if (e.key === 'Enter') {
        // Execute command
        const cmd = command.toLowerCase().trim();
        if (cmd === 'hexon') {
          setHexOverlay(true);
        } else if (cmd === 'hexoff') {
          setHexOverlay(false);
        } else if (cmd === 'zoomin' || cmd === 'zoom+') {
          zoomIn();
        } else if (cmd === 'zoomout' || cmd === 'zoom-') {
          zoomOut();
        } else if (cmd === 'zoom100' || cmd === 'zoomreset') {
          resetZoom();
        }
        setCommandMode(false);
        setCommand('');
      } else if (e.key === 'Backspace') {
        setCommand(prev => prev.slice(0, -1));
      } else if (e.key.length === 1) {
        setCommand(prev => prev + e.key);
      }
      return;
    }

    switch (e.key) {
      case 'F1':
        e.preventDefault();
        setShowHelp(true);
        break;
      
      case 'Escape':
      case 'q':
      case 'Q':
        onClose();
        break;
      
      case ':':
        setCommandMode(true);
        setCommand('');
        break;
      
      case 'ArrowUp':
        e.preventDefault();
        setCursorRow(prev => Math.max(0, prev - 1));
        setCursorCol(0); // Reset to start of line
        break;
      
      case 'ArrowDown':
        e.preventDefault();
        setCursorRow(prev => Math.min(fileData.records.length - 1, prev + 1));
        setCursorCol(0); // Reset to start of line
        break;
      
      case 'ArrowLeft':
        e.preventDefault();
        setCursorCol(prev => Math.max(0, prev - 1));
        break;
      
      case 'ArrowRight':
        e.preventDefault();
        if (cursorRow < fileData.records.length) {
          // Use Unicode string length for character-based cursor movement
          const record = fileData.records[cursorRow];
          const maxCol = record.data ? record.data.length - 1 : 0;
          setCursorCol(prev => Math.min(maxCol, prev + 1));
        }
        break;
      
      case 'Home':
        e.preventDefault();
        setCursorRow(0);
        setCursorCol(0);
        break;
      
      case 'End':
        e.preventDefault();
        setCursorRow(fileData.records.length - 1);
        setCursorCol(0);
        break;
      
      case 'PageUp':
        e.preventDefault();
        setCursorRow(prev => Math.max(0, prev - 10));
        setCursorCol(0);
        break;
      
      case 'PageDown':
        e.preventDefault();
        setCursorRow(prev => Math.min(fileData.records.length - 1, prev + 10));
        setCursorCol(0);
        break;
      
      case '+':
      case '=':
        if (e.ctrlKey) {
          e.preventDefault();
          zoomIn();
        }
        break;
      
      case '-':
        if (e.ctrlKey) {
          e.preventDefault();
          zoomOut();
        }
        break;
      
      case '0':
        if (e.ctrlKey) {
          e.preventDefault();
          resetZoom();
        }
        break;
    }
  }, [showHelp, commandMode, command, cursorRow, fileData.records, onClose, zoomIn, zoomOut, resetZoom]);

  // Setup keyboard event listeners
  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Focus container on mount
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.focus();
    }
  }, []);

  const currentHex = getCurrentHexValue();

  return (
    <div 
      className={`edtfile-browser ${isDarkMode ? 'dark' : 'light'}`}
      ref={containerRef}
      tabIndex={-1}
      style={{ fontSize: `${zoomLevel}%` }}
    >
      {/* Data Area - only show data, no headers */}
      <div className="data-area" ref={dataAreaRef}>
        {fileData.records.map((record, rowIndex) => {
          return (
            <div key={record.number} className="data-row">
              {/* Main data line - display Unicode string with byte-based cursor */}
              <div className="data-line">
                {record.data ? record.data.split('').map((char, charIndex) => {
                  return (
                    <span
                      key={charIndex}
                      className={`data-char ${
                        rowIndex === cursorRow && charIndex === cursorCol ? 'cursor' : ''
                      }`}
                    >
                      {char}
                    </span>
                  );
                }) : (
                  'No data'
                )}
              </div>
              
              {/* Hex overlay line (if enabled) - show hex aligned with characters */}
              {hexOverlay && record.rawBytes && (
                <div className="hex-overlay-line">
                  {record.data ? record.data.split('').map((char, charIndex) => {
                    // For full-width characters, show both bytes
                    const charCode = char.charCodeAt(0);
                    if (charCode > 127) {
                      // This is likely a multi-byte character, show placeholder for alignment
                      return (
                        <span
                          key={charIndex}
                          className={`hex-char ${
                            rowIndex === cursorRow && charIndex === cursorCol ? 'cursor' : ''
                          }`}
                        >
                          XX
                        </span>
                      );
                    } else {
                      // Single byte character
                      return (
                        <span
                          key={charIndex}
                          className={`hex-char ${
                            rowIndex === cursorRow && charIndex === cursorCol ? 'cursor' : ''
                          }`}
                        >
                          {charCode.toString(16).toUpperCase().padStart(2, '0')}
                        </span>
                      );
                    }
                  }) : null}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status Bar - show current hex value and zoom */}
      <div className="status-bar">
        <div className="status-left">
          {currentHex && (
            <div className="hex-info">
              Pos: {currentHex.position.toString().padStart(3, ' ')} | 
              Hex: {currentHex.hex} | 
              Dec: {currentHex.decimal.toString().padStart(3, ' ')} | 
              Char: '{currentHex.char}'
            </div>
          )}
        </div>
        <div className="status-right">
          <div className="zoom-info">
            Zoom: {zoomLevel}%
          </div>
        </div>
      </div>

      {/* Command Line */}
      <div className="command-line">
        {commandMode ? (
          <span>:{command}</span>
        ) : (
          <span>F1=Help | q=Quit | :=Command | ↑↓←→=Navigate</span>
        )}
      </div>

      {/* Help Window */}
      {showHelp && (
        <div className="help-overlay">
          <div className="help-window">
            <div className="help-header">EDTFILE Browser Help</div>
            <div className="help-content">
              <div className="help-section">
                <h4>Navigation:</h4>
                <div>↑/↓ - Move between records</div>
                <div>←/→ - Move cursor in record</div>
                <div>PgUp/PgDn - Page up/down</div>
                <div>Home/End - First/last record</div>
              </div>
              <div className="help-section">
                <h4>Commands:</h4>
                <div>:hexon - Show hex values below data</div>
                <div>:hexoff - Hide hex values</div>
                <div>:zoomin - Zoom in (10%)</div>
                <div>:zoomout - Zoom out (10%)</div>
                <div>:zoom100 - Reset zoom to 100%</div>
                <div>ESC - Exit command mode</div>
                <div>q - Quit browser</div>
              </div>
              <div className="help-section">
                <h4>Shortcuts:</h4>
                <div>Ctrl+Plus - Zoom in</div>
                <div>Ctrl+Minus - Zoom out</div>
                <div>Ctrl+0 - Reset zoom</div>
              </div>
              <div className="help-footer">
                Press any key to close help
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EdtfileBrowser;