import React, { useState, useEffect, useRef } from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';

interface TerminalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  command: string;
  onExecute: (command: string) => Promise<string>;
}

const Terminal: React.FC<TerminalProps> = ({ isOpen, onClose, title, command, onExecute }) => {
  const [output, setOutput] = useState<string[]>([]);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentInput, setCurrentInput] = useState('');
  const [waitingForInput, setWaitingForInput] = useState(false);
  const [inputPrompt, setInputPrompt] = useState('');
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [size, setSize] = useState({ width: 800, height: 600 });
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [resizeDirection, setResizeDirection] = useState('');
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && command) {
      // Reset state when opening
      setOutput([]);
      setCurrentInput('');
      setWaitingForInput(false);
      setInputPrompt('');
      setIsExecuting(false);
      setPosition({ x: 0, y: 0 }); // Reset position
      setSize({ width: 800, height: 600 }); // Reset size
      executeCommand();
    }
  }, [isOpen, command]);

  // Drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    // Don't start drag if clicking on buttons or interactive elements
    if ((e.target as HTMLElement).tagName === 'BUTTON' || 
        (e.target as HTMLElement).tagName === 'svg' ||
        (e.target as HTMLElement).closest('button')) {
      return;
    }
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX - position.x,
      y: e.clientY - position.y
    });
    e.preventDefault(); // Prevent text selection during drag
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      
      // Keep terminal within viewport bounds
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      setPosition({
        x: Math.max(-size.width/2, Math.min(maxX, newX)),
        y: Math.max(-size.height/2, Math.min(maxY, newY))
      });
    } else if (isResizing) {
      handleResize(e);
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setIsResizing(false);
    setResizeDirection('');
  };

  // Resize handlers
  const handleResizeStart = (e: React.MouseEvent, direction: string) => {
    e.stopPropagation();
    setIsResizing(true);
    setResizeDirection(direction);
    setResizeStart({
      x: e.clientX,
      y: e.clientY,
      width: size.width,
      height: size.height
    });
  };

  const handleResize = (e: MouseEvent) => {
    if (!isResizing) return;

    const deltaX = e.clientX - resizeStart.x;
    const deltaY = e.clientY - resizeStart.y;

    let newWidth = resizeStart.width;
    let newHeight = resizeStart.height;
    let newX = position.x;
    let newY = position.y;

    // Handle horizontal resizing
    if (resizeDirection.includes('right')) {
      newWidth = Math.max(400, resizeStart.width + deltaX);
    }
    if (resizeDirection.includes('left')) {
      newWidth = Math.max(400, resizeStart.width - deltaX);
      newX = position.x + (resizeStart.width - newWidth);
    }
    
    // Handle vertical resizing
    if (resizeDirection.includes('bottom')) {
      newHeight = Math.max(300, resizeStart.height + deltaY);
    }
    if (resizeDirection.includes('top')) {
      newHeight = Math.max(300, resizeStart.height - deltaY);
      newY = position.y + (resizeStart.height - newHeight);
    }
    
    // Handle corner resizing
    if (resizeDirection === 'top-left') {
      newWidth = Math.max(400, resizeStart.width - deltaX);
      newHeight = Math.max(300, resizeStart.height - deltaY);
      newX = position.x + (resizeStart.width - newWidth);
      newY = position.y + (resizeStart.height - newHeight);
    }
    if (resizeDirection === 'top-right') {
      newWidth = Math.max(400, resizeStart.width + deltaX);
      newHeight = Math.max(300, resizeStart.height - deltaY);
      newY = position.y + (resizeStart.height - newHeight);
    }
    if (resizeDirection === 'bottom-left') {
      newWidth = Math.max(400, resizeStart.width - deltaX);
      newHeight = Math.max(300, resizeStart.height + deltaY);
      newX = position.x + (resizeStart.width - newWidth);
    }
    if (resizeDirection === 'bottom-right') {
      newWidth = Math.max(400, resizeStart.width + deltaX);
      newHeight = Math.max(300, resizeStart.height + deltaY);
    }

    // Keep within viewport bounds
    const maxWidth = window.innerWidth - newX;
    const maxHeight = window.innerHeight - newY;
    
    newWidth = Math.min(newWidth, maxWidth);
    newHeight = Math.min(newHeight, maxHeight);

    setSize({ width: newWidth, height: newHeight });
    if (resizeDirection.includes('left') || resizeDirection.includes('top') || 
        resizeDirection.includes('top-left') || resizeDirection.includes('bottom-left')) {
      setPosition({ x: newX, y: newY });
    }
  };

  useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, dragStart, position, resizeStart, size]);

  useEffect(() => {
    if (outputRef.current) {
      outputRef.current.scrollTop = outputRef.current.scrollHeight;
    }
  }, [output]);

  const executeCommand = async () => {
    if (isExecuting) return;
    
    setIsExecuting(true);
    setOutput([`$ ${command}`, '']);
    
    try {
      // Check if this is an interactive program
      if (command.includes('--interactive')) {
        await executeInteractiveProgram();
      } else {
        const result = await onExecute(command);
        setOutput(prev => [...prev, result]);
      }
    } catch (error) {
      setOutput(prev => [...prev, `Error: ${error}`]);
    } finally {
      setIsExecuting(false);
    }
  };

  const executeInteractiveProgram = async () => {
    // Extract class name from command
    const className = command.split(' ')[1] || 'Program';
    
    // Simulate compilation
    setOutput(prev => [...prev, 'Compiling Java code...', `javac ${className}.java`, '', 'Running Java application...', `java ${className}`, '']);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Determine program type and execute accordingly
    if (className.toLowerCase().includes('tax')) {
      await executeTaxProgram();
    } else if (className.toLowerCase().includes('hello')) {
      await executeHelloProgram();
    } else if (className.toLowerCase().includes('accept')) {
      await executeAcceptProgram();
    } else {
      // Generic interactive program
      await executeGenericProgram(className);
    }
  };

  const executeTaxProgram = async () => {
    // Start interactive execution
    setOutput(prev => [...prev, '所得税計算システム', '==================']);
    
    // Wait for user input
    const inputValue = await waitForUserInput('年収を入力（円）：');
    
    const income = parseInt(inputValue) || 5000000;
    
    // Calculate tax based on income
    let taxRate = 0;
    if (income <= 1950000) {
      taxRate = 0.05;
    } else if (income <= 3300000) {
      taxRate = 0.10;
    } else if (income <= 6950000) {
      taxRate = 0.20;
    } else if (income <= 9000000) {
      taxRate = 0.23;
    } else if (income <= 18000000) {
      taxRate = 0.33;
    } else {
      taxRate = 0.40;
    }
    
    const basicDeduction = 480000;
    const taxableIncome = income - basicDeduction;
    const incomeTax = Math.floor(taxableIncome * taxRate);
    const localTax = Math.floor(incomeTax * 0.1);
    const totalTax = incomeTax + localTax;
    const netIncome = income - totalTax;
    
    // Display results
    setOutput(prev => [...prev, '', '所得税計算結果', '================', 
      `年収　　　：¥${income.toLocaleString()} 円`,
      `基礎控除　：¥${basicDeduction.toLocaleString()} 円`, 
      `課税所得　：¥${taxableIncome.toLocaleString()} 円`,
      `所得税額　：¥${incomeTax.toLocaleString()} 円`,
      `住民税額　：¥${localTax.toLocaleString()} 円`,
      `手取り年収：¥${netIncome.toLocaleString()} 円`,
      '', 'Execution completed successfully.'
    ]);
  };

  const executeHelloProgram = async () => {
    const name = await waitForUserInput('お名前を入力してください：');
    setOutput(prev => [...prev, `${name || '田中太郎'}様`, '', 'Execution completed successfully.']);
  };

  const executeAcceptProgram = async () => {
    // Simulate Accept01 program execution exactly as the Java code
    // This simulates the mainPara() method execution
    
    // System.out.println("Enter your input: ");
    setOutput(prev => [...prev, 'Enter your input: ']);
    
    // userInput = scanner.nextLine(); (waiting for user input)
    const userInput = await waitForUserInput('');
    
    // System.out.println("You entered: " + userInput);
    setOutput(prev => [...prev, `You entered: ${userInput}`, '', 'Execution completed successfully.']);
  };

  const executeGenericProgram = async (className: string) => {
    setOutput(prev => [...prev, `${className} program started.`]);
    const value = await waitForUserInput('値を入力してください：');
    setOutput(prev => [...prev, `入力値: ${value || 'default'}`, '', 'Execution completed successfully.']);
  };

  const waitForUserInput = (prompt: string): Promise<string> => {
    return new Promise((resolve) => {
      // Only add prompt to output if it's not empty
      if (prompt.trim()) {
        setOutput(prev => [...prev, prompt]);
      }
      setInputPrompt(prompt);
      setWaitingForInput(true);
      setCurrentInput('');
      
      // Focus input after a short delay
      setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      
      // Store resolve function for later use
      (window as any).resolveInput = resolve;
    });
  };

  const handleInputSubmit = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && waitingForInput) {
      const inputValue = currentInput;
      setOutput(prev => [...prev, inputValue]);
      setWaitingForInput(false);
      setInputPrompt('');
      
      // Resolve the promise with the input value
      if ((window as any).resolveInput) {
        (window as any).resolveInput(inputValue);
        delete (window as any).resolveInput;
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div 
        ref={terminalRef}
        className="bg-gray-900 rounded-lg shadow-2xl flex flex-col select-none relative"
        style={{
          transform: `translate(${position.x}px, ${position.y}px)`,
          width: `${size.width}px`,
          height: `${size.height}px`,
          cursor: isDragging ? 'grabbing' : 'default',
          minWidth: '400px',
          minHeight: '300px'
        }}
      >
        {/* Terminal Header */}
        <div 
          className="bg-gray-800 rounded-t-lg px-4 py-3 flex items-center justify-between border-b border-gray-700 cursor-grab active:cursor-grabbing"
          onMouseDown={handleMouseDown}
        >
          <div className="flex items-center space-x-3">
            <div className="flex space-x-2">
              <div className="w-3 h-3 bg-red-500 rounded-full"></div>
              <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
              <div className="w-3 h-3 bg-green-500 rounded-full"></div>
            </div>
            <span className="text-white font-medium">{title}</span>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Terminal Body */}
        <div 
          className="flex-1 bg-black text-green-400 font-mono text-sm overflow-hidden flex flex-col"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div
            ref={outputRef}
            className="flex-1 overflow-y-auto p-4 whitespace-pre-wrap"
          >
            {output.map((line, index) => (
              <div key={index} className="leading-relaxed">
                {line}
              </div>
            ))}
            {isExecuting && !waitingForInput && (
              <div className="flex items-center space-x-2 mt-2">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                <span className="text-gray-400">Executing...</span>
              </div>
            )}
            {waitingForInput && (
              <div className="flex items-center mt-2">
                <span className="text-green-400 mr-2">$</span>
                <input
                  ref={inputRef}
                  type="text"
                  value={currentInput}
                  onChange={(e) => setCurrentInput(e.target.value)}
                  onKeyDown={handleInputSubmit}
                  className="bg-transparent border-none outline-none text-green-400 flex-1"
                  placeholder="Enter value..."
                />
                <span className="text-green-400 animate-pulse">█</span>
              </div>
            )}
          </div>
        </div>

        {/* Terminal Footer */}
        <div 
          className="bg-gray-800 rounded-b-lg px-4 py-2 border-t border-gray-700"
          onMouseDown={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>Press Ctrl+C to interrupt</span>
            <span>{isExecuting ? 'Running...' : 'Ready'}</span>
          </div>
        </div>

        {/* Resize Handles */}
        {/* Top edge */}
        <div 
          className="absolute top-0 left-2 right-2 h-1 cursor-n-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'top')}
        />
        {/* Bottom edge */}
        <div 
          className="absolute bottom-0 left-2 right-2 h-1 cursor-s-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'bottom')}
        />
        {/* Left edge */}
        <div 
          className="absolute top-2 bottom-2 left-0 w-1 cursor-w-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'left')}
        />
        {/* Right edge */}
        <div 
          className="absolute top-2 bottom-2 right-0 w-1 cursor-e-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'right')}
        />
        {/* Corner handles */}
        <div 
          className="absolute top-0 left-0 w-3 h-3 cursor-nw-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'top-left')}
        />
        <div 
          className="absolute top-0 right-0 w-3 h-3 cursor-ne-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'top-right')}
        />
        <div 
          className="absolute bottom-0 left-0 w-3 h-3 cursor-sw-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-left')}
        />
        <div 
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-blue-500 hover:opacity-50 transition-colors"
          onMouseDown={(e) => handleResizeStart(e, 'bottom-right')}
        />
      </div>
    </div>
  );
};

export default Terminal;