import React, { useState, useEffect } from 'react';
import {
  CodeBracketIcon,
  EyeIcon,
  DocumentTextIcon,
  ArrowsPointingOutIcon,
  ArrowsPointingInIcon,
  ClipboardDocumentIcon,
} from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';

interface ArtifactWindowProps {
  isDarkMode: boolean;
  content: string;
  contentType: 'code' | 'html' | 'markdown' | 'text';
  language?: string;
  onClose?: () => void;
  isFullscreen?: boolean;
  onToggleFullscreen?: () => void;
}

const ArtifactWindow: React.FC<ArtifactWindowProps> = ({
  isDarkMode,
  content,
  contentType,
  language = 'javascript',
  onClose,
  isFullscreen = false,
  onToggleFullscreen,
}) => {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<'code' | 'preview'>('code');
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('コピーに失敗しました:', error);
    }
  };

  const renderCodeContent = () => {
    return (
      <pre className={`overflow-auto text-sm p-4 h-full ${
        isDarkMode 
          ? 'bg-gray-900 text-gray-100' 
          : 'bg-gray-50 text-gray-900'
      }`}>
        <code className={`language-${language}`}>
          {content}
        </code>
      </pre>
    );
  };

  const renderPreviewContent = () => {
    if (contentType === 'html') {
      return (
        <iframe
          srcDoc={content}
          className="w-full h-full border-none"
          sandbox="allow-scripts allow-same-origin"
          title="アーティファクトプレビュー"
        />
      );
    }
    
    if (contentType === 'markdown') {
      return (
        <div className={`p-4 h-full overflow-auto prose max-w-none ${
          isDarkMode ? 'prose-invert' : ''
        }`}>
          <pre className="whitespace-pre-wrap">{content}</pre>
        </div>
      );
    }

    return renderCodeContent();
  };

  const getIconForContentType = () => {
    switch (contentType) {
      case 'code':
        return <CodeBracketIcon className="w-4 h-4" />;
      case 'html':
        return <EyeIcon className="w-4 h-4" />;
      case 'markdown':
        return <DocumentTextIcon className="w-4 h-4" />;
      default:
        return <DocumentTextIcon className="w-4 h-4" />;
    }
  };

  return (
    <div className={`flex flex-col h-full ${
      isDarkMode ? 'bg-gray-800' : 'bg-white'
    } border-l ${
      isDarkMode ? 'border-gray-700' : 'border-gray-200'
    }`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-4 py-3 border-b ${
        isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-gray-50'
      }`}>
        <div className="flex items-center space-x-2">
          {getIconForContentType()}
          <span className={`font-medium text-sm ${
            isDarkMode ? 'text-gray-200' : 'text-gray-700'
          }`}>
            アーティファクト
          </span>
          <span className={`text-xs px-2 py-1 rounded ${
            isDarkMode 
              ? 'bg-gray-700 text-gray-300' 
              : 'bg-gray-200 text-gray-600'
          }`}>
            {language.toUpperCase()}
          </span>
        </div>

        <div className="flex items-center space-x-2">
          {/* View Mode Toggle */}
          {(contentType === 'html' || contentType === 'markdown') && (
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setViewMode('code')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  viewMode === 'code'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <CodeBracketIcon className="w-3 h-3" />
              </button>
              <button
                onClick={() => setViewMode('preview')}
                className={`px-2 py-1 text-xs rounded transition-colors ${
                  viewMode === 'preview'
                    ? isDarkMode
                      ? 'bg-blue-600 text-white'
                      : 'bg-blue-500 text-white'
                    : isDarkMode
                      ? 'text-gray-400 hover:text-gray-200'
                      : 'text-gray-600 hover:text-gray-800'
                }`}
              >
                <EyeIcon className="w-3 h-3" />
              </button>
            </div>
          )}

          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className={`p-1 rounded transition-colors ${
              copied
                ? 'text-green-600 dark:text-green-400'
                : isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
            }`}
            title={copied ? 'コピーしました!' : 'コードをコピー'}
          >
            <ClipboardDocumentIcon className="w-4 h-4" />
          </button>

          {/* Fullscreen Toggle */}
          {onToggleFullscreen && (
            <button
              onClick={onToggleFullscreen}
              className={`p-1 rounded transition-colors ${
                isDarkMode
                  ? 'text-gray-400 hover:text-gray-200'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
              title={isFullscreen ? '全画面を終了' : '全画面表示'}
            >
              {isFullscreen ? (
                <ArrowsPointingInIcon className="w-4 h-4" />
              ) : (
                <ArrowsPointingOutIcon className="w-4 h-4" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {viewMode === 'code' ? renderCodeContent() : renderPreviewContent()}
      </div>
    </div>
  );
};

export default ArtifactWindow;