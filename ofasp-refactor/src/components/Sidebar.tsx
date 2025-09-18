import React, { useState, useEffect } from 'react';
import {
  ChevronDoubleLeftIcon,
  ChevronDoubleRightIcon,
  Cog6ToothIcon,
  MoonIcon,
  SunIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { MenuItem, Theme } from '../types';
import LanguageSelector from './LanguageSelector';

interface SidebarProps {
  menuItems: MenuItem[];
  activeMenuId: string | null;
  onMenuSelect: (item: MenuItem) => void;
  theme: Theme;
  onThemeToggle: () => void;
  user?: {
    name: string;
    role: string;
  };
}

const Sidebar: React.FC<SidebarProps> = ({
  menuItems,
  activeMenuId,
  onMenuSelect,
  theme,
  onThemeToggle,
  user,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const [currentUser, setCurrentUser] = useState<{ userId: string; app: string } | null>(null);

  useEffect(() => {
    // Check for stored user info
    const userInfo = localStorage.getItem('openaspUser');
    if (userInfo) {
      try {
        const parsedUser = JSON.parse(userInfo);
        setCurrentUser(parsedUser);
      } catch (error) {
        console.error('Error parsing user info:', error);
      }
    }
  }, []);

  const handleLogout = () => {
    if (window.confirm('ログアウトしますか？')) {
      localStorage.removeItem('openaspUser');
      window.location.reload();
    }
  };

  const effectiveExpanded = !isCollapsed || isHovered;

  return (
    <div
      className={classNames(
        'fixed left-0 top-0 h-screen bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800 transition-all duration-300 z-50 flex flex-col',
        {
          'w-64': effectiveExpanded,
          'w-16': !effectiveExpanded,
        }
      )}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* ヘッダー */}
      <div className="h-16 flex items-center justify-between px-4 border-b border-gray-200 dark:border-gray-800">
        <div className="flex items-center">
          <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <span className="text-white font-bold text-lg">E</span>
          </div>
          {effectiveExpanded && (
            <span className="ml-3 text-lg font-semibold text-gray-900 dark:text-white animate-fade-in">
              EnduroASP AX
            </span>
          )}
        </div>
        {effectiveExpanded && (
          <button
            onClick={() => setIsCollapsed(!isCollapsed)}
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors animate-fade-in"
          >
            {isCollapsed ? (
              <ChevronDoubleRightIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            ) : (
              <ChevronDoubleLeftIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            )}
          </button>
        )}
      </div>

      {/* ユーザー情報 */}
      {user && (
        <div className="p-4 border-b border-gray-200 dark:border-gray-800">
          <div className="flex items-center">
            <div className="w-8 h-8 bg-gray-300 dark:bg-gray-700 rounded-full flex items-center justify-center flex-shrink-0">
              <span className="text-gray-600 dark:text-gray-300 font-medium">
                {user.name.charAt(0).toUpperCase()}
              </span>
            </div>
            {effectiveExpanded && (
              <div className="ml-3 animate-fade-in">
                <div className="text-sm font-medium text-gray-900 dark:text-white">
                  {user.name}
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400">{user.role}</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* メニューアイテム */}
      <nav 
        className="flex-1 overflow-y-auto py-4 scrollbar-custom"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgb(156, 163, 175) transparent',
          maxHeight: 'calc(100vh - 160px)' // ヘッダーとフッターの高さを考慮
        }}
      >
        {menuItems.map((item) => (
          <div key={item.id}>
            <button
              onClick={() => onMenuSelect(item)}
              className={classNames(
                'w-full flex items-center px-4 py-3 mb-1 transition-all duration-200',
                {
                  'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500':
                    activeMenuId === item.id,
                  'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent':
                    activeMenuId !== item.id,
                }
              )}
            >
              <div className="flex-shrink-0 w-6 h-6">
                <div className={classNames('w-6 h-6', {
                  'text-blue-600 dark:text-blue-400': activeMenuId === item.id,
                  'text-gray-600 dark:text-gray-400': activeMenuId !== item.id,
                })}>
                  {item.icon}
                </div>
              </div>
              {effectiveExpanded && (
                <>
                  <span
                    className={classNames(
                      'ml-3 text-sm font-medium animate-fade-in',
                      {
                        'text-blue-900 dark:text-blue-100': activeMenuId === item.id,
                        'text-gray-700 dark:text-gray-300': activeMenuId !== item.id,
                      }
                    )}
                  >
                    {item.label}
                  </span>
                  {item.badge && (
                    <span className="ml-auto bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full animate-fade-in">
                      {item.badge}
                    </span>
                  )}
                </>
              )}
              {!effectiveExpanded && item.badge && (
                <div className="absolute left-12 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                  {item.badge}
                </div>
              )}
            </button>
            
            {/* サブメニュー */}
            {item.subItems && effectiveExpanded && (
              <div className="ml-4 border-l-2 border-gray-200 dark:border-gray-700">
                {item.subItems.map((subItem) => (
                  <button
                    key={subItem.id}
                    onClick={() => onMenuSelect(subItem)}
                    className={classNames(
                      'w-full flex items-center px-4 py-2 mb-1 transition-all duration-200',
                      {
                        'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-blue-500':
                          activeMenuId === subItem.id,
                        'hover:bg-gray-100 dark:hover:bg-gray-800 border-l-4 border-transparent':
                          activeMenuId !== subItem.id,
                      }
                    )}
                  >
                    <div className="flex-shrink-0 w-5 h-5">
                      <div className={classNames('w-5 h-5', {
                        'text-blue-600 dark:text-blue-400': activeMenuId === subItem.id,
                        'text-gray-500 dark:text-gray-500': activeMenuId !== subItem.id,
                      })}>
                        {subItem.icon}
                      </div>
                    </div>
                    <span
                      className={classNames(
                        'ml-3 text-sm font-medium animate-fade-in',
                        {
                          'text-blue-900 dark:text-blue-100': activeMenuId === subItem.id,
                          'text-gray-600 dark:text-gray-400': activeMenuId !== subItem.id,
                        }
                      )}
                    >
                      {subItem.label}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      {/* フッター */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="space-y-2">
          {/* テーマ切り替え */}
          <button
            onClick={onThemeToggle}
            className="w-full flex items-center px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
          >
            {theme.mode === 'light' ? (
              <MoonIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            ) : (
              <SunIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            )}
            {effectiveExpanded && (
              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 animate-fade-in">
                {theme.mode === 'light' ? 'ダークモード' : 'ライトモード'}
              </span>
            )}
          </button>

          {/* 言語選択器 */}
          {effectiveExpanded && (
            <div className="animate-fade-in">
              <LanguageSelector />
            </div>
          )}

          {/* 設定 */}
          <button className="w-full flex items-center px-2 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors">
            <Cog6ToothIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 flex-shrink-0" />
            {effectiveExpanded && (
              <span className="ml-3 text-sm text-gray-700 dark:text-gray-300 animate-fade-in">
                設定
              </span>
            )}
          </button>
        </div>

        {/* ユーザー情報 */}
        {effectiveExpanded && currentUser && (
          <div className="mt-4 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg animate-fade-in">
            <div className="text-sm font-medium text-gray-900 dark:text-white">
              {currentUser.userId}
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              EnduroASP AX
            </div>
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-2 py-1.5 text-xs bg-red-100 hover:bg-red-200 dark:bg-red-900/20 dark:hover:bg-red-900/40 text-red-700 dark:text-red-400 rounded-md transition-colors"
            >
              <ArrowRightOnRectangleIcon className="w-3 h-3 mr-1" />
              ログアウト
            </button>
          </div>
        )}

        {/* バージョン情報 */}
        {effectiveExpanded && (
          <div className="mt-4 text-xs text-gray-400 dark:text-gray-600 text-center animate-fade-in">
            OpenASP v0.6
          </div>
        )}
      </div>
    </div>
  );
};

export default Sidebar;