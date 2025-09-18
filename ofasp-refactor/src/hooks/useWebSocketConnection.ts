/**
 * WebSocket Connection Hook
 * WebSocket接続フック
 * 
 * 使用方法:
 * const { connectionState, sendMessage, subscribe } = useWebSocketConnection(url);
 * 
 * 機能:
 * - React component integration for WebSocket
 * - Automatic connection management
 * - State synchronization with component lifecycle
 */

import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { WebSocketManager, WebSocketConfig, WebSocketMessage, ConnectionStats } from '../utils/webSocketManager';

interface UseWebSocketConfig extends Omit<WebSocketConfig, 'url'> {
  autoConnect?: boolean;
  retryOnMount?: boolean;
  enableStateSync?: boolean;
}

interface UseWebSocketReturn {
  connectionState: string;
  connectionStats: ConnectionStats & { queuedMessages: number; registeredHandlers: number };
  isConnected: boolean;
  isConnecting: boolean;
  sendMessage: (message: Omit<WebSocketMessage, 'id' | 'timestamp'>) => boolean;
  subscribe: (eventType: string, handler: (data: any) => void) => () => void;
  connect: () => Promise<void>;
  disconnect: () => void;
  reconnect: () => Promise<void>;
  getLastMessage: (eventType?: string) => any;
  clearMessageHistory: () => void;
}

// Configuration constants
const WEBSOCKET_HOOK_CONFIG = {
  DEFAULT_AUTO_CONNECT: true,
  DEFAULT_RETRY_ON_MOUNT: true,
  DEFAULT_STATE_SYNC: true,
  MESSAGE_HISTORY_SIZE: 50,
  STATE_UPDATE_DEBOUNCE: 100
} as const;

