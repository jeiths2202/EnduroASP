/**
 * Component Complexity Splitter Utility
 * コンポーネント複雑度分割ユーティリティ
 * 
 * 使用方法:
 * const splitter = new ComponentSplitter(componentConfig);
 * const subComponents = splitter.splitByResponsibility();
 * 
 * 機能:
 * - Component complexity analysis and splitting
 * - Responsibility-based decomposition
 * - Hook extraction utilities
 */

interface ComponentMetrics {
  totalLines: number;
  stateVariables: number;
  eventHandlers: number;
  useEffects: number;
  renderComplexity: number;
  cyclomaticComplexity: number;
}

interface SplitComponentConfig {
  componentName: string;
  maxLinesPerComponent?: number;
  maxStateVariables?: number;
  maxEventHandlers?: number;
  enableLogging?: boolean;
}

interface ComponentSplit {
  componentName: string;
  responsibility: string;
  suggestedHooks: string[];
  extractedLogic: string[];
  dependencies: string[];
  estimatedLines: number;
}

class ComponentSplitter {
  private config: Required<SplitComponentConfig>;

  // Configuration constants
  private static readonly COMPLEXITY_THRESHOLDS = {
    MAX_LINES_PER_COMPONENT: 150,
    MAX_STATE_VARIABLES: 8,
    MAX_EVENT_HANDLERS: 6,
    MAX_USE_EFFECTS: 4,
    HIGH_COMPLEXITY_SCORE: 50
  } as const;

  private static readonly RESPONSIBILITY_PATTERNS = {
    UI_RENDERING: ['render', 'display', 'view', 'layout'],
    STATE_MANAGEMENT: ['state', 'data', 'store', 'model'],
    EVENT_HANDLING: ['handler', 'event', 'action', 'trigger'],
    SIDE_EFFECTS: ['effect', 'api', 'fetch', 'request'],
    VALIDATION: ['validate', 'check', 'verify', 'sanitize']
  } as const;

  constructor(config: SplitComponentConfig) {
    this.config = {
      maxLinesPerComponent: config.maxLinesPerComponent ?? ComponentSplitter.COMPLEXITY_THRESHOLDS.MAX_LINES_PER_COMPONENT,
      maxStateVariables: config.maxStateVariables ?? ComponentSplitter.COMPLEXITY_THRESHOLDS.MAX_STATE_VARIABLES,
      maxEventHandlers: config.maxEventHandlers ?? ComponentSplitter.COMPLEXITY_THRESHOLDS.MAX_EVENT_HANDLERS,
      enableLogging: config.enableLogging ?? (process.env.NODE_ENV === 'development'),
      componentName: config.componentName
    };
  }

