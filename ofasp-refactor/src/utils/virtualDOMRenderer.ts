/**
 * Virtual DOM Renderer for Large Grids
 * 大規模グリッド用仮想DOMレンダラー
 * 
 * 使用方法:
 * const renderer = new VirtualDOMRenderer(container, config);
 * renderer.render(data);
 * 
 * 機能:
 * - Virtual scrolling for large datasets (24x80 = 1,920 cells)
 * - Efficient DOM updates with minimal reflows
 * - Memory-optimized rendering with viewport culling
 */

interface CellData {
  row: number;
  col: number;
  content: string;
  className?: string;
  style?: Record<string, string>;
  attributes?: Record<string, string>;
}

interface ViewportInfo {
  startRow: number;
  endRow: number;
  startCol: number;
  endCol: number;
  visibleCells: CellData[];
}

interface VirtualDOMConfig {
  gridRows: number;
  gridCols: number;
  cellWidth: number;
  cellHeight: number;
  overscan?: number;
  enableVirtualization?: boolean;
  reuseElements?: boolean;
  enableLogging?: boolean;
}

interface RenderStats {
  totalCells: number;
  renderedCells: number;
  reusedElements: number;
  renderTime: number;
  memoryUsage: string;
}

class VirtualDOMRenderer {
  private container: HTMLElement;
  private config: Required<VirtualDOMConfig>;
  private cellElements: Map<string, HTMLElement> = new Map();
  private elementPool: HTMLElement[] = [];
  private currentData: CellData[] = [];
  private lastViewport: ViewportInfo | null = null;
  private renderStats: RenderStats;

  // Configuration constants
  private static readonly DEFAULT_CONFIG = {
    overscan: 5,
    enableVirtualization: true,
    reuseElements: true,
    enableLogging: process.env.NODE_ENV === 'development'
  } as const;

  constructor(container: HTMLElement, config: VirtualDOMConfig) {
    this.container = container;
    this.config = {
      ...VirtualDOMRenderer.DEFAULT_CONFIG,
      ...config
    };

    this.renderStats = {
      totalCells: 0,
      renderedCells: 0,
      reusedElements: 0,
      renderTime: 0,
      memoryUsage: '0KB'
    };

    this.initializeContainer();

    if (this.config.enableLogging) {
      console.debug('[VirtualDOMRenderer] Initialized for grid:', 
        `${this.config.gridRows}x${this.config.gridCols}`);
    }
  }

  /**
   * データレンダリング
   * Render cell data
   */
  render(data: CellData[]): RenderStats {
    const startTime = performance.now();
    
    this.currentData = data;
    this.renderStats.totalCells = data.length;

    if (this.config.enableVirtualization) {
      const viewport = this.calculateViewport();
      this.renderViewport(viewport);
    } else {
      this.renderAllCells(data);
    }

    this.renderStats.renderTime = performance.now() - startTime;
    this.updateMemoryStats();

    if (this.config.enableLogging) {
      console.debug('[VirtualDOMRenderer] Render complete:', this.renderStats);
    }

    return { ...this.renderStats };
  }

  /**
   * 部分更新
   * Update specific cells
   */
  updateCells(updates: CellData[]): void {
    const startTime = performance.now();
    let updatedCount = 0;

    updates.forEach(cellData => {
      const cellKey = this.getCellKey(cellData.row, cellData.col);
      const element = this.cellElements.get(cellKey);

      if (element) {
        this.updateCellElement(element, cellData);
        updatedCount++;
      } else if (this.isInViewport(cellData.row, cellData.col)) {
        // Cell is in viewport but not rendered - full re-render needed
        const updatedData = this.currentData.map(cell =>
          cell.row === cellData.row && cell.col === cellData.col ? cellData : cell
        );
        this.currentData = updatedData;
        this.render(this.currentData);
        return;
      }
    });

    const updateTime = performance.now() - startTime;

    if (this.config.enableLogging) {
      console.debug(`[VirtualDOMRenderer] Updated ${updatedCount} cells in ${updateTime.toFixed(2)}ms`);
    }
  }

