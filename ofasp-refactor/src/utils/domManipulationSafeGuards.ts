/**
 * DOM Manipulation Safe Guards
 * DOM操作セーフガード
 * 
 * 使用方法:
 * const safeDOM = new DOMSafeGuards(config);
 * safeDOM.safeQuerySelector('#element');
 * 
 * 機能:
 * - Safe DOM manipulation with error handling
 * - Anti-pattern detection and prevention
 * - Performance monitoring and warnings
 */

interface DOMSafeGuardsConfig {
  enableErrorHandling?: boolean;
  enablePerformanceMonitoring?: boolean;
  enableAntiPatternDetection?: boolean;
  maxOperationsPerFrame?: number;
  enableLogging?: boolean;
}

interface DOMOperation {
  type: 'query' | 'modify' | 'create' | 'remove';
  selector?: string;
  element?: Element;
  timestamp: number;
  duration: number;
}

interface AntiPatternWarning {
  type: 'frequent_queries' | 'layout_thrashing' | 'memory_leak' | 'unsafe_html' | 'excessive_nesting';
  message: string;
  element?: Element;
  suggestion: string;
  severity: 'low' | 'medium' | 'high';
}

interface DOMSafetyStats {
  totalOperations: number;
  averageOperationTime: number;
  antiPatternsDetected: number;
  errorsHandled: number;
  performanceWarnings: number;
}

class DOMSafeGuards {
  private config: Required<DOMSafeGuardsConfig>;
  private operationHistory: DOMOperation[] = [];
  private selectorCache: Map<string, Element | null> = new Map();
  private frameOperationCount: number = 0;
  private lastFrameTime: number = 0;
  private stats: DOMSafetyStats;
  private antiPatternWarnings: AntiPatternWarning[] = [];

  // Configuration constants
  private static readonly DEFAULT_CONFIG = {
    enableErrorHandling: true,
    enablePerformanceMonitoring: true,
    enableAntiPatternDetection: true,
    maxOperationsPerFrame: 100,
    enableLogging: process.env.NODE_ENV === 'development'
  } as const;

  private static readonly PERFORMANCE_THRESHOLDS = {
    SLOW_QUERY_MS: 5,
    EXCESSIVE_OPERATIONS_PER_FRAME: 50,
    MEMORY_LEAK_THRESHOLD: 1000,
    MAX_NESTING_DEPTH: 10
  } as const;

  constructor(config: DOMSafeGuardsConfig = {}) {
    this.config = {
      ...DOMSafeGuards.DEFAULT_CONFIG,
      ...config
    };

    this.stats = {
      totalOperations: 0,
      averageOperationTime: 0,
      antiPatternsDetected: 0,
      errorsHandled: 0,
      performanceWarnings: 0
    };

    if (this.config.enableLogging) {
      console.debug('[DOMSafeGuards] Initialized with config:', this.config);
    }
  }

  /**
   * 安全なクエリセレクタ
   * Safe query selector
   */
  safeQuerySelector<T extends Element = Element>(
    selector: string,
    context: ParentNode = document,
    useCache: boolean = true
  ): T | null {
    const startTime = performance.now();

    try {
      // Check cache first
      if (useCache && this.selectorCache.has(selector)) {
        const cached = this.selectorCache.get(selector) as T | null;
        this.recordOperation('query', selector, undefined, startTime);
        return cached;
      }

      // Validate selector
      if (!this.isValidSelector(selector)) {
        throw new Error(`Invalid selector: ${selector}`);
      }

      // Perform query
      const element = context.querySelector<T>(selector);

      // Cache result
      if (useCache) {
        // Limit cache size
        if (this.selectorCache.size >= 100) {
          const firstKey = this.selectorCache.keys().next().value;
          this.selectorCache.delete(firstKey);
        }
        this.selectorCache.set(selector, element);
      }

      this.recordOperation('query', selector, element || undefined, startTime);
      this.detectQueryAntiPatterns(selector, startTime);

      return element;

    } catch (error) {
      this.handleError('safeQuerySelector', error as Error, { selector });
      return null;
    }
  }

  /**
   * 安全な複数要素クエリ
   * Safe query selector all
   */
  safeQuerySelectorAll<T extends Element = Element>(
    selector: string,
    context: ParentNode = document
  ): T[] {
    const startTime = performance.now();

    try {
      if (!this.isValidSelector(selector)) {
        throw new Error(`Invalid selector: ${selector}`);
      }

      const elements = Array.from(context.querySelectorAll<T>(selector));
      
      this.recordOperation('query', selector, undefined, startTime);
      this.detectQueryAntiPatterns(selector, startTime, elements.length);

      return elements;

    } catch (error) {
      this.handleError('safeQuerySelectorAll', error as Error, { selector });
      return [];
    }
  }

