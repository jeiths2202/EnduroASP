/**
 * Memory Leak Detection Utilities
 * メモリリーク検出ユーティリティ
 * 
 * 利用方法:
 * - Timer cleanup management
 * - Event listener tracking
 * - Resource disposal monitoring
 */

interface TimerManager {
  id: number;
  type: 'interval' | 'timeout';
  description?: string;
  created: Date;
}

interface EventListenerManager {
  element: EventTarget;
  event: string;
  handler: EventListener;
  options?: boolean | AddEventListenerOptions;
  created: Date;
}

class MemoryLeakDetector {
  private timers: Map<number, TimerManager> = new Map();
  private eventListeners: Set<EventListenerManager> = new Set();
  private maxHistorySize: number;

  constructor(maxHistorySize: number = 100) {
    this.maxHistorySize = maxHistorySize;
  }

  /**
   * タイマー登録と追跡
   * Register and track timer
   */
  registerInterval(callback: () => void, delay: number, description?: string): number {
    const id = window.setInterval(callback, delay);
    this.timers.set(id, {
      id,
      type: 'interval',
      description,
      created: new Date()
    });
    return id;
  }

  registerTimeout(callback: () => void, delay: number, description?: string): number {
    const id = window.setTimeout(() => {
      callback();
      this.timers.delete(id); // Auto cleanup for timeout
    }, delay);
    this.timers.set(id, {
      id,
      type: 'timeout',
      description,
      created: new Date()
    });
    return id;
  }

  /**
   * タイマークリーンアップ
   * Timer cleanup
   */
  clearTimer(id: number): void {
    const timer = this.timers.get(id);
    if (timer) {
      if (timer.type === 'interval') {
        window.clearInterval(id);
      } else {
        window.clearTimeout(id);
      }
      this.timers.delete(id);
    }
  }

  /**
   * 全タイマークリーンアップ
   * Clear all timers
   */
  clearAllTimers(): void {
    this.timers.forEach((timer, id) => {
      this.clearTimer(id);
    });
  }

  /**
   * イベントリスナー登録と追跡
   * Register and track event listener
   */
  addEventListener(
    element: EventTarget,
    event: string,
    handler: EventListener,
    options?: boolean | AddEventListenerOptions
  ): () => void {
    element.addEventListener(event, handler, options);
    
    const listenerInfo: EventListenerManager = {
      element,
      event,
      handler,
      options,
      created: new Date()
    };
    
    this.eventListeners.add(listenerInfo);

    // Return cleanup function
    return () => {
      element.removeEventListener(event, handler, options);
      this.eventListeners.delete(listenerInfo);
    };
  }

  /**
   * 配列サイズ制限管理
   * Array size limit management
   */
  limitArraySize<T>(array: T[], maxSize: number = this.maxHistorySize): T[] {
    if (array.length <= maxSize) return array;
    return array.slice(-maxSize);
  }

  /**
   * メモリ使用状況診断
   * Memory usage diagnostics
   */
  getDiagnostics(): {
    activeTimers: number;
    activeEventListeners: number;
    timers: TimerManager[];
    oldestTimer?: Date;
    memoryEstimate: string;
  } {
    const timers = Array.from(this.timers.values());
    const oldestTimer = timers.length > 0 
      ? new Date(Math.min(...timers.map(t => t.created.getTime())))
      : undefined;

    return {
      activeTimers: this.timers.size,
      activeEventListeners: this.eventListeners.size,
      timers,
      oldestTimer,
      memoryEstimate: this.estimateMemoryUsage()
    };
  }

  private estimateMemoryUsage(): string {
    const timerMemory = this.timers.size * 0.1; // KB per timer estimate
    const listenerMemory = this.eventListeners.size * 0.05; // KB per listener estimate
    const totalKB = timerMemory + listenerMemory;
    
    if (totalKB < 1024) {
      return `${totalKB.toFixed(1)}KB`;
    }
    return `${(totalKB / 1024).toFixed(1)}MB`;
  }

  /**
   * 完全クリーンアップ
   * Complete cleanup
   */
  dispose(): void {
    this.clearAllTimers();
    
    // Remove all event listeners
    this.eventListeners.forEach(listener => {
      listener.element.removeEventListener(
        listener.event,
        listener.handler,
        listener.options
      );
    });
    
    this.eventListeners.clear();
  }
}

// シングルトンインスタンス
// Singleton instance
export const memoryLeakDetector = new MemoryLeakDetector();

export default MemoryLeakDetector;