  /**
   * スクロール処理
   * Handle scroll events
   */
  onScroll(): void {
    if (!this.config.enableVirtualization) return;

    const viewport = this.calculateViewport();
    
    // Check if viewport changed significantly
    if (this.hasViewportChanged(viewport)) {
      this.renderViewport(viewport);
      this.lastViewport = viewport;
    }
  }

  /**
   * セル検索
   * Find cell element
   */
  findCell(row: number, col: number): HTMLElement | null {
    const cellKey = this.getCellKey(row, col);
    return this.cellElements.get(cellKey) || null;
  }

  /**
   * 統計情報取得
   * Get render statistics
   */
  getStatistics(): RenderStats & {
    poolSize: number;
    activeElements: number;
    viewportInfo: ViewportInfo | null;
  } {
    return {
      ...this.renderStats,
      poolSize: this.elementPool.length,
      activeElements: this.cellElements.size,
      viewportInfo: this.lastViewport
    };
  }

  /**
   * クリーンアップ
   * Cleanup renderer
   */
  cleanup(): void {
    this.cellElements.clear();
    this.elementPool.length = 0;
    this.container.innerHTML = '';
    this.currentData.length = 0;
    this.lastViewport = null;

    if (this.config.enableLogging) {
      console.debug('[VirtualDOMRenderer] Cleaned up');
    }
  }

  /**
   * コンテナ初期化
   * Initialize container
   */
  private initializeContainer(): void {
    this.container.style.position = 'relative';
    this.container.style.overflow = 'auto';
    this.container.style.height = `${this.config.gridRows * this.config.cellHeight}px`;
    this.container.style.width = `${this.config.gridCols * this.config.cellWidth}px`;

    // Add scroll listener for virtual scrolling
    if (this.config.enableVirtualization) {
      this.container.addEventListener('scroll', () => this.onScroll(), { passive: true });
    }
  }

  /**
   * ビューポート計算
   * Calculate visible viewport
   */
  private calculateViewport(): ViewportInfo {
    const scrollTop = this.container.scrollTop;
    const scrollLeft = this.container.scrollLeft;
    const containerHeight = this.container.clientHeight;
    const containerWidth = this.container.clientWidth;

    const startRow = Math.max(0, Math.floor(scrollTop / this.config.cellHeight) - this.config.overscan);
    const endRow = Math.min(
      this.config.gridRows - 1,
      Math.floor((scrollTop + containerHeight) / this.config.cellHeight) + this.config.overscan
    );

    const startCol = Math.max(0, Math.floor(scrollLeft / this.config.cellWidth) - this.config.overscan);
    const endCol = Math.min(
      this.config.gridCols - 1,
      Math.floor((scrollLeft + containerWidth) / this.config.cellWidth) + this.config.overscan
    );

    const visibleCells = this.currentData.filter(cell =>
      cell.row >= startRow && cell.row <= endRow &&
      cell.col >= startCol && cell.col <= endCol
    );

    return { startRow, endRow, startCol, endCol, visibleCells };
  }

  /**
   * ビューポートレンダリング
   * Render viewport cells
   */
  private renderViewport(viewport: ViewportInfo): void {
    // Remove cells outside viewport
    const keysToRemove: string[] = [];
    this.cellElements.forEach((element, key) => {
      const [row, col] = key.split('_').map(Number);
      if (row < viewport.startRow || row > viewport.endRow ||
          col < viewport.startCol || col > viewport.endCol) {
        this.recycleCellElement(element);
        keysToRemove.push(key);
      }
    });

    keysToRemove.forEach(key => this.cellElements.delete(key));

    // Render visible cells
    viewport.visibleCells.forEach(cellData => {
      const cellKey = this.getCellKey(cellData.row, cellData.col);
      
      if (!this.cellElements.has(cellKey)) {
        const element = this.createCellElement(cellData);
        this.cellElements.set(cellKey, element);
      }
    });

    this.renderStats.renderedCells = viewport.visibleCells.length;
  }

