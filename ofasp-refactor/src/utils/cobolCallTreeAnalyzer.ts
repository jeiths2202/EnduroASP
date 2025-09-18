/**
 * COBOL Call Tree Analyzer
 * Analyzes CALL relationships between COBOL programs and generates tree structure
 */

export interface CallInfo {
  callerProgram: string;
  calleeProgram: string;
  lineNumber?: number;
  callStatement: string;
}

export interface ProgramNode {
  name: string;
  type: 'COBOL' | 'CL';
  children: ProgramNode[];
  calls: CallInfo[];
  isFound: boolean; // Whether the program file exists
  cyclic?: boolean; // In case of circular reference
}

export interface CallTreeResult {
  rootNodes: ProgramNode[];
  allCalls: CallInfo[];
  missingPrograms: string[];
  cyclicReferences: string[][];
}

export class CobolCallTreeAnalyzer {
  private programs: Map<string, string> = new Map(); // Program name -> Source code
  private callCache: Map<string, CallInfo[]> = new Map(); // Cache

  /**
   * Register program file
   */
  addProgram(name: string, sourceCode: string, type: 'COBOL' | 'CL' = 'COBOL'): void {
    const programName = this.normalizeProgramName(name);
    this.programs.set(programName, sourceCode);
    console.log(`Added program: ${programName} (${sourceCode.length} chars)`);
  }

  /**
   * Normalize program name (remove extension, convert to uppercase)
   */
  normalizeProgramName(name: string): string {
    return name
      .replace(/\.(cob|cobol|cpy|copy|cl|cle)$/i, '')
      .toUpperCase()
      .trim();
  }

  /**
   * Extract CALL statements from COBOL source code
   */
  private extractCallStatements(sourceCode: string): CallInfo[] {
    const calls: CallInfo[] = [];
    const lines = sourceCode.split('\n');
    
    // COBOL CALL statement patterns - Modified for more accurate matching
    const callPatterns = [
      // CALL 'PROGRAM-NAME'
      /^\s*CALL\s+['"]([A-Z0-9\-_]+)['"](?:\s+USING.*?)?(?:\s+RETURNING.*?)?/gi,
      // CALL PROGRAM-NAME (without quotes, but only at the start of CALL statement)
      /^\s*CALL\s+([A-Z0-9\-_]+)(?:\s+USING.*?)?(?:\s+RETURNING.*?)?(?:\s*\.?\s*$)/gi
    ];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comment lines
      if (trimmedLine.startsWith('*') || trimmedLine.startsWith('//')) {
        return;
      }

      callPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(trimmedLine)) !== null) {
          const calleeName = match[1].replace(/['"]/g, '').toUpperCase();
          
          // Skip system functions and reserved words
          if (!this.isSystemFunction(calleeName)) {
            calls.push({
              callerProgram: '', // Set later
              calleeProgram: calleeName,
              lineNumber: index + 1,
              callStatement: trimmedLine
            });
          }
        }
      });
    });

    return calls;
  }

  /**
   * Extract CALL statements from CL source code
   */
  private extractCLCallStatements(sourceCode: string): CallInfo[] {
    const calls: CallInfo[] = [];
    const lines = sourceCode.split('\n');
    
    // CL CALL statement patterns
    const callPatterns = [
      // CALL PGM(PROGRAM-NAME)
      /CALL\s+PGM\s*\(\s*([A-Z0-9\-_]+)\s*\)/gi,
      // CALL 'PROGRAM-NAME'
      /CALL\s+['"]([A-Z0-9\-_]+)['"](?:\s+PARM.*?)?/gi,
      // CALL PROGRAM-NAME.LIBRARY (extract program name before dot)
      /CALL\s+([A-Z0-9\-_X]+)\.([A-Z0-9\-_]+)(?:\s|$)/gi,
      // CALL PROGRAM-NAME
      /CALL\s+([A-Z0-9\-_X]+)(?:\s+PARM.*?)?(?:\s|$)/gi
    ];

    lines.forEach((line, index) => {
      const trimmedLine = line.trim();
      
      // Skip comment lines
      if (trimmedLine.startsWith('/*') || trimmedLine.startsWith('//')) {
        return;
      }

      callPatterns.forEach(pattern => {
        let match;
        while ((match = pattern.exec(trimmedLine)) !== null) {
          const calleeName = match[1].replace(/['"]/g, '').toUpperCase();
          
          if (!this.isSystemFunction(calleeName)) {
            calls.push({
              callerProgram: '', // Set later
              calleeProgram: calleeName,
              lineNumber: index + 1,
              callStatement: trimmedLine
            });
          }
        }
      });
    });

    return calls;
  }

  /**
   * Check if it's a system function
   */
  private isSystemFunction(name: string): boolean {
    const systemFunctions = [
      'LENGTH', 'SUBSTR', 'INSPECT', 'STRING', 'UNSTRING',
      'ACCEPT', 'DISPLAY', 'MOVE', 'ADD', 'SUBTRACT',
      'MULTIPLY', 'DIVIDE', 'COMPUTE', 'IF', 'ELSE',
      'END-IF', 'PERFORM', 'EXIT', 'STOP', 'GOBACK',
      // Add COBOL keywords and reserved words
      'TO', 'FROM', 'USING', 'RETURNING', 'GIVING', 'BY',
      'INTO', 'THROUGH', 'THRU', 'UNTIL', 'VARYING',
      'WITH', 'POINTER', 'REFERENCE', 'CONTENT', 'VALUE'
    ];
    return systemFunctions.includes(name);
  }

  /**
   * Get CALL information for specific program (with cache)
   */
  private getCallsForProgram(programName: string): CallInfo[] {
    if (this.callCache.has(programName)) {
      return this.callCache.get(programName)!;
    }

    const sourceCode = this.programs.get(programName);
    if (!sourceCode) {
      return [];
    }

    // Determine if it's COBOL or CL
    const isCL = sourceCode.includes('PGM ') || /CALL\s+PGM\s*\(/i.test(sourceCode);
    const calls = isCL 
      ? this.extractCLCallStatements(sourceCode)
      : this.extractCallStatements(sourceCode);

    // Set caller information
    calls.forEach(call => {
      call.callerProgram = programName;
    });

    this.callCache.set(programName, calls);
    return calls;
  }

  /**
   * Create program node
   */
  private createProgramNode(programName: string, visitedPrograms: Set<string> = new Set()): ProgramNode {
    const calls = this.getCallsForProgram(programName);
    const isFound = this.programs.has(programName);
    
    // Check for circular reference
    if (visitedPrograms.has(programName)) {
      return {
        name: programName,
        type: this.getLanguageType(programName),
        children: [],
        calls: calls,
        isFound: isFound,
        cyclic: true
      };
    }

    const newVisited = new Set(visitedPrograms);
    newVisited.add(programName);

    const children: ProgramNode[] = [];
    
    calls.forEach(call => {
      const childNode = this.createProgramNode(call.calleeProgram, newVisited);
      children.push(childNode);
    });

    return {
      name: programName,
      type: this.getLanguageType(programName),
      children: children,
      calls: calls,
      isFound: isFound
    };
  }

  /**
   * Determine the language type of the program
   */
  private getLanguageType(programName: string): 'COBOL' | 'CL' {
    const sourceCode = this.programs.get(programName);
    if (!sourceCode) return 'COBOL';
    
    const isCL = sourceCode.includes('PGM ') || /CALL\s+PGM\s*\(/i.test(sourceCode);
    return isCL ? 'CL' : 'COBOL';
  }

  /**
   * Analyze CALL relationships of all programs and generate tree structure
   */
  analyzeCallTree(): CallTreeResult {
    const allCalls: CallInfo[] = [];
    const missingPrograms: Set<string> = new Set();
    const cyclicReferences: string[][] = [];

    // Extract CALL information from all programs
    Array.from(this.programs.keys()).forEach(programName => {
      const calls = this.getCallsForProgram(programName);
      allCalls.push(...calls);

      // Check for non-existent programs
      calls.forEach(call => {
        if (!this.programs.has(call.calleeProgram)) {
          missingPrograms.add(call.calleeProgram);
        }
      });
    });

    // Identify root nodes (programs not called by other programs)
    const calledPrograms = new Set(allCalls.map(call => call.calleeProgram));
    const rootPrograms = Array.from(this.programs.keys())
      .filter(program => !calledPrograms.has(program));

    // If there are no root nodes (all mutually referenced), use the first program as root
    if (rootPrograms.length === 0 && this.programs.size > 0) {
      rootPrograms.push(Array.from(this.programs.keys())[0]);
    }

    // Generate tree from each root
    const rootNodes = rootPrograms.map(rootProgram => 
      this.createProgramNode(rootProgram)
    );

    return {
      rootNodes,
      allCalls,
      missingPrograms: Array.from(missingPrograms),
      cyclicReferences
    };
  }

  /**
   * Output tree structure in text format
   */
  printCallTree(result: CallTreeResult): string {
    let output = '=== COBOL Call Tree Analysis ===\n\n';
    
    output += `Total Programs: ${this.programs.size}\n`;
    output += `Total Calls: ${result.allCalls.length}\n`;
    output += `Missing Programs: ${result.missingPrograms.length}\n`;
    output += `Root Programs: ${result.rootNodes.length}\n\n`;

    if (result.missingPrograms.length > 0) {
      output += '❌ Missing Programs:\n';
      result.missingPrograms.forEach(program => {
        output += `  - ${program}\n`;
      });
      output += '\n';
    }

    output += '🌳 Call Tree Structure:\n';
    result.rootNodes.forEach(rootNode => {
      output += this.printNode(rootNode, 0);
    });

    return output;
  }

  /**
   * Output node recursively
   */
  private printNode(node: ProgramNode, depth: number): string {
    const indent = '  '.repeat(depth);
    const icon = node.isFound ? '📄' : '❌';
    const cyclic = node.cyclic ? ' (CYCLIC)' : '';
    const type = node.type === 'CL' ? '[CL]' : '[COBOL]';
    
    let output = `${indent}${icon} ${node.name} ${type}${cyclic}\n`;
    
    if (node.calls.length > 0 && depth < 10) { // Depth limit
      node.children.forEach(child => {
        output += this.printNode(child, depth + 1);
      });
    }
    
    return output;
  }

  /**
   * Output debug information
   */
  printDebugInfo(): void {
    console.log('=== Debug Info ===');
    console.log(`Registered Programs: ${this.programs.size}`);
    
    Array.from(this.programs.entries()).forEach(([name, code]) => {
      const calls = this.getCallsForProgram(name);
      console.log(`${name}: ${calls.length} calls, ${code.length} chars`);
      calls.forEach(call => {
        console.log(`  -> ${call.calleeProgram} (line: ${call.lineNumber})`);
      });
    });
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.callCache.clear();
  }

  /**
   * Clear all data
   */
  clear(): void {
    this.programs.clear();
    this.callCache.clear();
  }
}