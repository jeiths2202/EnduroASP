/**
 * Event Handler Management Hook
 * イベントハンドラー管理フック
 * 
 * 使用方法:
 * const { registerHandler, cleanup } = useEventHandlers('ComponentName');
 * 
 * 機能:
 * - Event handler deduplication
 * - Automatic cleanup on unmount
 * - WebSocket handler registry integration
 */

import { useEffect, useCallback, useRef } from 'react';
import { eventHandlerRegistry } from '../utils/eventHandlerRegistry';

interface UseEventHandlersConfig {
  enableLogging?: boolean;
  maxHandlersPerComponent?: number;
}

interface UseEventHandlersReturn {
  registerHandler: (
    eventName: string,
    handler: (...args: any[]) => void,
    options?: {
      description?: string;
      force?: boolean;
    }
  ) => string;
  registerWebSocketHandler: (
    eventName: string,
    handler: (...args: any[]) => void,
    description?: string
  ) => string;
  registerBulkHandlers: (handlers: Array<{
    event: string;
    handler: (...args: any[]) => void;
    description?: string;
  }>) => string[];
  unregisterHandler: (handlerId: string) => boolean;
  getHandlerStats: () => {
    componentHandlers: number;
    totalSystemHandlers: number;
    memoryEstimate: string;
  };
  cleanup: () => void;
}

// Configuration constants
const EVENT_HANDLER_CONFIG = {
  DEFAULT_MAX_HANDLERS: 20,
  MEMORY_WARNING_THRESHOLD: 50,
  LOGGING_ENABLED: process.env.NODE_ENV === 'development'
} as const;

export const useEventHandlers = (
  componentId: string,
  config: UseEventHandlersConfig = {}
): UseEventHandlersReturn => {
  const {
    enableLogging = EVENT_HANDLER_CONFIG.LOGGING_ENABLED,
    maxHandlersPerComponent = EVENT_HANDLER_CONFIG.DEFAULT_MAX_HANDLERS
  } = config;

  const registeredHandlerIds = useRef<string[]>([]);
  const isCleanedUp = useRef<boolean>(false);

  /**
   * 単一ハンドラー登録
   * Register single handler
   */
  const registerHandler = useCallback((
    eventName: string,
    handler: (...args: any[]) => void,
    options: {
      description?: string;
      force?: boolean;
    } = {}
  ): string => {
    if (isCleanedUp.current) {
      console.warn(`[EventHandlers] Component ${componentId} already cleaned up`);
      return '';
    }

    // Check component handler limit
    if (registeredHandlerIds.current.length >= maxHandlersPerComponent) {
      const error = `Component ${componentId} exceeded handler limit: ${maxHandlersPerComponent}`;
      console.error(`[EventHandlers] ${error}`);
      throw new Error(error);
    }

    const handlerId = eventHandlerRegistry.registerHandler(eventName, handler, {
      id: `${componentId}_${eventName}_${Date.now()}`,
      description: options.description || `${componentId} ${eventName} handler`,
      force: options.force
    });

    registeredHandlerIds.current.push(handlerId);

    if (enableLogging) {
      console.debug(`[EventHandlers] ${componentId} registered: ${handlerId}`);
    }

    return handlerId;
  }, [componentId, maxHandlersPerComponent, enableLogging]);

  /**
   * WebSocketハンドラー専用登録
   * WebSocket handler specific registration
   */
  const registerWebSocketHandler = useCallback((
    eventName: string,
    handler: (...args: any[]) => void,
    description?: string
  ): string => {
    if (isCleanedUp.current) {
      console.warn(`[EventHandlers] Component ${componentId} already cleaned up`);
      return '';
    }

    const handlerId = eventHandlerRegistry.registerWebSocketHandler(
      eventName,
      handler,
      componentId,
      description
    );

    registeredHandlerIds.current.push(handlerId);

    if (enableLogging) {
      console.debug(`[EventHandlers] ${componentId} registered WebSocket: ${handlerId}`);
    }

    return handlerId;
  }, [componentId, enableLogging]);

  /**
   * 一括ハンドラー登録
   * Bulk handler registration
   */
  const registerBulkHandlers = useCallback((
    handlers: Array<{
      event: string;
      handler: (...args: any[]) => void;
      description?: string;
    }>
  ): string[] => {
    if (isCleanedUp.current) {
      console.warn(`[EventHandlers] Component ${componentId} already cleaned up`);
      return [];
    }

    // Check bulk registration limit
    const totalAfterRegistration = registeredHandlerIds.current.length + handlers.length;
    if (totalAfterRegistration > maxHandlersPerComponent) {
      const error = `Bulk registration would exceed limit: ${totalAfterRegistration} > ${maxHandlersPerComponent}`;
      console.error(`[EventHandlers] ${componentId}: ${error}`);
      throw new Error(error);
    }

    const handlerIds = eventHandlerRegistry.registerComponentHandlers(
      componentId,
      handlers
    );

    registeredHandlerIds.current.push(...handlerIds);

    if (enableLogging) {
      console.debug(`[EventHandlers] ${componentId} bulk registered: ${handlerIds.length} handlers`);
    }

    return handlerIds;
  }, [componentId, maxHandlersPerComponent, enableLogging]);

  /**
   * 個別ハンドラー削除
   * Unregister individual handler
   */
  const unregisterHandler = useCallback((handlerId: string): boolean => {
    const success = eventHandlerRegistry.unregisterHandler(handlerId);
    
    if (success) {
      registeredHandlerIds.current = registeredHandlerIds.current.filter(
        id => id !== handlerId
      );
      
      if (enableLogging) {
        console.debug(`[EventHandlers] ${componentId} unregistered: ${handlerId}`);
      }
    }

    return success;
  }, [componentId, enableLogging]);

  /**
   * ハンドラー統計取得
   * Get handler statistics
   */
  const getHandlerStats = useCallback(() => {
    const systemStats = eventHandlerRegistry.getStatistics();
    
    return {
      componentHandlers: registeredHandlerIds.current.length,
      totalSystemHandlers: systemStats.totalHandlers,
      memoryEstimate: systemStats.memoryEstimate
    };
  }, []);

  /**
   * 全ハンドラークリーンアップ
   * Cleanup all handlers
   */
  const cleanup = useCallback(() => {
    if (isCleanedUp.current) {
      return;
    }

    const unregisteredCount = eventHandlerRegistry.unregisterComponentHandlers(componentId);
    registeredHandlerIds.current.length = 0;
    isCleanedUp.current = true;

    if (enableLogging) {
      console.debug(`[EventHandlers] ${componentId} cleaned up ${unregisteredCount} handlers`);
    }
  }, [componentId, enableLogging]);

  // Memory usage warning
  useEffect(() => {
    const stats = getHandlerStats();
    if (stats.componentHandlers > EVENT_HANDLER_CONFIG.MEMORY_WARNING_THRESHOLD) {
      console.warn(`[EventHandlers] ${componentId} has ${stats.componentHandlers} handlers (threshold: ${EVENT_HANDLER_CONFIG.MEMORY_WARNING_THRESHOLD})`);
    }
  }, [componentId, getHandlerStats]);

  // Automatic cleanup on unmount
  useEffect(() => {
    return cleanup;
  }, [cleanup]);

  return {
    registerHandler,
    registerWebSocketHandler,
    registerBulkHandlers,
    unregisterHandler,
    getHandlerStats,
    cleanup
  };
};