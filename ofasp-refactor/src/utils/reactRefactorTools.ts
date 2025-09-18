/**
 * React Refactor Tools
 * React リファクタリングツール
 * 
 * 使用方法:
 * const refactorHelper = new ReactRefactorTools();
 * const suggestions = refactorHelper.analyzeComponent(sourceCode);
 * 
 * 機能:
 * - React component analysis and refactoring suggestions
 * - Hook extraction utilities
 * - Performance optimization recommendations
 */

interface RefactorSuggestion {
  type: 'hook_extraction' | 'component_split' | 'performance' | 'pattern_improvement';
  priority: 'high' | 'medium' | 'low';
  description: string;
  codeLocation: {
    startLine: number;
    endLine: number;
    snippet: string;
  };
  suggestedFix: string;
  estimatedImpact: 'high' | 'medium' | 'low';
}

interface ComponentAnalysis {
  componentName: string;
  complexityScore: number;
  suggestions: RefactorSuggestion[];
  hookOpportunities: Array<{
    hookName: string;
    purpose: string;
    codeToExtract: string[];
  }>;
  performanceIssues: Array<{
    issue: string;
    solution: string;
    priority: 'high' | 'medium' | 'low';
  }>;
}

class ReactRefactorTools {
  private static readonly COMPLEXITY_PATTERNS = {
    STATE_DECLARATION: /const\s+\[([^,]+),\s*set[A-Z]\w*\]\s*=\s*useState/g,
    EFFECT_HOOK: /useEffect\s*\(/g,
    CALLBACK_HOOK: /useCallback\s*\(/g,
    MEMO_HOOK: /useMemo\s*\(/g,
    EVENT_HANDLER: /const\s+handle\w+|on[A-Z]\w+\s*=/g,
    CONDITIONAL_RENDER: /\{\s*\w+\s*\?\s*[\s\S]*?\:\s*[\s\S]*?\}/g,
    JSX_ELEMENT: /<[A-Z]\w*|<[a-z]+/g
  } as const;

  private static readonly PERFORMANCE_PATTERNS = {
    INLINE_FUNCTION: /on\w+\s*=\s*\{\s*\([^)]*\)\s*=>/g,
    INLINE_OBJECT: /\{\s*\w+\s*:\s*[^}]+\}/g,
    MISSING_DEPENDENCY: /useEffect\s*\([^,]+,\s*\[\s*\]/g,
    UNNECESSARY_RERENDER: /const\s+\w+\s*=\s*useMemo\s*\(\s*\(\)\s*=>\s*[^,]+,\s*\[\s*\]\s*\)/g
  } as const;

  /**
   * コンポーネント分析
   * Analyze React component
   */
  analyzeComponent(sourceCode: string, componentName: string): ComponentAnalysis {
    const complexityScore = this.calculateComplexityScore(sourceCode);
    const suggestions = this.generateRefactorSuggestions(sourceCode);
    const hookOpportunities = this.identifyHookOpportunities(sourceCode);
    const performanceIssues = this.identifyPerformanceIssues(sourceCode);

    return {
      componentName,
      complexityScore,
      suggestions,
      hookOpportunities,
      performanceIssues
    };
  }

  /**
   * 複雑度スコア計算
   * Calculate complexity score
   */
  private calculateComplexityScore(sourceCode: string): number {
    let score = 0;
    const lines = sourceCode.split('\n').length;
    
    // Base score from lines of code
    score += Math.floor(lines / 10);

    // State variables penalty
    const stateMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.STATE_DECLARATION) || [];
    score += stateMatches.length * 3;

    // Effects penalty
    const effectMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.EFFECT_HOOK) || [];
    score += effectMatches.length * 4;

    // Event handlers penalty
    const handlerMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.EVENT_HANDLER) || [];
    score += handlerMatches.length * 2;

    // Conditional rendering penalty
    const conditionalMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.CONDITIONAL_RENDER) || [];
    score += conditionalMatches.length * 2;

