/**
 * Event Handler Registry System
 * イベントハンドラー登録システム
 * 
 * 使用方法:
 * - Duplicate event handler prevention
 * - Centralized handler management
 * - Automatic cleanup on component unmount
 */

interface HandlerInfo {
  id: string;
  event: string;
  handler: (...args: any[]) => void;
  target?: any;
  registered: Date;
  description?: string;
}

interface EventHandlerConfig {
  enableDeduplication?: boolean;
  enableLogging?: boolean;
  maxHandlers?: number;
}

class EventHandlerRegistry {
  private handlers: Map<string, HandlerInfo> = new Map();
  private eventCounts: Map<string, number> = new Map();
  private config: Required<EventHandlerConfig>;

  constructor(config: EventHandlerConfig = {}) {
    this.config = {
      enableDeduplication: config.enableDeduplication ?? true,
      enableLogging: config.enableLogging ?? false,
      maxHandlers: config.maxHandlers ?? 100
    };
  }

  /**
   * ハンドラー登録（重複チェック付き）
   * Register handler with duplication check
   */
  registerHandler(
    eventName: string,
    handler: (...args: any[]) => void,
    options: {
      id?: string;
      target?: any;
      description?: string;
      force?: boolean;
    } = {}
  ): string {
    const handlerId = options.id || this.generateHandlerId(eventName);
    
    // Check for duplicates if enabled
    if (this.config.enableDeduplication && this.handlers.has(handlerId) && !options.force) {
      if (this.config.enableLogging) {
        console.warn(`[EventRegistry] Duplicate handler prevented: ${handlerId}`);
      }
      return handlerId;
    }

    // Check handler limit
    if (this.handlers.size >= this.config.maxHandlers) {
      console.error(`[EventRegistry] Handler limit exceeded: ${this.config.maxHandlers}`);
      throw new Error('Maximum event handlers exceeded');
    }

    // Register handler
    const handlerInfo: HandlerInfo = {
      id: handlerId,
      event: eventName,
      handler,
      target: options.target,
      registered: new Date(),
      description: options.description
    };

    this.handlers.set(handlerId, handlerInfo);
    this.updateEventCount(eventName, 1);

    if (this.config.enableLogging) {
      console.debug(`[EventRegistry] Registered handler: ${handlerId} for ${eventName}`);
    }

    return handlerId;
  }

  /**
   * ハンドラー削除
   * Unregister handler
   */
  unregisterHandler(handlerId: string): boolean {
    const handlerInfo = this.handlers.get(handlerId);
    if (!handlerInfo) {
      if (this.config.enableLogging) {
        console.warn(`[EventRegistry] Handler not found: ${handlerId}`);
      }
      return false;
    }

    this.handlers.delete(handlerId);
    this.updateEventCount(handlerInfo.event, -1);

    if (this.config.enableLogging) {
      console.debug(`[EventRegistry] Unregistered handler: ${handlerId}`);
    }

    return true;
  }

  /**
   * イベント名でハンドラー取得
   * Get handlers by event name
   */
  getHandlersByEvent(eventName: string): HandlerInfo[] {
    return Array.from(this.handlers.values()).filter(
      handler => handler.event === eventName
    );
  }

  /**
   * WebSocketイベント専用登録
   * WebSocket event specific registration
   */
  registerWebSocketHandler(
    eventName: string,
    handler: (...args: any[]) => void,
    componentId: string,
    description?: string
  ): string {
    const handlerId = `ws_${componentId}_${eventName}`;
    
    return this.registerHandler(eventName, handler, {
      id: handlerId,
      description: description || `WebSocket ${eventName} handler for ${componentId}`,
      force: false // Prevent duplicates
    });
  }

  /**
   * コンポーネント用一括登録
   * Bulk registration for component
   */
  registerComponentHandlers(
    componentId: string,
    handlers: Array<{
      event: string;
      handler: (...args: any[]) => void;
      description?: string;
    }>
  ): string[] {
    const handlerIds: string[] = [];

    handlers.forEach(({ event, handler, description }) => {
      const handlerId = `${componentId}_${event}_${Date.now()}`;
      const registeredId = this.registerHandler(event, handler, {
        id: handlerId,
        description: description || `${componentId} ${event} handler`
      });
      handlerIds.push(registeredId);
    });

    return handlerIds;
  }

  /**
   * コンポーネント用一括削除
   * Bulk unregistration for component
   */
  unregisterComponentHandlers(componentId: string): number {
    const componentHandlers = Array.from(this.handlers.keys()).filter(
      id => id.startsWith(componentId)
    );

    let unregisteredCount = 0;
    componentHandlers.forEach(handlerId => {
      if (this.unregisterHandler(handlerId)) {
        unregisteredCount++;
      }
    });

    return unregisteredCount;
  }

  /**
   * 統計情報取得
   * Get registry statistics
   */
  getStatistics(): {
    totalHandlers: number;
    eventCounts: Record<string, number>;
    oldestHandler?: Date;
    memoryEstimate: string;
  } {
    const handlers = Array.from(this.handlers.values());
    const oldestHandler = handlers.length > 0
      ? new Date(Math.min(...handlers.map(h => h.registered.getTime())))
      : undefined;

    const memoryEstimateKB = this.handlers.size * 0.1; // KB per handler estimate
    const memoryEstimate = memoryEstimateKB < 1024
      ? `${memoryEstimateKB.toFixed(1)}KB`
      : `${(memoryEstimateKB / 1024).toFixed(1)}MB`;

    return {
      totalHandlers: this.handlers.size,
      eventCounts: Object.fromEntries(this.eventCounts),
      oldestHandler,
      memoryEstimate
    };
  }

  /**
   * 完全クリーンアップ
   * Complete cleanup
   */
  clear(): void {
    const handlerCount = this.handlers.size;
    this.handlers.clear();
    this.eventCounts.clear();

    if (this.config.enableLogging) {
      console.debug(`[EventRegistry] Cleared ${handlerCount} handlers`);
    }
  }

  private generateHandlerId(eventName: string): string {
    return `${eventName}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private updateEventCount(eventName: string, delta: number): void {
    const currentCount = this.eventCounts.get(eventName) || 0;
    const newCount = Math.max(0, currentCount + delta);
    
    if (newCount === 0) {
      this.eventCounts.delete(eventName);
    } else {
      this.eventCounts.set(eventName, newCount);
    }
  }
}

// Global registry instance
export const eventHandlerRegistry = new EventHandlerRegistry({
  enableDeduplication: true,
  enableLogging: process.env.NODE_ENV === 'development',
  maxHandlers: 200
});

export default EventHandlerRegistry;