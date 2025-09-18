import React, { useState } from 'react';
import { useI18n } from '../hooks/useI18n';
import DevOpsDashboard from './DevOpsDashboard';
import DevOpsCobolPage from './DevOpsCobolPage';
import DevOpsClPage from './DevOpsClPage';
import MonitoringPage from './MonitoringPage';
import {
  HomeIcon,
  CodeBracketIcon,
  CommandLineIcon,
  ChartBarIcon,
  CogIcon,
  GlobeAltIcon
} from '@heroicons/react/24/outline';

const HomePage: React.FC = () => {
  const { t, language, setLanguage } = useI18n();
  const [currentPage, setCurrentPage] = useState<'dashboard' | 'cobol' | 'cl' | 'monitoring'>('dashboard');
  const [isDarkMode, setIsDarkMode] = useState(true);

  const navigation = [
    { id: 'dashboard', name: 'DevOps Dashboard', icon: HomeIcon },
    { id: 'monitoring', name: 'System Monitoring', icon: ChartBarIcon },
    { id: 'cobol', name: 'COBOL Converter', icon: CodeBracketIcon },
    { id: 'cl', name: 'CL Converter', icon: CommandLineIcon },
  ];

  const renderCurrentPage = () => {
    switch (currentPage) {
      case 'monitoring':
        return <MonitoringPage isDarkMode={isDarkMode} />;
      case 'cobol':
        return <DevOpsCobolPage isDarkMode={isDarkMode} />;
      case 'cl':
        return <DevOpsClPage isDarkMode={isDarkMode} />;
      default:
        return <DevOpsDashboard isDarkMode={isDarkMode} />;
    }
  };

  return (
    <div className={`min-h-screen ${isDarkMode ? 'dark' : ''}`}>
      <div className="bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
        {/* Navigation Header */}
        <nav className="bg-white dark:bg-gray-800 shadow-sm border-b border-gray-200 dark:border-gray-700">
          <div className="px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-8">
                <div className="flex items-center">
                  <h1 className="text-xl font-bold text-gray-900 dark:text-white">
                    OpenASP DevOps
                  </h1>
                  <span className="ml-2 px-2 py-1 text-xs bg-blue-100 dark:bg-blue-800 text-blue-800 dark:text-blue-100 rounded-full">
                    v1.0.0
                  </span>
                </div>
                
                <div className="flex space-x-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={() => setCurrentPage(item.id as any)}
                        className={`flex items-center px-4 py-2 rounded-lg transition-colors ${
                          currentPage === item.id
                            ? 'bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-100'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <Icon className="w-5 h-5 mr-2" />
                        {item.name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center space-x-4">
                {/* Language Selector */}
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as any)}
                  className="px-3 py-1 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                >
                  <option value="en">🇺🇸 English</option>
                  <option value="ja">🇯🇵 日本語</option>
                  <option value="ko">🇰🇷 한국어</option>
                </select>

                {/* Dark Mode Toggle */}
                <button
                  onClick={() => setIsDarkMode(!isDarkMode)}
                  className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  {isDarkMode ? '☀️' : '🌙'}
                </button>

                {/* Settings */}
                <button className="p-2 rounded-lg bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors">
                  <CogIcon className="w-5 h-5" />
                </button>
              </div>
            </div>
          </div>
        </nav>

        {/* Main Content */}
        <main className="min-h-screen bg-gray-50 dark:bg-gray-900">
          {renderCurrentPage()}
        </main>
      </div>
    </div>
  );
};

export default HomePage;