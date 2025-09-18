/**
 * WebSocket Hub Manager
 * WebSocketハブマネージャー
 * 
 * 使用方法:
 * const hub = new WebSocketHub();
 * hub.registerConnection('main', wsManager);
 * 
 * 機能:
 * - Multiple WebSocket connection management
 * - Connection routing and load balancing
 * - Centralized message broadcasting
 */

import { WebSocketManager, WebSocketMessage } from './webSocketManager';

interface ConnectionInfo {
  id: string;
  manager: WebSocketManager;
  priority: number;
  tags: string[];
  lastActivity: Date;
  messageCount: number;
}

interface HubConfig {
  enableLogging?: boolean;
  maxConnections?: number;
  connectionTimeout?: number;
  loadBalancing?: 'round_robin' | 'least_active' | 'priority';
}

interface BroadcastOptions {
  excludeConnections?: string[];
  includeOnlyTags?: string[];
  priority?: 'high' | 'medium' | 'low';
  requireConnected?: boolean;
}

interface HubStatistics {
  totalConnections: number;
  activeConnections: number;
  totalMessagesSent: number;
  totalMessagesReceived: number;
  averageResponseTime: number;
  connectionHealth: Record<string, {
    status: string;
    uptime: number;
    messageRate: number;
  }>;
}

class WebSocketHub {
  private connections: Map<string, ConnectionInfo> = new Map();
  private eventHandlers: Map<string, Array<(connectionId: string, data: any) => void>> = new Map();
  private config: Required<HubConfig>;
  private roundRobinIndex: number = 0;
  private hubStats: {
    messagesSent: number;
    messagesReceived: number;
    responseTimes: number[];
  };

  // Configuration constants
  private static readonly DEFAULT_CONFIG = {
    enableLogging: process.env.NODE_ENV === 'development',
    maxConnections: 10,
    connectionTimeout: 30000,
    loadBalancing: 'round_robin' as const
  };

  constructor(config: HubConfig = {}) {
    this.config = {
      ...WebSocketHub.DEFAULT_CONFIG,
      ...config
    };

    this.hubStats = {
      messagesSent: 0,
      messagesReceived: 0,
      responseTimes: []
    };

    if (this.config.enableLogging) {
      console.debug('[WebSocketHub] Initialized with config:', this.config);
    }
  }

  /**
   * 接続登録
   * Register WebSocket connection
   */
  registerConnection(
    id: string,
    manager: WebSocketManager,
    options: {
      priority?: number;
      tags?: string[];
    } = {}
  ): boolean {
    if (this.connections.has(id)) {
      console.warn(`[WebSocketHub] Connection ${id} already registered`);
      return false;
    }

    if (this.connections.size >= this.config.maxConnections) {
      console.error(`[WebSocketHub] Maximum connections (${this.config.maxConnections}) reached`);
      return false;
    }

    const connectionInfo: ConnectionInfo = {
      id,
      manager,
      priority: options.priority ?? 1,
      tags: options.tags ?? [],
      lastActivity: new Date(),
      messageCount: 0
    };

    // Setup message forwarding from this connection to hub handlers
    manager.on('*', (data) => {
      this.handleConnectionMessage(id, data);
    });

    // Setup connection state monitoring
    manager.onConnectionStateChange((state, error) => {
      this.handleConnectionStateChange(id, state, error);
    });

    this.connections.set(id, connectionInfo);

    if (this.config.enableLogging) {
      console.debug(`[WebSocketHub] Registered connection: ${id}`);
    }

    return true;
  }

  /**
   * 接続削除
   * Unregister connection
   */
  unregisterConnection(id: string): boolean {
    const connection = this.connections.get(id);
    if (!connection) {
      return false;
    }

    // Disconnect the WebSocket
    connection.manager.disconnect();
    this.connections.delete(id);

    if (this.config.enableLogging) {
      console.debug(`[WebSocketHub] Unregistered connection: ${id}`);
    }

    return true;
  }

  /**
   * メッセージ送信（単一接続）
   * Send message to specific connection
   */
  sendToConnection(
    connectionId: string,
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>
  ): boolean {
    const connection = this.connections.get(connectionId);
    if (!connection) {
      console.warn(`[WebSocketHub] Connection ${connectionId} not found`);
      return false;
    }

    const success = connection.manager.send(message);
    if (success) {
      connection.messageCount++;
      connection.lastActivity = new Date();
      this.hubStats.messagesSent++;
    }

    return success;
  }

  /**
   * ブロードキャスト送信
   * Broadcast message to multiple connections
   */
  broadcast(
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    options: BroadcastOptions = {}
  ): number {
    const {
      excludeConnections = [],
      includeOnlyTags = [],
      requireConnected = true
    } = options;

    let sentCount = 0;
    const targetConnections = this.getTargetConnections(excludeConnections, includeOnlyTags, requireConnected);

    targetConnections.forEach(connection => {
      const success = connection.manager.send(message);
      if (success) {
        connection.messageCount++;
        connection.lastActivity = new Date();
        sentCount++;
      }
    });

    this.hubStats.messagesSent += sentCount;

    if (this.config.enableLogging) {
      console.debug(`[WebSocketHub] Broadcast sent to ${sentCount}/${targetConnections.length} connections`);
    }

    return sentCount;
  }

