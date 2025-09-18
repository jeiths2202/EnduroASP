/**
 * WebSocket Service for OpenASP Terminal Communication
 * Handles MSGSAMPLEBROWSERMENU and other terminal events
 */

export interface EmployeeRecord {
  id: string;
  name: string;
  dept: string;
  salary: string;
  hire_date: string;
  status: string;
}

export interface SMEDMapData {
  type: 'smed_map';
  map_name: string;
  title: string;
  subtitle: string;
  headers: string[];
  page_info: {
    current: number;
    total: number;
  };
  function_keys: string;
  status: string;
  data: EmployeeRecord[];
}

export interface TerminalMessage {
  type: 'terminal_output' | 'smed_map' | 'error' | 'status';
  data: any;
  timestamp?: string;
}

export interface WebSocketEventHandlers {
  onTerminalOutput?: (data: string) => void;
  onSMEDMap?: (data: SMEDMapData) => void;
  onError?: (error: string) => void;
  onStatusUpdate?: (status: string) => void;
  onConnect?: () => void;
  onDisconnect?: () => void;
}

export class WebSocketService {
  private socket: any = null; // SocketIO client instance
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private reconnectDelay = 1000;
  private isConnecting = false;
  private terminalRegistered = false;
  private workstationInfo: { username: string; workstation: string; sessionId: string } | null = null;

  constructor(private url: string) {
    // Import socket.io-client dynamically if available
    this.checkSocketIOAvailability();
  }

  private checkSocketIOAvailability(): void {
    // Check if socket.io-client is available
    if (typeof window !== 'undefined') {
      const socketIO = (window as any).io;
      if (!socketIO) {
        console.warn('Socket.IO client not found. Using fallback WebSocket implementation.');
        console.warn('Please include socket.io-client library for full compatibility.');
      }
    }
  }

  public connect(handlers: WebSocketEventHandlers, workstationInfo?: { username: string; workstation: string; sessionId: string }): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already connected
      if (this.isConnected()) {
        console.log('[WEBSOCKET] Already connected, skipping connection attempt');
        resolve();
        return;
      }

      // Check if connection is in progress
      if (this.isConnecting) {
        console.log('[WEBSOCKET] Connection already in progress, rejecting duplicate attempt');
        reject(new Error('Connection already in progress'));
        return;
      }

      this.isConnecting = true;
      this.handlers = handlers;
      this.workstationInfo = workstationInfo || null;

      console.log('[WEBSOCKET] Attempting to connect to server:', this.url);
      console.log('[WEBSOCKET] Workstation info:', this.workstationInfo);