    // JSX complexity
    const jsxMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.JSX_ELEMENT) || [];
    score += Math.floor(jsxMatches.length / 5);

    return score;
  }

  /**
   * リファクタリング提案生成
   * Generate refactoring suggestions
   */
  private generateRefactorSuggestions(sourceCode: string): RefactorSuggestion[] {
    const suggestions: RefactorSuggestion[] = [];
    const lines = sourceCode.split('\n');

    // Check for large component
    if (lines.length > 200) {
      suggestions.push({
        type: 'component_split',
        priority: 'high',
        description: 'Component is too large and should be split into smaller components',
        codeLocation: this.findCodeLocation(sourceCode, 'function|const.*=.*=>|class'),
        suggestedFix: 'Split into multiple components based on responsibility (UI, Logic, State)',
        estimatedImpact: 'high'
      });
    }

    // Check for multiple useState calls
    const stateMatches = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.STATE_DECLARATION) || [];
    if (stateMatches.length > 6) {
      suggestions.push({
        type: 'hook_extraction',
        priority: 'medium',
        description: 'Multiple state variables detected - consider useReducer or custom hook',
        codeLocation: this.findCodeLocation(sourceCode, 'useState'),
        suggestedFix: 'Create custom hook or use useReducer for related state',
        estimatedImpact: 'medium'
      });
    }

    // Check for complex useEffect
    lines.forEach((line, index) => {
      if (line.includes('useEffect') && this.countBracesInBlock(lines, index) > 10) {
        suggestions.push({
          type: 'hook_extraction',
          priority: 'medium',
          description: 'Complex useEffect detected - consider splitting into multiple effects',
          codeLocation: {
            startLine: index + 1,
            endLine: index + 1,
            snippet: line.trim()
          },
          suggestedFix: 'Split into multiple useEffect hooks with specific purposes',
          estimatedImpact: 'medium'
        });
      }
    });

    // Check for performance issues
    const inlineFunctions = sourceCode.match(ReactRefactorTools.PERFORMANCE_PATTERNS.INLINE_FUNCTION) || [];
    if (inlineFunctions.length > 3) {
      suggestions.push({
        type: 'performance',
        priority: 'high',
        description: 'Multiple inline functions in JSX causing unnecessary re-renders',
        codeLocation: this.findCodeLocation(sourceCode, 'on\\w+\\s*=\\s*\\{'),
        suggestedFix: 'Extract inline functions to useCallback hooks',
        estimatedImpact: 'high'
      });
    }

    return suggestions;
  }

  /**
   * フック抽出機会の特定
   * Identify hook extraction opportunities
   */
  private identifyHookOpportunities(sourceCode: string): Array<{
    hookName: string;
    purpose: string;
    codeToExtract: string[];
  }> {
    const opportunities: Array<{
      hookName: string;
      purpose: string;
      codeToExtract: string[];
    }> = [];

    // API call patterns
    if (sourceCode.includes('fetch(') || sourceCode.includes('axios')) {
      opportunities.push({
        hookName: 'useApiCall',
        purpose: 'Extract API call logic with loading states and error handling',
        codeToExtract: ['API call functions', 'Loading state management', 'Error handling']
      });
    }

    // Form handling patterns
    if (sourceCode.includes('onSubmit') && sourceCode.includes('onChange')) {
      opportunities.push({
        hookName: 'useFormHandler',
        purpose: 'Extract form state management and validation logic',
        codeToExtract: ['Form state', 'Input handlers', 'Validation logic', 'Submit handler']
      });
    }

    // WebSocket patterns
    if (sourceCode.includes('WebSocket') || sourceCode.includes('socket')) {
      opportunities.push({
        hookName: 'useWebSocket',
        purpose: 'Extract WebSocket connection and message handling',
        codeToExtract: ['Connection setup', 'Message handlers', 'Connection cleanup']
      });
    }

    // Timer patterns
    if (sourceCode.includes('setInterval') || sourceCode.includes('setTimeout')) {
      opportunities.push({
        hookName: 'useTimer',
        purpose: 'Extract timer logic with proper cleanup',
        codeToExtract: ['Timer setup', 'Timer cleanup', 'Timer state management']
      });
    }

    // Local storage patterns
    if (sourceCode.includes('localStorage') || sourceCode.includes('sessionStorage')) {
      opportunities.push({
        hookName: 'useLocalStorage',
        purpose: 'Extract local storage logic with synchronization',
        codeToExtract: ['Storage read/write', 'State synchronization', 'Error handling']
      });
    }

    return opportunities;
  }

  /**
   * パフォーマンス問題の特定
   * Identify performance issues
   */
  private identifyPerformanceIssues(sourceCode: string): Array<{
    issue: string;
    solution: string;
    priority: 'high' | 'medium' | 'low';
  }> {
    const issues: Array<{
      issue: string;
      solution: string;
      priority: 'high' | 'medium' | 'low';
    }> = [];

    // Inline functions in render
    const inlineFunctions = sourceCode.match(ReactRefactorTools.PERFORMANCE_PATTERNS.INLINE_FUNCTION) || [];
    if (inlineFunctions.length > 0) {
      issues.push({
        issue: `${inlineFunctions.length} inline functions in JSX causing re-renders`,
        solution: 'Use useCallback to memoize event handlers',
        priority: 'high'
      });
    }

    // Missing dependencies in useEffect
    const missingDeps = sourceCode.match(ReactRefactorTools.PERFORMANCE_PATTERNS.MISSING_DEPENDENCY) || [];
    if (missingDeps.length > 0) {
      issues.push({
        issue: 'useEffect with empty dependency array may have missing dependencies',
        solution: 'Add all used variables to dependency array or use useCallback/useMemo',
        priority: 'medium'
      });
    }

    // Large JSX trees
    const jsxElements = sourceCode.match(ReactRefactorTools.COMPLEXITY_PATTERNS.JSX_ELEMENT) || [];
    if (jsxElements.length > 50) {
      issues.push({
        issue: 'Large JSX tree may cause performance issues',
        solution: 'Consider splitting into smaller components or virtualization',
        priority: 'medium'
      });
    }

    // Unnecessary useMemo with empty deps
    const unnecessaryMemo = sourceCode.match(ReactRefactorTools.PERFORMANCE_PATTERNS.UNNECESSARY_RERENDER) || [];
    if (unnecessaryMemo.length > 0) {
      issues.push({
        issue: 'useMemo with empty dependencies may be unnecessary',
        solution: 'Review if memoization is actually needed or move outside component',
        priority: 'low'
      });
    }

    return issues;
  }

  /**
   * コード位置特定ヘルパー
   * Helper to find code location
   */
  private findCodeLocation(sourceCode: string, pattern: string): {
    startLine: number;
    endLine: number;
    snippet: string;
  } {
    const lines = sourceCode.split('\n');
    const regex = new RegExp(pattern);
    
    for (let i = 0; i < lines.length; i++) {
      if (regex.test(lines[i])) {
        return {
          startLine: i + 1,
          endLine: i + 1,
          snippet: lines[i].trim()
        };
      }
    }

    return {
      startLine: 1,
      endLine: 1,
      snippet: 'Pattern not found'
    };
  }

  /**
   * ブロック内の括弧数カウント
   * Count braces in block
   */
  private countBracesInBlock(lines: string[], startIndex: number): number {
    let braceCount = 0;
    let openBraces = 0;
    
    for (let i = startIndex; i < lines.length && (openBraces > 0 || i === startIndex); i++) {
      const line = lines[i];
      for (const char of line) {
        if (char === '{') {
          openBraces++;
          braceCount++;
        } else if (char === '}') {
          openBraces--;
        }
      }
      
      if (openBraces === 0 && i > startIndex) {
        break;
      }
    }
    
    return braceCount;
  }
}

export { ReactRefactorTools, type ComponentAnalysis, type RefactorSuggestion };