export const useWebSocketConnection = (
  url: string,
  config: UseWebSocketConfig = {}
): UseWebSocketReturn => {
  const {
    autoConnect = WEBSOCKET_HOOK_CONFIG.DEFAULT_AUTO_CONNECT,
    retryOnMount = WEBSOCKET_HOOK_CONFIG.DEFAULT_RETRY_ON_MOUNT,
    enableStateSync = WEBSOCKET_HOOK_CONFIG.DEFAULT_STATE_SYNC,
    enableLogging = process.env.NODE_ENV === 'development',
    ...wsConfig
  } = config;

  // WebSocket manager instance (persistent across re-renders)
  const wsManagerRef = useRef<WebSocketManager | null>(null);
  
  // Component state
  const [connectionState, setConnectionState] = useState<string>('disconnected');
  const [connectionStats, setConnectionStats] = useState<ConnectionStats & { queuedMessages: number; registeredHandlers: number }>({
    connectionTime: null,
    reconnectAttempts: 0,
    messagesReceived: 0,
    messagesSent: 0,
    lastHeartbeat: null,
    currentState: 'disconnected',
    queuedMessages: 0,
    registeredHandlers: 0
  });
  
  // Message history for debugging and state management
  const messageHistoryRef = useRef<Map<string, any[]>>(new Map());
  const stateUpdateTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  /**
   * WebSocketマネージャー初期化
   * Initialize WebSocket manager
   */
  const initializeWebSocketManager = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
    }

    wsManagerRef.current = new WebSocketManager({
      url,
      enableLogging,
      ...wsConfig
    });

    // Setup connection state handler
    wsManagerRef.current.onConnectionStateChange((state, error) => {
      if (enableStateSync) {
        // Debounce state updates to prevent excessive re-renders
        if (stateUpdateTimeoutRef.current) {
          clearTimeout(stateUpdateTimeoutRef.current);
        }

        stateUpdateTimeoutRef.current = setTimeout(() => {
          setConnectionState(state);
          setConnectionStats(wsManagerRef.current!.getStatistics());
        }, WEBSOCKET_HOOK_CONFIG.STATE_UPDATE_DEBOUNCE);
      }

      if (error && enableLogging) {
        console.error('[useWebSocketConnection] Connection error:', error);
      }
    });

    if (enableLogging) {
      console.debug('[useWebSocketConnection] WebSocket manager initialized for:', url);
    }
  }, [url, enableLogging, enableStateSync, wsConfig]);

  /**
   * メッセージ送信
   * Send message
   */
  const sendMessage = useCallback((message: Omit<WebSocketMessage, 'id' | 'timestamp'>): boolean => {
    if (!wsManagerRef.current) {
      console.warn('[useWebSocketConnection] WebSocket manager not initialized');
      return false;
    }

    const success = wsManagerRef.current.send(message);
    
    if (enableStateSync) {
      // Update stats after send attempt
      setConnectionStats(wsManagerRef.current.getStatistics());
    }

    return success;
  }, [enableStateSync]);

  /**
   * イベント購読
   * Subscribe to event
   */
  const subscribe = useCallback((eventType: string, handler: (data: any) => void) => {
    if (!wsManagerRef.current) {
      console.warn('[useWebSocketConnection] WebSocket manager not initialized');
      return () => {};
    }

    // Wrap handler to store message history
    const wrappedHandler = (data: any) => {
      // Store in message history
      if (!messageHistoryRef.current.has(eventType)) {
        messageHistoryRef.current.set(eventType, []);
      }
      
      const history = messageHistoryRef.current.get(eventType)!;
      history.push({ data, timestamp: new Date() });
      
      // Limit history size
      if (history.length > WEBSOCKET_HOOK_CONFIG.MESSAGE_HISTORY_SIZE) {
        history.splice(0, history.length - WEBSOCKET_HOOK_CONFIG.MESSAGE_HISTORY_SIZE);
      }

      // Call original handler
      handler(data);

      // Update stats if state sync is enabled
      if (enableStateSync) {
        setConnectionStats(wsManagerRef.current!.getStatistics());
      }
    };

    const unsubscribe = wsManagerRef.current.on(eventType, wrappedHandler);

    if (enableLogging) {
      console.debug(`[useWebSocketConnection] Subscribed to: ${eventType}`);
    }

    return unsubscribe;
  }, [enableStateSync, enableLogging]);

  /**
   * 接続開始
   * Connect to WebSocket
   */
  const connect = useCallback(async (): Promise<void> => {
    if (!wsManagerRef.current) {
      initializeWebSocketManager();
    }

    if (wsManagerRef.current) {
      try {
        await wsManagerRef.current.connect();
        
        if (enableLogging) {
          console.debug('[useWebSocketConnection] Connected successfully');
        }
      } catch (error) {
        console.error('[useWebSocketConnection] Connection failed:', error);
        throw error;
      }
    }
  }, [initializeWebSocketManager, enableLogging]);

  /**
   * 接続終了
   * Disconnect from WebSocket
   */
  const disconnect = useCallback(() => {
    if (wsManagerRef.current) {
      wsManagerRef.current.disconnect();
      
      if (enableLogging) {
        console.debug('[useWebSocketConnection] Disconnected');
      }
    }
  }, [enableLogging]);

  /**
   * 再接続
   * Reconnect to WebSocket
   */
  const reconnect = useCallback(async (): Promise<void> => {
    disconnect();
    
    // Small delay before reconnecting
    await new Promise(resolve => setTimeout(resolve, 100));
    
    return connect();
  }, [connect, disconnect]);

  /**
   * 最新メッセージ取得
   * Get last message
   */
  const getLastMessage = useCallback((eventType?: string): any => {
    if (!eventType) {
      // Return last message from any event type
      const allMessages: Array<{ data: any; timestamp: Date; eventType: string }> = [];
      
      messageHistoryRef.current.forEach((messages, type) => {
        messages.forEach(msg => {
          allMessages.push({ ...msg, eventType: type });
        });
      });
      
      allMessages.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
      return allMessages[0]?.data || null;
    }

    const messages = messageHistoryRef.current.get(eventType);
    return messages && messages.length > 0 ? messages[messages.length - 1].data : null;
  }, []);

  /**
   * メッセージ履歴クリア
   * Clear message history
   */
  const clearMessageHistory = useCallback(() => {
    messageHistoryRef.current.clear();
    
    if (enableLogging) {
      console.debug('[useWebSocketConnection] Message history cleared');
    }
  }, [enableLogging]);

  // Initialize WebSocket manager on mount
  useEffect(() => {
    initializeWebSocketManager();

    return () => {
      if (stateUpdateTimeoutRef.current) {
        clearTimeout(stateUpdateTimeoutRef.current);
      }
    };
  }, [initializeWebSocketManager]);

  // Auto-connect on mount
  useEffect(() => {
    if (autoConnect) {
      connect().catch(error => {
        if (retryOnMount) {
          console.warn('[useWebSocketConnection] Initial connection failed, will retry on user action');
        } else {
          console.error('[useWebSocketConnection] Auto-connect failed:', error);
        }
      });
    }
  }, [autoConnect, connect, retryOnMount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (wsManagerRef.current) {
        wsManagerRef.current.disconnect();
      }
      messageHistoryRef.current.clear();
    };
  }, []);

  // Memoized computed values
  const isConnected = useMemo(() => connectionState === 'connected', [connectionState]);
  const isConnecting = useMemo(() => connectionState === 'connecting', [connectionState]);

  return {
    connectionState,
    connectionStats,
    isConnected,
    isConnecting,
    sendMessage,
    subscribe,
    connect,
    disconnect,
    reconnect,
    getLastMessage,
    clearMessageHistory
  };
};