  /**
   * 安全な要素作成
   * Safe element creation
   */
  safeCreateElement<T extends keyof HTMLElementTagNameMap>(
    tagName: T,
    options: {
      className?: string;
      textContent?: string;
      attributes?: Record<string, string>;
      innerHTML?: string;
    } = {}
  ): HTMLElementTagNameMap[T] | null {
    const startTime = performance.now();

    try {
      const element = document.createElement(tagName);

      // Apply options safely
      if (options.className) {
        element.className = options.className;
      }

      if (options.textContent) {
        element.textContent = options.textContent;
      }

      if (options.innerHTML) {
        // Sanitize HTML to prevent XSS
        const sanitizedHTML = this.sanitizeHTML(options.innerHTML);
        element.innerHTML = sanitizedHTML;
      }

      if (options.attributes) {
        Object.entries(options.attributes).forEach(([key, value]) => {
          if (this.isSafeAttribute(key)) {
            element.setAttribute(key, value);
          } else {
            this.addAntiPatternWarning({
              type: 'unsafe_html',
              message: `Unsafe attribute detected: ${key}`,
              element,
              suggestion: 'Use safe attributes and sanitize values',
              severity: 'medium'
            });
          }
        });
      }

      this.recordOperation('create', undefined, element, startTime);
      return element;

    } catch (error) {
      this.handleError('safeCreateElement', error as Error, { tagName, options });
      return null;
    }
  }

  /**
   * 安全な要素削除
   * Safe element removal
   */
  safeRemoveElement(element: Element): boolean {
    const startTime = performance.now();

    try {
      if (!element || !element.parentNode) {
        return false;
      }

      // Check for potential memory leaks
      this.checkForMemoryLeaks(element);

      element.remove();
      this.recordOperation('remove', undefined, element, startTime);
      
      return true;

    } catch (error) {
      this.handleError('safeRemoveElement', error as Error, { element });
      return false;
    }
  }

  /**
   * 安全なスタイル更新
   * Safe style updates
   */
  safeUpdateStyles(
    element: Element,
    styles: Record<string, string>,
    batchUpdate: boolean = true
  ): void {
    const startTime = performance.now();

    try {
      if (!element || !(element instanceof HTMLElement)) {
        throw new Error('Invalid element for style update');
      }

      if (batchUpdate) {
        // Batch style updates to minimize reflows
        const styleString = Object.entries(styles)
          .map(([property, value]) => `${this.kebabCase(property)}: ${value}`)
          .join('; ');
        
        element.style.cssText += '; ' + styleString;
      } else {
        Object.entries(styles).forEach(([property, value]) => {
          (element.style as any)[property] = value;
        });
      }

      this.recordOperation('modify', undefined, element, startTime);
      this.detectLayoutThrashing(element, startTime);

    } catch (error) {
      this.handleError('safeUpdateStyles', error as Error, { element, styles });
    }
  }

  /**
   * クエリキャッシュクリア
   * Clear query cache
   */
  clearQueryCache(): void {
    this.selectorCache.clear();
    
    if (this.config.enableLogging) {
      console.debug('[DOMSafeGuards] Query cache cleared');
    }
  }

  /**
   * 統計情報取得
   * Get safety statistics
   */
  getStatistics(): DOMSafetyStats & {
    cacheSize: number;
    operationHistory: number;
    antiPatternWarnings: AntiPatternWarning[];
  } {
    return {
      ...this.stats,
      cacheSize: this.selectorCache.size,
      operationHistory: this.operationHistory.length,
      antiPatternWarnings: [...this.antiPatternWarnings]
    };
  }

  /**
   * アンチパターン警告取得
   * Get anti-pattern warnings
   */
  getAntiPatternWarnings(severity?: 'low' | 'medium' | 'high'): AntiPatternWarning[] {
    return severity 
      ? this.antiPatternWarnings.filter(warning => warning.severity === severity)
      : [...this.antiPatternWarnings];
  }

  /**
   * 操作記録
   * Record DOM operation
   */
  private recordOperation(
    type: DOMOperation['type'],
    selector?: string,
    element?: Element,
    startTime: number = performance.now()
  ): void {
    const duration = performance.now() - startTime;
    
    const operation: DOMOperation = {
      type,
      selector,
      element,
      timestamp: startTime,
      duration
    };

    this.operationHistory.push(operation);
    
    // Limit history size
    if (this.operationHistory.length > 1000) {
      this.operationHistory.splice(0, 100);
    }

    // Update stats
    this.stats.totalOperations++;
    this.updateAverageOperationTime(duration);

    // Performance monitoring
    if (this.config.enablePerformanceMonitoring) {
      this.monitorFrameOperations();
      
      if (duration > DOMSafeGuards.PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
        this.stats.performanceWarnings++;
        
        if (this.config.enableLogging) {
          console.warn(`[DOMSafeGuards] Slow ${type} operation: ${duration.toFixed(2)}ms`, { selector, element });
        }
      }
    }
  }

