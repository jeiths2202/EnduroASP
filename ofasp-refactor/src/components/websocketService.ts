import { io, Socket } from 'socket.io-client';

// Simplified interfaces for Hub architecture
interface SmedDataDirectEvent {
  action: 'smed_data_direct';
  hub_version: string;
  data_flow_type: 'direct_hub';
  map_file: string;
  fields: any;
  program_name?: string;
  session_id?: string;
  metadata: {
    timestamp: string;
    source: 'websocket_hub';
    terminal_id?: string;
    wsname?: string;
  };
}

class WebSocketService {
  private socket: Socket | null = null;
  private listeners: Map<string, Set<Function>> = new Map();
  private connected: boolean = false;
  private terminalId: string = 'webui';
  private sessionId: string | null = null;
  private wsname: string = 'WSNAME00';
  private user: string = 'unknown';
  private reconnectAttempts: number = 0;
  private maxReconnectAttempts: number = 5;
  private reconnectDelay: number = 1000;
  private maxReconnectDelay: number = 10000;
  private connectionHealth: boolean = true;
  private heartbeatInterval: NodeJS.Timeout | null = null;
  private duplicateFilter: Set<string> = new Set();
  private filterCleanupInterval: NodeJS.Timeout | null = null;

  connect(apiUrl: string = 'http://localhost:8000') {
    if (this.socket?.connected) {
      console.log('[WebSocket Hub] Already connected');
      return;
    }

    console.log('[WebSocket Hub] Connecting to Hub server:', apiUrl);
    
    const currentDelay = Math.min(
      this.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.maxReconnectDelay
    );
    
    this.socket = io(apiUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: currentDelay,
      timeout: 5000,
      forceNew: true,
    });

