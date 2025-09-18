/**
 * WebSocket Connection Manager
 * WebSocket接続マネージャー
 * 
 * 使用方法:
 * const wsManager = new WebSocketManager(config);
 * wsManager.connect();
 * 
 * 機能:
 * - Automatic reconnection with exponential backoff
 * - Connection state management
 * - Message queue for offline scenarios
 */

interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  messageQueueSize?: number;
  heartbeatInterval?: number;
  enableLogging?: boolean;
}

interface WebSocketMessage {
  id: string;
  type: string;
  data: any;
  timestamp: Date;
  priority: 'high' | 'medium' | 'low';
}

interface ConnectionStats {
  connectionTime: Date | null;
  reconnectAttempts: number;
  messagesReceived: number;
  messagesSent: number;
  lastHeartbeat: Date | null;
  currentState: 'disconnected' | 'connecting' | 'connected' | 'error';
}

type WebSocketEventHandler = (data: any) => void;
type ConnectionStateHandler = (state: string, error?: Error) => void;

class WebSocketManager {
  private socket: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private messageQueue: WebSocketMessage[] = [];
  private eventHandlers: Map<string, WebSocketEventHandler[]> = new Map();
  private connectionStateHandlers: ConnectionStateHandler[] = [];
  private reconnectTimeoutId: NodeJS.Timeout | null = null;
  private heartbeatIntervalId: NodeJS.Timeout | null = null;
  private stats: ConnectionStats;

  // Configuration constants
  private static readonly DEFAULT_CONFIG = {
    protocols: [] as string[],
    reconnectInterval: 3000,
    maxReconnectAttempts: 10,
    messageQueueSize: 100,
    heartbeatInterval: 30000,
    enableLogging: process.env.NODE_ENV === 'development'
  };

  constructor(config: WebSocketConfig) {
    this.config = {
      ...WebSocketManager.DEFAULT_CONFIG,
      ...config
    };

    this.stats = {
      connectionTime: null,
      reconnectAttempts: 0,
      messagesReceived: 0,
      messagesSent: 0,
      lastHeartbeat: null,
      currentState: 'disconnected'
    };

    if (this.config.enableLogging) {
      console.debug('[WebSocketManager] Initialized for:', this.config.url);
    }
  }