  /**
   * セレクタ検証
   * Validate selector
   */
  private isValidSelector(selector: string): boolean {
    if (!selector || typeof selector !== 'string') {
      return false;
    }

    try {
      document.querySelector(selector);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * HTML サニタイズ
   * Sanitize HTML content
   */
  private sanitizeHTML(html: string): string {
    // Basic HTML sanitization (in production, use a proper library like DOMPurify)
    return html
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/javascript:/gi, '')
      .replace(/on\w+\s*=/gi, '');
  }

  /**
   * 安全な属性チェック
   * Check if attribute is safe
   */
  private isSafeAttribute(attribute: string): boolean {
    const unsafeAttributes = ['onclick', 'onload', 'onerror', 'onmouseover', 'onfocus'];
    return !unsafeAttributes.some(unsafe => attribute.toLowerCase().includes(unsafe));
  }

  /**
   * ケバブケース変換
   * Convert to kebab-case
   */
  private kebabCase(str: string): string {
    return str.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  }

  /**
   * クエリアンチパターン検出
   * Detect query anti-patterns
   */
  private detectQueryAntiPatterns(selector: string, startTime: number, resultCount?: number): void {
    if (!this.config.enableAntiPatternDetection) return;

    const duration = performance.now() - startTime;

    // Frequent queries for same selector
    const recentQueries = this.operationHistory
      .filter(op => op.type === 'query' && op.selector === selector && op.timestamp > startTime - 1000)
      .length;

    if (recentQueries > 10) {
      this.addAntiPatternWarning({
        type: 'frequent_queries',
        message: `Frequent queries detected for selector: ${selector} (${recentQueries} times in 1s)`,
        suggestion: 'Consider caching the element or using event delegation',
        severity: 'medium'
      });
    }

    // Expensive selectors
    if (duration > DOMSafeGuards.PERFORMANCE_THRESHOLDS.SLOW_QUERY_MS) {
      this.addAntiPatternWarning({
        type: 'layout_thrashing',
        message: `Slow selector detected: ${selector} took ${duration.toFixed(2)}ms`,
        suggestion: 'Use more specific selectors or cache results',
        severity: 'high'
      });
    }
  }

  /**
   * レイアウトスラッシング検出
   * Detect layout thrashing
   */
  private detectLayoutThrashing(element: Element, startTime: number): void {
    if (!this.config.enableAntiPatternDetection) return;

    const duration = performance.now() - startTime;
    
    if (duration > 1) { // More than 1ms for style update indicates potential reflow
      this.addAntiPatternWarning({
        type: 'layout_thrashing',
        message: `Potential layout thrashing detected during style update (${duration.toFixed(2)}ms)`,
        element,
        suggestion: 'Batch style updates or use CSS transforms',
        severity: 'medium'
      });
    }
  }

  /**
   * メモリリークチェック
   * Check for memory leaks
   */
  private checkForMemoryLeaks(element: Element): void {
    if (!this.config.enableAntiPatternDetection) return;

    const elementCount = document.querySelectorAll('*').length;
    
    if (elementCount > DOMSafeGuards.PERFORMANCE_THRESHOLDS.MEMORY_LEAK_THRESHOLD) {
      this.addAntiPatternWarning({
        type: 'memory_leak',
        message: `High element count detected: ${elementCount} elements in DOM`,
        element,
        suggestion: 'Check for elements not being properly removed',
        severity: 'high'
      });
    }
  }

  /**
   * フレーム操作数監視
   * Monitor operations per frame
   */
  private monitorFrameOperations(): void {
    const now = performance.now();
    
    if (now - this.lastFrameTime > 16) { // New frame (60fps = 16.67ms)
      this.frameOperationCount = 0;
      this.lastFrameTime = now;
    }

    this.frameOperationCount++;

    if (this.frameOperationCount > this.config.maxOperationsPerFrame) {
      this.stats.performanceWarnings++;
      
      if (this.config.enableLogging) {
        console.warn(`[DOMSafeGuards] Excessive DOM operations in single frame: ${this.frameOperationCount}`);
      }
    }
  }

  /**
   * アンチパターン警告追加
   * Add anti-pattern warning
   */
  private addAntiPatternWarning(warning: AntiPatternWarning): void {
    this.antiPatternWarnings.push(warning);
    this.stats.antiPatternsDetected++;

    // Limit warning history
    if (this.antiPatternWarnings.length > 100) {
      this.antiPatternWarnings.splice(0, 10);
    }

    if (this.config.enableLogging) {
      console.warn(`[DOMSafeGuards] Anti-pattern detected:`, warning);
    }
  }

  /**
   * 平均操作時間更新
   * Update average operation time
   */
  private updateAverageOperationTime(duration: number): void {
    const total = this.stats.averageOperationTime * (this.stats.totalOperations - 1) + duration;
    this.stats.averageOperationTime = total / this.stats.totalOperations;
  }

  /**
   * エラーハンドリング
   * Handle errors
   */
  private handleError(operation: string, error: Error, context: any): void {
    this.stats.errorsHandled++;

    if (this.config.enableErrorHandling) {
      console.error(`[DOMSafeGuards] Error in ${operation}:`, error, context);
    }

    if (!this.config.enableErrorHandling) {
      throw error;
    }
  }
}

export { DOMSafeGuards, type DOMSafeGuardsConfig, type AntiPatternWarning, type DOMSafetyStats };