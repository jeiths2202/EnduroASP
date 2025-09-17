import React, { useState, useEffect, useRef } from 'react';
import {
  ClockIcon,
  ServerIcon,
  DocumentTextIcon,
  TrashIcon,
  ArrowPathIcon,
  FunnelIcon,
  CodeBracketIcon,
  DocumentIcon,
  FolderIcon,
} from '@heroicons/react/24/outline';

interface LogEntry {
  id: string;
  timestamp: string;
  level: 'INFO' | 'WARNING' | 'ERROR' | 'DEBUG';
  source: string;
  message: string;
  details?: {
    program_name?: string;
    program_type?: string;
    package_name?: string;
    class_name?: string;
    map_name?: string;
    [key: string]: any;
  };
}

interface LogFile {
  name: string;
  size: number;
  modified: number;
}

interface LogManagementPageProps {
  isDarkMode?: boolean;
}

const LogManagementPage: React.FC<LogManagementPageProps> = ({ isDarkMode = true }) => {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [filteredLogs, setFilteredLogs] = useState<LogEntry[]>([]);
  const [filter, setFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [displayFormat, setDisplayFormat] = useState<'json' | 'line'>('line');
  const [logFiles, setLogFiles] = useState<LogFile[]>([]);
  const [selectedLogFile, setSelectedLogFile] = useState<string>('');
  const [lineCount, setLineCount] = useState<number>(1000);
  const [logContent, setLogContent] = useState<string>('');
  const [viewMode, setViewMode] = useState<'api' | 'file'>('api');
  const logContainerRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<NodeJS.Timer | null>(null);

  // Fetch logs from API
  const fetchLogs = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('http://localhost:8000/api/logs');
      if (response.ok) {
        const data = await response.json();
        setLogs(data.logs || []);
      }
    } catch (error) {
      console.error('Failed to fetch logs:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch log files list
  const fetchLogFiles = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/log-files');
      if (response.ok) {
        const data = await response.json();
        setLogFiles(data.files || []);
        if (data.files && data.files.length > 0 && !selectedLogFile) {
          setSelectedLogFile(data.files[0].name);
        }
      }
    } catch (error) {
      console.error('Failed to fetch log files:', error);
    }
  };

  // Fetch log file content
  const fetchLogFileContent = async () => {
    if (!selectedLogFile) return;
    
    try {
      setIsLoading(true);
      const response = await fetch(`http://localhost:8000/api/log-files/${selectedLogFile}?lines=${lineCount}`);
      if (response.ok) {
        const data = await response.json();
        setLogContent(data.content || '');
      }
    } catch (error) {
      console.error('Failed to fetch log file content:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Initial data fetch
  useEffect(() => {
    fetchLogFiles();
    if (viewMode === 'api') {
      fetchLogs();
    }
  }, [viewMode]);

  // Auto-refresh logic
  useEffect(() => {
    if (autoRefresh) {
      if (viewMode === 'api') {
        intervalRef.current = setInterval(fetchLogs, 2000);
      } else {
        intervalRef.current = setInterval(fetchLogFileContent, 2000);
      }
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [autoRefresh, viewMode, selectedLogFile, lineCount]);

  // Fetch log file content when selection changes
  useEffect(() => {
    if (viewMode === 'file' && selectedLogFile) {
      fetchLogFileContent();
    }
  }, [selectedLogFile, lineCount, viewMode]);

  // Format log for single line display
  const formatLogLine = (log: LogEntry): string => {
    let programInfo = '';
    
    if (log.details?.program_name) {
      if (log.details.program_type === 'JAVA' && log.details.package_name) {
        programInfo = ` [${log.details.program_type}:${log.details.package_name}.${log.details.class_name || log.details.program_name}]`;
      } else {
        programInfo = ` [${log.details.program_type || 'UNKNOWN'}:${log.details.program_name}]`;
      }
    }
    
    const otherDetails = log.details ? 
      Object.fromEntries(
        Object.entries(log.details).filter(([key]) => 
          !['program_name', 'program_type', 'package_name', 'class_name'].includes(key)
        )
      ) : {};
    
    const additionalDetails = Object.keys(otherDetails).length > 0 ? ` ${JSON.stringify(otherDetails)}` : '';
    
    return `[${log.timestamp}] [${log.level}] [${log.source}]${programInfo} ${log.message}${additionalDetails}`;
  };

  // Format JSON with syntax highlighting
  const formatJsonLog = (log: LogEntry): React.ReactElement => {
    const logObj = {
      timestamp: log.timestamp,
      level: log.level,
      source: log.source,
      message: log.message,
      ...(log.details && { details: log.details })
    };
    
    return (
      <pre className="text-xs text-gray-800 dark:text-gray-200 font-mono overflow-x-auto whitespace-pre-wrap">
        {JSON.stringify(logObj, null, 2)}
      </pre>
    );
  };

  // Filter logs based on level and search term
  useEffect(() => {
    let filtered = logs;

    // Filter by level
    if (filter !== 'ALL') {
      filtered = filtered.filter(log => log.level === filter);
    }

    // Filter by search term
    if (searchTerm) {
      filtered = filtered.filter(log => 
        log.message.toLowerCase().includes(searchTerm.toLowerCase()) ||
        log.source.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    setFilteredLogs(filtered);

    // Auto-scroll to bottom when new logs arrive
    if (logContainerRef.current && autoRefresh) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [logs, filter, searchTerm, autoRefresh]);

  const clearLogs = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/logs', {
        method: 'DELETE',
      });
      if (response.ok) {
        setLogs([]);
      }
    } catch (error) {
      console.error('Failed to clear logs:', error);
    }
  };

  const getLevelColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'text-blue-600 dark:text-blue-400';
      case 'WARNING':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'ERROR':
        return 'text-red-600 dark:text-red-400';
      case 'DEBUG':
        return 'text-gray-600 dark:text-gray-400';
      default:
        return 'text-gray-600 dark:text-gray-400';
    }
  };

  const getLevelBgColor = (level: string) => {
    switch (level) {
      case 'INFO':
        return 'bg-blue-100 dark:bg-blue-900/20';
      case 'WARNING':
        return 'bg-yellow-100 dark:bg-yellow-900/20';
      case 'ERROR':
        return 'bg-red-100 dark:bg-red-900/20';
      case 'DEBUG':
        return 'bg-gray-100 dark:bg-gray-900/20';
      default:
        return 'bg-gray-100 dark:bg-gray-900/20';
    }
  };

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <DocumentTextIcon className="w-6 h-6 text-gray-700 dark:text-gray-300" />
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                ログ管理
              </h1>
              {isLoading && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600 dark:border-blue-400"></div>
              )}
              <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('api')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'api'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  APIログ
                </button>
                <button
                  onClick={() => setViewMode('file')}
                  className={`px-3 py-1 text-xs rounded-md transition-colors ${
                    viewMode === 'file'
                      ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                      : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                  }`}
                >
                  ファイルログ
                </button>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {/* Log file selector (only in file mode) */}
              {viewMode === 'file' && (
                <>
                  <select
                    value={selectedLogFile}
                    onChange={(e) => setSelectedLogFile(e.target.value)}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value="">ログファイルを選択</option>
                    {logFiles.map((file) => (
                      <option key={file.name} value={file.name}>
                        {file.name} ({(file.size / 1024).toFixed(1)}KB)
                      </option>
                    ))}
                  </select>
                  
                  <select
                    value={lineCount}
                    onChange={(e) => setLineCount(Number(e.target.value))}
                    className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  >
                    <option value={100}>100行</option>
                    <option value={1000}>1000行</option>
                    <option value={10000}>10000行</option>
                  </select>
                </>
              )}
              
              {/* Search (only in API mode) */}
              {viewMode === 'api' && (
                <div className="relative">
                  <input
                    type="text"
                    placeholder="ログを検索..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 w-64 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                  />
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FunnelIcon className="h-4 w-4 text-gray-400" />
                  </div>
                </div>
              )}

              {/* Filter (only in API mode) */}
              {viewMode === 'api' && (
                <select
                  value={filter}
                  onChange={(e) => setFilter(e.target.value)}
                  className="px-4 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400"
                >
                  <option value="ALL">すべて</option>
                  <option value="INFO">INFO</option>
                  <option value="WARNING">WARNING</option>
                  <option value="ERROR">ERROR</option>
                  <option value="DEBUG">DEBUG</option>
                </select>
              )}

              {/* Auto-refresh toggle */}
              <button
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`px-4 py-2 text-sm rounded-lg transition-colors ${
                  autoRefresh
                    ? 'bg-blue-600 text-white hover:bg-blue-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
                }`}
              >
                <div className="flex items-center space-x-2">
                  <ArrowPathIcon className={`w-4 h-4 ${autoRefresh ? 'animate-spin' : ''}`} />
                  <span>自動更新</span>
                </div>
              </button>

              {/* Display format toggle (only in API mode) */}
              {viewMode === 'api' && (
                <div className="flex items-center bg-gray-200 dark:bg-gray-700 rounded-lg p-1">
                  <button
                    onClick={() => setDisplayFormat('line')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      displayFormat === 'line'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-1">
                      <DocumentIcon className="w-3 h-3" />
                      <span>ライン</span>
                    </div>
                  </button>
                  <button
                    onClick={() => setDisplayFormat('json')}
                    className={`px-3 py-1 text-xs rounded-md transition-colors ${
                      displayFormat === 'json'
                        ? 'bg-white dark:bg-gray-600 text-gray-900 dark:text-white shadow-sm'
                        : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'
                    }`}
                  >
                    <div className="flex items-center space-x-1">
                      <CodeBracketIcon className="w-3 h-3" />
                      <span>JSON</span>
                    </div>
                  </button>
                </div>
              )}

              {/* Clear logs (only in API mode) */}
              {viewMode === 'api' && (
                <button
                  onClick={clearLogs}
                  className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <div className="flex items-center space-x-2">
                    <TrashIcon className="w-4 h-4" />
                    <span>クリア</span>
                  </div>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Log container */}
      <div className="flex-1 overflow-hidden">
        <div
          ref={logContainerRef}
          className="h-full overflow-y-auto p-6 space-y-2"
        >
          {viewMode === 'api' ? (
            // API Log View
            filteredLogs.length === 0 ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <DocumentTextIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    ログがありません
                  </p>
                </div>
              </div>
            ) : (
              displayFormat === 'line' ? (
                // Line format display
                <div className="space-y-1">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-3 rounded border-l-4 ${getLevelBgColor(log.level)} ${
                        log.level === 'ERROR'
                          ? 'border-l-red-500'
                          : log.level === 'WARNING'
                          ? 'border-l-yellow-500'
                          : log.level === 'INFO'
                          ? 'border-l-blue-500'
                          : 'border-l-gray-500'
                      }`}
                    >
                      <p className="text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                        {formatLogLine(log)}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                // JSON format display
                <div className="space-y-3">
                  {filteredLogs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-4 rounded-lg border ${getLevelBgColor(log.level)} ${
                        log.level === 'ERROR' 
                          ? 'border-red-200 dark:border-red-800' 
                          : 'border-gray-200 dark:border-gray-700'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-3 flex-wrap">
                            <span className={`text-xs font-semibold px-2 py-1 rounded ${getLevelColor(log.level)}`}>
                              {log.level}
                            </span>
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <ClockIcon className="w-3 h-3 mr-1" />
                              {log.timestamp}
                            </div>
                            <div className="flex items-center text-xs text-gray-500 dark:text-gray-400">
                              <ServerIcon className="w-3 h-3 mr-1" />
                              {log.source}
                            </div>
                            {log.details?.program_name && (
                              <div className="flex items-center text-xs font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 px-2 py-1 rounded">
                                {log.details.program_type === 'JAVA' && log.details.package_name ? (
                                  <span>{log.details.program_type}:{log.details.package_name}.{log.details.class_name || log.details.program_name}</span>
                                ) : (
                                  <span>{log.details.program_type || 'UNKNOWN'}:{log.details.program_name}</span>
                                )}
                              </div>
                            )}
                          </div>
                          {formatJsonLog(log)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )
          ) : (
            // File Log View
            !selectedLogFile ? (
              <div className="flex items-center justify-center h-full">
                <div className="text-center">
                  <FolderIcon className="w-12 h-12 text-gray-400 dark:text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-500 dark:text-gray-400">
                    ログファイルを選択してください
                  </p>
                </div>
              </div>
            ) : (
              <div className="bg-black text-green-400 p-4 rounded-lg font-mono text-sm">
                <pre className="whitespace-pre-wrap overflow-x-auto">
                  {logContent || 'ログファイルが空です'}
                </pre>
              </div>
            )
          )}
        </div>
      </div>

      {/* Status bar */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-2">
        <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
          <div className="flex items-center space-x-4">
            {viewMode === 'api' ? (
              <>
                <span>総ログ数: {filteredLogs.length} / {logs.length}</span>
                <span>表示形式: {displayFormat === 'line' ? 'ライン' : 'JSON'}</span>
              </>
            ) : (
              <>
                <span>ファイル: {selectedLogFile || 'なし'}</span>
                <span>表示行数: {lineCount}行</span>
              </>
            )}
            <span>モード: {viewMode === 'api' ? 'APIログ' : 'ファイルログ'}</span>
          </div>
          <span>最終更新: {new Date().toLocaleTimeString('ja-JP')}</span>
        </div>
      </div>
    </div>
  );
};

export default LogManagementPage;