  /**
   * WebSocket接続開始
   * Start WebSocket connection
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.updateConnectionState('connecting');

      try {
        this.socket = new WebSocket(this.config.url, this.config.protocols);
        this.setupEventListeners(resolve, reject);
      } catch (error) {
        this.handleConnectionError(error as Error);
        reject(error);
      }
    });
  }

  /**
   * WebSocket接続終了
   * Close WebSocket connection
   */
  disconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
      this.reconnectTimeoutId = null;
    }

    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
      this.heartbeatIntervalId = null;
    }

    if (this.socket) {
      this.socket.close(1000, 'Manual disconnect');
      this.socket = null;
    }

    this.updateConnectionState('disconnected');

    if (this.config.enableLogging) {
      console.debug('[WebSocketManager] Disconnected');
    }
  }

  /**
   * イベントハンドラー登録
   * Register event handler
   */
  on(eventType: string, handler: WebSocketEventHandler): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }
    
    this.eventHandlers.get(eventType)!.push(handler);

    if (this.config.enableLogging) {
      console.debug(`[WebSocketManager] Registered handler for: ${eventType}`);
    }

    // Return unsubscribe function
    return () => {
      const handlers = this.eventHandlers.get(eventType);
      if (handlers) {
        const index = handlers.indexOf(handler);
        if (index !== -1) {
          handlers.splice(index, 1);
        }
      }
    };
  }

  /**
   * 接続状態変更ハンドラー登録
   * Register connection state handler
   */
  onConnectionStateChange(handler: ConnectionStateHandler): () => void {
    this.connectionStateHandlers.push(handler);

    return () => {
      const index = this.connectionStateHandlers.indexOf(handler);
      if (index !== -1) {
        this.connectionStateHandlers.splice(index, 1);
      }
    };
  }

  /**
   * メッセージ送信
   * Send message
   */
  send(message: Omit<WebSocketMessage, 'id' | 'timestamp'>): boolean {
    const fullMessage: WebSocketMessage = {
      id: this.generateMessageId(),
      timestamp: new Date(),
      ...message
    };

    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      try {
        this.socket.send(JSON.stringify(fullMessage));
        this.stats.messagesSent++;
        
        if (this.config.enableLogging) {
          console.debug('[WebSocketManager] Sent message:', fullMessage.type);
        }
        
        return true;
      } catch (error) {
        console.error('[WebSocketManager] Send error:', error);
        this.queueMessage(fullMessage);
        return false;
      }
    } else {
      this.queueMessage(fullMessage);
      return false;
    }
  }

  /**
   * 接続状態取得
   * Get connection state
   */
  getConnectionState(): string {
    return this.stats.currentState;
  }

  /**
   * 統計情報取得
   * Get connection statistics
   */
  getStatistics(): ConnectionStats & {
    queuedMessages: number;
    registeredHandlers: number;
  } {
    return {
      ...this.stats,
      queuedMessages: this.messageQueue.length,
      registeredHandlers: Array.from(this.eventHandlers.values())
        .reduce((sum, handlers) => sum + handlers.length, 0)
    };
  }

  /**
   * イベントリスナー設定
   * Setup event listeners
   */
  private setupEventListeners(resolve: () => void, reject: (error: Error) => void): void {
    if (!this.socket) return;

    this.socket.onopen = () => {
      this.stats.connectionTime = new Date();
      this.stats.reconnectAttempts = 0;
      this.updateConnectionState('connected');
      this.startHeartbeat();
      this.processMessageQueue();
      
      if (this.config.enableLogging) {
        console.debug('[WebSocketManager] Connected successfully');
      }
      
      resolve();
    };

    this.socket.onmessage = (event) => {
      this.stats.messagesReceived++;
      this.stats.lastHeartbeat = new Date();
      
      try {
        const message = JSON.parse(event.data);
        this.handleMessage(message);
      } catch (error) {
        console.error('[WebSocketManager] Message parse error:', error);
      }
    };

    this.socket.onclose = (event) => {
      this.socket = null;
      
      if (event.code !== 1000) { // Not a normal closure
        this.handleConnectionError(new Error(`Connection closed: ${event.code} ${event.reason}`));
      } else {
        this.updateConnectionState('disconnected');
      }
    };

    this.socket.onerror = (error) => {
      const wsError = new Error(`WebSocket error: ${error}`);
      this.handleConnectionError(wsError);
      reject(wsError);
    };
  }

  /**
   * メッセージ処理
   * Handle incoming message
   */
  private handleMessage(message: any): void {
    const handlers = this.eventHandlers.get(message.type) || [];
    
    handlers.forEach(handler => {
      try {
        handler(message.data);
      } catch (error) {
        console.error(`[WebSocketManager] Handler error for ${message.type}:`, error);
      }
    });

    // Handle system messages
    if (message.type === 'heartbeat_response') {
      this.stats.lastHeartbeat = new Date();
    }
  }

  /**
   * 接続エラー処理
   * Handle connection error
   */
  private handleConnectionError(error: Error): void {
    this.updateConnectionState('error', error);
    
    if (this.stats.reconnectAttempts < this.config.maxReconnectAttempts) {
      this.scheduleReconnect();
    } else {
      console.error('[WebSocketManager] Max reconnect attempts reached');
    }
  }

  /**
   * 再接続スケジュール
   * Schedule reconnection
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeoutId) {
      clearTimeout(this.reconnectTimeoutId);
    }

    const delay = Math.min(
      this.config.reconnectInterval * Math.pow(2, this.stats.reconnectAttempts),
      30000 // Max 30 seconds
    );

    this.reconnectTimeoutId = setTimeout(() => {
      this.stats.reconnectAttempts++;
      
      if (this.config.enableLogging) {
        console.debug(`[WebSocketManager] Reconnecting... Attempt ${this.stats.reconnectAttempts}`);
      }
      
      this.connect().catch(error => {
        console.error('[WebSocketManager] Reconnect failed:', error);
      });
    }, delay);
  }

  /**
   * ハートビート開始
   * Start heartbeat
   */
  private startHeartbeat(): void {
    if (this.heartbeatIntervalId) {
      clearInterval(this.heartbeatIntervalId);
    }

    this.heartbeatIntervalId = setInterval(() => {
      if (this.socket && this.socket.readyState === WebSocket.OPEN) {
        this.send({
          type: 'heartbeat',
          data: { timestamp: Date.now() },
          priority: 'low'
        });
      }
    }, this.config.heartbeatInterval);
  }

  /**
   * メッセージキュー処理
   * Process message queue
   */
  private processMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.socket?.readyState === WebSocket.OPEN) {
      const message = this.messageQueue.shift()!;
      
      try {
        this.socket.send(JSON.stringify(message));
        this.stats.messagesSent++;
      } catch (error) {
        console.error('[WebSocketManager] Queue processing error:', error);
        break;
      }
    }

    if (this.config.enableLogging && this.messageQueue.length > 0) {
      console.debug(`[WebSocketManager] Processed queue, ${this.messageQueue.length} messages remaining`);
    }
  }

  /**
   * メッセージキューイング
   * Queue message for later sending
   */
  private queueMessage(message: WebSocketMessage): void {
    // Remove oldest messages if queue is full
    if (this.messageQueue.length >= this.config.messageQueueSize) {
      const removed = this.messageQueue.splice(0, Math.floor(this.config.messageQueueSize * 0.3));
      
      if (this.config.enableLogging) {
        console.debug(`[WebSocketManager] Queue full, removed ${removed.length} old messages`);
      }
    }

    // Insert by priority (high priority first)
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    const insertIndex = this.messageQueue.findIndex(
      queued => priorityOrder[queued.priority] > priorityOrder[message.priority]
    );

    if (insertIndex === -1) {
      this.messageQueue.push(message);
    } else {
      this.messageQueue.splice(insertIndex, 0, message);
    }
  }

  /**
   * 接続状態更新
   * Update connection state
   */
  private updateConnectionState(state: ConnectionStats['currentState'], error?: Error): void {
    this.stats.currentState = state;
    
    this.connectionStateHandlers.forEach(handler => {
      try {
        handler(state, error);
      } catch (handlerError) {
        console.error('[WebSocketManager] State handler error:', handlerError);
      }
    });
  }

  /**
   * メッセージID生成
   * Generate message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

export { WebSocketManager, type WebSocketConfig, type WebSocketMessage, type ConnectionStats };