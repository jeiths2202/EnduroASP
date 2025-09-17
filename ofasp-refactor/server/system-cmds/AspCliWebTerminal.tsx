import React, { useState, useEffect, useRef, useCallback } from 'react';
import './AspCliWebTerminal.css';

interface AspCliWebTerminalProps {
  isDarkMode: boolean;
}

interface CommandHistory {
  command: string;
  output: string;
  timestamp: Date;
  success: boolean;
}

interface SystemInfo {
  currentUser: string;
  currentVolume: string;
  currentLibrary: string;
  systemTime: string;
}

const AspCliWebTerminal: React.FC<AspCliWebTerminalProps> = ({ isDarkMode }) => {
  const [commandHistory, setCommandHistory] = useState<CommandHistory[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);
  const [systemInfo, setSystemInfo] = useState<SystemInfo>({
    currentUser: 'ASPUSER',
    currentVolume: 'DISK99',
    currentLibrary: 'QGPL',
    systemTime: new Date().toLocaleString()
  });
  
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [commandSuggestions] = useState([
    'CRTLIB', 'DLTLIB', 'WRKLIB', 'CRTFILE', 'DLTFILE', 
    'DSPFD', 'WRKOBJ', 'WRKVOL', 'WRKSPLF', 'WRKMSG',
    'DSPJOB', 'SAVLIB', 'RSTLIB', 'SNDMSG', 'RCVMSG', 'EDTFILE'
  ]);

  // 시스템 시간 업데이트
  useEffect(() => {
    const timer = setInterval(() => {
      setSystemInfo(prev => ({
        ...prev,
        systemTime: new Date().toLocaleString()
      }));
    }, 1000);

    return () => clearInterval(timer);
  }, []);

  // 터미널 스크롤 자동 조정
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commandHistory]);

  // ASP 명령어 실행
  const executeCommand = useCallback(async (command: string) => {
    if (!command.trim()) return;

    setIsExecuting(true);
    const timestamp = new Date();
    
    try {
      // Python aspcli.py 호출
      const response = await fetch('/api/asp-command', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          command: command.trim(),
          user: systemInfo.currentUser 
        }),
      });

      let output = '';
      let success = false;

      if (response.ok) {
        const result = await response.json();
        output = result.output || result.error || '명령이 실행되었습니다.';
        success = result.success !== false;
      } else {
        // 백엔드가 없는 경우 시뮬레이션
        output = await simulateCommand(command.trim());
        success = true;
      }

      const newEntry: CommandHistory = {
        command: command.trim(),
        output,
        timestamp,
        success
      };

      setCommandHistory(prev => [...prev, newEntry]);
      
    } catch (error) {
      // 에러 발생 시 시뮬레이션으로 폴백
      const output = await simulateCommand(command.trim());
      const newEntry: CommandHistory = {
        command: command.trim(),
        output,
        timestamp,
        success: true
      };
      setCommandHistory(prev => [...prev, newEntry]);
    }

    setIsExecuting(false);
    setCurrentCommand('');
  }, [systemInfo.currentUser]);

  // 명령어 시뮬레이션 (백엔드 없을 때)
  const simulateCommand = async (command: string): Promise<string> => {
    const upperCommand = command.toUpperCase();
    
    // 명령어 파싱
    const parts = upperCommand.split(' ');
    const mainCommand = parts[0];
    
    await new Promise(resolve => setTimeout(resolve, 500)); // 시뮬레이션 지연

    switch (mainCommand) {
      case 'WRKVOL':
        return `[INFO] 볼륨 현황:
  📦 볼륨명        : DISK99
     ├ 라이브러리 수 : 3
     ├ 총 파일 수     : 12
     └ 디스크 사용량 : 1,024 Byte
  📦 볼륨명        : MSGQ
     ├ 라이브러리 수 : 1
     ├ 총 파일 수     : 0
     └ 디스크 사용량 : 0 Byte`;

      case 'CRTLIB':
        const libMatch = command.match(/LIB-(\w+)/i);
        const volMatch = command.match(/VOL-(\w+)/i);
        const libName = libMatch ? libMatch[1] : 'NEWLIB';
        const volName = volMatch ? volMatch[1] : 'DISK99';
        return `[INFO] 라이브러리 '${libName}'가 볼륨 '${volName}'에 생성되었습니다.`;

      case 'CRTFILE':
        const fileMatch = command.match(/FILE\((\w+)\/(\w+)\)/i);
        if (fileMatch) {
          const [, lib, file] = fileMatch;
          return `[INFO] 파일 '${file}'가 라이브러리 '${lib}'에 생성되었습니다.`;
        }
        return `[INFO] 파일이 생성되었습니다.`;

      case 'DSPFD':
        const dspfdMatch = command.match(/FILE\((\w+)\/(\w+)\)/i);
        if (dspfdMatch) {
          const [, lib, file] = dspfdMatch;
          return `[INFO] 파일 정의 정보:
  📁 파일 경로       : /volume/DISK99/${lib}/${file}
  📄 파일 이름       : ${file}
  📦 파일 크기       : 0 Byte
  🕒 생성일시         : ${new Date().toLocaleString()}
  📉 파일이 비어 있음  : 예`;
        }
        return `[INFO] 파일 정의 정보를 표시합니다.`;

      case 'HELP':
        return `사용 가능한 ASP 명령어:

라이브러리 관리:
  CRTLIB LIB-<name>,VOL-<volume>  - 라이브러리 생성
  DLTLIB LIB-<name>,VOL-<volume>  - 라이브러리 삭제
  WRKLIB LIB-<name>,VOL-<volume>  - 라이브러리 작업

파일 관리:
  CRTFILE FILE(<lib>/<file>),VOL-<volume>  - 파일 생성
  DLTFILE FILE(<lib>/<file>),VOL-<volume>  - 파일 삭제
  DSPFD FILE(<lib>/<file>),VOL-<volume>    - 파일 정의 표시

시스템 조회:
  WRKVOL     - 볼륨 현황
  WRKOBJ     - 객체 작업
  DSPJOB     - 작업 표시
  
예시:
  CRTLIB LIB-TESTLIB,VOL-DISK99
  CRTFILE FILE(TESTLIB/TESTFILE),VOL-DISK99`;

      case 'CLS':
      case 'CLEAR':
        setCommandHistory([]);
        return '';

      default:
        if (upperCommand.includes('LIB-') || upperCommand.includes('FILE(') || upperCommand.includes('VOL-')) {
          return `[INFO] 명령 '${mainCommand}'가 실행되었습니다.`;
        }
        return `[ERROR] 알 수 없는 명령입니다: ${mainCommand}
HELP를 입력하여 사용 가능한 명령어를 확인하세요.`;
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (currentCommand.trim() && !isExecuting) {
      executeCommand(currentCommand);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      // 명령어 자동완성
      const suggestions = commandSuggestions.filter(cmd => 
        cmd.toLowerCase().startsWith(currentCommand.toLowerCase())
      );
      if (suggestions.length === 1) {
        setCurrentCommand(suggestions[0] + ' ');
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      // 이전 명령어 불러오기
      const lastCommand = commandHistory[commandHistory.length - 1];
      if (lastCommand) {
        setCurrentCommand(lastCommand.command);
      }
    }
  };

  const clearHistory = () => {
    setCommandHistory([]);
  };

  return (
    <div className={`asp-cli-terminal ${isDarkMode ? 'dark' : 'light'}`}>
      {/* 헤더 */}
      <div className="terminal-header">
        <div className="header-title">
          <span className="title-icon">🖥️</span>
          <span className="title-text">ASP System Command Terminal</span>
        </div>
        <div className="header-info">
          <span className="info-item">사용자: {systemInfo.currentUser}</span>
          <span className="info-separator">|</span>
          <span className="info-item">볼륨: {systemInfo.currentVolume}</span>
          <span className="info-separator">|</span>
          <span className="info-item">{systemInfo.systemTime}</span>
        </div>
        <button 
          className="clear-button"
          onClick={clearHistory}
          title="화면 지우기"
        >
          🗑️
        </button>
      </div>

      {/* 터미널 본문 */}
      <div className="terminal-body" ref={terminalRef}>
        {/* 시작 메시지 */}
        {commandHistory.length === 0 && (
          <div className="welcome-message">
            <div className="welcome-logo">
              ╔══════════════════════════════════════════╗
              ║           ASP System Command             ║
              ║              Terminal v2.0               ║
              ╚══════════════════════════════════════════╝
            </div>
            <div className="welcome-text">
              ASP 시스템 명령어 터미널에 오신 것을 환영합니다.<br/>
              도움말을 보려면 <strong>HELP</strong>를 입력하세요.
            </div>
          </div>
        )}

        {/* 명령어 히스토리 */}
        {commandHistory.map((entry, index) => (
          <div key={index} className="command-entry">
            <div className="command-line">
              <span className="prompt">ASP&gt;</span>
              <span className="command-text">{entry.command}</span>
              <span className="command-time">
                [{entry.timestamp.toLocaleTimeString()}]
              </span>
            </div>
            <div className={`command-output ${entry.success ? 'success' : 'error'}`}>
              <pre>{entry.output}</pre>
            </div>
          </div>
        ))}

        {/* 실행 중 표시 */}
        {isExecuting && (
          <div className="executing-indicator">
            <span className="prompt">ASP&gt;</span>
            <span className="command-text">{currentCommand}</span>
            <span className="loading-dots">실행 중...</span>
          </div>
        )}
      </div>

      {/* 명령어 입력 */}
      <form className="terminal-input" onSubmit={handleSubmit}>
        <span className="input-prompt">ASP&gt;</span>
        <input
          ref={inputRef}
          type="text"
          value={currentCommand}
          onChange={(e) => setCurrentCommand(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="ASP 명령어를 입력하세요... (예: WRKVOL, HELP)"
          disabled={isExecuting}
          className="command-input"
          autoFocus
        />
        <button 
          type="submit" 
          disabled={isExecuting || !currentCommand.trim()}
          className="execute-button"
        >
          {isExecuting ? '실행중...' : '실행'}
        </button>
      </form>

      {/* 도움말 패널 */}
      <div className="help-panel">
        <strong>단축키:</strong> Tab(자동완성), ↑(이전 명령어), Ctrl+L(화면 지우기)
      </div>
    </div>
  );
};

export default AspCliWebTerminal;