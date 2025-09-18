import React, { useState, useEffect, useRef } from 'react';
import './map_layout.css';
// SJIS encoding utilities are handled by the API server

interface FieldData {
  row: number;
  col: number;
  value: string;
  length: number;
  attribute?: string;
  color?: string;
  isInputField?: boolean;
  maxLength?: number;
}

interface SmedField {
  name: string;
  type: string;
  position: { row: number; col: number };
  length: number;
  prompt: string;
  color: string;
}

interface SmedMapData {
  fields: SmedField[];
}

interface InputFieldValue {
  [key: string]: string;
}

interface UserSession {
  authenticated: boolean;
  user_id: string;
  program: string;
}

const MapLayout: React.FC = () => {
  const [screenData, setScreenData] = useState<FieldData[]>([]);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [inputValues, setInputValues] = useState<InputFieldValue>({});
  const [userSession, setUserSession] = useState<UserSession>({
    authenticated: false,
    user_id: '',
    program: ''
  });
  const [loginAttempting, setLoginAttempting] = useState<boolean>(false);
  const firstInputRef = useRef<HTMLInputElement>(null);

  // Parse SMED content from text format to map data structure
  const parseSmedContent = (content: string, mapName: string): SmedMapData => {
    console.log(`[INFO] Parsing SMED content for ${mapName}`);
    
    const lines = content.split('\n');
    const fields: SmedField[] = [];
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      
      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#') || trimmedLine.startsWith('//')) {
        continue;
      }
      
      // Skip MAPNAME line
      if (trimmedLine.startsWith('MAPNAME')) {
        continue;
      }
      
      // Parse ITEM field definitions
      if (trimmedLine.startsWith('ITEM')) {
        const field = parseItemField(trimmedLine);
        if (field) {
          fields.push(field);
        }
      }
    }
    
    console.log(`[INFO] Parsed ${fields.length} fields from SMED content`);
    return { fields };
  };

  // Parse individual ITEM field line
  const parseItemField = (line: string): SmedField | null => {
    try {
      // Extract field name
      const nameMatch = line.match(/ITEM\s+(\w+)/);
      const name = nameMatch ? nameMatch[1] : 'unknown';
      
      // Extract TYPE
      const typeMatch = line.match(/TYPE=([A-Z])/);
      const typeCode = typeMatch ? typeMatch[1] : 'I';
      const type = typeCode === 'T' ? 'text' : 'input';
      
      // Extract POS=(row,col)
      const posMatch = line.match(/POS=\((\d+),(\d+)\)/);
      const row = posMatch ? parseInt(posMatch[1]) : 0;
      const col = posMatch ? parseInt(posMatch[2]) : 0;
      
      // Extract PROMPT="text"
      const promptMatch = line.match(/PROMPT="([^"]*)"/);
      const prompt = promptMatch ? promptMatch[1] : '';
      
      // Extract COLOR=#RRGGBB
      const colorMatch = line.match(/COLOR=(#[0-9A-Fa-f]{6})/);
      const color = colorMatch ? colorMatch[1] : '#00FF00';
      
      // Extract LEN=number
      const lenMatch = line.match(/LEN=(\d+)/);
      let length = lenMatch ? parseInt(lenMatch[1]) : 0;
      
      // If no explicit length and has prompt, use prompt length
      if (length === 0 && prompt) {
        length = prompt.length;
      }
      
      // Default length for input fields
      if (length === 0 && type === 'input') {
        length = 10;
      }
      
      const field: SmedField = {
        name,
        type,
        position: { row, col },
        length,
        prompt,
        color
      };
      
      console.log(`[DEBUG] Parsed field: ${name} at (${row},${col}) - "${prompt}"`);
      return field;
      
    } catch (error) {
      console.error(`[ERROR] Failed to parse field line: ${line}`, error);
      return null;
    }
  };

  // Check if character is full-width
  const isFullWidthChar = (char: string): boolean => {
    const code = char.charCodeAt(0);
    return (
      (code >= 0x1100 && code <= 0x115F) ||  // Hangul Jamo
      (code >= 0x2E80 && code <= 0x2EFF) ||  // CJK Radicals Supplement
      (code >= 0x2F00 && code <= 0x2FDF) ||  // Kangxi Radicals
      (code >= 0x3000 && code <= 0x303F) ||  // CJK Symbols and Punctuation
      (code >= 0x3040 && code <= 0x309F) ||  // Hiragana
      (code >= 0x30A0 && code <= 0x30FF) ||  // Katakana
      (code >= 0x3100 && code <= 0x312F) ||  // Bopomofo
      (code >= 0x3130 && code <= 0x318F) ||  // Hangul Compatibility Jamo
      (code >= 0x3190 && code <= 0x319F) ||  // Kanbun
      (code >= 0x31A0 && code <= 0x31BF) ||  // Bopomofo Extended
      (code >= 0x31C0 && code <= 0x31EF) ||  // CJK Strokes
      (code >= 0x31F0 && code <= 0x31FF) ||  // Katakana Phonetic Extensions
      (code >= 0x3200 && code <= 0x32FF) ||  // Enclosed CJK Letters and Months
      (code >= 0x3300 && code <= 0x33FF) ||  // CJK Compatibility
      (code >= 0x3400 && code <= 0x4DBF) ||  // CJK Unified Ideographs Extension A
      (code >= 0x4E00 && code <= 0x9FFF) ||  // CJK Unified Ideographs
      (code >= 0xA000 && code <= 0xA48F) ||  // Yi Syllables
      (code >= 0xA490 && code <= 0xA4CF) ||  // Yi Radicals
      (code >= 0xAC00 && code <= 0xD7AF) ||  // Hangul Syllables
      (code >= 0xF900 && code <= 0xFAFF) ||  // CJK Compatibility Ideographs
      (code >= 0xFE10 && code <= 0xFE1F) ||  // Vertical Forms
      (code >= 0xFE30 && code <= 0xFE4F) ||  // CJK Compatibility Forms
      (code >= 0xFE50 && code <= 0xFE6F) ||  // Small Form Variants
      (code >= 0xFF00 && code <= 0xFFEF) ||  // Halfwidth and Fullwidth Forms
      (code >= 0x2580 && code <= 0x259F) ||  // Block Elements
      (code >= 0x25A0 && code <= 0x25FF) ||  // Geometric Shapes (includes !)
      (code >= 0x2600 && code <= 0x26FF) ||  // Miscellaneous Symbols
      (code >= 0x2700 && code <= 0x27BF)     // Dingbats
    );
  };

  // Calculate display width considering full-width characters
  const getDisplayWidth = (text: string): number => {
    console.log(`[DEBUG] Calculating display width for: "${text}"`);
    let width = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text[i];
      const code = char.charCodeAt(0);
      
      const isFullWidth = isFullWidthChar(char);
      
      console.log(`[DEBUG]   [${i}] '${char}' (U+${code.toString(16).toUpperCase().padStart(4, '0')}) -> ${isFullWidth ? 'FullWidth(2)' : 'HalfWidth(1)'}`);
      
      if (isFullWidth) {
        width += 2; // Full-width character takes 2 columns
      } else {
        width += 1; // Half-width character takes 1 column
      }
    }
    console.log(`[DEBUG] Total display width: ${width}`);
    return width;
  };

  // Validate input length considering full-width characters
  const validateInputLength = (value: string, maxLength: number): boolean => {
    let currentLength = 0;
    for (let char of value) {
      currentLength += isFullWidthChar(char) ? 2 : 1;
    }
    return currentLength <= maxLength;
  };

  // Convert SMED field data to screen display format
  const convertSmedToScreenData = (smedData: SmedMapData): FieldData[] => {
    console.log(`[INFO] Converting SMED data with ${smedData.fields.length} fields`);
    
    return smedData.fields.map((field, index) => {
      console.log(`[DEBUG] Field ${index}: ${field.name}`);
      console.log(`[DEBUG]   Position: (${field.position.row}, ${field.position.col})`);
      console.log(`[DEBUG]   Prompt: "${field.prompt}"`);
      console.log(`[DEBUG]   Length: ${field.length}`);
      
      // Determine if this is an input field (no prompt and has length)
      const isInputField = !field.prompt && field.length > 0;
      
      const displayWidth = field.prompt ? getDisplayWidth(field.prompt) : field.length;
      
      const result: FieldData = {
        row: field.position.row,
        col: field.position.col,
        value: field.prompt,
        length: displayWidth,
        color: field.color,
        attribute: field.type,
        isInputField: isInputField,
        maxLength: field.length
      };
      
      console.log(`[DEBUG]   Converted to: row=${result.row}, col=${result.col}, length=${result.length}, isInputField=${result.isInputField}, maxLength=${result.maxLength}`);
      return result;
    });
  };

  // Load SMED MAP data from Flask API
  const loadSmedMap = async (mapName: string = 'mainmenu', retryCount: number = 0) => {
    const maxRetries = 3;
    try {
      console.log(`[INFO] Loading SMED map: ${mapName} (attempt ${retryCount + 1}/${maxRetries + 1})`);
      setLoading(true);
      setError('');
      
      // Use volume/library structure for SMED file access
      const apiUrl = `http://localhost:8000/api/smed/content/DISK01/TESTLIB/${mapName.toUpperCase()}`;
      console.log(`[DEBUG] API URL: ${apiUrl}`);
      
      // Add timeout and retry logic
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'text/plain',
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`[DEBUG] API Response status: ${response.status}`);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      // Get SMED content as text and parse it
      const smedContent = await response.text();
      console.log(`[INFO] Received SMED content:`, smedContent.substring(0, 200));
      
      // Parse SMED content into map data structure
      const mapData = parseSmedContent(smedContent, mapName);
      console.log(`[INFO] Parsed map data:`, mapData);
      
      const screenFields = convertSmedToScreenData(mapData);
      console.log(`[INFO] Converted to screen data:`, screenFields);
      
      setScreenData(screenFields);
      console.log(`[INFO] Screen data set successfully`);
      
      // Focus on first input field after data is loaded
      setTimeout(() => {
        if (firstInputRef.current) {
          firstInputRef.current.focus();
          console.log(`[DEBUG] Focused on first input field`);
        }
      }, 100);
      
    } catch (err) {
      console.error('[ERROR] Error loading SMED map:', err);
      
      // Retry logic for network errors
      if (retryCount < maxRetries) {
        const isNetworkError = err instanceof TypeError || 
                              (err instanceof Error && err.name === 'AbortError') ||
                              (err instanceof Error && err.message.includes('Failed to fetch'));
        
        if (isNetworkError) {
          console.log(`[INFO] Network error detected, retrying in ${(retryCount + 1) * 1000}ms...`);
          setTimeout(() => {
            loadSmedMap(mapName, retryCount + 1);
          }, (retryCount + 1) * 1000); // Exponential backoff
          return;
        }
      }
      
      // Set error message with more details
      let errorMessage = 'API サーバーに接続できません';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'API リクエストがタイムアウトしました';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'ネットワーク接続エラー - API サーバーが起動しているか確認してください';
        } else {
          errorMessage = `API エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
      
      // Fallback to sample data if all retries fail
      console.log(`[INFO] All retries failed, using fallback sample data`);
      loadSampleData();
    } finally {
      setLoading(false);
    }
  };

  // Handle login submission
  const handleLogin = async () => {
    // Debug: Show all input values
    console.log(`[DEBUG] All input values:`, inputValues);
    
    const idField = inputValues['9-37'] || inputValues['9-30'] || ''; // Try both positions
    const passField = inputValues['10-37'] || inputValues['10-30'] || ''; // Try both positions
    
    // Debug: Show extracted values
    console.log(`[DEBUG] Extracted ID: "${idField}" from key 9-37 or 9-30`);
    console.log(`[DEBUG] Extracted PASS: "${passField}" from key 10-37 or 10-30`);
    
    if (!idField.trim() || !passField.trim()) {
      console.log(`[DEBUG] Login failed - empty fields: ID="${idField}", PASS="${passField}"`);
      setError('Please enter both ID and Password');
      return;
    }
    
    console.log(`[INFO] SMED-based login attempt: ${idField}`);
    setLoginAttempting(true);
    setError('');
    
    try {
      // SMED構造に従って LOGO マップの LoginProgram を直接実行
      console.log(`[INFO] Executing LOGO map program: com.openasp.login.LoginProgram`);
      
      const result = await executeMapProgram('LOGO', {
        user_id: idField,
        password: passField
      });
      
      if (result && result.success) {
        console.log(`[INFO] Login successful via LoginProgram for ${idField}`);
        
        setUserSession({
          authenticated: true,
          user_id: idField,
          program: result.program || 'LoginProgram'
        });
        
        // LoginProgram が next_map を指定した場合、そのマップをロード
        if (result.next_map) {
          console.log(`[INFO] LoginProgram requested to load map: ${result.next_map}`);
          await loadSmedMap(result.next_map.toLowerCase());
        }
        
      } else {
        console.log(`[WARNING] Login failed via LoginProgram`);
        setError(result?.message || 'ログイン失敗');
      }
      
    } catch (err) {
      console.error('[ERROR] Login request failed:', err);
      
      // Provide more specific error messages
      let errorMessage = 'ログイン要求が失敗しました';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'ログイン要求がタイムアウトしました';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'API サーバーに接続できません。サーバーが起動しているか確認してください。';
        } else {
          errorMessage = `ログインエラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    } finally {
      setLoginAttempting(false);
    }
  };

  // Execute Java program
  const executeProgram = async (userId: string, program: string, inputData: any) => {
    console.log(`[INFO] Executing program: ${program} for user: ${userId}`);
    
    try {
      // Add timeout for program execution request
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout for program execution
      
      const response = await fetch('http://localhost:8000/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: userId,
          program: program,
          input_fields: inputData
        }),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      const result = await response.json();
      console.log(`[DEBUG] Program execution result:`, result);
      
      if (result.success) {
        console.log(`[INFO] Program ${program} executed successfully`);
        
        // Check if program wants to load a new map
        if (result.next_map) {
          console.log(`[INFO] Program ${program} requested to load map: ${result.next_map}`);
          await loadSmedMap(result.next_map); // ???? ?? ??
        }
        
        // Handle program output (could load new SMED map, show results, etc.)
        if (result.execution_result && result.execution_result.output) {
          console.log(`[INFO] Program output:`, result.execution_result.output);
          
          // Try to parse program output for additional commands
          try {
            const outputData = JSON.parse(result.execution_result.output);
            if (outputData.status === 'success') {
              // Handle successful program execution
              console.log(`[INFO] Program ${program} completed successfully`);
              
              // Show success message briefly
              setError(''); // Clear any previous errors
              
              // For PGM1, the MENU map should be loaded automatically via next_map
              if (program === 'PGM1') {
                console.log(`[INFO] PGM1 execution completed, MENU map should be loading`);
              }
            }
          } catch (parseError) {
            console.log(`[DEBUG] Program output is not JSON, treating as plain text`);
          }
        }
      } else {
        console.log(`[WARNING] Program execution failed: ${result.message}`);
        setError(`Program execution failed: ${result.message}`);
      }
      
    } catch (err) {
      console.error('[ERROR] Program execution request failed:', err);
      
      // Provide more specific error messages
      let errorMessage = 'プログラム実行が失敗しました';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'プログラム実行がタイムアウトしました';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'API サーバーに接続できません。サーバーが起動しているか確認してください。';
        } else {
          errorMessage = `プログラム実行エラー: ${err.message}`;
        }
      }
      
      setError(errorMessage);
    }
  };

  // Execute map program via API
  const executeMapProgram = async (mapName: string, inputData: any) => {
    console.log(`[INFO] Executing map program for: ${mapName}`);
    console.log(`[DEBUG] inputData:`, inputData);
    console.log(`[DEBUG] inputData.user_id:`, inputData.user_id);
    console.log(`[DEBUG] userSession.user_id:`, userSession.user_id);
    
    const finalUserId = inputData.user_id || userSession.user_id || 'system';
    console.log(`[DEBUG] Final user_id to be sent:`, finalUserId);
    
    try {
      // Add timeout for map program execution
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const requestBody = {
        user_id: finalUserId,
        map_name: mapName,
        input_fields: inputData
      };
      console.log(`[DEBUG] Request body:`, requestBody);
      
      const response = await fetch('http://localhost:8000/api/execute', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const result = await response.json();
      console.log(`[DEBUG] Map program execution result:`, result);
      
      if (result.success && result.result) {
        return result.result;
      } else {
        console.log(`[WARNING] Map program execution failed: ${result.message}`);
        return { success: false, message: result.message || 'Map program execution failed' };
      }
      
    } catch (err) {
      console.error('[ERROR] Map program execution request failed:', err);
      
      // Provide more specific error messages
      let errorMessage = 'マップ プログラム実行が失敗しました';
      if (err instanceof Error) {
        if (err.name === 'AbortError') {
          errorMessage = 'マップ プログラム実行がタイムアウトしました';
        } else if (err.message.includes('Failed to fetch')) {
          errorMessage = 'API サーバーに接続できません。サーバーが起動しているか確認してください。';
        } else {
          errorMessage = `マップ プログラム実行エラー: ${err.message}`;
        }
      }
      
      return { success: false, message: errorMessage };
    }
  };

  // Handle input change with full-width character validation
  const handleInputChange = (fieldKey: string, value: string, maxLength: number) => {
    console.log(`[DEBUG] Input change: ${fieldKey} = "${value}", maxLength: ${maxLength}`);
    
    if (validateInputLength(value, maxLength)) {
      setInputValues(prev => ({
        ...prev,
        [fieldKey]: value
      }));
      console.log(`[DEBUG] Input accepted: "${value}"`);
    } else {
      console.log(`[DEBUG] Input rejected: exceeds length limit`);
    }
  };

  // Handle Enter key press for login and Function keys
  const handleInputKeyDown = (event: React.KeyboardEvent) => {
    console.log(`[DEBUG] Input Key pressed: ${event.key}, Code: ${event.code}`);
    
    // Handle Enter key for login
    if (event.key === 'Enter' && !loginAttempting && !userSession.authenticated) {
      event.preventDefault();
      event.stopPropagation();
      handleLogin();
      return;
    }
    
    // Handle Function Keys (F1-F12)
    if (event.key.startsWith('F') && event.key.length >= 2) {
      event.preventDefault();
      event.stopPropagation();
      console.log(`[DEBUG] Input field function key: ${event.key}`);
      handleFunctionKey(event.key);
      return;
    }
    
    // Handle other special keys (except Tab which should maintain default behavior)
    if (['Escape', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      handleSpecialKey(event.key);
      return;
    }
    
    // Handle Tab key - allow default browser behavior for focus navigation
    if (event.key === 'Tab') {
      console.log(`[DEBUG] Tab key pressed - allowing default focus navigation`);
      // Do not preventDefault() - let browser handle focus navigation
      return;
    }
  };

  // Handle Function Key presses (F1-F12)
  const handleFunctionKey = async (functionKey: string) => {
    console.log(`[INFO] Function key pressed: ${functionKey}`);
    
    // F3 = Logout (Exit)
    if (functionKey === 'F3') {
      console.log(`[INFO] F3 pressed - Logout requested`);
      await handleLogout();
      return;
    }
    
    // F1 = Help
    if (functionKey === 'F1') {
      console.log(`[INFO] F1 pressed - Help requested`);
      // Future: Show help screen
      return;
    }
    
    // F12 = Cancel
    if (functionKey === 'F12') {
      console.log(`[INFO] F12 pressed - Cancel requested`);
      // Future: Cancel current operation
      return;
    }
    
    // For other function keys, execute with current map and function key data
    if (userSession.authenticated) {
      const currentMapName = screenData.length > 0 ? 'MENU' : 'LOGO'; // Determine current map
      
      try {
        const result = await executeMapProgram(currentMapName, {
          user_id: userSession.user_id,
          function_key: functionKey,
          action: 'function_key_pressed'
        });
        
        if (result && result.success && result.next_map) {
          console.log(`[INFO] Function key ${functionKey} requested next map: ${result.next_map}`);
          if (result.next_map === 'LOGOUT') {
            await handleLogout();
          } else {
            await loadSmedMap(result.next_map.toLowerCase());
          }
        }
      } catch (err) {
        console.error(`[ERROR] Function key execution failed:`, err);
        const errorMessage = err instanceof Error ? err.message : String(err);
        setError(`Function key execution failed: ${errorMessage}`);
      }
    }
  };

  // Handle special key presses
  const handleSpecialKey = (specialKey: string) => {
    console.log(`[INFO] Special key pressed: ${specialKey}`);
    
    // Future: Handle other special keys
    if (specialKey === 'Escape') {
      // Same as F12 - Cancel
      handleFunctionKey('F12');
    }
  };

  // Handle logout process
  const handleLogout = async () => {
    console.log(`[INFO] Logout process started`);
    console.log(`[DEBUG] Current userSession:`, userSession);
    console.log(`[DEBUG] userSession.authenticated:`, userSession.authenticated);
    console.log(`[DEBUG] userSession.user_id:`, userSession.user_id);
    setLoginAttempting(true);
    
    try {
      // Execute logout program
      const result = await executeMapProgram('LOGOUT', {
        user_id: userSession.user_id,
        action: 'logout'
      });
      
      if (result && result.success) {
        console.log(`[INFO] Logout successful`);
        
        // Clear user session
        setUserSession({
          authenticated: false,
          user_id: '',
          program: ''
        });
        
        // Clear input values
        setInputValues({});
        
        // Return to LOGO screen
        await loadSmedMap('logo');
        
        setError(''); // Clear any errors
      } else {
        console.log(`[WARNING] Logout failed:`, result?.message);
        setError(result?.message || 'ログアウトに失敗しました');
      }
      
    } catch (err) {
      console.error('[ERROR] Logout request failed:', err);
      
      // Force logout even if program fails
      console.log(`[INFO] Force logout due to error`);
      setUserSession({
        authenticated: false,
        user_id: '',
        program: ''
      });
      setInputValues({});
      await loadSmedMap('logo');
      setError('');
      
    } finally {
      setLoginAttempting(false);
    }
  };

  // Fallback sample data
  const loadSampleData = () => {
    const sampleLogo: FieldData[] = [
      { row: 2, col: 30, value: '==========================', length: 26 },
      { row: 3, col: 30, value: '    OpenASP SMED MAP      ', length: 26 },
      { row: 4, col: 30, value: '    WEB MIGRATION TOOL    ', length: 26 },
      { row: 5, col: 30, value: '==========================', length: 26 },
      { row: 7, col: 35, value: 'SYSTEM READY', length: 12 },
      { row: 9, col: 25, value: 'Press any key to continue...', length: 28 },
      { row: 22, col: 2, value: 'F1=Help  F3=Exit  F12=Cancel', length: 28 },
    ];
    setScreenData(sampleLogo);
  };

  useEffect(() => {
    // Load LOGO map on component mount
    loadSmedMap('logo');
    
    // Add wheel event listener for zoom
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      
      setZoomLevel(prevZoom => {
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        const newZoom = Math.max(0.5, Math.min(3.0, prevZoom + delta));
        return Math.round(newZoom * 10) / 10; // Round to first decimal place
      });
    };

    // Add keyboard event listener (Support Ctrl + +/- and Function Keys)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Handle zoom controls with Ctrl
      if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
          e.preventDefault();
          setZoomLevel(prevZoom => Math.min(3.0, Math.round((prevZoom + 0.1) * 10) / 10));
          return;
        } else if (e.key === '-') {
          e.preventDefault();
          setZoomLevel(prevZoom => Math.max(0.5, Math.round((prevZoom - 0.1) * 10) / 10));
          return;
        } else if (e.key === '0') {
          e.preventDefault();
          setZoomLevel(1.0);
          return;
        }
      }
      
      // Handle Function Keys (F1-F12) globally - always prevent default browser behavior
      if (e.key.startsWith('F') && e.key.length >= 2) {
        e.preventDefault();
        e.stopPropagation();
        
        // Check if an input field is currently focused
        const activeElement = document.activeElement;
        const isInputFocused = activeElement && activeElement.tagName === 'INPUT';
        
        if (!isInputFocused) {
          console.log(`[DEBUG] Global function key pressed: ${e.key}`);
          handleFunctionKey(e.key);
        } else {
          console.log(`[DEBUG] Function key ${e.key} ignored - input field is focused`);
        }
        return;
      }
      
      // Handle other special keys globally
      if (['Escape'].includes(e.key)) {
        e.preventDefault();
        console.log(`[DEBUG] Global special key pressed: ${e.key}`);
        handleSpecialKey(e.key);
        return;
      }
    };

    document.addEventListener('wheel', handleWheel, { passive: false });
    document.addEventListener('keydown', handleKeyDown);
    
    return () => {
      document.removeEventListener('wheel', handleWheel);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, []);

  // Create 24x80 grid using absolute positioning for fields
  const createGrid = () => {
    console.log(`[DEBUG] Creating grid with ${screenData.length} fields using absolute positioning`);
    
    // Create the base 24x80 grid with empty cells
    const baseGrid = [];
    for (let row = 1; row <= 24; row++) {
      const rowData = [];
      for (let col = 1; col <= 80; col++) {
        rowData.push(
          <span key={`${row}-${col}`} className="grid-cell">
            &nbsp;
          </span>
        );
      }
      baseGrid.push(
        <div key={row} className="grid-row">
          {rowData}
        </div>
      );
    }

    // Separate input fields and display fields
    const inputFields = screenData.filter(field => field.isInputField);
    const displayFields = screenData.filter(field => !field.isInputField);
    
    // Find the first input field (leftmost, then topmost)
    const firstInputField = inputFields.sort((a, b) => {
      if (a.row !== b.row) return a.row - b.row;
      return a.col - b.col;
    })[0];

    // Create display field overlays
    const displayOverlays = displayFields.map((field, index) => {
      console.log(`[DEBUG] Creating display overlay for field at (${field.row}, ${field.col}): "${field.value}"`);
      
      const topPixels = (field.row - 1) * 21;
      const leftPixels = (field.col - 1) * 15;
      
      return (
        <div
          key={`display-${index}`}
          className="field-overlay"
          style={{
            position: 'absolute',
            top: `${topPixels}px`,
            left: `${leftPixels}px`,
            color: field.color || '#00FF00',
            whiteSpace: 'pre',
            fontFamily: '"Courier New", monospace',
            fontSize: '18px',
            lineHeight: '21px',
            pointerEvents: 'none'
          }}
        >
          {field.value}
        </div>
      );
    });

    // Create input field overlays
    const inputOverlays = inputFields.map((field, index) => {
      console.log(`[DEBUG] Creating input overlay for field at (${field.row}, ${field.col}), maxLength: ${field.maxLength}`);
      
      const topPixels = (field.row - 1) * 21;
      const leftPixels = (field.col - 1) * 15;
      const fieldKey = `${field.row}-${field.col}`;
      const widthPixels = (field.maxLength || 10) * 15; // 15px per character
      
      const isFirstInput = firstInputField && 
        field.row === firstInputField.row && 
        field.col === firstInputField.col;
      
      // Calculate tab index based on row and column position
      const tabIndex = (field.row - 1) * 100 + field.col;
      
      return (
        <input
          key={`input-${index}`}
          ref={isFirstInput ? firstInputRef : null}
          type="text"
          className="input-field"
          style={{
            position: 'absolute',
            top: `${topPixels}px`,
            left: `${leftPixels}px`,
            width: `${widthPixels}px`,
            height: '21px',
            color: field.color || '#00FF00',
            backgroundColor: 'transparent',
            border: 'none',
            outline: 'none',
            fontFamily: '"Courier New", monospace',
            fontSize: '18px',
            lineHeight: '21px',
            padding: 0,
            margin: 0
          }}
          value={inputValues[fieldKey] || ''}
          onChange={(e) => handleInputChange(fieldKey, e.target.value, field.maxLength || 10)}
          onKeyDown={handleInputKeyDown}
          maxLength={field.maxLength || 10}
          disabled={loginAttempting}
          tabIndex={tabIndex}
        />
      );
    });

    return (
      <div className="grid-container">
        <div className="base-grid">
          {baseGrid}
        </div>
        <div className="field-overlays">
          {displayOverlays}
          {inputOverlays}
        </div>
      </div>
    );
  };

  return (
    <div className="map-container">
      <div className="zoom-indicator">
        Zoom: {Math.round(zoomLevel * 100)}%
      </div>
      
      {userSession.authenticated && (
        <div className="session-indicator">
          User: {userSession.user_id} | Program: {userSession.program}
        </div>
      )}
      
      {loading && (
        <div className="loading-indicator">
          Loading OpenASP SMED MAP...
        </div>
      )}
      
      {loginAttempting && (
        <div className="loading-indicator">
          Authenticating...
        </div>
      )}
      
      {error && (
        <div className="error-indicator">
          Error: {error}
        </div>
      )}
      
      <div 
        className="terminal-grid"
        style={{
          transform: `scale(${zoomLevel})`,
          transformOrigin: 'center center'
        }}
      >
        {createGrid()}
      </div>
      <div className="zoom-help">
        Mouse wheel or Ctrl + +/- to zoom | Ctrl + 0 to reset
        {!userSession.authenticated && " | Enter to login"}
      </div>
    </div>
  );
};

export default MapLayout;
