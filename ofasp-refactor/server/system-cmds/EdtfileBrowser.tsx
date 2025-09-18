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
  const [cursorRow, setCursorRow] = useState(0);
  const [cursorCol, setCursorCol] = useState(0);
  const [showHelp, setShowHelp] = useState(false);
  const [hexOverlay, setHexOverlay] = useState(false);
  const [commandMode, setCommandMode] = useState(false);
  const [command, setCommand] = useState('');
  
  const containerRef = useRef<HTMLDivElement>(null);
  const dataAreaRef = useRef<HTMLDivElement>(null);

  // Current hex value at cursor position
  const getCurrentHexValue = useCallback(() => {
    if (cursorRow >= fileData.records.length) return null;
    
    const record = fileData.records[cursorRow];
    if (cursorCol >= record.rawBytes.length) return null;
    
    const byteValue = record.rawBytes[cursorCol];
    const char = byteValue >= 32 && byteValue <= 126 ? String.fromCharCode(byteValue) : '.';
    
    return {
      position: cursorCol,
      hex: byteValue.toString(16).toUpperCase().padStart(2, '0'),
      decimal: byteValue,
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
          const maxCol = fileData.records[cursorRow].rawBytes.length - 1;
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
    }
  }, [showHelp, commandMode, command, cursorRow, fileData.records, onClose]);

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
    >
      {/* Data Area - only show data, no headers */}
      <div className="data-area" ref={dataAreaRef}>
        {fileData.records.map((record, rowIndex) => (
          <div key={record.number} className="data-row">
            {/* Main data line */}
            <div className="data-line">
              {record.data.split('').map((char, colIndex) => (
                <span
                  key={colIndex}
                  className={`data-char ${
                    rowIndex === cursorRow && colIndex === cursorCol ? 'cursor' : ''
                  }`}
                >
                  {char}
                </span>
              ))}
            </div>
            
            {/* Hex overlay line (if enabled) */}
            {hexOverlay && (
              <div className="hex-overlay-line">
                {record.rawBytes.map((byte, colIndex) => (
                  <span
                    key={colIndex}
                    className={`hex-char ${
                      rowIndex === cursorRow && colIndex === cursorCol ? 'cursor' : ''
                    }`}
                  >
                    {byte.toString(16).toUpperCase().padStart(2, '0')}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Status Bar - show current hex value */}
      <div className="status-bar">
        {currentHex && (
          <div className="hex-info">
            Pos: {currentHex.position.toString(16).toUpperCase().padStart(4, '0')} | 
            Hex: {currentHex.hex} | 
            Dec: {currentHex.decimal.toString().padStart(3, ' ')} | 
            Char: '{currentHex.char}'
          </div>
        )}
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
                <div>ESC - Exit command mode</div>
                <div>q - Quit browser</div>
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