      try {
        // Try Socket.IO first if available
        if (typeof window !== 'undefined' && (window as any).io) {
          this.connectWithSocketIO(resolve, reject);
        } else {
          // Fallback to native WebSocket
          console.warn('[WEBSOCKET] Socket.IO not available, falling back to native WebSocket');
          this.connectWithNativeWebSocket(resolve, reject);
        }
      } catch (error) {
        this.isConnecting = false;
        console.error('[WEBSOCKET] Connection attempt failed:', error);
        reject(error);
      }
    });
  }

  private connectWithSocketIO(resolve: () => void, reject: (error: Error) => void): void {
    const io = (window as any).io;
    
    // Extract server URL for Socket.IO (remove ws:// prefix if present)
    const serverUrl = this.url.replace('ws://', 'http://').replace('wss://', 'https://');
    
    console.log('[WEBSOCKET] Connecting with Socket.IO to:', serverUrl);
    
    this.socket = io(serverUrl, {
      transports: ['websocket', 'polling'],
      autoConnect: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: this.reconnectDelay
    });

    this.socket.on('connect', () => {
      console.log('[WEBSOCKET] Socket.IO connected successfully');
      console.log('[WEBSOCKET] Session ID:', this.socket.id);
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      // Register terminal after connection
      if (this.workstationInfo) {
        console.log('[WEBSOCKET] Registering terminal with workstation info:', this.workstationInfo);
        
        this.registerTerminalWithSocketIO()
          .then(() => {
            console.log('[WEBSOCKET] Terminal registration completed successfully');
            this.handlers.onConnect?.();
            resolve();
          })
          .catch((error) => {
            console.error('[WEBSOCKET] Terminal registration failed:', error);
            this.handlers.onError?.(`Terminal registration failed: ${error.message}`);
            reject(error);
          });
      } else {
        console.log('[WEBSOCKET] No workstation info provided, skipping terminal registration');
        this.handlers.onConnect?.();
        resolve();
      }
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log('[WEBSOCKET] Socket.IO disconnected:', reason);
      this.isConnecting = false;
      this.terminalRegistered = false;
      this.handlers.onDisconnect?.();
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error('[WEBSOCKET] Socket.IO connection error:', error);
      this.isConnecting = false;
      this.handlers.onError?.('Socket.IO connection error');
      reject(error);
    });

    // Handle SMED display messages
    this.socket.on('smed_display', (data: any) => {
      console.log('[WEBSOCKET] Received SMED display data:', data);
      this.handleSMEDDisplay(data);
    });

    // Handle terminal registration response
    this.socket.on('terminal_registered', (data: any) => {
      console.log('[WEBSOCKET] Terminal registered response:', data);
      this.terminalRegistered = true;
    });

    this.socket.on('registration_response', (data: any) => {
      console.log('[WEBSOCKET] Registration response:', data);
      if (data.data?.success) {
        this.terminalRegistered = true;
      }
    });

    // Handle other messages
    this.socket.onAny((eventName: string, ...args: any[]) => {
      console.log(`[WEBSOCKET] Received event: ${eventName}`, args);
    });
  }

  private connectWithNativeWebSocket(resolve: () => void, reject: (error: Error) => void): void {
    console.log('[WEBSOCKET] Connecting with native WebSocket');
    
    // For native WebSocket, we need to handle the protocol mismatch
    // This is a fallback that may not work perfectly with SocketIO server
    const ws = new WebSocket(this.url);

    ws.onopen = () => {
      console.log('[WEBSOCKET] Native WebSocket connected (limited compatibility)');
      console.warn('[WEBSOCKET] Native WebSocket may not be fully compatible with SocketIO server');
      this.socket = ws; // Store as socket for compatibility
      this.isConnecting = false;
      this.reconnectAttempts = 0;
      
      this.handlers.onConnect?.();
      resolve();
    };

    ws.onmessage = (event) => {
      this.handleMessage(event.data);
    };

    ws.onerror = (error) => {
      console.error('[WEBSOCKET] Native WebSocket error:', error);
      this.isConnecting = false;
      this.handlers.onError?.('Native WebSocket connection error');
      reject(new Error('Native WebSocket connection error'));
    };

    ws.onclose = (event) => {
      console.log('[WEBSOCKET] Native WebSocket disconnected:', event.code, event.reason);
      this.isConnecting = false;
      this.terminalRegistered = false;
      this.handlers.onDisconnect?.();
      
      if (!event.wasClean && this.reconnectAttempts < this.maxReconnectAttempts) {
        this.scheduleReconnect();
      }
    };

    this.socket = ws;
  }

  private handleMessage(rawData: string): void {
    try {
      // Try to parse as JSON first
      const message: TerminalMessage = JSON.parse(rawData);
      
      switch (message.type) {
        case 'smed_map':
          if (this.isValidSMEDMapData(message.data)) {
            this.handlers.onSMEDMap?.(message.data as SMEDMapData);
          } else {
            console.warn('Invalid SMED map data received:', message.data);
            this.handlers.onError?.('Invalid SMED map data format');
          }
          break;
          
        case 'terminal_output':
          this.handlers.onTerminalOutput?.(message.data);
          break;
          
        case 'error':
          this.handlers.onError?.(message.data);
          break;
          
        case 'status':
          this.handlers.onStatusUpdate?.(message.data);
          break;
          
        default:
          console.warn('Unknown message type:', message.type);
          // Treat as regular terminal output
          this.handlers.onTerminalOutput?.(rawData);
      }
    } catch (error) {
      // Try to parse as OpenASP JSON response (from Java programs)
      try {
        const openAspResponse = JSON.parse(rawData);
        if (this.isOpenAspDisplayMapResponse(openAspResponse)) {
          const smedData = this.convertOpenAspToSMEDMap(openAspResponse);
          this.handlers.onSMEDMap?.(smedData);
          return;
        }
      } catch (parseError) {
        // Ignore second parse error
      }
      
      // If not JSON, treat as regular terminal output
      this.handlers.onTerminalOutput?.(rawData);
    }
  }

  private isValidSMEDMapData(data: any): boolean {
    return (
      data &&
      typeof data.type === 'string' &&
      typeof data.map_name === 'string' &&
      typeof data.title === 'string' &&
      Array.isArray(data.headers) &&
      Array.isArray(data.data) &&
      data.page_info &&
      typeof data.page_info.current === 'number' &&
      typeof data.page_info.total === 'number'
    );
  }

  private isOpenAspDisplayMapResponse(data: any): boolean {
    return (
      data &&
      data.action === 'display_map' &&
      typeof data.map_file === 'string' &&
      data.fields &&
      typeof data.fields === 'object'
    );
  }

  private convertOpenAspToSMEDMap(openAspData: any): SMEDMapData {
    const fields = openAspData.fields;
    const pageInfo = openAspData.page_info || { current: 1, total: 1, total_records: 0 };
    
    // Extract employee data from fields
    const employeeData: any[] = [];
    const recordsPerPage = 10;
    
    for (let i = 1; i <= recordsPerPage; i++) {
      const empId = fields[`EMP${i}_ID`];
      const empName = fields[`EMP${i}_NAME`];
      const empDept = fields[`EMP${i}_DEPT`];
      const empSalary = fields[`EMP${i}_SALARY`];
      const empHireDate = fields[`EMP${i}_HIREDATE`];
      const empStatus = fields[`EMP${i}_STATUS`];
      
      // Only add non-empty records
      if (empId && empId.trim()) {
        employeeData.push({
          id: empId.trim(),
          name: empName?.trim() || '',
          dept: empDept?.trim() || '',
          salary: empSalary?.trim() || '',
          hire_date: empHireDate?.trim() || '',
          status: empStatus?.trim() || ''
        });
      }
    }
    
    return {
      type: 'employee_browser' as any,
      map_name: openAspData.map_file || 'BROWSE_MENU',
      title: 'Employee Data Browser',
      subtitle: 'OpenASP Browser',
      headers: ['ID', 'Name', 'Department', 'Salary', 'Hire Date', 'Status'],
      data: employeeData,
      page_info: {
        current: pageInfo.current || 1,
        total: pageInfo.total || 1,
        total_records: pageInfo.total_records || employeeData.length,
        records_per_page: pageInfo.records_per_page || 10
      } as any,
      messages: openAspData.messages || [],
      function_keys: openAspData.function_keys || {},
      status: `Page ${pageInfo.current || 1} of ${pageInfo.total || 1}`
    } as SMEDMapData;
  }

  private async registerTerminalWithSocketIO(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket || !this.socket.connected) {
        const error = new Error('Socket.IO not connected for terminal registration');
        console.error('[WEBSOCKET] Terminal registration failed:', error.message);
        reject(error);
        return;
      }

      if (!this.workstationInfo) {
        const error = new Error('Workstation information not provided for terminal registration');
        console.error('[WEBSOCKET] Terminal registration failed:', error.message);
        reject(error);
        return;
      }

      const registrationData = {
        terminal_id: this.workstationInfo.workstation,
        user: this.workstationInfo.username,
        username: this.workstationInfo.username,
        workstation: this.workstationInfo.workstation,
        sessionId: this.workstationInfo.sessionId,
        timestamp: new Date().toISOString()
      };

      console.log('[WEBSOCKET] Sending terminal registration with data:', registrationData);

      // Set up a timeout for registration response
      const timeout = setTimeout(() => {
        console.error('[WEBSOCKET] Terminal registration timeout');
        reject(new Error('Terminal registration timeout'));
      }, 10000); // 10 second timeout

      // Listen for registration confirmation
      const onRegistered = (data: any) => {
        console.log('[WEBSOCKET] Registration confirmed:', data);
        clearTimeout(timeout);
        this.socket.off('terminal_registered', onRegistered);
        this.socket.off('registration_response', onRegistrationResponse);
        this.terminalRegistered = true;
        resolve();
      };

      const onRegistrationResponse = (data: any) => {
        console.log('[WEBSOCKET] Registration response received:', data);
        if (data.data?.success || data.success) {
          clearTimeout(timeout);
          this.socket.off('terminal_registered', onRegistered);
          this.socket.off('registration_response', onRegistrationResponse);
          this.terminalRegistered = true;
          resolve();
        } else {
          clearTimeout(timeout);
          this.socket.off('terminal_registered', onRegistered);
          this.socket.off('registration_response', onRegistrationResponse);
          reject(new Error(data.data?.message || data.message || 'Registration failed'));
        }
      };

      // Set up listeners
      this.socket.on('terminal_registered', onRegistered);
      this.socket.on('registration_response', onRegistrationResponse);

      // Send registration message
      try {
        this.socket.emit('register_terminal', registrationData);
        console.log('[WEBSOCKET] Terminal registration request sent');
      } catch (sendError) {
        clearTimeout(timeout);
        this.socket.off('terminal_registered', onRegistered);
        this.socket.off('registration_response', onRegistrationResponse);
        console.error('[WEBSOCKET] Failed to send terminal registration:', sendError);
        reject(new Error(`Failed to send registration message: ${sendError}`));
      }
    });
  }

  private async registerTerminal(): Promise<void> {
    // Legacy method for native WebSocket compatibility
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('Socket not connected'));
        return;
      }

      // Check if it's a SocketIO connection
      if (this.socket.emit && typeof this.socket.emit === 'function') {
        this.registerTerminalWithSocketIO().then(resolve).catch(reject);
        return;
      }

      // Native WebSocket fallback (limited compatibility)
      if (!this.workstationInfo) {
        reject(new Error('Workstation information not provided'));
        return;
      }

      const registrationMessage = {
        type: 'register_terminal',
        data: {
          username: this.workstationInfo.username,
          workstation: this.workstationInfo.workstation,
          sessionId: this.workstationInfo.sessionId,
          timestamp: new Date().toISOString()
        }
      };

      try {
        (this.socket as WebSocket).send(JSON.stringify(registrationMessage));
        console.log('[WEBSOCKET] Native WebSocket registration sent (limited compatibility)');
        // For native WebSocket, we'll assume success since SocketIO server may not respond properly
        setTimeout(() => {
          console.warn('[WEBSOCKET] Native WebSocket registration assumed successful (no confirmation)');
          this.terminalRegistered = true;
          resolve();
        }, 1000);
      } catch (error) {
        reject(error);
      }
    });
  }

  private handleSMEDDisplay(data: any): void {
    console.log('[WEBSOCKET] Handling SMED display data:', data);
    
    try {
      // Convert to the expected format
      if (this.isOpenAspDisplayMapResponse(data)) {
        const smedData = this.convertOpenAspToSMEDMap(data);
        console.log('[WEBSOCKET] Converted to SMED map data:', smedData);
        this.handlers.onSMEDMap?.(smedData);
      } else if (this.isValidSMEDMapData(data)) {
        console.log('[WEBSOCKET] Valid SMED map data received');
        this.handlers.onSMEDMap?.(data as SMEDMapData);
      } else {
        console.warn('[WEBSOCKET] Invalid SMED display data format:', data);
        // Try to handle as generic terminal output
        this.handlers.onTerminalOutput?.(JSON.stringify(data));
      }
    } catch (error) {
      console.error('[WEBSOCKET] Error handling SMED display:', error);
      this.handlers.onError?.(`SMED display error: ${error}`);
    }
  }

  private scheduleReconnect(): void {
    this.reconnectAttempts++;
    const delay = this.reconnectDelay * Math.pow(2, this.reconnectAttempts - 1);
    
    console.log(`Scheduling reconnect attempt ${this.reconnectAttempts} in ${delay}ms`);
    
    setTimeout(() => {
      if (this.handlers.onConnect) {
        this.connect(this.handlers, this.workstationInfo || undefined).catch(() => {
          // Reconnection failed, will try again if under limit
        });
      }
    }, delay);
  }

  public sendCommand(command: string): void {
    if (!this.isConnected()) {
      console.warn('[WEBSOCKET] Not connected, cannot send command:', command);
      this.handlers.onError?.('WebSocket not connected');
      return;
    }

    if (!this.terminalRegistered) {
      console.warn('[WEBSOCKET] Terminal not registered, cannot send command:', command);
      this.handlers.onError?.('Terminal not registered with server');
      return;
    }

    const message = {
      type: 'command',
      data: command,
      workstation: this.workstationInfo?.workstation,
      sessionId: this.workstationInfo?.sessionId,
      timestamp: new Date().toISOString()
    };

    try {
      if (this.socket.emit && typeof this.socket.emit === 'function') {
        // Socket.IO
        this.socket.emit('command', message);
        console.log('[WEBSOCKET] Sent Socket.IO command:', message);
      } else {
        // Native WebSocket
        (this.socket as WebSocket).send(JSON.stringify(message));
        console.log('[WEBSOCKET] Sent native WebSocket command:', message);
      }
    } catch (error) {
      console.error('[WEBSOCKET] Failed to send command:', error);
      this.handlers.onError?.(`Failed to send command: ${error}`);
    }
  }

  public sendMSGSampleBrowserMenuCommand(): void {
    if (!this.isConnected()) {
      console.warn('WebSocket not connected, cannot send MSGSAMPLEBROWSERMENU command');
      this.handlers.onError?.('WebSocket not connected');
      return;
    }

    if (!this.terminalRegistered) {
      console.warn('Terminal not registered, cannot send MSGSAMPLEBROWSERMENU command');
      this.handlers.onError?.('Terminal not registered with server');
      return;
    }

    // Try both WebSocket and HTTP API approaches
    this.sendCommand('CALL MSGSAMPLEBROWSERMENU');
    
    // Also try HTTP API if available
    this.trySendViaHttpApi('MSGSAMPLEBROWSERMENU');
  }

  private async trySendViaHttpApi(command: string): Promise<void> {
    if (!this.workstationInfo) return;

    try {
      // Extract port from WebSocket URL and try HTTP API
      const wsUrl = new URL(this.url);
      const httpUrl = `http://${wsUrl.hostname}:3006/api/smed/send/`;
      
      const response = await fetch(httpUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command: command,
          workstation: this.workstationInfo.workstation,
          username: this.workstationInfo.username,
          sessionId: this.workstationInfo.sessionId,
          timestamp: new Date().toISOString()
        })
      });

      if (response.ok) {
        const result = await response.json();
        console.log('HTTP API response:', result);
        this.handlers.onStatusUpdate?.('Command sent via HTTP API');
      } else {
        console.warn('HTTP API request failed:', response.status, response.statusText);
      }
    } catch (error) {
      console.warn('HTTP API not available:', error);
      // This is not a critical error, WebSocket should handle the command
    }
  }

  public disconnect(): void {
    console.log('[WEBSOCKET] Disconnecting WebSocket service...');
    
    if (this.socket) {
      try {
        if (this.socket.disconnect && typeof this.socket.disconnect === 'function') {
          // Socket.IO
          this.socket.disconnect();
          console.log('[WEBSOCKET] Socket.IO disconnected');
        } else if (this.socket.close && typeof this.socket.close === 'function') {
          // Native WebSocket
          this.socket.close(1000, 'Client disconnect');
          console.log('[WEBSOCKET] Native WebSocket disconnected');
        }
      } catch (error) {
        console.error('[WEBSOCKET] Error during disconnect:', error);
      }
      
      this.socket = null;
    }
    
    // Reset all state
    this.handlers = {};
    this.reconnectAttempts = 0;
    this.terminalRegistered = false;
    this.isConnecting = false;
    this.workstationInfo = null;
    
    console.log('[WEBSOCKET] WebSocket service disconnected and cleaned up');
  }

  public isConnected(): boolean {
    if (this.socket && this.socket.connected !== undefined) {
      // Socket.IO connection
      return this.socket.connected;
    } else if (this.socket && this.socket.readyState !== undefined) {
      // Native WebSocket connection
      return this.socket.readyState === WebSocket.OPEN;
    }
    return false;
  }

  public isTerminalRegistered(): boolean {
    return this.terminalRegistered && this.isConnected();
  }

  public getConnectionState(): string {
    if (!this.socket) return 'DISCONNECTED';
    
    // Check if it's Socket.IO
    if (this.socket.connected !== undefined) {
      return this.socket.connected ? 'CONNECTED' : 'DISCONNECTED';
    }
    
    // Native WebSocket
    if (this.socket.readyState !== undefined) {
      switch (this.socket.readyState) {
        case WebSocket.CONNECTING: return 'CONNECTING';
        case WebSocket.OPEN: return 'CONNECTED';
        case WebSocket.CLOSING: return 'CLOSING';
        case WebSocket.CLOSED: return 'DISCONNECTED';
        default: return 'UNKNOWN';
      }
    }
    
    return 'UNKNOWN';
  }
}

export default WebSocketService;