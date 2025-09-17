/**
 * Grid Event Delegation System
 * グリッドイベント委譲システム
 * 
 * 使用方法:
 * const delegator = new GridEventDelegation(containerElement);
 * delegator.registerCellHandler('click', handler);
 * 
 * 機能:
 * - Event delegation for large grids (24x80 = 1,920 cells)
 * - Memory efficient event handling
 * - Cell position calculation
 */

interface CellPosition {
  row: number;
  col: number;
  cellId: string;
}

interface CellEventHandler {
  eventType: string;
  handler: (position: CellPosition, event: Event) => void;
  selector?: string;
}

interface GridEventDelegationConfig {
  gridRows?: number;
  gridCols?: number;
  cellSelector?: string;
  enableLogging?: boolean;
}

class GridEventDelegation {
  private container: Element;
  private handlers: Map<string, CellEventHandler[]> = new Map();
  private config: Required<GridEventDelegationConfig>;
  private delegatedEvents: Set<string> = new Set();

  // Configuration constants
  private static readonly DEFAULT_CONFIG = {
    gridRows: 24,
    gridCols: 80,
    cellSelector: '[data-row][data-col]',
    enableLogging: process.env.NODE_ENV === 'development'
  } as const;

  constructor(
    container: Element,
    config: GridEventDelegationConfig = {}
  ) {
    this.container = container;
    this.config = {
      ...GridEventDelegation.DEFAULT_CONFIG,
      ...config
    };

    if (this.config.enableLogging) {
      console.debug(`[GridDelegation] Initialized for ${this.config.gridRows}x${this.config.gridCols} grid`);
    }
  }

  /**
   * セルイベントハンドラー登録
   * Register cell event handler
   */
  registerCellHandler(
    eventType: string,
    handler: (position: CellPosition, event: Event) => void,
    selector?: string
  ): void {
    const handlerInfo: CellEventHandler = {
      eventType,
      handler,
      selector: selector || this.config.cellSelector
    };

    // Add to handlers map
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handlerInfo);

    // Setup delegation if not already done
    if (!this.delegatedEvents.has(eventType)) {
      this.setupEventDelegation(eventType);
      this.delegatedEvents.add(eventType);
    }

    if (this.config.enableLogging) {
      console.debug(`[GridDelegation] Registered ${eventType} handler`);
    }
  }

  /**
   * 複数イベントハンドラー一括登録
   * Register multiple event handlers
   */
  registerMultipleCellHandlers(
    handlers: Array<{
      eventType: string;
      handler: (position: CellPosition, event: Event) => void;
      selector?: string;
    }>
  ): void {
    handlers.forEach(({ eventType, handler, selector }) => {
      this.registerCellHandler(eventType, handler, selector);
    });
  }

  /**
   * イベント委譲設定
   * Setup event delegation
   */
  private setupEventDelegation(eventType: string): void {
    const delegatedHandler = (event: Event) => {
      const target = event.target as Element;
      const cellElement = target.closest(this.config.cellSelector);
      
      if (!cellElement) {
        return; // Not a cell element
      }

      const position = this.getCellPosition(cellElement);
      if (!position) {
        return; // Invalid cell position
      }

      // Execute all handlers for this event type
      const eventHandlers = this.handlers.get(eventType) || [];
      eventHandlers.forEach(({ handler, selector }) => {
        // Check if target matches specific selector if provided
        if (selector && selector !== this.config.cellSelector) {
          if (!target.matches(selector) && !target.closest(selector)) {
            return;
          }
        }

        try {
          handler(position, event);
        } catch (error) {
          console.error(`[GridDelegation] Error in ${eventType} handler:`, error);
        }
      });
    };

    this.container.addEventListener(eventType, delegatedHandler, {
      capture: eventType === 'focus' || eventType === 'blur' // Use capture for focus events
    });

    if (this.config.enableLogging) {
      console.debug(`[GridDelegation] Setup delegation for ${eventType}`);
    }
  }

  /**
   * セル位置計算
   * Calculate cell position
   */
  private getCellPosition(cellElement: Element): CellPosition | null {
    const rowAttr = cellElement.getAttribute('data-row');
    const colAttr = cellElement.getAttribute('data-col');

    if (!rowAttr || !colAttr) {
      return null;
    }

    const row = parseInt(rowAttr, 10);
    const col = parseInt(colAttr, 10);

    // Validate grid bounds
    if (
      isNaN(row) || isNaN(col) ||
      row < 0 || row >= this.config.gridRows ||
      col < 0 || col >= this.config.gridCols
    ) {
      if (this.config.enableLogging) {
        console.warn(`[GridDelegation] Invalid cell position: ${row},${col}`);
      }
      return null;
    }

    return {
      row,
      col,
      cellId: `cell_${row}_${col}`
    };
  }

  /**
   * 特定イベントタイプのハンドラー削除
   * Remove handlers for specific event type
   */
  removeEventHandlers(eventType: string): boolean {
    const removed = this.handlers.delete(eventType);
    
    if (removed && this.config.enableLogging) {
      console.debug(`[GridDelegation] Removed all ${eventType} handlers`);
    }

    return removed;
  }

  /**
   * 統計情報取得
   * Get delegation statistics
   */
  getStatistics(): {
    totalEventTypes: number;
    totalHandlers: number;
    delegatedEvents: string[];
    gridSize: string;
    memoryEstimate: string;
  } {
    const totalHandlers = Array.from(this.handlers.values())
      .reduce((sum, handlers) => sum + handlers.length, 0);

    const memoryEstimateKB = totalHandlers * 0.05; // 50 bytes per handler estimate
    const memoryEstimate = memoryEstimateKB < 1 
      ? `${(memoryEstimateKB * 1024).toFixed(0)}B`
      : `${memoryEstimateKB.toFixed(1)}KB`;

    return {
      totalEventTypes: this.handlers.size,
      totalHandlers,
      delegatedEvents: Array.from(this.delegatedEvents),
      gridSize: `${this.config.gridRows}x${this.config.gridCols}`,
      memoryEstimate
    };
  }

  /**
   * 完全クリーンアップ
   * Complete cleanup
   */
  cleanup(): void {
    // Clear all handlers
    const eventTypes = Array.from(this.handlers.keys());
    this.handlers.clear();
    this.delegatedEvents.clear();

    if (this.config.enableLogging) {
      console.debug(`[GridDelegation] Cleaned up ${eventTypes.length} event types`);
    }
  }
}

export { GridEventDelegation, type CellPosition, type GridEventDelegationConfig };