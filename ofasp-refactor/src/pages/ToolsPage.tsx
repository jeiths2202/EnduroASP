import React, { useState, useEffect } from 'react';
import { ArrowRightIcon, ArrowLeftIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline';
import { 
  encodingConverter, 
  ConversionMode, 
  EncodingType, 
  ErrorHandling,
  type ConversionOptions 
} from '../utils/encodingConverter';
import { 
  convertEbcdicToAscii, 
  convertAsciiToEbcdic,
  type EbcdicConversionOptions 
} from '../utils/ebcdicConverter';

interface ToolsPageProps {
  isDarkMode: boolean;
}

const ToolsPage: React.FC<ToolsPageProps> = ({ isDarkMode }) => {
  const [activeTab, setActiveTab] = useState<'source' | 'dataset'>('source');
  const [ebcdicText, setEbcdicText] = useState('');
  const [asciiText, setAsciiText] = useState('');
  const [conversionDirection, setConversionDirection] = useState<'toAscii' | 'toEbcdic'>('toAscii');
  const [encoding, setEncoding] = useState<EncodingType>(EncodingType.US);
  const [errorHandling, setErrorHandling] = useState<ErrorHandling>(ErrorHandling.REPLACE);
  const [useSOSI, setUseSOSI] = useState(false);
  const [sosiType, setSosiType] = useState<'0E0F' | '1E1F' | 'custom'>('0E0F');
  const [customSO, setCustomSO] = useState('0E');
  const [customSI, setCustomSI] = useState('0F');
  const [sosiHandling, setSosiHandling] = useState<'remove' | 'keep' | 'space'>('remove');
  const [isConverting, setIsConverting] = useState(false);
  const [conversionErrors, setConversionErrors] = useState<string[]>([]);
  const [isInitialized, setIsInitialized] = useState(false);
  const [fileName, setFileName] = useState('converted_data');
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [asciiCursorPos, setAsciiCursorPos] = useState(0);
  const [asciiHexDisplay, setAsciiHexDisplay] = useState('');

  useEffect(() => {
    // Check if encoding converter is initialized
    const checkInitialization = async () => {
      if (encodingConverter.isInitialized()) {
        setIsInitialized(true);
      } else {
        // Wait for initialization
        setTimeout(checkInitialization, 100);
      }
    };
    checkInitialization();
  }, []);

  const addConsoleLog = (message: string) => {
    if (showConsole) {
      const timestamp = new Date().toLocaleTimeString();
      setConsoleLog(prev => [...prev, `[${timestamp}] ${message}`]);
    }
  };

  const handleConvert = async () => {
    setIsConverting(true);
    setConversionErrors([]);

    try {
      const input = conversionDirection === 'toAscii' ? ebcdicText : asciiText;
      
      // Debug logging
      addConsoleLog(`=== Conversion Start ===`);
      addConsoleLog(`Direction: ${conversionDirection === 'toAscii' ? 'EBCDIC → ASCII' : 'ASCII → EBCDIC'}`);
      addConsoleLog(`Encoding: ${encoding}`);
      addConsoleLog(`Input Data: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`);
      addConsoleLog(`Input Length: ${input.length}`);
      addConsoleLog(`SOSI Usage: ${useSOSI}`);
      const actualSO = sosiType === 'custom' ? customSO : sosiType.substring(0,2);
      const actualSI = sosiType === 'custom' ? customSI : sosiType.substring(2,4);
      addConsoleLog(`SOSI Type: ${sosiType === 'custom' ? 'Custom' : sosiType} (SO/SI: 0x${actualSO}/0x${actualSI})`);
      addConsoleLog(`SOSI Handling: ${sosiHandling === 'remove' ? 'Remove' : sosiHandling === 'keep' ? 'Keep' : 'Space Conversion'}`);
      addConsoleLog(`Error Handling: ${errorHandling}`);

      const ebcdicOptions: EbcdicConversionOptions = {
        useSOSI,
        sosiHandling,
        errorHandling: errorHandling === ErrorHandling.STRICT ? 'strict' : 
                     errorHandling === ErrorHandling.REPLACE ? 'replace' : 'ignore',
        debugCallback: addConsoleLog
      };

      let result;
      if (conversionDirection === 'toAscii') {
        result = convertEbcdicToAscii(input, ebcdicOptions);
        addConsoleLog(`ASCII Output: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`);
        addConsoleLog(`Output Length: ${result.output.length}`);
        setAsciiText(result.output);
      } else {
        result = convertAsciiToEbcdic(input, ebcdicOptions);
        addConsoleLog(`EBCDIC Output: ${result.output.substring(0, 100)}${result.output.length > 100 ? '...' : ''}`);
        addConsoleLog(`Output Length: ${result.output.length}`);
        setEbcdicText(result.output);
      }

      if (result.errors.length > 0) {
        addConsoleLog(`⚠️ Warning: ${result.errors.length} conversion errors occurred`);
        result.errors.forEach((error, index) => {
          addConsoleLog(`  ${index + 1}. ${error}`);
        });
      } else {
        addConsoleLog(`✅ Conversion completed (no errors)`);
      }

      if (result.warnings && result.warnings.length > 0) {
        addConsoleLog(`⚠️ Warning: ${result.warnings.length} warnings occurred`);
        result.warnings.forEach((warning, index) => {
          addConsoleLog(`  ${index + 1}. ${warning}`);
        });
      }

      setConversionErrors(result.errors);
      addConsoleLog(`=== Conversion End ===`);
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : 'Unknown conversion error';
      addConsoleLog(`❌ Conversion failed: ${errorMsg}`);
      console.error('Conversion error:', error);
      setConversionErrors([errorMsg]);
    } finally {
      setIsConverting(false);
    }
  };

  const hexStringToBytes = (hexString: string): Uint8Array => {
    const cleanHex = hexString.replace(/\s/g, '');
    const bytes = new Uint8Array(cleanHex.length / 2);
    
    for (let i = 0; i < cleanHex.length; i += 2) {
      bytes[i / 2] = parseInt(cleanHex.substr(i, 2), 16);
    }
    
    return bytes;
  };

  const saveEbcdicFile = () => {
    if (!ebcdicText.trim()) {
      alert('No EBCDIC data to save.');
      return;
    }

    try {
      // Convert hex string to binary data
      const binaryData = hexStringToBytes(ebcdicText);
      
      // Create blob with binary data
      const blob = new Blob([binaryData], { type: 'application/octet-stream' });
      
      // Create download link
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${fileName}.dat`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('File save error:', error);
      alert('An error occurred while saving the file.');
    }
  };

  const saveAsciiFile = () => {
    if (!asciiText.trim()) {
      alert('No ASCII data to save.');
      return;
    }

    const blob = new Blob([asciiText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${fileName}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const toggleDirection = () => {
    setConversionDirection(prev => prev === 'toAscii' ? 'toEbcdic' : 'toAscii');
  };

  const handleAsciiCursorChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setAsciiText(e.target.value);
    const pos = e.target.selectionStart;
    setAsciiCursorPos(pos);
    updateHexDisplay(e.target.value, pos);
  };

  const handleAsciiCursorMove = (e: React.MouseEvent<HTMLTextAreaElement> | React.KeyboardEvent<HTMLTextAreaElement>) => {
    const target = e.target as HTMLTextAreaElement;
    setTimeout(() => {
      const pos = target.selectionStart;
      setAsciiCursorPos(pos);
      updateHexDisplay(asciiText, pos);
    }, 0);
  };

  const updateHexDisplay = (text: string, position: number) => {
    if (position >= 0 && position < text.length) {
      const char = text.charAt(position);
      const charCode = char.charCodeAt(0);
      const hexValue = charCode.toString(16).toUpperCase().padStart(2, '0');
      setAsciiHexDisplay(`Position: ${position} | Char: '${char}' | Hex: 0x${hexValue} | Dec: ${charCode}`);
    } else {
      setAsciiHexDisplay('');
    }
  };

  return (
    <div className="h-full p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          Tools
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Code Page Validation: EBCDIC ↔ ASCII Mapping
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 bg-gray-100 dark:bg-gray-800 p-1 rounded-lg mb-6">
        <button
          onClick={() => setActiveTab('source')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'source'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          SOURCE
        </button>
        <button
          onClick={() => setActiveTab('dataset')}
          className={`flex-1 py-2 px-4 rounded-md transition-colors ${
            activeTab === 'dataset'
              ? 'bg-white dark:bg-gray-700 text-blue-600 dark:text-blue-400 shadow-sm'
              : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
          }`}
        >
          DATASET
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'source' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          {/* Conversion Settings */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Encoding Type
              </label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as EncodingType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={EncodingType.US}>US (English)</option>
                <option value={EncodingType.JP}>JP (Japanese)</option>
                <option value={EncodingType.KR}>KR (Korean)</option>
                <option value={EncodingType.JAK}>JAK</option>
                <option value={EncodingType.KEIS}>KEIS</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error Handling
              </label>
              <select
                value={errorHandling}
                onChange={(e) => setErrorHandling(e.target.value as ErrorHandling)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              >
                <option value={ErrorHandling.REPLACE}>Replace with ?</option>
                <option value={ErrorHandling.IGNORE}>Ignore errors</option>
                <option value={ErrorHandling.STRICT}>Strict mode</option>
              </select>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                File Name
              </label>
              <input
                type="text"
                value={fileName}
                onChange={(e) => setFileName(e.target.value)}
                placeholder="Enter file name"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
              />
            </div>
          </div>

          {/* SOSI Options */}
          <div className="mb-4 space-y-3">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={useSOSI}
                onChange={(e) => setUseSOSI(e.target.checked)}
                className="mr-2"
              />
              <span className="text-sm text-gray-700 dark:text-gray-300">
                Use SOSI (Shift-Out/Shift-In) processing for double-byte characters
              </span>
            </label>
            
            {useSOSI && (
              <div className="ml-6 space-y-2">
                <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                  SOSI Code Type:
                </div>
                <div className="space-y-2">
                  <div className="flex space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiType"
                        value="0E0F"
                        checked={sosiType === '0E0F'}
                        onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Standard (SO: 0x0E, SI: 0x0F)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiType"
                        value="1E1F"
                        checked={sosiType === '1E1F'}
                        onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Alternative (SO: 0x1E, SI: 0x1F)
                      </span>
                    </label>
                  </div>
                  
                  <div className="flex items-center space-x-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiType"
                        value="custom"
                        checked={sosiType === 'custom'}
                        onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Custom:
                      </span>
                    </label>
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600 dark:text-gray-400">SO:</span>
                      <input
                        type="text"
                        value={customSO}
                        onChange={(e) => setCustomSO(e.target.value.toUpperCase())}
                        disabled={sosiType !== 'custom'}
                        maxLength={2}
                        placeholder="0E"
                        className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">SI:</span>
                      <input
                        type="text"
                        value={customSI}
                        onChange={(e) => setCustomSI(e.target.value.toUpperCase())}
                        disabled={sosiType !== 'custom'}
                        maxLength={2}
                        placeholder="0F"
                        className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800"
                      />
                    </div>
                  </div>
                </div>
                
                <div className="mt-3">
                  <div className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                    SOSI Code Handling:
                  </div>
                  <div className="space-y-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="remove"
                        checked={sosiHandling === 'remove'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Remove SOSI codes (remove from output)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="keep"
                        checked={sosiHandling === 'keep'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Keep SOSI codes (keep 0x0E/0x0F)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="space"
                        checked={sosiHandling === 'space'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="mr-2"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">
                        Convert to spaces (convert to 0x20)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Clear Button */}
          <div className="mb-4 flex justify-end">
            <button
              onClick={() => {
                setEbcdicText('');
                setAsciiText('');
                setConversionErrors([]);
                setConsoleLog([]);
                addConsoleLog('Data initialization completed');
              }}
              className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors flex items-center space-x-2"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
              <span>Clear Data</span>
            </button>
          </div>

          {/* Conversion Area */}
          <div className="flex items-center space-x-4">
            {/* EBCDIC Side */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  EBCDIC (Hex)
                </h3>
                <button
                  onClick={saveEbcdicFile}
                  disabled={!ebcdicText.trim()}
                  className="px-3 py-1 text-sm bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded transition-colors"
                >
                  Save Binary
                </button>
              </div>
              <textarea
                value={ebcdicText}
                onChange={(e) => setEbcdicText(e.target.value.replace(/\n/g, ''))} // Remove line breaks on input
                placeholder="Enter EBCDIC hex values (e.g., C1C2C3)"
                className="w-full h-64 p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
                style={{ whiteSpace: 'pre', overflowWrap: 'break-word' }}
                disabled={conversionDirection === 'toEbcdic' || isConverting}
              />
            </div>

            {/* Conversion Button */}
            <div className="flex flex-col items-center space-y-2">
              <button
                onClick={handleConvert}
                disabled={isConverting || !isInitialized}
                className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-full transition-colors"
              >
                {isConverting ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                ) : conversionDirection === 'toAscii' ? (
                  <ArrowRightIcon className="w-5 h-5" />
                ) : (
                  <ArrowLeftIcon className="w-5 h-5" />
                )}
              </button>
              <button
                onClick={toggleDirection}
                disabled={isConverting}
                className="text-sm text-blue-600 dark:text-blue-400 hover:underline disabled:text-gray-400"
              >
                Toggle
              </button>
            </div>

            {/* ASCII Side */}
            <div className="flex-1">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  ASCII (Text)
                </h3>
                <button
                  onClick={saveAsciiFile}
                  disabled={!asciiText.trim()}
                  className="px-3 py-1 text-sm bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded transition-colors"
                >
                  Save Text
                </button>
              </div>
              <textarea
                value={asciiText}
                onChange={handleAsciiCursorChange}
                onClick={handleAsciiCursorMove}
                onKeyUp={handleAsciiCursorMove}
                placeholder="Enter ASCII text"
                className="w-full h-64 p-4 font-mono text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white resize-none"
                disabled={conversionDirection === 'toAscii' || isConverting}
              />
              {/* Hex Display */}
              <div className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-700">
                <div className="font-mono text-xs text-gray-600 dark:text-gray-400">
                  {asciiHexDisplay || 'Click or move cursor in ASCII text to see hex values'}
                </div>
              </div>
            </div>
          </div>

          {/* Error Display */}
          {conversionErrors.length > 0 && (
            <div className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
              <div className="flex items-center mb-2">
                <ExclamationTriangleIcon className="w-5 h-5 text-yellow-600 dark:text-yellow-400 mr-2" />
                <h4 className="text-sm font-semibold text-yellow-800 dark:text-yellow-300">
                  Conversion Warnings
                </h4>
              </div>
              <ul className="text-sm text-yellow-700 dark:text-yellow-400 space-y-1">
                {conversionErrors.map((error, index) => (
                  <li key={index}>• {error}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Console Debug Panel */}
          <div className="mt-6">
            <div className="flex items-center justify-between mb-2">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  checked={showConsole}
                  onChange={(e) => {
                    setShowConsole(e.target.checked);
                    if (e.target.checked) {
                      addConsoleLog('Debug console activated');
                    } else {
                      setConsoleLog([]);
                    }
                  }}
                  className="mr-2"
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  Show Debug Console
                </span>
              </label>
              {showConsole && (
                <button
                  onClick={() => setConsoleLog([])}
                  className="px-3 py-1 text-xs bg-gray-600 hover:bg-gray-700 text-white rounded transition-colors"
                >
                  Clear Console
                </button>
              )}
            </div>
            
            {showConsole && (
              <div className="bg-black text-green-400 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
                {consoleLog.length === 0 ? (
                  <div className="text-gray-500">Console output will appear here...</div>
                ) : (
                  consoleLog.map((log, index) => (
                    <div key={index} className="mb-1">
                      {log}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Info Panel */}
          <div className="mt-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 dark:text-blue-300 mb-2">
              Usage Instructions
            </h4>
            <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
              <li>• For EBCDIC to ASCII: Enter hex values without spaces (e.g., C1C2C3 for "ABC")</li>
              <li>• For ASCII to EBCDIC: Enter regular text</li>
              <li>• EBCDIC data is displayed as continuous hex string (legacy format)</li>
              <li>• Save Binary converts hex to actual binary file (.dat)</li>
              <li>• Save Text saves ASCII content as plain text file (.txt)</li>
              <li>• Multiple encoding types supported for different regions</li>
              <li>• SOSI processing available for double-byte character sets</li>
              <li>• Enable Debug Console to see detailed conversion logs</li>
            </ul>
          </div>
        </div>
      )}

      {activeTab === 'dataset' && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <p className="text-lg">Dataset conversion tools coming soon...</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToolsPage;