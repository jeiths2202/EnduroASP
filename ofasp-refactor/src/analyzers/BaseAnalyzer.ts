/**
 * Base Analyzer Interface for OpenASP AX
 */

export interface AnalysisResult {
  fileName: string;
  filePath: string;
  fileType: 'COBOL' | 'COPYBOOK' | 'CL' | 'SMED';
  encoding: 'EBCDIC' | 'ASCII';
  size: number;
  lineCount: number;
  dependencies: {
    programs: string[];      // Called programs
    copybooks: string[];     // COPY statements
    maps: string[];         // SMED maps
    files: string[];        // File operations
    sqlTables: string[];    // SQL tables
  };
  missingAssets: {
    type: string;
    name: string;
    referencedAt: number;   // Line number
  }[];
  unsupportedStatements: {
    statement: string;
    lineNumber: number;
    reason: string;
  }[];
  metadata: Record<string, any>;
  analysisDate: Date;
}

export abstract class BaseAnalyzer {
  protected analyzedAssets: Set<string> = new Set();
  
  abstract analyze(filePath: string, content: string): AnalysisResult;
  
  protected detectEncoding(content: string): 'EBCDIC' | 'ASCII' {
    const hasEBCDICChars = /[\u0081-\u0089\u0091-\u0099\u00A2-\u00A9\u00C1-\u00C9\u00D1-\u00D9\u00E2-\u00E9\u00F0-\u00F9]/.test(content);
    return hasEBCDICChars ? 'EBCDIC' : 'ASCII';
  }
  
  protected isAnalyzed(assetName: string): boolean {
    return this.analyzedAssets.has(assetName);
  }
  
  protected markAsAnalyzed(assetName: string): void {
    this.analyzedAssets.add(assetName);
  }
}