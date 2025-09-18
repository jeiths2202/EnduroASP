import React, { useState, useEffect, useRef } from 'react';

interface ASPWebUITerminalProps {
  isDarkMode: boolean;
}

const ASPWebUITerminal: React.FC<ASPWebUITerminalProps> = ({ isDarkMode }) => {
  const [userId, setUserId] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentLine, setCurrentLine] = useState(0);
  const [currentCol, setCurrentCol] = useState(0);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const userIdRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Simulate login process
    setTimeout(() => {
      setIsLoading(false);
      setIsLoggedIn(true);
    }, 1000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (userId && password) {
        handleLogin(e);
      }
    }
  };

  const ASPLogo = () => (
    <div className="font-mono text-center leading-tight mb-6">
      <div className="text-green-400 mb-4">
        <div className="text-4xl font-bold mb-4 tracking-wider">
          <div className="text-green-300 drop-shadow-lg">
            ╔═══════════════════════════════════════════════════════════════╗
          </div>
          <div className="text-green-300 drop-shadow-lg">
            ║                                                               ║
          </div>
          <div className="text-yellow-400 drop-shadow-lg">
            ║                     OpenASP                                   ║
          </div>
          <div className="text-green-300 drop-shadow-lg">
            ║                                                               ║
          </div>
          <div className="text-blue-400 drop-shadow-lg text-lg">
            ║              Application Server Platform                      ║
          </div>
          <div className="text-green-300 drop-shadow-lg">
            ║                                                               ║
          </div>
          <div className="text-cyan-400 drop-shadow-lg text-lg">
            ║                  WebUI Terminal v2.0                         ║
          </div>
          <div className="text-green-300 drop-shadow-lg">
            ║                                                               ║
          </div>
          <div className="text-green-300 drop-shadow-lg">
            ╚═══════════════════════════════════════════════════════════════╝
          </div>
        </div>
      </div>
    </div>
  );

  const MainScreen = () => (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ASPLogo />
          <div className="mt-8 text-green-400 font-mono">
            <div className="mb-6 text-white text-xl">
              Welcome to OpenASP WebUI Terminal
            </div>
            <div className="mb-6 text-yellow-400 text-lg">
              System ready for operations
            </div>
            <div className="animate-pulse text-lg">
              Press any key to continue...
            </div>
          </div>
        </div>
      </div>
      <div className="h-10 bg-gray-800 flex items-center justify-between px-6 text-green-400 font-mono text-base">
        <div>LINE: {currentLine.toString().padStart(3, '0')}</div>
        <div>COL: {currentCol.toString().padStart(3, '0')}</div>
        <div>OpenASP WebUI v2.0</div>
      </div>
    </div>
  );

  const LoginScreen = () => (
    <div className="h-full flex flex-col">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <ASPLogo />
          <div className="mt-8 text-green-400 font-mono">
            <div className="mb-8 text-white text-xl">
              OpenASP WebUI Terminal Login
            </div>
            <form onSubmit={handleLogin} className="space-y-6">
              <div className="flex items-center justify-center space-x-4">
                <label className="text-yellow-400 w-20 text-right text-lg">
                  User ID:
                </label>
                <input
                  ref={userIdRef}
                  type="text"
                  value={userId}
                  onChange={(e) => setUserId(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-black text-green-400 font-mono px-3 py-2 w-40 border-2 border-green-400 focus:outline-none focus:border-yellow-400 uppercase text-lg"
                  maxLength={8}
                  autoFocus
                />
              </div>
              <div className="flex items-center justify-center space-x-4">
                <label className="text-yellow-400 w-20 text-right text-lg">
                  Password:
                </label>
                <input
                  ref={passwordRef}
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="bg-black text-green-400 font-mono px-3 py-2 w-40 border-2 border-green-400 focus:outline-none focus:border-yellow-400 text-lg"
                  maxLength={16}
                />
              </div>
              <div className="mt-8">
                {isLoading ? (
                  <div className="text-yellow-400 animate-pulse text-lg">
                    Authenticating...
                  </div>
                ) : (
                  <div className="text-gray-400 text-lg">
                    Press ENTER to login
                  </div>
                )}
              </div>
            </form>
          </div>
        </div>
      </div>
      <div className="h-10 bg-gray-800 flex items-center justify-between px-6 text-green-400 font-mono text-base">
        <div>LINE: {currentLine.toString().padStart(3, '0')}</div>
        <div>COL: {currentCol.toString().padStart(3, '0')}</div>
        <div>OpenASP WebUI v2.0</div>
      </div>
    </div>
  );

  useEffect(() => {
    const updateCursor = () => {
      if (userIdRef.current && document.activeElement === userIdRef.current) {
        setCurrentLine(12);
        setCurrentCol(18 + userId.length);
      } else if (passwordRef.current && document.activeElement === passwordRef.current) {
        setCurrentLine(13);
        setCurrentCol(18 + password.length);
      } else {
        setCurrentLine(0);
        setCurrentCol(0);
      }
    };

    const interval = setInterval(updateCursor, 100);
    return () => clearInterval(interval);
  }, [userId, password]);

  return (
    <div className="h-full bg-black text-green-400 font-mono overflow-hidden p-4">
      <div 
        className="h-full w-full max-w-6xl mx-auto"
        style={{ 
          fontSize: '18px',
          lineHeight: '1.3',
          fontFamily: 'Monaco, "Cascadia Code", "Consolas", "Courier New", monospace',
          border: '3px solid #00ff00',
          boxShadow: '0 0 30px rgba(0, 255, 0, 0.4)',
          background: 'linear-gradient(45deg, #000000 0%, #001100 100%)',
          borderRadius: '8px'
        }}
      >
        {isLoggedIn ? <MainScreen /> : <LoginScreen />}
      </div>
    </div>
  );
};

export default ASPWebUITerminal;