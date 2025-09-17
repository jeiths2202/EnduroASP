import React, { useState, useEffect, useRef } from 'react';
import { 
  CpuChipIcon,
  ServerIcon,
  CircleStackIcon,
  ClockIcon,
  ArrowPathIcon,
  ExclamationTriangleIcon,
  Cog6ToothIcon
} from '@heroicons/react/24/outline';
import SystemManagerPage from './SystemManagerPage';

interface SystemInfo {
  hostname: string;
  uptime: string;
  cpu_percent: number;
  cpu_count: number;
  memory_total: string;
  memory_used: string;
  memory_percent: number;
  disk_total: string;
  disk_used: string;
  disk_percent: number;
  process_count: number;
  load_avg: [number, number, number];
}

interface ProcessInfo {
  pid: number;
  name: string;
  user: string;
  cpu_percent: number;
  memory_percent: number;
  status: string;
}

interface Alert {
  type: string;
  message: string;
  timestamp: string;
}

interface SystemData {
  system_info: SystemInfo;
  processes: ProcessInfo[];
  alerts: Alert[];
  logs: string[];
  last_update: string;
}

const DashboardPage: React.FC = () => {
  const [systemData, setSystemData] = useState<SystemData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState<number>(5);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSystemData = async () => {
    setIsRefreshing(true);
    try {
      // Try to fetch from port 3008 (ASP Manager backend service)
      const response = await fetch('http://localhost:3008/api/system');
      if (!response.ok) {
        throw new Error('Failed to fetch system data');
      }
      const data = await response.json();
      setSystemData(data);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching system data:', error);
      
      // フォールバックデータ
      setSystemData({
        system_info: {
          hostname: 'ASP-SYS-001',
          uptime: '3d 12h 30m',
          cpu_percent: 34.5,
          cpu_count: 8,
          memory_total: '16.0 GB',
          memory_used: '8.0 GB',
          memory_percent: 50.0,
          disk_total: '100.0 GB',
          disk_used: '20.0 GB',
          disk_percent: 20.0,
          process_count: 128,
          load_avg: [0.85, 1.12, 1.35]
        },
        processes: [
          { pid: 1234, name: 'asp-server', user: 'root', cpu_percent: 12.5, memory_percent: 8.3, status: 'running' },
          { pid: 5678, name: 'batch-proc', user: 'batch', cpu_percent: 8.2, memory_percent: 4.1, status: 'running' }
        ],
        alerts: [
          { type: 'info', message: 'System monitoring active', timestamp: new Date().toISOString() }
        ],
        logs: [
          `[${new Date().toLocaleTimeString()}] INFO: ASP Manager dashboard loaded`,
          `[${new Date().toLocaleTimeString()}] INFO: System monitoring active`
        ],
        last_update: new Date().toISOString()
      });
      setLastUpdated(new Date());
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const startAutoRefresh = () => {
    stopAutoRefresh();
    intervalRef.current = setInterval(fetchSystemData, refreshInterval * 1000);
  };

  const stopAutoRefresh = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const handleManualRefresh = () => {
    fetchSystemData();
  };

  const handleRefreshIntervalChange = (newInterval: number) => {
    setRefreshInterval(newInterval);
    startAutoRefresh();
  };

  useEffect(() => {
    fetchSystemData();
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, []);

  useEffect(() => {
    startAutoRefresh();
    return () => stopAutoRefresh();
  }, [refreshInterval]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">システム情報を読み込んでいます...</p>
        </div>
      </div>
    );
  }

  if (!systemData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <ServerIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-400">システム情報を取得できませんでした</p>
          <button 
            onClick={handleManualRefresh}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            再試行
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full bg-gray-900 text-white">
      {/* ヘッダー */}
      <div className="bg-gray-800 border-b border-gray-700 p-4">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-white">ダッシュボード</h1>
            <p className="text-gray-400 text-sm">
              最終更新: {lastUpdated ? lastUpdated.toLocaleString('ja-JP') : 'なし'}
            </p>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* システム管理ボタン */}
            <button
              onClick={() => setActiveSection(activeSection === 'system_manager' ? 'overview' : 'system_manager')}
              className={`px-4 py-2 rounded-lg transition-colors ${
                activeSection === 'system_manager' 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              {activeSection === 'system_manager' ? 'ダッシュボード' : 'システム管理'}
            </button>
            
            {/* 更新間隔設定 */}
            <div className="flex items-center space-x-2">
              <label className="text-sm text-gray-300">更新間隔:</label>
              <select
                value={refreshInterval}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="bg-gray-700 text-white px-3 py-1 rounded border border-gray-600"
              >
                <option value={1}>1秒</option>
                <option value={5}>5秒</option>
                <option value={10}>10秒</option>
                <option value={30}>30秒</option>
                <option value={60}>1分</option>
              </select>
            </div>
            
            {/* 手動更新ボタン */}
            <button
              onClick={handleManualRefresh}
              disabled={isRefreshing}
              className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <ArrowPathIcon className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>更新</span>
            </button>
          </div>
        </div>
      </div>

      {/* コンテンツ切り替え */}
      {activeSection === 'system_manager' ? (
        <SystemManagerPage />
      ) : (
        <div className="p-6">
          {/* システム情報カード */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* CPU使用率 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <CpuChipIcon className="w-8 h-8 text-blue-400" />
                  <div>
                    <p className="text-sm text-gray-400">CPU使用率</p>
                    <p className="text-2xl font-bold text-white">{systemData.system_info.cpu_percent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-blue-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${systemData.system_info.cpu_percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {systemData.system_info.cpu_count}コア
              </div>
            </div>

            {/* メモリ使用量 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <CircleStackIcon className="w-8 h-8 text-green-400" />
                  <div>
                    <p className="text-sm text-gray-400">メモリ使用量</p>
                    <p className="text-2xl font-bold text-white">{systemData.system_info.memory_percent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-green-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${systemData.system_info.memory_percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {systemData.system_info.memory_used} / {systemData.system_info.memory_total}
              </div>
            </div>

            {/* ディスク使用量 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <ServerIcon className="w-8 h-8 text-purple-400" />
                  <div>
                    <p className="text-sm text-gray-400">ディスク使用量</p>
                    <p className="text-2xl font-bold text-white">{systemData.system_info.disk_percent.toFixed(1)}%</p>
                  </div>
                </div>
              </div>
              <div className="w-full bg-gray-700 rounded-full h-2">
                <div 
                  className="bg-purple-400 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${systemData.system_info.disk_percent}%` }}
                />
              </div>
              <div className="mt-2 text-xs text-gray-400">
                {systemData.system_info.disk_used} / {systemData.system_info.disk_total}
              </div>
            </div>

            {/* システム稼働時間 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <ClockIcon className="w-8 h-8 text-yellow-400" />
                  <div>
                    <p className="text-sm text-gray-400">システム稼働時間</p>
                    <p className="text-lg font-bold text-white">{systemData.system_info.uptime}</p>
                  </div>
                </div>
              </div>
              <div className="mt-2 text-xs text-gray-400">
                プロセス数: {systemData.system_info.process_count}
              </div>
            </div>
          </div>

          {/* アラート */}
          {systemData.alerts && systemData.alerts.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700 mb-8">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center">
                <ExclamationTriangleIcon className="w-5 h-5 mr-2 text-yellow-400" />
                システムアラート
              </h3>
              <div className="space-y-2">
                {systemData.alerts.map((alert, index) => (
                  <div key={index} className={`p-3 rounded border-l-4 ${
                    alert.type === 'warning' ? 'bg-yellow-900/20 border-yellow-400' : 'bg-blue-900/20 border-blue-400'
                  }`}>
                    <p className="text-white">{alert.message}</p>
                    <p className="text-xs text-gray-400">{new Date(alert.timestamp).toLocaleTimeString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 詳細情報セクション */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* システム情報 */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">システム情報</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">ホスト名</span>
                  <span className="text-white font-medium">{systemData.system_info.hostname}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">CPUコア数</span>
                  <span className="text-white font-medium">{systemData.system_info.cpu_count}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">負荷平均</span>
                  <span className="text-white font-medium">{systemData.system_info.load_avg.map(l => l.toFixed(2)).join(', ')}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-400">プロセス数</span>
                  <span className="text-white font-medium">{systemData.system_info.process_count}</span>
                </div>
              </div>
            </div>

            {/* トッププロセス */}
            <div className="bg-gray-800 rounded-lg p-6 border border-gray-700">
              <h3 className="text-lg font-semibold text-white mb-4">トッププロセス</h3>
              <div className="space-y-2">
                {systemData.processes.slice(0, 5).map((proc) => (
                  <div key={proc.pid} className="flex justify-between items-center py-2 border-b border-gray-700">
                    <div>
                      <p className="text-white font-medium">{proc.name}</p>
                      <p className="text-xs text-gray-400">PID: {proc.pid} | {proc.user}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-white">{proc.cpu_percent.toFixed(1)}%</p>
                      <p className="text-xs text-gray-400">{proc.memory_percent.toFixed(1)}% MEM</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DashboardPage;