/**
 * COPYBOOK Analyzer for OpenASP AX
 */

import { BaseAnalyzer, AnalysisResult } from './BaseAnalyzer';
import * as path from 'path';

export class CopybookAnalyzer extends BaseAnalyzer {
  
  analyze(filePath: string, content: string): AnalysisResult {
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    
    const result: AnalysisResult = {
      fileName,
      filePath,
      fileType: 'COPYBOOK',
      encoding: this.detectEncoding(content),
      size: content.length,
      lineCount: lines.length,
      dependencies: {
        programs: [],
        copybooks: [],
        maps: [],
        files: [],
        sqlTables: []
      },
      missingAssets: [],
      unsupportedStatements: [],
      metadata: {
        dataStructures: [],
        totalFields: 0,
        hasRedefines: false,
        hasOccurs: false,
        maxLevel: 0
      },
      analysisDate: new Date()
    };

    // Mark as analyzed
    this.markAsAnalyzed(fileName);

    let currentStructure: any = null;
    let maxLevel = 0;

    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const trimmedLine = line.trim();
      const upperLine = trimmedLine.toUpperCase();
      
      // Skip comments and empty lines
      if (trimmedLine.startsWith('*') || trimmedLine === '') {
        return;
      }
      
      // Parse level number and field definition
      const levelMatch = trimmedLine.match(/^(\d{2})\s+([\w-]+)(.*)$/);
      if (levelMatch) {
        const level = parseInt(levelMatch[1]);
        const fieldName = levelMatch[2];
        const remainder = levelMatch[3] || '';
        
        maxLevel = Math.max(maxLevel, level);
        result.metadata.totalFields++;
        
        // Track 01 level structures
        if (level === 1) {
          currentStructure = {
            name: fieldName,
            fields: [],
            line: lineNum
          };
          result.metadata.dataStructures.push(currentStructure);
        }
        
        // Parse PIC clause
        const picMatch = remainder.match(/PIC\s+([X9A-Z\(\)\-\+\$\,\.]+)/i);
        const picClause = picMatch ? picMatch[1] : null;
        
        // Check for REDEFINES
        if (upperLine.includes('REDEFINES')) {
          result.metadata.hasRedefines = true;
        }
        
        // Check for OCCURS
        if (upperLine.includes('OCCURS')) {
          result.metadata.hasOccurs = true;
        }
        
        // Add field to current structure
        if (currentStructure && level > 1) {
          currentStructure.fields.push({
            level,
            name: fieldName,
            pic: picClause,
            line: lineNum
          });
        }
      }
      
      // Check for nested COPY statements (copybooks can include other copybooks)
      if (upperLine.includes('COPY')) {
        const copyMatch = line.match(/COPY\s+(\w+)/i);
        if (copyMatch) {
          const nestedCopybook = copyMatch[1];
          if (!result.dependencies.copybooks.includes(nestedCopybook)) {
            result.dependencies.copybooks.push(nestedCopybook);
          }
        }
      }
      
      // Detect unsupported features
      const unsupportedPatterns = [
        { pattern: /SYNC|SYNCHRONIZED/, reason: 'SYNCHRONIZED clause needs special handling' },
        { pattern: /USAGE\s+POINTER/, reason: 'POINTER usage not fully supported' },
        { pattern: /USAGE\s+FUNCTION-POINTER/, reason: 'FUNCTION-POINTER usage not supported' }
      ];
      
      unsupportedPatterns.forEach(({ pattern, reason }) => {
        if (pattern.test(upperLine)) {
          result.unsupportedStatements.push({
            statement: trimmedLine,
            lineNumber: lineNum,
            reason
          });
        }
      });
    });
    
    result.metadata.maxLevel = maxLevel;
    
    return result;
  }
  
  /**
   * Validate copybook structure
   */
  validateStructure(result: AnalysisResult): string[] {
    const errors: string[] = [];
    
    // Check if copybook has any 01 level items
    if (result.metadata.dataStructures.length === 0) {
      errors.push('No 01 level data structures found');
    }
    
    // Check for proper level hierarchy
    result.metadata.dataStructures.forEach((structure: any) => {
      let previousLevel = 1;
      structure.fields.forEach((field: any) => {
        if (field.level <= previousLevel && field.level !== previousLevel) {
          errors.push(`Invalid level hierarchy at line ${field.line}: level ${field.level} after ${previousLevel}`);
        }
        previousLevel = field.level;
      });
    });
    
    return errors;
  }
}