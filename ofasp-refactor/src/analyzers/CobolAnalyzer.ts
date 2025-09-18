/**
 * COBOL Analyzer for OpenASP AX
 */

import { BaseAnalyzer, AnalysisResult } from './BaseAnalyzer';
import * as path from 'path';

export class CobolAnalyzer extends BaseAnalyzer {
  
  analyze(filePath: string, content: string): AnalysisResult {
    const lines = content.split('\n');
    const fileName = path.basename(filePath);
    
    const result: AnalysisResult = {
      fileName,
      filePath,
      fileType: 'COBOL',
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
        programId: '',
        hasSQL: false,
        hasCICS: false,
        divisions: []
      },
      analysisDate: new Date()
    };

    // Mark this asset as analyzed
    this.markAsAnalyzed(fileName);

    // Analyze each line
    lines.forEach((line, index) => {
      const lineNum = index + 1;
      const upperLine = line.toUpperCase().trim();
      
      // Extract PROGRAM-ID
      if (upperLine.includes('PROGRAM-ID')) {
        const match = line.match(/PROGRAM-ID\.\s*(\S+)/i);
        if (match) {
          result.metadata.programId = match[1];
        }
      }
      
      // Detect divisions
      const divisions = ['IDENTIFICATION', 'ENVIRONMENT', 'DATA', 'PROCEDURE'];
      divisions.forEach(div => {
        if (upperLine.includes(`${div} DIVISION`)) {
          result.metadata.divisions.push(div);
        }
      });
      
      // Find CALL statements
      if (upperLine.includes('CALL')) {
        const callMatch = line.match(/CALL\s+['"]?(\w+)['"]?/i);
        if (callMatch) {
          const calledProgram = callMatch[1];
          if (!result.dependencies.programs.includes(calledProgram)) {
            result.dependencies.programs.push(calledProgram);
          }
        }
      }
      
      // Find COPY statements
      if (upperLine.includes('COPY')) {
        const copyMatch = line.match(/COPY\s+(\w+)/i);
        if (copyMatch) {
          const copybook = copyMatch[1];
          if (!result.dependencies.copybooks.includes(copybook)) {
            result.dependencies.copybooks.push(copybook);
          }
        }
      }
      
      // Find EXEC SQL statements
      if (upperLine.includes('EXEC SQL') || upperLine.includes('EXEC-SQL')) {
        result.metadata.hasSQL = true;
        
        // Extract table names from SQL
        const sqlMatch = line.match(/FROM\s+(\w+)|INTO\s+(\w+)|UPDATE\s+(\w+)|DELETE\s+FROM\s+(\w+)/i);
        if (sqlMatch) {
          const tableName = sqlMatch[1] || sqlMatch[2] || sqlMatch[3] || sqlMatch[4];
          if (tableName && !result.dependencies.sqlTables.includes(tableName)) {
            result.dependencies.sqlTables.push(tableName);
          }
        }
      }
      
      // Find EXEC CICS statements
      if (upperLine.includes('EXEC CICS')) {
        result.metadata.hasCICS = true;
        
        // Extract SEND MAP / RECEIVE MAP
        if (upperLine.includes('SEND MAP') || upperLine.includes('RECEIVE MAP')) {
          const mapMatch = line.match(/MAP\s*\(\s*['"]?(\w+)['"]?\s*\)/i);
          if (mapMatch && !result.dependencies.maps.includes(mapMatch[1])) {
            result.dependencies.maps.push(mapMatch[1]);
          }
        }
      }
      
      // Find file operations
      const fileOps = ['OPEN', 'CLOSE', 'READ', 'WRITE', 'REWRITE', 'DELETE'];
      fileOps.forEach(op => {
        if (upperLine.startsWith(op) || upperLine.includes(` ${op} `)) {
          const fileMatch = line.match(new RegExp(`${op}\\s+(\\w+)`, 'i'));
          if (fileMatch && !result.dependencies.files.includes(fileMatch[1])) {
            result.dependencies.files.push(fileMatch[1]);
          }
        }
      });
      
      // Detect unsupported statements
      const unsupportedPatterns = [
        { pattern: /SORT\s+\w+/, reason: 'SORT statement needs special handling' },
        { pattern: /MERGE\s+\w+/, reason: 'MERGE statement needs special handling' },
        { pattern: /EXEC\s+DLI/, reason: 'DL/I database calls not supported' },
        { pattern: /EXEC\s+IDMS/, reason: 'IDMS database calls not supported' }
      ];
      
      unsupportedPatterns.forEach(({ pattern, reason }) => {
        if (pattern.test(line)) {
          result.unsupportedStatements.push({
            statement: line.trim(),
            lineNumber: lineNum,
            reason
          });
        }
      });
    });
    
    return result;
  }
  
  /**
   * Check for missing assets based on dependencies
   */
  checkMissingAssets(result: AnalysisResult, availableAssets: Set<string>): void {
    // Check for missing called programs
    result.dependencies.programs.forEach(program => {
      if (!availableAssets.has(program) && !availableAssets.has(`${program}.cob`)) {
        result.missingAssets.push({
          type: 'PROGRAM',
          name: program,
          referencedAt: 0 // Would need line tracking for accurate line numbers
        });
      }
    });
    
    // Check for missing copybooks
    result.dependencies.copybooks.forEach(copybook => {
      if (!availableAssets.has(copybook) && !availableAssets.has(`${copybook}.cpy`)) {
        result.missingAssets.push({
          type: 'COPYBOOK',
          name: copybook,
          referencedAt: 0
        });
      }
    });
    
    // Check for missing maps
    result.dependencies.maps.forEach(map => {
      if (!availableAssets.has(map) && !availableAssets.has(`${map}.smed`)) {
        result.missingAssets.push({
          type: 'MAP',
          name: map,
          referencedAt: 0
        });
      }
    });
  }
}