    this.setupHubEventHandlers();
    this.startHeartbeat();
    this.startDuplicateFilterCleanup();
  }

  private startHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('ping');
        this.connectionHealth = true;
      }
    }, 15000); // 15초마다 heartbeat - Hub는 더 빠른 연결 확인
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private startDuplicateFilterCleanup() {
    if (this.filterCleanupInterval) {
      clearInterval(this.filterCleanupInterval);
    }
    
    // 중복 필터 정리 - 30초마다 오래된 해시 제거
    this.filterCleanupInterval = setInterval(() => {
      if (this.duplicateFilter.size > 50) {
        console.log('[WebSocket Hub] Cleaning up duplicate filter');
        this.duplicateFilter.clear();
      }
    }, 30000);
  }

  private stopDuplicateFilterCleanup() {
    if (this.filterCleanupInterval) {
      clearInterval(this.filterCleanupInterval);
      this.filterCleanupInterval = null;
    }
  }

  private setupHubEventHandlers() {
    if (!this.socket) return;

    console.log('[WebSocket Hub] Setting up Hub event handlers');

    this.socket.on('connect', () => {
      console.log('[WebSocket Hub] Connected to Hub');
      this.connected = true;
      this.reconnectAttempts = 0;
      this.connectionHealth = true;
      this.emit('hub_connected', { connected: true, hub_version: 'v2.0' });
    });

    this.socket.on('disconnect', (reason) => {
      console.log('[WebSocket Hub] Disconnected from Hub:', reason);
      this.connected = false;
      this.connectionHealth = false;
      this.stopHeartbeat();
      this.stopDuplicateFilterCleanup();
      this.emit('hub_disconnected', { connected: false, reason });
    });

    this.socket.on('connect_error', (error) => {
      console.error('[WebSocket Hub] Connection error:', error);
      this.reconnectAttempts++;
      this.connectionHealth = false;
      this.emit('hub_connection_error', { error, attempts: this.reconnectAttempts });
    });

    this.socket.on('pong', () => {
      this.connectionHealth = true;
    });

    // 핵심 이벤트: smed_data_direct와 smed_data_received 모두 처리
    this.socket.on('smed_data_direct', (data: SmedDataDirectEvent) => {
      this.handleSmedDataDirect(data);
    });
    
    // API server에서 보내는 smed_display 이벤트 처리 (서버에서 실제로 전송하는 이벤트)
    this.socket.on('smed_display', (data: any) => {
      console.log('[DEBUG] WebSocket Hub: smed_display event triggered');
      console.log('[DEBUG] WebSocket Hub: Raw data from API server:', JSON.stringify(data, null, 2));
      
      // 서버에서 받은 형식을 smed_data_direct 형식으로 변환
      const convertedData: SmedDataDirectEvent = {
        action: 'smed_data_direct' as const,
        hub_version: data.hub_version || 'v2.0',
        data_flow_type: 'direct_hub' as const,
        map_file: data.map_file || 'MAIN001',
        fields: data, // 전체 데이터를 fields로 전달
        program_name: data.program_name || 'MAIN001',
        session_id: data.session_id || `hub_session_${Date.now()}`,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'websocket_hub',
          terminal_id: data.terminal_id,
          wsname: this.wsname
        }
      };
      
      console.log('[DEBUG] WebSocket Hub: Converted smed_display data:', JSON.stringify(convertedData, null, 2));
      this.handleSmedDataDirect(convertedData);
    });

    // API server에서 보내는 smed_data_received 이벤트도 처리
    this.socket.on('smed_data_received', (data: any) => {
      console.log('[DEBUG] WebSocket Hub: smed_data_received event triggered');
      console.log('[DEBUG] WebSocket Hub: Raw data from API server:', JSON.stringify(data, null, 2));
      console.log('[DEBUG] WebSocket Hub: Data type:', typeof data);
      console.log('[DEBUG] WebSocket Hub: Data keys:', data ? Object.keys(data) : 'data is null');
      
      // smed_data_direct 형식으로 변환하여 처리 - 원본 데이터 구조 보존
      const convertedData: SmedDataDirectEvent = {
        action: 'smed_data_direct' as const,
        hub_version: 'v2.0',
        data_flow_type: 'direct_hub' as const,
        map_file: data.map_name || 'BROWSE_MENU',
        fields: data, // 전체 데이터를 fields로 전달하되 원본 구조 유지
        program_name: data.program_name,
        session_id: data.session_id || `hub_session_${Date.now()}`,
        metadata: {
          timestamp: new Date().toISOString(),
          source: 'websocket_hub',
          terminal_id: data.terminal_id,
          wsname: this.wsname
        }
      };
      
      // 원본 데이터의 type과 data 필드를 fields에도 복사
      if (data.type) {
        convertedData.fields.type = data.type;
        console.log('[DEBUG] WebSocket Hub: Added data.type to convertedData.fields:', data.type);
      }
      if (data.data) {
        convertedData.fields.data = data.data;
        console.log('[DEBUG] WebSocket Hub: Added data.data to convertedData.fields:', JSON.stringify(data.data, null, 2));
      }
      
      console.log('[DEBUG] WebSocket Hub: Converted data structure:', JSON.stringify(convertedData, null, 2));
      this.handleSmedDataDirect(convertedData);
    });
    
    // Command confirmation 이벤트 처리
    this.socket.on('command_confirmation', (data: any) => {
      console.log('[WebSocket Hub] Command confirmation received:', data);
      this.emit('command_confirmation', data);
    });

    // Hub 등록 확인 이벤트
    this.socket.on('hub_registered', (data: any) => {
      console.log('[WebSocket Hub] Registration confirmed:', data);
      this.sessionId = data.session_id;
      this.emit('hub_registered', data);
    });

    this.socket.on('hub_registration_error', (data: any) => {
      console.error('[WebSocket Hub] Registration error:', data);
      this.emit('hub_registration_error', data);
    });

    // Hub 키 이벤트 응답
    this.socket.on('hub_key_event_response', (data: any) => {
      console.log('[WebSocket Hub] Key event response:', data);
      this.emit('hub_key_event_response', data);
    });

    this.socket.on('hub_key_event_error', (data: any) => {
      console.error('[WebSocket Hub] Key event error:', data);
      this.emit('hub_key_event_error', data);
    });

    // Hub 메뉴 선택 응답
    this.socket.on('hub_menu_selection_response', (data: any) => {
      console.log('[WebSocket Hub] Menu selection response:', data);
      this.emit('hub_menu_selection_response', data);
    });

    this.socket.on('hub_menu_selection_error', (data: any) => {
      console.error('[WebSocket Hub] Menu selection error:', data);
      this.emit('hub_menu_selection_error', data);
    });

    // Hub 상태 이벤트
    this.socket.on('hub_status', (data: any) => {
      console.log('[WebSocket Hub] Hub status:', data);
      this.emit('hub_status', data);
    });

    this.socket.on('error', (error: any) => {
      console.error('[WebSocket Hub] Error:', error);
      this.emit('hub_error', error);
    });
  }

  private handleSmedDataDirect(data: SmedDataDirectEvent) {
    try {
      console.log('[DEBUG] WebSocket Hub: handleSmedDataDirect called - START');
      console.log('[DEBUG] WebSocket Hub: SMED data direct received:', {
        action: data.action,
        hub_version: data.hub_version,
        data_flow_type: data.data_flow_type,
        map_file: data.map_file,
        fields_count: Array.isArray(data.fields) ? data.fields.length : Object.keys(data.fields || {}).length,
        metadata: data.metadata
      });
      console.log('[DEBUG] WebSocket Hub: Full data structure:', JSON.stringify(data, null, 2));

      // 중복 검사 - Hub 레벨에서 처리되지만 클라이언트에서도 추가 방어
      const dataHash = JSON.stringify({
        map_file: data.map_file,
        timestamp: data.metadata.timestamp,
        session_id: data.session_id
      });

      if (this.duplicateFilter.has(dataHash)) {
        console.log('[DEBUG] WebSocket Hub: Duplicate data detected, skipping');
        return;
      }

      this.duplicateFilter.add(dataHash);
      console.log('[DEBUG] WebSocket Hub: Data hash added to duplicate filter:', dataHash);

      // Hub 버전 및 데이터 플로우 검증
      if (data.hub_version && data.data_flow_type === 'direct_hub') {
        console.log('[DEBUG] WebSocket Hub: Valid Hub data, processing...');
        
        // 단순화된 SMED 이벤트로 전달
        const emitData = {
          map_file: data.map_file,
          fields: data.fields,
          program_name: data.program_name,
          session_id: data.session_id,
          hub_metadata: data.metadata,
          processed_at: new Date().toISOString()
        };
        
        console.log('[DEBUG] WebSocket Hub: About to emit smed_data_received with data:', JSON.stringify(emitData, null, 2));
        console.log('[DEBUG] WebSocket Hub: Current listeners for smed_data_received:', this.listeners.get('smed_data_received')?.size || 0);
        
        this.emit('smed_data_received', emitData);
        
        console.log('[DEBUG] WebSocket Hub: smed_data_received event emitted successfully');
      } else {
        console.warn('[DEBUG] WebSocket Hub: Invalid Hub data format:', data);
        console.warn('[DEBUG] WebSocket Hub: hub_version:', data.hub_version);
        console.warn('[DEBUG] WebSocket Hub: data_flow_type:', data.data_flow_type);
      }
      console.log('[DEBUG] WebSocket Hub: handleSmedDataDirect - END');
    } catch (error) {
      console.error('[DEBUG] WebSocket Hub: Error processing SMED data:', error);
      this.emit('hub_processing_error', { error, originalData: data });
    }
  }

  registerWithHub(terminalId: string, user: string, wsname: string = 'WSNAME00') {
    this.terminalId = terminalId;
    this.user = user;
    this.wsname = wsname;
    
    const attemptRegistration = () => {
      if (!this.socket?.connected) {
        console.warn('[WebSocket Hub] Not connected yet, will register after connection');
        return false;
      }

      console.log('[WebSocket Hub] Registering with Hub:', { terminalId, user, wsname });
      
      // Hub로 등록 요청 - 단순화된 형식
      this.socket.emit('hub_register', {
        terminal_id: terminalId,
        user: user,
        wsname: wsname,
        client_type: 'react_web_terminal',
        hub_version: 'v2.0'
      });

      return true;
    };

    // 즉시 등록 시도
    if (attemptRegistration()) {
      return true;
    }

    // 연결 대기 후 등록
    const registrationTimeout = setTimeout(() => {
      console.error('[WebSocket Hub] Registration timeout - connection not established');
    }, 5000);

    const handleConnection = () => {
      clearTimeout(registrationTimeout);
      this.socket?.off('connect', handleConnection);
      
      // 연결 후 즉시 등록
      setTimeout(() => attemptRegistration(), 100);
    };

    this.socket?.on('connect', handleConnection);
    return true;
  }

  sendKeyEventToHub(key: string, fieldValues: Record<string, string>) {
    if (!this.socket?.connected) {
      console.error('[WebSocket Hub] Cannot send key event - not connected to Hub');
      return false;
    }

    console.log('[WebSocket Hub] Sending key event via Hub:', { key, fieldCount: Object.keys(fieldValues).length });
    
    this.socket.emit('hub_key_event', {
      terminal_id: this.terminalId,
      user: this.user,
      wsname: this.wsname,
      key: key,
      field_values: fieldValues,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  sendCommandToHub(command: string) {
    if (!this.socket?.connected) {
      console.error('[DEBUG] WebSocket Hub: Cannot send command - not connected to Hub');
      return false;
    }

    console.log('[DEBUG] WebSocket Hub: Sending command via Hub:', command);
    
    const commandData = {
      command: command,
      terminal_id: this.terminalId,
      user: this.user,
      wsname: this.wsname,
      timestamp: new Date().toISOString()
    };
    
    console.log('[DEBUG] WebSocket Hub: Command data being sent:', JSON.stringify(commandData, null, 2));
    
    this.socket.emit('hub_command', commandData);
    
    console.log('[DEBUG] WebSocket Hub: hub_command event emitted successfully');
    return true;
  }

  // 단순화된 명령 전송 - Hub를 통해 처리 (완전한 CALL 형식 사용)
  sendMSGSampleBrowserCommand() {
    return this.sendCommandToHub('CALL PGM-MSGSAMPLEBROWSERMENUJSON.TESTLIB,VOL-DISK01');
  }

  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    const eventListeners = this.listeners.get(event)!;
    eventListeners.add(callback);
    
    console.log(`[WebSocket] Added listener for '${event}'. Total listeners: ${eventListeners.size}`);
  }

  off(event: string, callback?: Function) {
    if (!this.listeners.has(event)) {
      return;
    }
    
    const eventListeners = this.listeners.get(event)!;
    
    if (callback) {
      // Remove specific callback
      const removed = eventListeners.delete(callback);
      console.log(`[WebSocket] Removed specific listener for '${event}': ${removed}. Remaining: ${eventListeners.size}`);
    } else {
      // Remove all listeners for this event
      const count = eventListeners.size;
      eventListeners.clear();
      console.log(`[WebSocket] Cleared all ${count} listeners for '${event}'`);
    }
    
    // Clean up empty event listener sets
    if (eventListeners.size === 0) {
      this.listeners.delete(event);
    }
  }

  private emit(event: string, data: any) {
    if (this.listeners.has(event)) {
      this.listeners.get(event)!.forEach(callback => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} listener:`, error);
        }
      });
    }
  }

  disconnect() {
    console.log('[WebSocket] Disconnecting and cleaning up...');
    
    this.stopHeartbeat();
    
    if (this.socket) {
      // Remove all socket event listeners to prevent memory leaks
      this.socket.removeAllListeners();
      this.socket.disconnect();
      this.socket = null;
    }
    
    // Clear all application event listeners
    const totalListeners = Array.from(this.listeners.values()).reduce((sum, set) => sum + set.size, 0);
    console.log(`[WebSocket] Clearing ${totalListeners} application event listeners`);
    this.listeners.clear();
    
    // Reset connection state
    this.connected = false;
    this.sessionId = null;
    this.reconnectAttempts = 0;
    this.connectionHealth = true;
    
    console.log('[WebSocket] Cleanup completed');
  }

  getConnectionHealth(): boolean {
    return this.connectionHealth;
  }

  getReconnectAttempts(): number {
    return this.reconnectAttempts;
  }

  forceReconnect(apiUrl: string = 'http://localhost:8000') {
    console.log('Forcing WebSocket reconnection...');
    this.disconnect();
    setTimeout(() => {
      this.connect(apiUrl);
    }, 1000);
  }

  isConnected(): boolean {
    return this.connected;
  }

  isTerminalRegistered(): boolean {
    return this.connected && this.sessionId !== null;
  }

  getSessionId(): string | null {
    return this.sessionId;
  }

  getTerminalId(): string {
    return this.terminalId;
  }

  getWorkstationName(): string {
    return this.wsname;
  }

  getUser(): string {
    return this.user;
  }

  // Hub를 통한 상태 확인 - HTTP API 대신 Hub 사용
  requestHubStatus() {
    if (!this.socket?.connected) {
      console.error('[WebSocket Hub] Cannot request status - not connected to Hub');
      return false;
    }

    this.socket.emit('hub_status_request', {
      terminal_id: this.terminalId,
      user: this.user,
      wsname: this.wsname
    });

    return true;
  }

  // Hub를 통한 워크스테이션 등록
  registerWorkstationViaHub(wsname: string) {
    if (!this.socket?.connected) {
      console.error('[WebSocket Hub] Cannot register workstation - not connected to Hub');
      return false;
    }

    this.socket.emit('hub_workstation_register', {
      wsname: wsname,
      terminal_id: this.terminalId,
      user: this.user
    });

    return true;
  }

  // Hub 연결 상태 및 메타데이터 가져오기
  getHubConnectionInfo(): any {
    return {
      connected: this.connected,
      connectionHealth: this.connectionHealth,
      reconnectAttempts: this.reconnectAttempts,
      terminalId: this.terminalId,
      user: this.user,
      wsname: this.wsname,
      duplicateFilterSize: this.duplicateFilter.size,
      lastHeartbeat: this.heartbeatInterval ? 'active' : 'inactive'
    };
  }

  // =================================================================
  // BACKWARD COMPATIBILITY WRAPPER METHODS FOR EXISTING COMPONENTS
  // =================================================================

  // Wrapper for SMED data sending (Hub-based)
  sendSmedData(workstationName: string, smedData: any): boolean {
    if (!this.socket?.connected) {
      console.error('[WebSocket Hub] Cannot send SMED data - not connected to Hub');
      return false;
    }

    console.log('[WebSocket Hub] Sending SMED data via Hub:', { workstationName, smedData });
    
    this.socket.emit('hub_smed_data', {
      wsname: workstationName,
      terminal_id: this.terminalId,
      user: this.user,
      smed_data: smedData,
      timestamp: new Date().toISOString()
    });

    return true;
  }

  // Wrapper for workstation list (HTTP fallback + Hub integration)
  async listWorkstations(): Promise<{ workstations: any[] }> {
    try {
      // Try HTTP API first for workstation management
      const response = await fetch('http://localhost:8000/api/workstations', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        return { workstations: result.workstations || [] };
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebSocket Hub] Failed to list workstations via HTTP, trying Hub fallback:', error);
      
      // Hub fallback
      if (this.socket?.connected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Hub workstation list timeout'));
          }, 5000);

          const handleResponse = (data: any) => {
            clearTimeout(timeout);
            this.socket?.off('hub_workstation_list_response', handleResponse);
            resolve({ workstations: data.workstations || [] });
          };

          this.socket?.on('hub_workstation_list_response', handleResponse);
          this.socket?.emit('hub_workstation_list_request', {
            terminal_id: this.terminalId,
            user: this.user
          });
        });
      }

      throw new Error('Failed to list workstations: No connection available');
    }
  }

  // Wrapper for workstation status (HTTP fallback + Hub integration)
  async getWorkstationStatus(wsname: string): Promise<any> {
    try {
      // Try HTTP API first
      const response = await fetch(`http://localhost:8000/api/workstation/${wsname}/status`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        return result;
      } else if (response.status === 404) {
        throw new Error('404: Workstation not found');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebSocket Hub] Failed to get workstation status via HTTP, trying Hub fallback:', error);
      
      // Hub fallback
      if (this.socket?.connected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Hub workstation status timeout'));
          }, 5000);

          const handleResponse = (data: any) => {
            clearTimeout(timeout);
            this.socket?.off('hub_workstation_status_response', handleResponse);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.status);
            }
          };

          this.socket?.on('hub_workstation_status_response', handleResponse);
          this.socket?.emit('hub_workstation_status_request', {
            wsname: wsname,
            terminal_id: this.terminalId,
            user: this.user
          });
        });
      }

      throw error;
    }
  }

  // Simple workstation connection check (name only)
  async connectWorkstation(wsname: string): Promise<boolean> {
    try {
      console.log('[WebSocket Hub] Connecting to workstation:', wsname);
      // 단순히 workstation name이 유효한지만 확인
      if (wsname && wsname.length > 0) {
        return true;
      }
      return false;
    } catch (error) {
      console.error('[WebSocket Hub] Workstation connection failed:', error);
      return false;
    }
  }

  // New workstation login method using the enhanced API
  async loginWorkstation(wsname: string, userId: string = 'admin', password: string = 'admin123'): Promise<any> {
    try {
      const response = await fetch('http://localhost:8000/api/workstation/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsname: wsname,
          user_id: userId,
          password: password
        }),
      });

      if (response.ok) {
        const result = await response.json();
        console.log('[WebSocket Hub] Workstation login successful:', wsname);
        return result;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebSocket Hub] Workstation login failed:', error);
      throw error;
    }
  }

  // Wrapper for workstation registration (HTTP + Hub)
  async registerWorkstation(wsname: string, status: 'ON' | 'OFF'): Promise<void> {
    try {
      // Try HTTP API first
      const response = await fetch('http://localhost:8000/api/workstations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          wsname: wsname,
          status: status
        }),
      });

      if (response.ok) {
        console.log('[WebSocket Hub] Workstation registered via HTTP API:', wsname);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebSocket Hub] Failed to register workstation via HTTP, trying Hub fallback:', error);
      
      // Hub fallback
      if (this.socket?.connected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Hub workstation registration timeout'));
          }, 5000);

          const handleResponse = (data: any) => {
            clearTimeout(timeout);
            this.socket?.off('hub_workstation_register_response', handleResponse);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve();
            }
          };

          this.socket?.on('hub_workstation_register_response', handleResponse);
          this.socket?.emit('hub_workstation_register', {
            wsname: wsname,
            status: status,
            terminal_id: this.terminalId,
            user: this.user
          });
        });
      }

      throw new Error('Failed to register workstation: No connection available');
    }
  }

  // Wrapper for workstation status update (HTTP + Hub)
  async updateWorkstationStatus(wsname: string, status: 'ON' | 'OFF'): Promise<void> {
    try {
      // Try HTTP API first
      const response = await fetch(`http://localhost:8000/api/workstations/${wsname}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: status
        }),
      });

      if (response.ok) {
        console.log('[WebSocket Hub] Workstation status updated via HTTP API:', wsname, status);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      console.error('[WebSocket Hub] Failed to update workstation status via HTTP, trying Hub fallback:', error);
      
      // Hub fallback
      if (this.socket?.connected) {
        return new Promise((resolve, reject) => {
          const timeout = setTimeout(() => {
            reject(new Error('Hub workstation status update timeout'));
          }, 5000);

          const handleResponse = (data: any) => {
            clearTimeout(timeout);
            this.socket?.off('hub_workstation_status_update_response', handleResponse);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve();
            }
          };

          this.socket?.on('hub_workstation_status_update_response', handleResponse);
          this.socket?.emit('hub_workstation_status_update', {
            wsname: wsname,
            status: status,
            terminal_id: this.terminalId,
            user: this.user
          });
        });
      }

      throw new Error('Failed to update workstation status: No connection available');
    }
  }

  // Send menu selection to avoid creating new process
  sendMenuSelection(programName: string, selection: string): Promise<boolean> {
    if (!this.socket?.connected) {
      console.error('[WebSocket Hub] Cannot send menu selection - not connected to Hub');
      return Promise.resolve(false);
    }

    console.log('[WebSocket Hub] Sending menu selection via Hub:', { programName, selection });
    
    const menuData = {
      action: 'menu_selection',
      program_name: programName,
      selection: selection,
      terminal_id: this.terminalId,
      user: this.user,
      wsname: this.wsname,
      timestamp: new Date().toISOString()
    };
    
    console.log('[WebSocket Hub] Menu selection data being sent:', JSON.stringify(menuData, null, 2));
    
    this.socket.emit('hub_menu_selection', menuData);
    
    console.log('[WebSocket Hub] hub_menu_selection event emitted successfully');
    
    // Return a promise that resolves when response is received
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.socket?.off('hub_menu_selection_response', handleResponse);
        this.socket?.off('hub_menu_selection_error', handleError);
        reject(new Error('Menu selection timeout'));
      }, 10000); // 10 second timeout

      const handleResponse = (data: any) => {
        clearTimeout(timeout);
        this.socket?.off('hub_menu_selection_response', handleResponse);
        this.socket?.off('hub_menu_selection_error', handleError);
        console.log('[WebSocket Hub] Menu selection confirmed:', data);
        resolve(true);
      };

      const handleError = (data: any) => {
        clearTimeout(timeout);
        this.socket?.off('hub_menu_selection_response', handleResponse);
        this.socket?.off('hub_menu_selection_error', handleError);
        console.error('[WebSocket Hub] Menu selection error:', data);
        reject(new Error(data.error || 'Menu selection failed'));
      };

      this.socket?.on('hub_menu_selection_response', handleResponse);
      this.socket?.on('hub_menu_selection_error', handleError);
    });
  }

  // Wrapper for terminal registration (Hub-based)
  registerTerminal(terminalId: string, user: string, wsname: string): boolean {
    console.log('[WebSocket Hub] Terminal registration request (wrapper method):', { terminalId, user, wsname });
    return this.registerWithHub(terminalId, user, wsname);
  }
}

// Create singleton instance
const webSocketService = new WebSocketService();

export default webSocketService;