  /**
   * 全セルレンダリング
   * Render all cells (non-virtualized)
   */
  private renderAllCells(data: CellData[]): void {
    // Clear existing elements
    this.container.innerHTML = '';
    this.cellElements.clear();

    data.forEach(cellData => {
      const element = this.createCellElement(cellData);
      const cellKey = this.getCellKey(cellData.row, cellData.col);
      this.cellElements.set(cellKey, element);
    });

    this.renderStats.renderedCells = data.length;
  }

  /**
   * セル要素作成
   * Create cell element
   */
  private createCellElement(cellData: CellData): HTMLElement {
    let element: HTMLElement;

    // Try to reuse from pool
    if (this.config.reuseElements && this.elementPool.length > 0) {
      element = this.elementPool.pop()!;
      this.renderStats.reusedElements++;
    } else {
      element = document.createElement('div');
      element.style.position = 'absolute';
      element.style.boxSizing = 'border-box';
    }

    this.updateCellElement(element, cellData);
    this.container.appendChild(element);

    return element;
  }

  /**
   * セル要素更新
   * Update cell element
   */
  private updateCellElement(element: HTMLElement, cellData: CellData): void {
    // Position
    element.style.left = `${cellData.col * this.config.cellWidth}px`;
    element.style.top = `${cellData.row * this.config.cellHeight}px`;
    element.style.width = `${this.config.cellWidth}px`;
    element.style.height = `${this.config.cellHeight}px`;

    // Content
    element.textContent = cellData.content;

    // Class name
    element.className = cellData.className || 'virtual-cell';

    // Custom styles
    if (cellData.style) {
      Object.assign(element.style, cellData.style);
    }

    // Custom attributes
    if (cellData.attributes) {
      Object.entries(cellData.attributes).forEach(([key, value]) => {
        element.setAttribute(key, value);
      });
    }

    // Data attributes for identification
    element.setAttribute('data-row', cellData.row.toString());
    element.setAttribute('data-col', cellData.col.toString());
  }

  /**
   * セル要素リサイクル
   * Recycle cell element to pool
   */
  private recycleCellElement(element: HTMLElement): void {
    if (this.config.reuseElements && this.elementPool.length < 100) {
      element.remove();
      element.textContent = '';
      element.className = '';
      
      // Clear custom attributes but keep position styles
      Array.from(element.attributes).forEach(attr => {
        if (attr.name.startsWith('data-') || !attr.name.startsWith('style')) {
          element.removeAttribute(attr.name);
        }
      });

      this.elementPool.push(element);
    } else {
      element.remove();
    }
  }

  /**
   * セルキー生成
   * Generate cell key
   */
  private getCellKey(row: number, col: number): string {
    return `${row}_${col}`;
  }

  /**
   * ビューポート内チェック
   * Check if cell is in viewport
   */
  private isInViewport(row: number, col: number): boolean {
    if (!this.lastViewport) return false;
    
    return row >= this.lastViewport.startRow && row <= this.lastViewport.endRow &&
           col >= this.lastViewport.startCol && col <= this.lastViewport.endCol;
  }

  /**
   * ビューポート変更チェック
   * Check if viewport changed
   */
  private hasViewportChanged(viewport: ViewportInfo): boolean {
    if (!this.lastViewport) return true;

    return this.lastViewport.startRow !== viewport.startRow ||
           this.lastViewport.endRow !== viewport.endRow ||
           this.lastViewport.startCol !== viewport.startCol ||
           this.lastViewport.endCol !== viewport.endCol;
  }

  /**
   * メモリ統計更新
   * Update memory statistics
   */
  private updateMemoryStats(): void {
    const elementCount = this.cellElements.size + this.elementPool.length;
    const estimatedMemoryKB = elementCount * 0.5; // 500 bytes per element estimate
    
    this.renderStats.memoryUsage = estimatedMemoryKB < 1024
      ? `${estimatedMemoryKB.toFixed(1)}KB`
      : `${(estimatedMemoryKB / 1024).toFixed(1)}MB`;
  }
}

export { VirtualDOMRenderer, type CellData, type VirtualDOMConfig, type RenderStats };