  /**
   * 複雑度分析
   * Analyze component complexity
   */
  analyzeComplexity(sourceCode: string): ComponentMetrics {
    const lines = sourceCode.split('\n');
    const totalLines = lines.filter(line => line.trim()).length;

    // State variables analysis
    const statePattern = /useState|useReducer|this\.state/g;
    const stateMatches = sourceCode.match(statePattern) || [];
    const stateVariables = stateMatches.length;

    // Event handlers analysis
    const handlerPattern = /const\s+handle\w+|function\s+handle\w+|on\w+\s*=/g;
    const handlerMatches = sourceCode.match(handlerPattern) || [];
    const eventHandlers = handlerMatches.length;

    // useEffect analysis
    const effectPattern = /useEffect\s*\(/g;
    const effectMatches = sourceCode.match(effectPattern) || [];
    const useEffects = effectMatches.length;

    // Render complexity (JSX elements count)
    const jsxPattern = /<[A-Z]\w*|<[a-z]+/g;
    const jsxMatches = sourceCode.match(jsxPattern) || [];
    const renderComplexity = jsxMatches.length;

    // Cyclomatic complexity (simplified)
    const complexityPattern = /if\s*\(|while\s*\(|for\s*\(|\?\s*:|switch\s*\(|catch\s*\(/g;
    const complexityMatches = sourceCode.match(complexityPattern) || [];
    const cyclomaticComplexity = complexityMatches.length + 1;

    const metrics: ComponentMetrics = {
      totalLines,
      stateVariables,
      eventHandlers,
      useEffects,
      renderComplexity,
      cyclomaticComplexity
    };

    if (this.config.enableLogging) {
      console.debug(`[ComponentSplitter] ${this.config.componentName} complexity:`, metrics);
    }

    return metrics;
  }

  /**
   * 責任ベース分割提案
   * Suggest responsibility-based splits
   */
  splitByResponsibility(sourceCode: string): ComponentSplit[] {
    const metrics = this.analyzeComplexity(sourceCode);
    const splits: ComponentSplit[] = [];

    // UI Rendering Component
    if (metrics.renderComplexity > 10) {
      splits.push({
        componentName: `${this.config.componentName}Display`,
        responsibility: 'UI Rendering and Layout',
        suggestedHooks: ['useDisplayMode', 'useLayoutConfig'],
        extractedLogic: [
          'JSX rendering logic',
          'Conditional rendering',
          'Layout calculations',
          'Style computations'
        ],
        dependencies: ['React', 'CSS-in-JS library'],
        estimatedLines: Math.min(80, Math.floor(metrics.renderComplexity * 2))
      });
    }

    // State Management Component
    if (metrics.stateVariables > this.config.maxStateVariables) {
      splits.push({
        componentName: `${this.config.componentName}State`,
        responsibility: 'State Management and Data Flow',
        suggestedHooks: ['useComponentState', 'useDataFlow'],
        extractedLogic: [
          'State initialization',
          'State updates',
          'Derived state calculations',
          'State validation'
        ],
        dependencies: ['React useState/useReducer', 'State management library'],
        estimatedLines: Math.min(100, metrics.stateVariables * 8)
      });
    }

    // Event Handler Component
    if (metrics.eventHandlers > this.config.maxEventHandlers) {
      splits.push({
        componentName: `${this.config.componentName}Handlers`,
        responsibility: 'Event Handling and User Interactions',
        suggestedHooks: ['useEventHandlers', 'useInteractionState'],
        extractedLogic: [
          'Event handler functions',
          'User interaction logic',
          'Event delegation setup',
          'Handler cleanup'
        ],
        dependencies: ['Event handler registry', 'Custom hooks'],
        estimatedLines: Math.min(120, metrics.eventHandlers * 12)
      });
    }

    // Side Effects Component
    if (metrics.useEffects > ComponentSplitter.COMPLEXITY_THRESHOLDS.MAX_USE_EFFECTS) {
      splits.push({
        componentName: `${this.config.componentName}Effects`,
        responsibility: 'Side Effects and External Integrations',
        suggestedHooks: ['useAsyncEffects', 'useExternalAPI'],
        extractedLogic: [
          'API calls',
          'External service integration',
          'Cleanup effects',
          'Dependency management'
        ],
        dependencies: ['HTTP client', 'External APIs', 'Cleanup utilities'],
        estimatedLines: Math.min(90, metrics.useEffects * 15)
      });
    }

    // Business Logic Component
    if (metrics.cyclomaticComplexity > 15) {
      splits.push({
        componentName: `${this.config.componentName}Logic`,
        responsibility: 'Business Logic and Data Processing',
        suggestedHooks: ['useBusinessLogic', 'useDataProcessor'],
        extractedLogic: [
          'Business rule validation',
          'Data transformation',
          'Calculation logic',
          'Conditional processing'
        ],
        dependencies: ['Validation utilities', 'Data processors'],
        estimatedLines: Math.min(110, metrics.cyclomaticComplexity * 4)
      });
    }

    if (this.config.enableLogging && splits.length > 0) {
      console.debug(`[ComponentSplitter] Suggested ${splits.length} component splits for ${this.config.componentName}`);
    }

    return splits;
  }

  /**
   * フック抽出提案
   * Suggest hook extractions
   */
  suggestHookExtractions(sourceCode: string): Array<{
    hookName: string;
    purpose: string;
    extractedCode: string[];
    estimatedLines: number;
  }> {
    const hooks: Array<{
      hookName: string;
      purpose: string;
      extractedCode: string[];
      estimatedLines: number;
    }> = [];

    // Timer/Interval logic
    if (sourceCode.includes('setInterval') || sourceCode.includes('setTimeout')) {
      hooks.push({
        hookName: 'useTimerEffects',
        purpose: 'Timer and interval management with cleanup',
        extractedCode: ['Timer setup', 'Interval management', 'Cleanup logic'],
        estimatedLines: 45
      });
    }

    // API calls
    if (sourceCode.includes('fetch(') || sourceCode.includes('axios') || sourceCode.includes('api.')) {
      hooks.push({
        hookName: 'useApiData',
        purpose: 'API data fetching and state management',
        extractedCode: ['API calls', 'Loading states', 'Error handling'],
        estimatedLines: 60
      });
    }

    // WebSocket logic
    if (sourceCode.includes('WebSocket') || sourceCode.includes('socket')) {
      hooks.push({
        hookName: 'useWebSocketConnection',
        purpose: 'WebSocket connection and message handling',
        extractedCode: ['Connection setup', 'Message handlers', 'Reconnection logic'],
        estimatedLines: 75
      });
    }

    // Form handling
    if (sourceCode.includes('onSubmit') || sourceCode.includes('onChange') || sourceCode.includes('form')) {
      hooks.push({
        hookName: 'useFormManagement',
        purpose: 'Form state and validation management',
        extractedCode: ['Form state', 'Validation logic', 'Submit handling'],
        estimatedLines: 55
      });
    }

    return hooks;
  }

  /**
   * 分割実行可能性スコア
   * Calculate split feasibility score
   */
  calculateSplitScore(metrics: ComponentMetrics): {
    score: number;
    recommendation: 'immediate' | 'recommended' | 'optional' | 'unnecessary';
    reasons: string[];
  } {
    let score = 0;
    const reasons: string[] = [];

    // Lines of code penalty
    if (metrics.totalLines > this.config.maxLinesPerComponent) {
      const excess = metrics.totalLines - this.config.maxLinesPerComponent;
      score += excess * 0.5;
      reasons.push(`Exceeds line limit by ${excess} lines`);
    }

    // State complexity penalty
    if (metrics.stateVariables > this.config.maxStateVariables) {
      score += (metrics.stateVariables - this.config.maxStateVariables) * 5;
      reasons.push(`Too many state variables: ${metrics.stateVariables}`);
    }

    // Event handler penalty
    if (metrics.eventHandlers > this.config.maxEventHandlers) {
      score += (metrics.eventHandlers - this.config.maxEventHandlers) * 3;
      reasons.push(`Too many event handlers: ${metrics.eventHandlers}`);
    }

    // Cyclomatic complexity penalty
    if (metrics.cyclomaticComplexity > 15) {
      score += (metrics.cyclomaticComplexity - 15) * 2;
      reasons.push(`High cyclomatic complexity: ${metrics.cyclomaticComplexity}`);
    }

    // Determine recommendation
    let recommendation: 'immediate' | 'recommended' | 'optional' | 'unnecessary';
    if (score >= 50) {
      recommendation = 'immediate';
    } else if (score >= 25) {
      recommendation = 'recommended';
    } else if (score >= 10) {
      recommendation = 'optional';
    } else {
      recommendation = 'unnecessary';
    }

    return { score, recommendation, reasons };
  }
}

export { ComponentSplitter, type ComponentMetrics, type ComponentSplit };