  /**
   * ロードバランシング付きメッセージ送信
   * Send message with load balancing
   */
  sendWithLoadBalancing(
    message: Omit<WebSocketMessage, 'id' | 'timestamp'>,
    tags?: string[]
  ): string | null {
    const availableConnections = Array.from(this.connections.values()).filter(conn => {
      const isConnected = conn.manager.getConnectionState() === 'connected';
      const hasMatchingTags = !tags || tags.some(tag => conn.tags.includes(tag));
      return isConnected && hasMatchingTags;
    });

    if (availableConnections.length === 0) {
      console.warn('[WebSocketHub] No available connections for load balancing');
      return null;
    }

    let selectedConnection: ConnectionInfo;

    switch (this.config.loadBalancing) {
      case 'round_robin':
        selectedConnection = availableConnections[this.roundRobinIndex % availableConnections.length];
        this.roundRobinIndex++;
        break;

      case 'least_active':
        selectedConnection = availableConnections.reduce((prev, current) =>
          prev.messageCount < current.messageCount ? prev : current
        );
        break;

      case 'priority':
        selectedConnection = availableConnections.reduce((prev, current) =>
          prev.priority > current.priority ? prev : current
        );
        break;

      default:
        selectedConnection = availableConnections[0];
    }

    const success = selectedConnection.manager.send(message);
    if (success) {
      selectedConnection.messageCount++;
      selectedConnection.lastActivity = new Date();
      this.hubStats.messagesSent++;
      return selectedConnection.id;
    }

    return null;
  }

  /**
   * イベントハンドラー登録
   * Register event handler
   */
  on(eventType: string, handler: (connectionId: string, data: any) => void): () => void {
    if (!this.eventHandlers.has(eventType)) {
      this.eventHandlers.set(eventType, []);
    }

    this.eventHandlers.get(eventType)!.push(handler);

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
   * 接続リスト取得
   * Get connection list
   */
  getConnections(filter?: {
    tags?: string[];
    connectedOnly?: boolean;
  }): ConnectionInfo[] {
    let connections = Array.from(this.connections.values());

    if (filter?.tags) {
      connections = connections.filter(conn =>
        filter.tags!.some(tag => conn.tags.includes(tag))
      );
    }

    if (filter?.connectedOnly) {
      connections = connections.filter(conn =>
        conn.manager.getConnectionState() === 'connected'
      );
    }

    return connections;
  }

  /**
   * ハブ統計取得
   * Get hub statistics
   */
  getStatistics(): HubStatistics {
    const connectionHealth: Record<string, { status: string; uptime: number; messageRate: number }> = {};

    this.connections.forEach((conn, id) => {
      const stats = conn.manager.getStatistics();
      const uptime = stats.connectionTime 
        ? Date.now() - stats.connectionTime.getTime()
        : 0;
      
      const messageRate = uptime > 0 ? (conn.messageCount / (uptime / 1000)) : 0;

      connectionHealth[id] = {
        status: stats.currentState,
        uptime,
        messageRate
      };
    });

    const activeConnections = Array.from(this.connections.values())
      .filter(conn => conn.manager.getConnectionState() === 'connected').length;

    const averageResponseTime = this.hubStats.responseTimes.length > 0
      ? this.hubStats.responseTimes.reduce((sum, time) => sum + time, 0) / this.hubStats.responseTimes.length
      : 0;

    return {
      totalConnections: this.connections.size,
      activeConnections,
      totalMessagesSent: this.hubStats.messagesSent,
      totalMessagesReceived: this.hubStats.messagesReceived,
      averageResponseTime,
      connectionHealth
    };
  }

  /**
   * ハブクリーンアップ
   * Cleanup hub
   */
  cleanup(): void {
    this.connections.forEach((conn, id) => {
      conn.manager.disconnect();
    });

    this.connections.clear();
    this.eventHandlers.clear();
    this.hubStats.responseTimes.length = 0;

    if (this.config.enableLogging) {
      console.debug('[WebSocketHub] Cleaned up all connections');
    }
  }

  /**
   * 接続メッセージ処理
   * Handle message from connection
   */
  private handleConnectionMessage(connectionId: string, data: any): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      connection.lastActivity = new Date();
      this.hubStats.messagesReceived++;
    }

    // Forward to registered handlers
    const handlers = this.eventHandlers.get(data.type) || [];
    const allHandlers = this.eventHandlers.get('*') || [];

    [...handlers, ...allHandlers].forEach(handler => {
      try {
        handler(connectionId, data);
      } catch (error) {
        console.error(`[WebSocketHub] Handler error for ${data.type}:`, error);
      }
    });
  }

  /**
   * 接続状態変更処理
   * Handle connection state change
   */
  private handleConnectionStateChange(connectionId: string, state: string, error?: Error): void {
    if (this.config.enableLogging) {
      console.debug(`[WebSocketHub] Connection ${connectionId} state: ${state}`);
    }

    if (error) {
      console.error(`[WebSocketHub] Connection ${connectionId} error:`, error);
    }
  }

  /**
   * ターゲット接続取得
   * Get target connections for broadcast
   */
  private getTargetConnections(
    excludeConnections: string[],
    includeOnlyTags: string[],
    requireConnected: boolean
  ): ConnectionInfo[] {
    return Array.from(this.connections.values()).filter(conn => {
      // Exclude specific connections
      if (excludeConnections.includes(conn.id)) {
        return false;
      }

      // Check tag filtering
      if (includeOnlyTags.length > 0) {
        const hasMatchingTag = includeOnlyTags.some(tag => conn.tags.includes(tag));
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Check connection state
      if (requireConnected && conn.manager.getConnectionState() !== 'connected') {
        return false;
      }

      return true;
    });
  }
}

export { WebSocketHub, type ConnectionInfo, type HubConfig, type HubStatistics };