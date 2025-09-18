/**
 * Fujitsu CL (Control Language) Analyzer
 * Analyzes CL programs and extracts dependencies, program calls, and control structures
 */

export interface CLAnalysisResult {
  fileName: string;
  filePath: string;
  fileType: 'CL';
  encoding: 'ASCII' | 'EBCDIC';
  size: number;
  lineCount: number;
  dependencies: {
    programs: string[];
    libraries: string[];
    files: string[];
  };
  missingAssets: string[];
  unsupportedStatements: Array<{
    line: number;
    statement: string;
    reason: string;
  }>;
  metadata: {
    programName: string;
    parameters: string[];
    variables: Array<{
      name: string;
      type: string;
    }>;
    hasErrorHandling: boolean;
    hasFileOperations: boolean;
    hasSortOperations: boolean;
    hasLoops: boolean;
    controlStructures: Array<{
      type: 'IF' | 'CASE' | 'FOR' | 'WHILE';
      line: number;
    }>;
    fileOperations: Array<{
      type: string;
      fileName: string;
      line: number;
    }>;
  };
  analysisDate: string;
}

export class CLAnalyzer {
  private analyzedAssets: Set<string> = new Set();

  analyze(filePath: string, content: string): CLAnalysisResult {
    const lines = content.split('\n');
    const fileName = this.extractFileName(filePath);
    
    const result: CLAnalysisResult = {
      fileName,
      filePath,
      fileType: 'CL',
      encoding: this.detectEncoding(content),
      size: content.length,
      lineCount: lines.length,
      dependencies: {
        programs: [],
        libraries: [],
        files: []
      },
      missingAssets: [],
      unsupportedStatements: [],
      metadata: {
        programName: '',
        parameters: [],
        variables: [],
        hasErrorHandling: false,
        hasFileOperations: false,
        hasSortOperations: false,
        hasLoops: false,
        controlStructures: [],
        fileOperations: []
      },
      analysisDate: new Date().toISOString()
    };

    this.analyzedAssets.add(fileName);
    
    // Parse CL content line by line
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      const upperLine = trimmedLine.toUpperCase();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('*') || trimmedLine === '') {
        return;
      }
      
      // Extract program name
      if (upperLine.startsWith('PGM')) {
        result.metadata.programName = this.extractProgramName(trimmedLine);
      }
      
      // Extract parameters
      if (upperLine.startsWith('PARA')) {
        result.metadata.parameters = this.extractParameters(trimmedLine);
      }
      
      // Extract variables
      if (upperLine.startsWith('VAR')) {
        const variable = this.extractVariable(trimmedLine);
        if (variable) {
          result.metadata.variables.push(variable);
        }
      }
      
      // Extract library definitions
      if (upperLine.includes('DEFLIBL') || upperLine.includes('LIBL-')) {
        const library = this.extractLibrary(trimmedLine);
        if (library && !result.dependencies.libraries.includes(library)) {
          result.dependencies.libraries.push(library);
        }
      }
      
      // Extract CALL statements
      if (upperLine.includes('CALL') && upperLine.includes('PGM-')) {
        const programCall = this.extractProgramCall(trimmedLine);
        if (programCall) {
          if (!result.dependencies.programs.includes(programCall.program)) {
            result.dependencies.programs.push(programCall.program);
          }
          if (programCall.library && !result.dependencies.libraries.includes(programCall.library)) {
            result.dependencies.libraries.push(programCall.library);
          }
        }
      }
      
      // Extract file operations
      if (this.isFileOperation(upperLine)) {
        result.metadata.hasFileOperations = true;
        const fileOp = this.extractFileOperation(trimmedLine, lineNum);
        if (fileOp) {
          result.metadata.fileOperations.push(fileOp);
          if (!result.dependencies.files.includes(fileOp.fileName)) {
            result.dependencies.files.push(fileOp.fileName);
          }
        }
      }
      
      // Extract SORTD operations
      if (upperLine.includes('SORTD')) {
        result.metadata.hasSortOperations = true;
        const sortFiles = this.extractSortFiles(trimmedLine);
        sortFiles.forEach(file => {
          if (!result.dependencies.files.includes(file)) {
            result.dependencies.files.push(file);
          }
        });
      }
      
      // Extract control structures
      const controlStructure = this.extractControlStructure(upperLine, lineNum);
      if (controlStructure) {
        result.metadata.controlStructures.push(controlStructure);
        if (controlStructure.type === 'FOR' || controlStructure.type === 'WHILE') {
          result.metadata.hasLoops = true;
        }
      }
      
