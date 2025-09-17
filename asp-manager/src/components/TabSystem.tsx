import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { Tab } from '../types';

interface TabSystemProps {
  tabs: Tab[];
  activeTabId: string | null;
  onTabSelect: (tabId: string) => void;
  onTabClose: (tabId: string) => void;
  sidebarWidth: number;
}

const TabSystem: React.FC<TabSystemProps> = ({
  tabs,
  activeTabId,
  onTabSelect,
  onTabClose,
  sidebarWidth,
}) => {
  if (tabs.length === 0) {
    return (
      <div 
        className="fixed top-0 right-0 h-full bg-gray-50 dark:bg-gray-950 transition-all duration-300"
        style={{ left: `${sidebarWidth}px` }}
      >
        <div className="flex items-center justify-center h-full">
          <div className="text-center">
            <div className="w-24 h-24 mx-auto mb-6 bg-gray-200 dark:bg-gray-800 rounded-full flex items-center justify-center">
              <svg className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
              タブがありません
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              左側のメニューから項目を選択してください
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="fixed top-0 right-0 h-full flex flex-col bg-gray-50 dark:bg-gray-950 transition-all duration-300"
      style={{ left: `${sidebarWidth}px` }}
    >
      {/* タブバー */}
      <div className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center overflow-x-auto scrollbar-thin">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={classNames(
                'flex items-center min-w-0 border-r border-gray-200 dark:border-gray-800',
                {
                  'bg-gray-50 dark:bg-gray-850': activeTabId === tab.id,
                  'hover:bg-gray-50 dark:hover:bg-gray-850': activeTabId !== tab.id,
                }
              )}
            >
              <button
                onClick={() => onTabSelect(tab.id)}
                className={classNames(
                  'flex items-center px-4 py-3 min-w-0 max-w-xs transition-colors',
                  {
                    'border-b-2 border-blue-500': activeTabId === tab.id,
                    'border-b-2 border-transparent': activeTabId !== tab.id,
                  }
                )}
              >
                <span
                  className={classNames(
                    'text-sm font-medium truncate',
                    {
                      'text-gray-900 dark:text-white': activeTabId === tab.id,
                      'text-gray-600 dark:text-gray-400': activeTabId !== tab.id,
                    }
                  )}
                >
                  {tab.title}
                </span>
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onTabClose(tab.id);
                }}
                className="p-1.5 mr-2 rounded hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors group"
              >
                <XMarkIcon className="w-4 h-4 text-gray-400 group-hover:text-gray-600 dark:group-hover:text-gray-300" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* タブコンテンツ */}
      <div className="flex-1 overflow-hidden">
        {tabs.map((tab) => (
          <div
            key={tab.id}
            className={classNames(
              'h-full overflow-auto',
              {
                'block': activeTabId === tab.id,
                'hidden': activeTabId !== tab.id,
              }
            )}
          >
            {tab.content}
          </div>
        ))}
      </div>
    </div>
  );
};

export default TabSystem;