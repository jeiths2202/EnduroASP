import React, { useEffect, useState } from 'react';

interface AIProcessingAnimationProps {
  isVisible: boolean;
  title: string;
  message: string;
  onComplete: () => void;
  duration?: number; // Duration in milliseconds
}

const AIProcessingAnimation: React.FC<AIProcessingAnimationProps> = ({
  isVisible,
  title,
  message,
  onComplete,
  duration = 5000
}) => {
  const [progress, setProgress] = useState(0);
  const [currentMessage, setCurrentMessage] = useState('');

  const processingMessages = [
    'AIがソースコードを解析中...',
    'ニューラルネットワークが構造を学習中...',
    '最適化パターンを適用中...',
    'コード生成アルゴリズムを実行中...',
    '品質チェックを実行中...',
    '最終調整中...'
  ];

  useEffect(() => {
    if (!isVisible) {
      setProgress(0);
      setCurrentMessage('');
      return;
    }

    let progressInterval: NodeJS.Timeout;
    let messageInterval: NodeJS.Timeout;
    let messageIndex = 0;

    // Progress animation
    progressInterval = setInterval(() => {
      setProgress(prev => {
        const newProgress = prev + (100 / (duration / 100));
        if (newProgress >= 100) {
          clearInterval(progressInterval);
          setTimeout(onComplete, 500);
          return 100;
        }
        return newProgress;
      });
    }, 100);

    // Message rotation
    messageInterval = setInterval(() => {
      setCurrentMessage(processingMessages[messageIndex]);
      messageIndex = (messageIndex + 1) % processingMessages.length;
    }, duration / processingMessages.length);

    // Initial message
    setCurrentMessage(processingMessages[0]);

    return () => {
      clearInterval(progressInterval);
      clearInterval(messageInterval);
    };
  }, [isVisible, duration, onComplete]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50">
      <div className="bg-gray-900 rounded-lg p-8 max-w-2xl w-full mx-4 border border-purple-500">
        {/* Title */}
        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-white mb-2">{title}</h2>
          <p className="text-gray-300">{message}</p>
        </div>

        {/* Neural Network Image */}
        <div className="relative mb-6">
          <img 
            src="/neural-network.png" 
            alt="Neural Network Processing"
            className="w-full max-w-lg mx-auto rounded-lg shadow-lg animate-pulse"
            style={{
              filter: 'brightness(1.2) contrast(1.1) saturate(1.3)',
              animation: 'neural-glow 2s ease-in-out infinite alternate'
            }}
          />
          
          {/* Overlay effects */}
          <div className="absolute inset-0 bg-gradient-to-r from-purple-500/20 via-transparent to-cyan-500/20 rounded-lg animate-pulse"></div>
          
          {/* Processing indicator */}
          <div className="absolute top-4 right-4 bg-green-500 rounded-full w-4 h-4 animate-ping"></div>
        </div>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex justify-between text-sm text-gray-400 mb-2">
            <span>進行状況</span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div className="w-full bg-gray-700 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-purple-500 to-cyan-500 h-3 rounded-full transition-all duration-300 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"></div>
            </div>
          </div>
        </div>

        {/* Current Message */}
        <div className="text-center">
          <p className="text-cyan-400 font-mono text-sm animate-pulse">
            {currentMessage}
          </p>
        </div>

        {/* Loading dots */}
        <div className="flex justify-center space-x-2 mt-4">
          <div className="w-2 h-2 bg-purple-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
          <div className="w-2 h-2 bg-cyan-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
          <div className="w-2 h-2 bg-pink-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
        </div>
      </div>

      <style>{`
        @keyframes neural-glow {
          0% { filter: brightness(1.2) contrast(1.1) saturate(1.3) hue-rotate(0deg); }
          50% { filter: brightness(1.4) contrast(1.2) saturate(1.4) hue-rotate(30deg); }
          100% { filter: brightness(1.2) contrast(1.1) saturate(1.3) hue-rotate(0deg); }
        }
        
        @keyframes shimmer {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(100%); }
        }
        
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default AIProcessingAnimation;