      // Check for error handling
      if (upperLine.includes('ERROR') || upperLine.includes('GOTO') || 
          upperLine.includes('IF') && upperLine.includes('RETCODE')) {
        result.metadata.hasErrorHandling = true;
      }
      
      // Check for unsupported statements
      const unsupported = this.checkUnsupportedStatements(trimmedLine, lineNum);
      if (unsupported) {
        result.unsupportedStatements.push(unsupported);
      }
    });
    
    return result;
  }

  private extractFileName(filePath: string): string {
    return filePath.split('/').pop() || '';
  }

  private detectEncoding(content: string): 'ASCII' | 'EBCDIC' {
    // Simple heuristic: check for common EBCDIC characters
    const ebcdicPattern = /[\x40-\x7F\x81-\x9F\xA2-\xFE]/;
    return ebcdicPattern.test(content) ? 'EBCDIC' : 'ASCII';
  }

  private extractProgramName(line: string): string {
    const match = line.match(/PGM\s*\(\s*([^)]+)\s*\)/i);
    return match ? match[1].trim() : '';
  }

  private extractParameters(line: string): string[] {
    const match = line.match(/PARA\s+(.+)/i);
    if (match) {
      return match[1].split(',').map(param => param.trim());
    }
    return [];
  }

  private extractVariable(line: string): { name: string; type: string } | null {
    const match = line.match(/VAR\s+([^,]+),(.+)/i);
    if (match) {
      return {
        name: match[1].trim(),
        type: match[2].trim()
      };
    }
    return null;
  }

  private extractLibrary(line: string): string | null {
    const match = line.match(/LIBL-([A-Z0-9]+)/i);
    return match ? match[1] : null;
  }

  private extractProgramCall(line: string): { program: string; library?: string } | null {
    const match = line.match(/CALL\s+PGM-([^.]+)(?:\.([A-Z0-9]+))?/i);
    if (match) {
      return {
        program: match[1],
        library: match[2] || undefined
      };
    }
    return null;
  }

  private isFileOperation(line: string): boolean {
    const fileOps = ['CRTFILE', 'DLTFILE', 'CPYFILE', 'MOVFILE', 'BAKFILE'];
    return fileOps.some(op => line.includes(op));
  }

  private extractFileOperation(line: string, lineNum: number): { type: string; fileName: string; line: number } | null {
    const fileOps = ['CRTFILE', 'DLTFILE', 'CPYFILE', 'MOVFILE', 'BAKFILE'];
    
    for (const op of fileOps) {
      if (line.toUpperCase().includes(op)) {
        const match = line.match(new RegExp(`${op}\\s+FILE-([A-Z0-9]+)`, 'i'));
        if (match) {
          return {
            type: op,
            fileName: match[1],
            line: lineNum
          };
        }
      }
    }
    return null;
  }

  private extractSortFiles(line: string): string[] {
    const files: string[] = [];
    const infileMatch = line.match(/INFILE-([A-Z0-9]+)/i);
    const outfileMatch = line.match(/OUTFILE-([A-Z0-9]+)/i);
    
    if (infileMatch) files.push(infileMatch[1]);
    if (outfileMatch) files.push(outfileMatch[1]);
    
    return files;
  }

  private extractControlStructure(line: string, lineNum: number): { type: 'IF' | 'CASE' | 'FOR' | 'WHILE'; line: number } | null {
    if (line.startsWith('IF ')) return { type: 'IF', line: lineNum };
    if (line.startsWith('CASE ')) return { type: 'CASE', line: lineNum };
    if (line.startsWith('FOR ')) return { type: 'FOR', line: lineNum };
    if (line.startsWith('WHILE ')) return { type: 'WHILE', line: lineNum };
    return null;
  }

  private checkUnsupportedStatements(line: string, lineNum: number): { line: number; statement: string; reason: string } | null {
    const upperLine = line.toUpperCase();
    
    // Check for potentially unsupported features
    if (upperLine.includes('EXEC SQL')) {
      return {
        line: lineNum,
        statement: line.trim(),
        reason: 'Embedded SQL in CL is not commonly supported'
      };
    }
    
    if (upperLine.includes('EXEC CICS')) {
      return {
        line: lineNum,
        statement: line.trim(),
        reason: 'CICS commands in CL may require special handling'
      };
    }
    
    if (upperLine.includes('DYNVAR')) {
      return {
        line: lineNum,
        statement: line.trim(),
        reason: 'Dynamic variables may not be supported in all environments'
      };
    }
    
    return null;
  }

  getAnalyzedAssets(): string[] {
    return Array.from(this.analyzedAssets);
  }

  reset(): void {
    this.analyzedAssets.clear();
  }
}