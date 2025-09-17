import React, { useState, useRef, useCallback, useEffect } from 'react';

interface SplitLayoutProps {
  children: [React.ReactNode, React.ReactNode];
  direction?: 'horizontal' | 'vertical';
  defaultSplit?: number;
  minSize?: number;
  className?: string;
  isDarkMode?: boolean;
}

const SplitLayout: React.FC<SplitLayoutProps> = ({
  children,
  direction = 'horizontal',
  defaultSplit = 50,
  minSize = 20,
  className = '',
  isDarkMode = false,
}) => {
  const [splitPercentage, setSplitPercentage] = useState(defaultSplit);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const resizerRef = useRef<HTMLDivElement>(null);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const handleMouseMove = (event: MouseEvent) => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      let percentage: number;

      if (direction === 'horizontal') {
        const x = event.clientX - rect.left;
        percentage = (x / rect.width) * 100;
      } else {
        const y = event.clientY - rect.top;
        percentage = (y / rect.height) * 100;
      }

      // Constrain percentage within min/max bounds
      percentage = Math.max(minSize, Math.min(100 - minSize, percentage));
      setSplitPercentage(percentage);
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [direction, minSize]);

  // Handle touch events for mobile
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    e.preventDefault();
    setIsDragging(true);
    
    const handleTouchMove = (event: TouchEvent) => {
      if (!containerRef.current || !event.touches[0]) return;

      const rect = containerRef.current.getBoundingClientRect();
      const touch = event.touches[0];
      let percentage: number;

      if (direction === 'horizontal') {
        const x = touch.clientX - rect.left;
        percentage = (x / rect.width) * 100;
      } else {
        const y = touch.clientY - rect.top;
        percentage = (y / rect.height) * 100;
      }

      percentage = Math.max(minSize, Math.min(100 - minSize, percentage));
      setSplitPercentage(percentage);
    };

    const handleTouchEnd = () => {
      setIsDragging(false);
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };

    document.addEventListener('touchmove', handleTouchMove);
    document.addEventListener('touchend', handleTouchEnd);
  }, [direction, minSize]);

  // Prevent text selection during drag
  useEffect(() => {
    if (isDragging) {
      document.body.style.userSelect = 'none';
      document.body.style.cursor = direction === 'horizontal' ? 'ew-resize' : 'ns-resize';
    } else {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    }

    return () => {
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
  }, [isDragging, direction]);

  const leftPanelStyle = direction === 'horizontal' 
    ? { width: `${splitPercentage}%` }
    : { height: `${splitPercentage}%` };

  const rightPanelStyle = direction === 'horizontal'
    ? { width: `${100 - splitPercentage}%` }
    : { height: `${100 - splitPercentage}%` };

  const resizerStyle = direction === 'horizontal'
    ? { 
        width: '4px', 
        cursor: 'ew-resize',
        left: `${splitPercentage}%`,
        transform: 'translateX(-50%)',
      }
    : { 
        height: '4px', 
        cursor: 'ns-resize',
        top: `${splitPercentage}%`,
        transform: 'translateY(-50%)',
      };

  return (
    <div
      ref={containerRef}
      className={`relative ${
        direction === 'horizontal' ? 'flex h-full' : 'flex flex-col h-full'
      } ${className}`}
    >
      {/* Left/Top Panel */}
      <div
        style={leftPanelStyle}
        className={`${direction === 'horizontal' ? 'h-full' : 'w-full'} overflow-hidden`}
      >
        {children[0]}
      </div>

      {/* Resizer */}
      <div
        ref={resizerRef}
        style={resizerStyle}
        className={`absolute z-10 ${
          isDarkMode ? 'bg-gray-600 hover:bg-gray-500' : 'bg-gray-300 hover:bg-gray-400'
        } transition-colors ${
          direction === 'horizontal' ? 'h-full' : 'w-full'
        } ${
          isDragging 
            ? isDarkMode ? 'bg-blue-500' : 'bg-blue-400'
            : ''
        }`}
        onMouseDown={handleMouseDown}
        onTouchStart={handleTouchStart}
      >
        {/* Visual indicator for the resizer */}
        <div className={`absolute inset-0 flex items-center justify-center ${
          direction === 'horizontal' ? 'flex-col' : 'flex-row'
        }`}>
          <div className={`${
            isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
          } ${
            direction === 'horizontal' 
              ? 'w-0.5 h-6' 
              : 'w-6 h-0.5'
          } rounded-full`} />
        </div>
      </div>

      {/* Right/Bottom Panel */}
      <div
        style={rightPanelStyle}
        className={`${direction === 'horizontal' ? 'h-full' : 'w-full'} overflow-hidden`}
      >
        {children[1]}
      </div>
    </div>
  );
};

export default SplitLayout;