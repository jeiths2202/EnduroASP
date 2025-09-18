import React, { useState, useEffect } from 'react';

const NetworkControlComponent: React.FC = () => {
  const [sessions, setSessions] = useState<any[]>([]);
  const [sessionStats, setSessionStats] = useState<any>({
    total_sessions: 0,
    active_sessions: 0,
    inactive_sessions: 0,
    unique_users: 0,
    sessions_by_user: []
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());
  const [isProcessingBulkDisconnect, setIsProcessingBulkDisconnect] = useState(false);

  const fetchSessions = async () => {
    if (loading) return;
    
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`http://localhost:8000/api/v1/sessions?t=${Date.now()}`, {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      });
      if (response.ok) {
        const data = await response.json();
        const sessionsData = Array.isArray(data) ? data : [];
        setSessions(sessionsData);
        
        const activeSessionNames = new Set(
          sessionsData
            .filter(session => session.status === '1' || session.status === 'ON')
            .map(session => session.wsname)
        );
        setSelectedSessions(prev => new Set(
          Array.from(prev).filter(wsname => activeSessionNames.has(wsname))
        ));
      } else {
        setError('Failed to fetch sessions');
      }
      
      const statsResponse = await fetch('http://localhost:8000/api/v1/sessions/stats');
      if (statsResponse.ok) {
        const statsData = await statsResponse.json();
        const safeStatsData = {
          total_sessions: statsData.total_sessions || 0,
          active_sessions: statsData.active_sessions || 0,
          inactive_sessions: statsData.inactive_sessions || 0,
          unique_users: statsData.unique_users || 0,
          sessions_by_user: Array.isArray(statsData.sessions_by_user) ? statsData.sessions_by_user : []
        };
        setSessionStats(safeStatsData);
      }
    } catch (err) {
      console.error('Error fetching sessions:', err);
      setError('Network error while fetching sessions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  const handleLogoff = async (wsname: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/sessions/${wsname}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: '0' }),
      });
      
      if (response.ok) {
        fetchSessions();
      } else {
        setError(`Failed to logoff session ${wsname}`);
      }
    } catch (err) {
      console.error('Error logging off session:', err);
      setError('Network error while logging off session');
    }
  };

  const handleCleanupSessions = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/v1/sessions/cleanup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ days_old: 7 }),
      });
      
      if (response.ok) {
        const result = await response.json();
        alert(`Cleaned up ${result.deleted_count} old sessions`);
        fetchSessions();
      } else {
        setError('Failed to cleanup sessions');
      }
    } catch (err) {
      console.error('Error cleaning up sessions:', err);
      setError('Network error while cleaning up sessions');
    }
  };

  const handleSessionSelect = (wsname: string) => {
    const session = sessions.find(s => s.wsname === wsname);
    if (!session || (session.status !== '1' && session.status !== 'ON')) {
      return;
    }
    
    const newSelected = new Set(selectedSessions);
    if (newSelected.has(wsname)) {
      newSelected.delete(wsname);
    } else {
      newSelected.add(wsname);
    }
    setSelectedSessions(newSelected);
  };

  const handleSelectAll = () => {
    const activeSessions = sessions.filter(session => session.status === '1' || session.status === 'ON');
    if (selectedSessions.size === activeSessions.length) {
      setSelectedSessions(new Set());
    } else {
      setSelectedSessions(new Set(activeSessions.map(session => session.wsname)));
    }
  };

  const handleBulkDisconnect = async () => {
    if (selectedSessions.size === 0) return;
    
    const confirmed = window.confirm(
      `選択された ${selectedSessions.size} 個のワークステーションセッションを終了しますか？\n\n` +
      `ワークステーション: ${Array.from(selectedSessions).join(', ')}`
    );
    
    if (!confirmed) return;

    setIsProcessingBulkDisconnect(true);

    try {
      const response = await fetch('http://localhost:8000/api/v1/sessions/bulk-disconnect', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workstations: Array.from(selectedSessions)
        }),
      });

      if (response.ok) {
        const result = await response.json();
        const successCount = result.success_count || 0;
        const failureCount = result.failed_count || 0;
        
        alert(
          `セッション終了完了:\n` +
          `成功: ${successCount}個\n` +
          `失敗: ${failureCount}個` +
          (failureCount > 0 ? `\n\n失敗したワークステーション:\n${result.failed.map((f: any) => `${f.wsname}: ${f.error}`).join('\n')}` : '')
        );
      } else {
        const errorData = await response.json();
        alert(`Bulk disconnect failed: ${errorData.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Error during bulk disconnect:', err);
      alert('Network error during bulk disconnect');
    }

    setIsProcessingBulkDisconnect(false);
    setSelectedSessions(new Set());
    
    fetchSessions();
  };

  return (
    <div className="space-y-6">
      {/* Header with Controls */}
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">ネットワーク制御 - Terminal Session Management</h3>
        <div className="flex space-x-2">
          <button 
            onClick={fetchSessions}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {loading ? '更新中...' : '更新'}
          </button>
          <button 
            onClick={handleBulkDisconnect}
            disabled={selectedSessions.size === 0 || isProcessingBulkDisconnect}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isProcessingBulkDisconnect ? '終了中...' : `選択セッション終了 (${selectedSessions.size})`}
          </button>
          <button 
            onClick={handleCleanupSessions}
            className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition-colors"
          >
            古いセッション終了
          </button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-900/50 border border-red-700 text-red-200 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* Session Statistics */}
      {sessionStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">T</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-400">総セッション数</p>
                <p className="text-2xl font-semibold text-white">{sessionStats.total_sessions || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">A</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-400">アクティブセッション</p>
                <p className="text-2xl font-semibold text-green-400">{sessionStats.active_sessions || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-gray-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">I</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-400">非アクティブセッション</p>
                <p className="text-2xl font-semibold text-gray-400">{sessionStats.inactive_sessions || 0}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-sm">U</span>
                </div>
              </div>
              <div className="ml-4">
                <p className="text-sm text-gray-400">ユニークユーザー</p>
                <p className="text-2xl font-semibold text-purple-400">{sessionStats.unique_users || 0}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Session List */}
      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <div className="px-6 py-4 bg-gray-900 border-b border-gray-700">
          <h4 className="text-lg font-medium text-white">Active Terminal Sessions</h4>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">Loading sessions...</div>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex items-center justify-center py-8">
            <div className="text-gray-400">No active sessions found</div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-900">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                        checked={selectedSessions.size > 0 && selectedSessions.size === sessions.filter(s => s.status === '1' || s.status === 'ON').length}
                        onChange={handleSelectAll}
                      />
                      <span>Workstation Name</span>
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Username
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Connection Time
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700">
                {sessions.map((session) => (
                  <tr key={session.wsname} className="hover:bg-gray-700/50">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <div className="flex items-center space-x-2">
                        <input
                          type="checkbox"
                          className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                          checked={selectedSessions.has(session.wsname)}
                          onChange={() => handleSessionSelect(session.wsname)}
                          disabled={session.status !== '1' && session.status !== 'ON'}
                        />
                        <div className={`w-2 h-2 rounded-full ${(session.status === '1' || session.status === 'ON') ? 'bg-green-500' : 'bg-gray-500'}`}></div>
                        <span className="text-sm font-medium text-white">{session.wsname}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{session.username}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-300">{session.conn_time}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        (session.status === '1' || session.status === 'ON') 
                          ? 'bg-green-900/50 text-green-400 border border-green-600' 
                          : 'bg-gray-900/50 text-gray-400 border border-gray-600'
                      }`}>
                        {(session.status === '1' || session.status === 'ON') ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      {(session.status === '1' || session.status === 'ON') && (
                        <button
                          onClick={() => handleLogoff(session.wsname)}
                          className="text-red-400 hover:text-red-300 font-medium"
                        >
                          Logoff
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Users by Session Statistics */}
      {sessionStats.sessions_by_user && sessionStats.sessions_by_user.length > 0 && (
        <div className="bg-gray-800 rounded-lg border border-gray-700 p-6">
          <h4 className="text-lg font-medium text-white mb-4">Sessions by User</h4>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {(sessionStats.sessions_by_user || []).map((userStat: any) => (
              <div key={userStat.username} className="bg-gray-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-white">{userStat.username}</span>
                  <span className="text-sm text-gray-400">{userStat.count} sessions</span>
                </div>
                <div className="mt-2">
                  <div className="bg-gray-600 rounded-full h-2">
                    <div 
                      className="bg-blue-600 h-2 rounded-full" 
                      style={{ width: `${(userStat.count / (sessionStats.total_sessions || 1)) * 100}%` }}
                    ></div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkControlComponent;