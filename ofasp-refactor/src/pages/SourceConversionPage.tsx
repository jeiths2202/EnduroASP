import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  FolderOpenIcon,
  DocumentIcon,
  ArrowRightIcon,
  DocumentArrowDownIcon,
} from '@heroicons/react/24/outline';
import { 
  encodingConverter, 
  ConversionMode, 
  EncodingType, 
  ErrorHandling,
  type ConversionOptions 
} from '../utils/encodingConverter';
import { 
  convertEbcdicToAscii, 
  type EbcdicConversionOptions 
} from '../utils/ebcdicConverter';
import { pythonConverter } from '../utils/pythonConverter';
import { PythonBatchConverter } from '../utils/pythonBatchConverter';

interface FileInfo {
  name: string;
  size: number;
  lastModified: Date;
  path: string;
  type: 'file' | 'directory';
}

interface SourceConversionPageProps {
  isDarkMode: boolean;
}

const SourceConversionPage: React.FC<SourceConversionPageProps> = ({ isDarkMode }) => {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [selectedFile, setSelectedFile] = useState<FileInfo | null>(null);
  const [originalContent, setOriginalContent] = useState<string>('');
  const [convertedContent, setConvertedContent] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [hexViewWidth, setHexViewWidth] = useState<number>(50); // percentage
  const [isResizing, setIsResizing] = useState<boolean>(false);
  const [encoding, setEncoding] = useState<EncodingType>(EncodingType.US);
  const [errorHandling, setErrorHandling] = useState<ErrorHandling>(ErrorHandling.REPLACE);
  const [useSOSI, setUseSOSI] = useState(false);
  const [sosiType, setSosiType] = useState<'0E0F' | '1E1F' | 'custom'>('0E0F');
  const [customSO, setCustomSO] = useState('0E');
  const [customSI, setCustomSI] = useState('0F');
  const [sosiHandling, setSosiHandling] = useState<'remove' | 'keep' | 'space'>('remove');
  const [isInitialized, setIsInitialized] = useState(false);
  const [showConsole, setShowConsole] = useState(false);
  const [consoleLog, setConsoleLog] = useState<string[]>([]);
  const [useBatchConversion, setUseBatchConversion] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const consoleRef = useRef<HTMLDivElement>(null);

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

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDirectorySelect = () => {
    dirInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileInfos: FileInfo[] = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        lastModified: new Date(file.lastModified),
        path: file.name,
        type: 'file' as const
      }));
      setSelectedFiles(fileInfos);
    }
  };

  const handleFileItemClick = async (file: FileInfo) => {
    setSelectedFile(file);
    
    // ファイルの内容を読み込み
    const fileInput = fileInputRef.current;
    if (fileInput?.files) {
      const actualFile = Array.from(fileInput.files).find(f => f.name === file.name);
      if (actualFile) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const arrayBuffer = e.target?.result as ArrayBuffer;
          const bytes = new Uint8Array(arrayBuffer);
          
          // Convert binary to hex string for EBCDIC conversion
          const hexString = Array.from(bytes)
            .map(byte => byte.toString(16).padStart(2, '0').toUpperCase())
            .join('');
          
          setOriginalContent(hexString);
          setConvertedContent(''); // 変換内容をクリア
        };
        reader.readAsArrayBuffer(actualFile);
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP');
  };

  const addConsoleLog = (message: string) => {
    if (showConsole) {
      const timestamp = new Date().toLocaleTimeString();
      setConsoleLog(prev => [...prev, `[${timestamp}] ${message}`]);
    }
  };

  const scrollToLineInConsole = (lineNumber: number) => {
    // Debug Consoleが閉じている場合は先に開く
    if (!showConsole) {
      setShowConsole(true);
      // Debug Consoleが開くまで少し待ってからスクロール実行
      setTimeout(() => scrollToLineInConsole(lineNumber), 200);
      return;
    }

    // Line処理開始ログを検索
    const targetPattern = `=== Line ${lineNumber} 処理開始`;
    const logIndex = consoleLog.findIndex(log => log.includes(targetPattern));
    
    if (logIndex !== -1) {
      // 少し遅延してスクロール (DOM更新待ち)
      setTimeout(() => {
        if (consoleRef.current) {
          const logElements = consoleRef.current.children;
          if (logElements[logIndex]) {
            logElements[logIndex].scrollIntoView({ 
              behavior: 'smooth', 
              block: 'center' 
            });
            
            // 該当ログをハイライト
            const element = logElements[logIndex] as HTMLElement;
            element.style.backgroundColor = '#ffff00';
            element.style.color = '#000000';
            
            // 3秒後にハイライト解除
            setTimeout(() => {
              element.style.backgroundColor = '';
              element.style.color = '';
            }, 3000);
          }
        }
      }, 100);
    } else {
      // 該当行のログが見つからない場合の通知
      alert(`Line ${lineNumber}の処理ログが見つかりません。バッチ変換モードでは詳細ログが生成されません。`);
    }
  };

  const renderHexView = (hexContent: string): React.ReactElement => {
    const lines = [];
    
    // Convert hex string to bytes
    const bytes: number[] = [];
    for (let i = 0; i < hexContent.length; i += 2) {
      const hexByte = hexContent.substr(i, 2);
      if (hexByte.length === 2) {
        bytes.push(parseInt(hexByte, 16));
      }
    }
    
    // Display in xxd format
    for (let i = 0; i < bytes.length; i += 16) {
      const chunk = bytes.slice(i, i + 16);
      const offset = i.toString(16).padStart(8, '0');
      
      // Hex part with spacing
      const hexPart = chunk
        .map(b => b.toString(16).padStart(2, '0'))
        .join(' ')
        .padEnd(47, ' '); // 16 bytes * 2 chars + 15 spaces
      
      // ASCII part - for EBCDIC, just show dots for now
      const asciiPart = chunk
        .map(b => '.')
        .join('');
      
      lines.push(
        <div key={i} className="font-mono text-xs leading-relaxed">
          <span className="text-gray-500 dark:text-gray-400">{offset}:</span>
          <span className="mx-2 text-blue-600 dark:text-blue-400">{hexPart}</span>
          <span className="text-gray-700 dark:text-gray-300">{asciiPart}</span>
        </div>
      );
    }
    
    return <div className="whitespace-pre-wrap">{lines}</div>;
  };

  const handleConvert = async () => {
    if (!selectedFile || !originalContent) return;
    
    if (!isInitialized) {
      alert('変換機が初期化されていません。しばらくお待ちください。');
      return;
    }
    
    setIsConverting(true);
    addConsoleLog('=== 変換開始 ===');
    addConsoleLog(`ファイル: ${selectedFile.name}`);
    addConsoleLog(`エンコーディング: ${encoding}`);
    addConsoleLog(`エラー処理: ${errorHandling}`);
    
    if (useSOSI) {
      addConsoleLog(`SOSI処理: 有効`);
      addConsoleLog(`SOSI タイプ: ${sosiType}`);
      if (sosiType === 'custom') {
        addConsoleLog(`カスタムSO: 0x${customSO}, SI: 0x${customSI}`);
      }
      addConsoleLog(`SOSI処理方法: ${sosiHandling}`);
    }
    
    try {
      // Convert hex string to bytes for line processing
      const bytes: number[] = [];
      for (let i = 0; i < originalContent.length; i += 2) {
        const hexByte = originalContent.substr(i, 2);
        if (hexByte.length === 2) {
          bytes.push(parseInt(hexByte, 16));
        }
      }

      addConsoleLog(`入力データサイズ: ${bytes.length} bytes`);
      
      const lineLength = 80;
      let resultLines: string[] = [];
      
      if (useBatchConversion) {
        // Use batch conversion (faster)
        addConsoleLog('バッチ変換モードを使用');
        try {
          // Prepare SOSI codes for batch conversion
          let sosiSO: number | undefined;
          let sosiSI: number | undefined;
          
          if (useSOSI) {
            if (sosiType === '0E0F') {
              sosiSO = 0x0E;
              sosiSI = 0x0F;
            } else if (sosiType === '1E1F') {
              sosiSO = 0x1E;
              sosiSI = 0x1F;
            } else if (sosiType === 'custom') {
              sosiSO = parseInt(customSO, 16);
              sosiSI = parseInt(customSI, 16);
            }
            addConsoleLog(`バッチ変換SOSI codes: SO=0x${sosiSO?.toString(16).padStart(2, '0').toUpperCase()}, SI=0x${sosiSI?.toString(16).padStart(2, '0').toUpperCase()}`);
          }
          
          const batchOptions = {
            encoding,
            useSOSI,
            sosiHandling,
            rlen: lineLength,
            sosiSO,
            sosiSI
          };
          
          resultLines = await PythonBatchConverter.convertWithLineProcessing(
            bytes,
            batchOptions,
            (processed, total) => {
              addConsoleLog(`処理中: ${processed}/${total} 行`);
            }
          );
          
          addConsoleLog(`バッチ変換完了: ${resultLines.length} 行`);
        } catch (batchError) {
          addConsoleLog(`バッチ変換エラー: ${batchError}`);
          addConsoleLog('行ごと変換にフォールバック');
          // Fall back to line-by-line conversion
        }
      }
      
      if (!useBatchConversion || resultLines.length === 0) {
        // Process line by line (slower but more detailed logging)
        addConsoleLog('行ごと変換モードを使用');
        resultLines = [];
        
        for (let lineStart = 0; lineStart < bytes.length; lineStart += lineLength) {
        const lineEnd = Math.min(lineStart + lineLength, bytes.length);
        const lineBytes = bytes.slice(lineStart, lineEnd);
        
        // Convert line bytes back to hex string for conversion
        const lineHex = lineBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
        
        const lineNumber = Math.floor(lineStart / lineLength) + 1;
        addConsoleLog(`=== Line ${lineNumber} 処理開始 (${lineBytes.length} bytes) ===`);
        
        // Show input hex values
        addConsoleLog(`入力HEX: ${lineHex}`);
        addConsoleLog(`入力バイト: ${lineBytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')}`);
        
        // Convert this line using Python service
        let convertedLine: string;
        try {
          addConsoleLog(`Python サービスで変換中...`);
          
          // Prepare SOSI codes based on UI settings
          let sosiSO: number | undefined;
          let sosiSI: number | undefined;
          
          if (useSOSI) {
            if (sosiType === '0E0F') {
              sosiSO = 0x0E;
              sosiSI = 0x0F;
            } else if (sosiType === '1E1F') {
              sosiSO = 0x1E;
              sosiSI = 0x1F;
            } else if (sosiType === 'custom') {
              sosiSO = parseInt(customSO, 16);
              sosiSI = parseInt(customSI, 16);
            }
            addConsoleLog(`SOSI codes: SO=0x${sosiSO?.toString(16).padStart(2, '0').toUpperCase()}, SI=0x${sosiSI?.toString(16).padStart(2, '0').toUpperCase()}`);
          }
          
          convertedLine = await pythonConverter.EBCDIC_TO_ASCII(
            lineHex,          // input
            null,             // output (not used)
            encoding,         // encoding type
            useSOSI,          // sosi_flag
            false,            // out_sosi_flag (should be false when using sosi_handling)
            80,               // rlen (fixed for source conversion)
            null,             // layout (not used for source)
            sosiHandling,     // sosi_handling
            sosiSO,           // sosi_so
            sosiSI            // sosi_si
          );
          addConsoleLog(`Python サービス変換完了: ${convertedLine.length} 文字`);
        } catch (error) {
          addConsoleLog(`Python サービス変換エラー: ${error}`);
          addConsoleLog(`TypeScript版にフォールバック中...`);
          
          // Fallback to TypeScript version
          try {
            convertedLine = await encodingConverter.EBCDIC_TO_ASCII(
              lineHex,          // input
              null,             // output (not used)
              encoding,         // encoding type
              useSOSI,          // sosi_flag
              false,            // out_sosi_flag (should be false when using sosi_handling)
              80,               // rlen (fixed for source conversion)
              null              // layout (not used for source)
            );
            addConsoleLog(`TypeScript版変換完了: ${convertedLine.length} 文字`);
          } catch (fallbackError) {
            addConsoleLog(`TypeScript版変換エラー: ${fallbackError}`);
            convertedLine = ''; // 両方失敗時は空文字列
          }
        }
        
        // Show converted characters and their ASCII hex values
        const asciiBytes = Array.from(convertedLine).map(char => char.charCodeAt(0));
        const asciiHex = asciiBytes.map(b => b.toString(16).padStart(2, '0').toUpperCase()).join('');
        
        addConsoleLog(`出力ASCII: "${convertedLine}"`);
        addConsoleLog(`出力HEX: ${asciiHex}`);
        addConsoleLog(`出力バイト: ${asciiBytes.map(b => `0x${b.toString(16).padStart(2, '0').toUpperCase()}`).join(' ')}`);
        
        // Show byte-by-byte conversion mapping with SOSI detection
        addConsoleLog(`バイト変換マッピング:`);
        const maxLen = Math.max(lineBytes.length, asciiBytes.length);
        for (let i = 0; i < maxLen; i++) {
          const ebcdicByte = i < lineBytes.length ? lineBytes[i] : undefined;
          const asciiByte = i < asciiBytes.length ? asciiBytes[i] : undefined;
          const ebcdicChar = ebcdicByte !== undefined ? (ebcdicByte >= 32 && ebcdicByte <= 126 ? String.fromCharCode(ebcdicByte) : '.') : '';
          const asciiChar = asciiByte !== undefined ? (asciiByte >= 32 && asciiByte <= 126 ? String.fromCharCode(asciiByte) : '.') : '';
          
          if (ebcdicByte !== undefined && asciiByte !== undefined) {
            let specialNote = '';
            if (ebcdicByte === 0x0E) specialNote = ' (SOSI: SO - ダブルバイト開始)';
            else if (ebcdicByte === 0x0F) specialNote = ' (SOSI: SI - ダブルバイト終了)';
            else if (ebcdicByte === 0x40) specialNote = ' (EBCDIC 空白)';
            
            addConsoleLog(`  [${i.toString().padStart(2, '0')}] 0x${ebcdicByte.toString(16).padStart(2, '0').toUpperCase()}('${ebcdicChar}') → 0x${asciiByte.toString(16).padStart(2, '0').toUpperCase()}('${asciiChar}')${specialNote}`);
          } else if (ebcdicByte !== undefined) {
            addConsoleLog(`  [${i.toString().padStart(2, '0')}] 0x${ebcdicByte.toString(16).padStart(2, '0').toUpperCase()}('${ebcdicChar}') → [パディング]`);
          } else if (asciiByte !== undefined) {
            addConsoleLog(`  [${i.toString().padStart(2, '0')}] [なし] → 0x${asciiByte.toString(16).padStart(2, '0').toUpperCase()}('${asciiChar}')`);
          }
        }
        
        // Pad with spaces if less than 80 characters
        if (convertedLine.length < lineLength) {
          const originalLength = convertedLine.length;
          convertedLine = convertedLine.padEnd(lineLength, ' ');
          addConsoleLog(`${lineLength - originalLength}文字のスペースでパディング`);
        }
        
        addConsoleLog(`Line ${lineNumber} 処理完了`);
        addConsoleLog('');
        
        resultLines.push(convertedLine);
        }
      }
      
      // Join lines with CR (0x0D) for display
      const finalResult = resultLines.join('\r');
      setConvertedContent(finalResult);
      
      addConsoleLog(`出力データ: ${resultLines.length} 行, ${finalResult.length} characters`);
      addConsoleLog('=== 変換完了 ===');
    } catch (error) {
      console.error('変換エラー:', error);
      addConsoleLog(`エラー: ${error instanceof Error ? error.message : 'Unknown error'}`);
      setConvertedContent('変換中にエラーが発生しました。');
    } finally {
      setIsConverting(false);
    }
  };

  const renderConvertedContent = () => {
    if (!convertedContent) {
      return '変換ボタンを押して変換を実行してください。';
    }

    const lines = convertedContent.split('\r');
    return lines.map((line, index) => (
      <div
        key={index}
        className="hover:bg-blue-100 dark:hover:bg-blue-900/30 cursor-pointer transition-colors leading-relaxed"
        onClick={() => scrollToLineInConsole(index + 1)}
        title={`Line ${index + 1}番の処理ログを表示`}
      >
        {line || ' '}
      </div>
    ));
  };

  const downloadConvertedFile = () => {
    if (!convertedContent || !selectedFile) return;
    
    // Replace CR with CRLF for Windows compatibility
    const downloadContent = convertedContent.replace(/\r/g, '\r\n');
    
    const blob = new Blob([downloadContent], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `converted_${selectedFile.name}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing || !resizeRef.current) return;
    
    const container = resizeRef.current.parentElement;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const mouseX = e.clientX - containerRect.left;
    const containerWidth = containerRect.width;
    
    // Calculate new percentage, with min/max constraints
    let newWidth = (mouseX / containerWidth) * 100;
    newWidth = Math.max(20, Math.min(80, newWidth)); // 20% to 80%
    
    setHexViewWidth(newWidth);
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  React.useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    } else {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  return (
    <div className="h-full p-6 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        ソース変換
      </h1>

      {/* ファイル選択エリア */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          ファイル選択
        </h2>
        <div className="flex space-x-4">
          <button
            onClick={handleFileSelect}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <DocumentIcon className="w-5 h-5 mr-2" />
            ファイル選択
          </button>
          <button
            onClick={handleDirectorySelect}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FolderOpenIcon className="w-5 h-5 mr-2" />
            ディレクトリ選択
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={dirInputRef}
          type="file"
          {...({ webkitdirectory: '' } as any)}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* ファイルリスト */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            選択されたファイル ({selectedFiles.length}件)
          </h2>
          <div className="max-h-80 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg" style={{ maxHeight: '320px' }}>
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                onClick={() => handleFileItemClick(file)}
                className={`p-3 border-b border-gray-200 dark:border-gray-700 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                  selectedFile?.name === file.name ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <DocumentIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)} • {formatDate(file.lastModified)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Encoding Type & Error Handling */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            変換設定
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Encoding Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Encoding Type
              </label>
              <select
                value={encoding}
                onChange={(e) => setEncoding(e.target.value as EncodingType)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={EncodingType.US}>US (English)</option>
                <option value={EncodingType.JP}>JP (Japanese)</option>
                <option value={EncodingType.KR}>KR (Korean)</option>
                <option value={EncodingType.JAK}>JAK</option>
                <option value={EncodingType.KEIS}>KEIS</option>
              </select>
            </div>

            {/* Error Handling */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Error Handling
              </label>
              <select
                value={errorHandling}
                onChange={(e) => setErrorHandling(e.target.value as ErrorHandling)}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value={ErrorHandling.REPLACE}>Replace with ?</option>
                <option value={ErrorHandling.IGNORE}>Ignore errors</option>
                <option value={ErrorHandling.STRICT}>Strict mode</option>
              </select>
            </div>
          </div>

          {/* Conversion Method */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={useBatchConversion}
                onChange={(e) => setUseBatchConversion(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                バッチ変換を使用 (高速、ログ少なめ)
              </span>
            </label>
          </div>

          {/* SOSI Options */}
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <label className="flex items-center mb-4">
              <input
                type="checkbox"
                checked={useSOSI}
                onChange={(e) => setUseSOSI(e.target.checked)}
                className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
              />
              <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
                Use SOSI (Shift-Out/Shift-In) processing for double-byte characters
              </span>
            </label>
            
            {useSOSI && (
              <div className="space-y-4">
                {/* SOSI Code Type */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    SOSI Code Type
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiType"
                        value="0E0F"
                        checked={sosiType === '0E0F'}
                        onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
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
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Alternative (SO: 0x1E, SI: 0x1F)
                      </span>
                    </label>
                    
                    <div className="flex items-center space-x-2">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="sosiType"
                          value="custom"
                          checked={sosiType === 'custom'}
                          onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        />
                        <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                          Custom:
                        </span>
                      </label>
                      <span className="text-xs text-gray-600 dark:text-gray-400">SO:</span>
                      <input
                        type="text"
                        value={customSO}
                        onChange={(e) => setCustomSO(e.target.value.toUpperCase())}
                        disabled={sosiType !== 'custom'}
                        maxLength={2}
                        placeholder="0E"
                        className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50"
                      />
                      <span className="text-xs text-gray-600 dark:text-gray-400">SI:</span>
                      <input
                        type="text"
                        value={customSI}
                        onChange={(e) => setCustomSI(e.target.value.toUpperCase())}
                        disabled={sosiType !== 'custom'}
                        maxLength={2}
                        placeholder="0F"
                        className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50"
                      />
                    </div>
                  </div>
                </div>
                
                {/* SOSI Code Handling */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    SOSI Code Handling
                  </h4>
                  <div className="flex flex-wrap gap-4">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="remove"
                        checked={sosiHandling === 'remove'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Remove SOSI codes (出力から削除)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="keep"
                        checked={sosiHandling === 'keep'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Keep SOSI codes (0x0E/0x0F 保持)
                      </span>
                    </label>
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiHandling"
                        value="space"
                        checked={sosiHandling === 'space'}
                        onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Convert to spaces (0x20に変換)
                      </span>
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 変換エリア */}
      {selectedFile && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            ファイル変換: {selectedFile.name}
          </h2>
          
          <div className="flex gap-4 relative" ref={resizeRef}>
            {/* 元ファイル表示 */}
            <div style={{ width: `${hexViewWidth}%` }}>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                元ファイル (Hex View)
              </h3>
              <div className="h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                {originalContent && renderHexView(originalContent)}
              </div>
            </div>

            {/* リサイズハンドル */}
            <div 
              className="w-2 bg-gray-300 dark:bg-gray-600 hover:bg-gray-400 dark:hover:bg-gray-500 cursor-col-resize flex items-center justify-center rounded transition-colors"
              onMouseDown={handleMouseDown}
              style={{ minWidth: '8px' }}
            >
              <div className="w-0.5 h-8 bg-gray-500 dark:bg-gray-400 rounded"></div>
            </div>

            {/* 変換ボタン */}
            <div className="flex items-center justify-center" style={{ width: '80px' }}>
              <div className="text-center space-y-4">
                <button
                  onClick={handleConvert}
                  disabled={!originalContent || isConverting}
                  className="flex items-center px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors text-sm"
                >
                  {isConverting ? (
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                  ) : (
                    <ArrowRightIcon className="w-5 h-5 mr-2" />
                  )}
                  {isConverting ? '変換中...' : '変換実行'}
                </button>
                
                {convertedContent && (
                  <button
                    onClick={downloadConvertedFile}
                    className="flex items-center px-3 py-1 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm"
                  >
                    <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                    ダウンロード
                  </button>
                )}
              </div>
            </div>

            {/* 変換結果表示 */}
            <div style={{ width: `${100 - hexViewWidth - 10}%` }}>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                変換結果 {convertedContent && <span className="text-xs text-gray-500">(ラインをクリックしてログを表示)</span>}
              </h3>
              <div className="h-96 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre" style={{ overflowX: 'auto' }}>
                  {renderConvertedContent()}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Debug Console */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <label className="flex items-center">
            <input
              type="checkbox"
              checked={showConsole}
              onChange={(e) => {
                setShowConsole(e.target.checked);
                if (e.target.checked) {
                  addConsoleLog('デバッグコンソール有効化');
                } else {
                  setConsoleLog([]);
                }
              }}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
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
          <div ref={consoleRef} className="bg-black text-green-400 rounded-lg p-4 h-64 overflow-y-auto font-mono text-sm">
            {consoleLog.length === 0 ? (
              <div className="text-gray-500">Console output will appear here...</div>
            ) : (
              consoleLog.map((log, index) => (
                <div 
                  key={index} 
                  className="mb-1 transition-colors duration-500"
                  data-log-index={index}
                >
                  {log}
                </div>
              ))
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default SourceConversionPage;