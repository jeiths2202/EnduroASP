import React, { useState, useEffect } from 'react';
import { 
  DocumentTextIcon, 
  EyeIcon, 
  CogIcon,
  FolderIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  ArrowUturnLeftIcon
} from '@heroicons/react/24/outline';

interface SmedMapPageProps {
  isDarkMode: boolean;
}

interface CatalogStructure {
  [volume: string]: {
    [library: string]: {
      [file: string]: {
        TYPE: string;
        MAPTYPE?: string;
        DESCRIPTION?: string;
        ROWS?: number;
        COLS?: number;
        CREATED?: string;
        UPDATED?: string;
      };
    };
  };
}

interface SmedFile {
  volume: string;
  library: string;
  filename: string;
  description: string;
  rows: number;
  cols: number;
}

const SmedMapPage: React.FC<SmedMapPageProps> = ({ isDarkMode }) => {
  const [activeSubTab, setActiveSubTab] = useState<'view' | 'manage'>('view');
  const [catalogData, setCatalogData] = useState<CatalogStructure>({});
  const [selectedVolume, setSelectedVolume] = useState<string>('');
  const [selectedLibrary, setSelectedLibrary] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<string>('');
  const [fileContent, setFileContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const subTabs = [
    { id: 'view', label: 'SMED定義ファイルの選択と確認', icon: <EyeIcon className="w-4 h-4" /> },
    { id: 'manage', label: 'SMEDマップ管理', icon: <CogIcon className="w-4 h-4" /> },
  ];

  // Load catalog data on mount
  useEffect(() => {
    fetchCatalogData();
  }, []);

  // Update library list when volume changes
  useEffect(() => {
    if (selectedVolume && catalogData[selectedVolume]) {
      const libraries = Object.keys(catalogData[selectedVolume]);
      if (libraries.length > 0 && !selectedLibrary) {
        setSelectedLibrary(libraries[0]);
      }
    }
  }, [selectedVolume, catalogData, selectedLibrary]);

  const fetchCatalogData = async () => {
    try {
      const response = await fetch('http://localhost:8000/api/catalog');
      if (response.ok) {
        const data = await response.json();
        setCatalogData(data);
        
        // Set initial selections
        const volumes = Object.keys(data);
        if (volumes.length > 0) {
          setSelectedVolume(volumes[0]);
        }
      }
    } catch (error) {
      console.error('カタログデータ取得エラー:', error);
    }
  };

  const getSmedFiles = (): SmedFile[] => {
    const smedFiles: SmedFile[] = [];
    
    if (!catalogData || !selectedVolume || !selectedLibrary) return smedFiles;
    
    const library = catalogData[selectedVolume]?.[selectedLibrary];
    if (!library) return smedFiles;
    
    Object.entries(library).forEach(([filename, fileInfo]) => {
      if (fileInfo.TYPE === 'MAP' && fileInfo.MAPTYPE === 'SMED') {
        smedFiles.push({
          volume: selectedVolume,
          library: selectedLibrary,
          filename,
          description: fileInfo.DESCRIPTION || '',
          rows: fileInfo.ROWS || 24,
          cols: fileInfo.COLS || 80
        });
      }
    });
    
    return smedFiles;
  };

  const fetchFileContent = async (volume: string, library: string, filename: string) => {
    setLoading(true);
    try {
      // Use existing SMED content API that handles SJIS to Unicode conversion
      const response = await fetch(`http://localhost:8000/api/smed/content/${volume}/${library}/${filename}`);
      if (response.ok) {
        // API returns text/plain content directly, not JSON
        const content = await response.text();
        setFileContent(content);
        setOriginalContent(content);
      } else if (response.status === 404) {
        // File not found - show informative message
        const notFoundContent = `# ファイルが見つかりません\n\nファイル: ${volume}/${library}/${filename}\n\nこのファイルは catalog.json に登録されていますが、\n実際のファイルシステムには存在しません。\n\n管理者にお問い合わせください。`;
        setFileContent(notFoundContent);
        setOriginalContent(notFoundContent);
      } else {
        // Other errors - use sample content as fallback
        const sampleContent = generateSampleContent(filename);
        setFileContent(sampleContent);
        setOriginalContent(sampleContent);
      }
    } catch (error) {
      console.error('ファイル内容取得エラー:', error);
      const sampleContent = generateSampleContent(filename);
      setFileContent(sampleContent);
      setOriginalContent(sampleContent);
    } finally {
      setLoading(false);
    }
  };

  const saveFileContent = async () => {
    if (!selectedVolume || !selectedLibrary || !selectedFile) return;
    
    setSaveStatus('saving');
    try {
      // Use existing SMED save API
      const response = await fetch(`http://localhost:8000/api/smed/save`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          filename: selectedFile,
          content: fileContent,
          volume: selectedVolume,
          library: selectedLibrary
        }),
      });
      
      if (response.ok) {
        setSaveStatus('saved');
        setOriginalContent(fileContent);
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        setSaveStatus('error');
        setTimeout(() => setSaveStatus('idle'), 3000);
      }
    } catch (error) {
      console.error('保存エラー:', error);
      setSaveStatus('error');
      setTimeout(() => setSaveStatus('idle'), 3000);
    }
  };

  const revertChanges = () => {
    setFileContent(originalContent);
    setIsEditing(false);
  };

  const generateSampleContent = (filename: string) => {
    const lines = [];
    for (let row = 0; row < 24; row++) {
      let line = '';
      for (let col = 0; col < 80; col++) {
        if (row === 0 || row === 23) {
          line += '+';
        } else if (col === 0 || col === 79) {
          line += '|';
        } else if (row === 2 && col >= 30 && col <= 50) {
          const titleMap: { [key: string]: string } = {
            'LOGO.smed': 'OpenASP LOGO画面',
            'MENU.smed': 'メインメニュー画面',
            'PGM1.smed': 'プログラム1画面',
            'PGM2.smed': 'プログラム2画面'
          };
          const title = titleMap[filename] || filename;
          if (col - 30 < title.length) {
            line += title[col - 30];
          } else {
            line += ' ';
          }
        } else if (row === 10 && filename === 'MENU.smed') {
          const menuItems = '1.営業管理 2.在庫管理 3.レポート F3.終了';
          if (col >= 10 && col - 10 < menuItems.length) {
            line += menuItems[col - 10];
          } else {
            line += ' ';
          }
        } else {
          line += ' ';
        }
      }
      lines.push(line);
    }
    return lines.join('\n');
  };

  const handleFileSelect = (file: SmedFile) => {
    setSelectedFile(file.filename);
    fetchFileContent(file.volume, file.library, file.filename);
  };

  const renderViewTab = () => (
    <div className="h-full flex bg-gray-50 dark:bg-gray-950">
      {/* 左側：ファイルリスト */}
      <div className="w-80 bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 p-6">
        <div className="mb-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
            SMEDマップ管理
          </h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            SMED定義ファイルの選択と確認
          </p>
        </div>

        {/* Volume Selection */}
        <div className="mb-4">
          <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
            ボリューム
          </h3>
          <select
            value={selectedVolume}
            onChange={(e) => {
              setSelectedVolume(e.target.value);
              setSelectedLibrary('');
              setSelectedFile('');
            }}
            className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {Object.keys(catalogData).map((volume) => (
              <option key={volume} value={volume}>
                {volume}
              </option>
            ))}
          </select>
        </div>

        {/* Library Selection */}
        {selectedVolume && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-2">
              ライブラリ
            </h3>
            <select
              value={selectedLibrary}
              onChange={(e) => {
                setSelectedLibrary(e.target.value);
                setSelectedFile('');
              }}
              className="w-full p-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            >
              <option value="">選択してください</option>
              {Object.keys(catalogData[selectedVolume] || {}).map((library) => (
                <option key={library} value={library}>
                  {library}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* SMED Files List */}
        {selectedLibrary && (
          <div className="mb-4">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-3">
              利用可能なSMEDファイル
            </h3>
            <div className="space-y-1">
              {getSmedFiles().map((file) => (
                <button
                  key={file.filename}
                  onClick={() => handleFileSelect(file)}
                  className={`w-full text-left p-2 rounded border transition-colors text-xs ${
                    selectedFile === file.filename
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }`}
                >
                  <div className="flex items-center">
                    <DocumentTextIcon 
                      className={`w-3 h-3 mr-1 flex-shrink-0 ${
                        selectedFile === file.filename 
                          ? 'text-blue-600 dark:text-blue-400' 
                          : 'text-gray-400'
                      }`} 
                    />
                    <div className="flex-1 min-w-0">
                      <span className={`font-medium block truncate ${
                        selectedFile === file.filename
                          ? 'text-blue-900 dark:text-blue-100'
                          : 'text-gray-900 dark:text-white'
                      }`}>
                        {file.filename}
                      </span>
                      {file.description && (
                        <span className="text-gray-500 dark:text-gray-400 block truncate">
                          {file.description}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {!selectedLibrary && selectedVolume && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <FolderIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p className="text-sm">ライブラリを選択してください</p>
          </div>
        )}

        {selectedFile && (
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <h4 className="text-sm font-medium text-blue-900 dark:text-blue-100 mb-2">
              選択中のファイル
            </h4>
            <p className="text-sm text-blue-700 dark:text-blue-300">{selectedFile}</p>
          </div>
        )}
      </div>

      {/* 右側：プレビューエリア */}
      <div className="flex-1 p-6">
        {selectedFile ? (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  {selectedFile} - {isEditing ? '編集モード' : 'プレビュー'}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {selectedVolume}/{selectedLibrary}/{selectedFile}
                </p>
              </div>
              <div className="flex items-center space-x-2">
                {!isEditing ? (
                  <button
                    onClick={() => setIsEditing(true)}
                    className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
                  >
                    <PencilIcon className="w-4 h-4 mr-2" />
                    編集
                  </button>
                ) : (
                  <>
                    <button
                      onClick={saveFileContent}
                      disabled={saveStatus === 'saving'}
                      className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-400 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <CheckIcon className="w-4 h-4 mr-2" />
                      {saveStatus === 'saving' ? '保存中...' : '保存'}
                    </button>
                    <button
                      onClick={revertChanges}
                      className="flex items-center px-4 py-2 bg-orange-600 hover:bg-orange-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <ArrowUturnLeftIcon className="w-4 h-4 mr-2" />
                      元に戻す
                    </button>
                    <button
                      onClick={() => setIsEditing(false)}
                      className="flex items-center px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      <XMarkIcon className="w-4 h-4 mr-2" />
                      キャンセル
                    </button>
                  </>
                )}
              </div>
            </div>

            {saveStatus === 'saved' && (
              <div className="mb-4 p-3 bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200 rounded-lg">
                ファイルが正常に保存されました
              </div>
            )}
            {saveStatus === 'error' && (
              <div className="mb-4 p-3 bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200 rounded-lg">
                保存中にエラーが発生しました
              </div>
            )}

            <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg p-4">
              {loading ? (
                <div className="flex items-center justify-center h-96">
                  <div className="text-center">
                    <div className="animate-spin h-8 w-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                    <p className="text-gray-600 dark:text-gray-400">読み込み中...</p>
                  </div>
                </div>
              ) : (
                <div className="font-mono text-sm bg-black text-green-400 p-4 rounded overflow-auto">
                  {isEditing ? (
                    <textarea
                      value={fileContent}
                      onChange={(e) => setFileContent(e.target.value)}
                      className="w-full h-96 bg-transparent text-green-400 outline-none resize-none"
                      style={{ 
                        fontSize: '12px', 
                        lineHeight: '1.2',
                        fontFamily: 'Consolas, "Courier New", monospace'
                      }}
                      spellCheck={false}
                    />
                  ) : (
                    <pre 
                      className="whitespace-pre" 
                      style={{ 
                        fontSize: '12px', 
                        lineHeight: '1.2',
                        fontFamily: 'Consolas, "Courier New", monospace'
                      }}
                    >
                      {fileContent}
                    </pre>
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <DocumentTextIcon className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                SMEDファイルを選択してください
              </h3>
              <p className="text-gray-600 dark:text-gray-400">
                左側のリストからファイルを選択すると、プレビューが表示されます
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderManageTab = () => (
    <div className="h-full p-8">
      <div className="max-w-4xl mx-auto">
        <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6">
          SMEDマップ管理
        </h3>
        <div className="bg-white dark:bg-gray-900 rounded-lg shadow-sm border border-gray-200 dark:border-gray-800 p-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-6 text-center">
              <DocumentTextIcon className="w-12 h-12 text-blue-600 dark:text-blue-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                新規作成
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                新しいSMEDマップを作成します
              </p>
              <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                作成開始
              </button>
            </div>

            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-6 text-center">
              <EyeIcon className="w-12 h-12 text-green-600 dark:text-green-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                編集
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                既存のSMEDマップを編集します
              </p>
              <button className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                編集開始
              </button>
            </div>

            <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-6 text-center">
              <CogIcon className="w-12 h-12 text-orange-600 dark:text-orange-400 mx-auto mb-4" />
              <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                設定
              </h4>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                SMEDマップの設定を管理します
              </p>
              <button className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                設定開始
              </button>
            </div>
          </div>

          <div className="mt-8">
            <h4 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              マップファイル一覧
            </h4>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-800">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ボリューム
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ライブラリ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      ファイル名
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      説明
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                      アクション
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                  {Object.entries(catalogData).map(([volume, libraries]) =>
                    Object.entries(libraries).map(([library, files]) =>
                      Object.entries(files).map(([filename, fileInfo]) => 
                        fileInfo.TYPE === 'MAP' && fileInfo.MAPTYPE === 'SMED' ? (
                          <tr key={`${volume}-${library}-${filename}`}>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {volume}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {library}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                              {filename}
                            </td>
                            <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400">
                              {fileInfo.DESCRIPTION || '-'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm">
                              <button 
                                onClick={() => {
                                  setActiveSubTab('view');
                                  setSelectedVolume(volume);
                                  setSelectedLibrary(library);
                                  handleFileSelect({
                                    volume,
                                    library,
                                    filename,
                                    description: fileInfo.DESCRIPTION || '',
                                    rows: fileInfo.ROWS || 24,
                                    cols: fileInfo.COLS || 80
                                  });
                                }}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium mr-3"
                              >
                                表示/編集
                              </button>
                              <button className="text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium">
                                削除
                              </button>
                            </td>
                          </tr>
                        ) : null
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-950">
      {/* サブタブナビゲーション */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="px-6">
          <div className="flex space-x-8">
            {subTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveSubTab(tab.id as 'view' | 'manage')}
                className={`flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                  activeSubTab === tab.id
                    ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300'
                }`}
              >
                {tab.icon}
                <span className="ml-2">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* サブタブコンテンツ */}
      <div className="flex-1">
        {activeSubTab === 'view' ? renderViewTab() : renderManageTab()}
      </div>
    </div>
  );
};

export default SmedMapPage;