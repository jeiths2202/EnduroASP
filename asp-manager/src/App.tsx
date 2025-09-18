import React, { useState, useEffect, useCallback } from 'react';
import {
  HomeIcon,
  UserGroupIcon,
  DocumentTextIcon,
  CpuChipIcon,
  PlayIcon,
  CommandLineIcon,
  ClipboardDocumentListIcon,
} from '@heroicons/react/24/outline';
import Sidebar from './components/Sidebar';
import TabSystem from './components/TabSystem';
import DashboardPage from './pages/DashboardPage';
import SmedMapPage from './pages/SmedMapPage';
import LogManagementPage from './pages/LogManagementPage';
import SystemManagerPage from './pages/SystemManagerPage';
import MarkdownRenderer from './components/MarkdownRenderer';
import { MenuItem, Tab, Theme } from './types';

function App() {
  const [theme, setTheme] = useState<Theme>({ mode: 'dark' });
  const [activeMenuId, setActiveMenuId] = useState<string | null>('dashboard');
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(false);

  useEffect(() => {
    // Check if user is logged in
    const userInfo = localStorage.getItem('openaspUser');
    if (userInfo) {
      try {
        const parsedUser = JSON.parse(userInfo);
        if (parsedUser.app === 'asp-manager') {
          setIsLoggedIn(true);
        }
      } catch (error) {
        console.error('Error parsing user info:', error);
        localStorage.removeItem('openaspUser');
      }
    }
  }, []);
  const [tabs, setTabs] = useState<Tab[]>([
    {
      id: 'dashboard',
      title: 'ダッシュボード',
      content: <DashboardPage />,
      type: 'document',
      timestamp: new Date(),
    },
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('dashboard');
  const [sidebarWidth, setSidebarWidth] = useState(256);

  // テーマの初期化
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme') as 'light' | 'dark' | null;
    if (savedTheme) {
      setTheme({ mode: savedTheme });
    } else {
      // デフォルトはダークモード
      setTheme({ mode: 'dark' });
      localStorage.setItem('theme', 'dark');
    }
  }, []);

  // テーマ変更時の処理
  useEffect(() => {
    if (theme.mode === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    localStorage.setItem('theme', theme.mode);
  }, [theme]);

  // サイドバー幅の監視
  useEffect(() => {
    const checkSidebarWidth = () => {
      const sidebar = document.querySelector('.fixed.left-0');
      if (sidebar) {
        const width = sidebar.getBoundingClientRect().width;
        setSidebarWidth(width);
      }
    };

    checkSidebarWidth();
    const interval = setInterval(checkSidebarWidth, 100);
    return () => clearInterval(interval);
  }, []);

  const menuItems: MenuItem[] = [
    { id: 'dashboard', label: 'ダッシュボード', icon: <HomeIcon /> },
    { id: 'asp-online', label: 'ASPオンライン', icon: <PlayIcon /> },
    { id: 'asp-batch', label: 'ASPバッチ', icon: <CommandLineIcon /> },
    { id: 'accounts', label: 'アカウント管理', icon: <UserGroupIcon /> },
    { id: 'smed-maps', label: 'SMEDマップ管理', icon: <DocumentTextIcon />, badge: 3 },
    { id: 'programs', label: 'プログラム管理', icon: <CpuChipIcon /> },
    { id: 'catalog', label: 'カタログ管理', icon: <ClipboardDocumentListIcon /> },
    { id: 'log-management', label: 'ログ管理', icon: <ClipboardDocumentListIcon /> },
  ];

  const handleMenuSelect = useCallback((item: MenuItem) => {
    setActiveMenuId(item.id);

    // 既存のタブを確認
    const existingTab = tabs.find((tab) => tab.id === item.id);
    if (existingTab) {
      setActiveTabId(item.id);
      return;
    }

    // 新しいタブを作成
    let content: React.ReactNode;
    switch (item.id) {
      case 'dashboard':
        content = <DashboardPage />;
        break;
      case 'asp-online':
        content = (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ASPオンライン処理
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                利用可能なオンラインプログラム
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['MENU', 'LOGO', 'PGM1', 'PGM2', 'EIGYO001', 'EIGYO002', 'URIAGE001'].map((program) => (
                  <div key={program} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors">
                    <div className="flex items-center">
                      <PlayIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-3" />
                      <span className="font-medium text-gray-900 dark:text-white">{program}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      オンライン処理プログラム
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        break;
      case 'asp-batch':
        content = (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              ASPバッチ処理
            </h2>
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                利用可能なバッチプログラム
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {['BATCH001', 'REPORT001', 'NOHINO001', 'NOHINO002', 'ZAIKO001'].map((program) => (
                  <div key={program} className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 hover:bg-green-50 dark:hover:bg-green-900/20 cursor-pointer transition-colors">
                    <div className="flex items-center">
                      <CommandLineIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-3" />
                      <span className="font-medium text-gray-900 dark:text-white">{program}</span>
                    </div>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                      バッチ処理プログラム
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
        break;
      case 'log-management':
        content = <LogManagementPage isDarkMode={theme.mode === 'dark'} />;
        break;
      case 'smed-maps':
        content = <SmedMapPage isDarkMode={theme.mode === 'dark'} />;
        break;
      case 'catalog':
        content = <SystemManagerPage />;
        break;
      default:
        content = (
          <div className="p-8">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">
              {item.label}
            </h2>
            <MarkdownRenderer 
              content={`# ${item.label}\n\nこの機能は現在開発中です。\n\n## 今後の予定\n- 基本機能の実装\n- UIの改善\n- テストの追加`}
              isDarkMode={theme.mode === 'dark'}
            />
          </div>
        );
    }

    const newTab: Tab = {
      id: item.id,
      title: item.label,
      content: content,
      type: 'document',
      timestamp: new Date(),
    };

    setTabs([...tabs, newTab]);
    setActiveTabId(item.id);
  }, [tabs, theme.mode]);

  const handleTabSelect = (tabId: string) => {
    setActiveTabId(tabId);
    setActiveMenuId(tabId);
  };

  const handleTabClose = (tabId: string) => {
    const newTabs = tabs.filter((tab) => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveTab = newTabs[newTabs.length - 1];
      if (newActiveTab) {
        setActiveTabId(newActiveTab.id);
        setActiveMenuId(newActiveTab.id);
      }
    }
  };

  const handleThemeToggle = () => {
    setTheme({ mode: theme.mode === 'light' ? 'dark' : 'light' });
  };

  // Show login page if not logged in
  if (!isLoggedIn) {
    return (
      <div className="h-screen">
        <iframe 
          src="/login.html" 
          className="w-full h-full border-none"
          title="EnduroASP Manager Login"
        />
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 dark:bg-gray-950">
      <Sidebar
        menuItems={menuItems}
        activeMenuId={activeMenuId}
        onMenuSelect={handleMenuSelect}
        theme={theme}
        onThemeToggle={handleThemeToggle}
        user={{ name: 'Admin', role: '管理者' }}
      />
      <TabSystem
        tabs={tabs}
        activeTabId={activeTabId}
        onTabSelect={handleTabSelect}
        onTabClose={handleTabClose}
        sidebarWidth={sidebarWidth}
      />
    </div>
  );
}

export default App;