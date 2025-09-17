/**
 * Advanced File Type Analyzer for OpenASP AX
 * Analyzes COBOL, COPYBOOK, CL, and SMED files with intelligent detection
 */

export type FileType = 'COBOL' | 'COPYBOOK' | 'CL' | 'SMED' | 'UNKNOWN';

export interface FileAnalysisResult {
  fileName: string;
  fileType: FileType;
  confidence: number; // 0-100
  detectionReasons: string[];
  encoding: 'EBCDIC' | 'ASCII';
  size: number;
  lineCount: number;
  hasSQL: boolean;
  hasMapStatements: boolean;
  hasDataDivision: boolean;
}

class FileAnalyzer {
  
  /**
   * Analyze file content and determine its type
   */
  analyzeFile(fileName: string, content: string, fileSize: number): FileAnalysisResult {
    const lines = content.split('\n');
    const upperContent = content.toUpperCase();
    
    const result: FileAnalysisResult = {
      fileName,
      fileType: 'UNKNOWN',
      confidence: 0,
      detectionReasons: [],
      encoding: this.detectEncoding(content),
      size: fileSize,
      lineCount: lines.length,
      hasSQL: this.hasSQL(upperContent),
      hasMapStatements: this.hasMapStatements(upperContent),
      hasDataDivision: this.hasDataDivision(upperContent)
    };

    // Analyze file type with scoring system
    const scores = {
      COBOL: this.analyzeCobol(fileName, upperContent, lines),
      COPYBOOK: this.analyzeCopybook(fileName, upperContent, lines),
      CL: this.analyzeCL(fileName, upperContent, lines),
      SMED: this.analyzeSMED(fileName, upperContent, lines)
    };

    // Find the highest score
    let maxScore = 0;
    let detectedType: FileType = 'UNKNOWN';
    
    for (const [type, analysis] of Object.entries(scores)) {
      if (analysis.score > maxScore) {
        maxScore = analysis.score;
        detectedType = type as FileType;
        result.detectionReasons = analysis.reasons;
      }
    }

    result.fileType = detectedType;
    result.confidence = Math.min(maxScore, 100);

    return result;
  }

  /**
   * Analyze COBOL file characteristics
   */
  private analyzeCobol(fileName: string, content: string, lines: string[]) {
    let score = 0;
    const reasons: string[] = [];

    // File extension check
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['cob', 'cobol', 'cbl'].includes(ext)) {
      score += 20;
      reasons.push(`COBOL file extension (.${ext})`);
    }

    // COBOL Division keywords
    const divisions = [
      'IDENTIFICATION DIVISION',
      'ENVIRONMENT DIVISION', 
      'DATA DIVISION',
      'PROCEDURE DIVISION'
    ];
    
    divisions.forEach(division => {
      if (content.includes(division)) {
        score += 15;
        reasons.push(`Contains ${division}`);
      }
    });

    // COBOL specific keywords
    const cobolKeywords = [
      'PROGRAM-ID',
      'WORKING-STORAGE SECTION',
      'FILE SECTION',
      'LINKAGE SECTION',
      'EXEC SQL',
      'EXEC CICS'
    ];

    cobolKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        score += 8;
        reasons.push(`Contains ${keyword}`);
      }
    });

    // COBOL PIC clauses
    if (content.match(/PIC\s+[X9]+/)) {
      score += 10;
      reasons.push('Contains PIC clauses');
    }

    // COBOL COPY statements
    if (content.match(/COPY\s+\w+/)) {
      score += 8;
      reasons.push('Contains COPY statements');
    }

    // Check for typical COBOL structure (01 level items)
    const hasLevelNumbers = lines.some(line => 
      line.trim().match(/^\d{2}\s+[\w-]+/)
    );
    if (hasLevelNumbers) {
      score += 12;
      reasons.push('Contains COBOL level numbers');
    }

    return { score, reasons };
  }

  /**
   * Analyze COPYBOOK file characteristics
   */
  private analyzeCopybook(fileName: string, content: string, lines: string[]) {
    let score = 0;
    const reasons: string[] = [];

    // File extension check
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['cpy', 'copy', 'inc', 'copybook'].includes(ext)) {
      score += 25;
      reasons.push(`COPYBOOK file extension (.${ext})`);
    }

    // Copybooks typically don't have divisions
    const hasDivisions = [
      'IDENTIFICATION DIVISION',
      'PROCEDURE DIVISION'
    ].some(div => content.includes(div));
    
    if (!hasDivisions) {
      score += 15;
      reasons.push('No program divisions (typical of copybooks)');
    }

    // COPYBOOK specific patterns
    if (content.includes('WORKING-STORAGE SECTION')) {
      score -= 10; // Less likely to be a copybook if it has this
    }

    // Data structure definitions
    const hasDataStructures = lines.some(line => 
      line.trim().match(/^\d{2}\s+[\w-]+.*PIC/)
    );
    if (hasDataStructures) {
      score += 15;
      reasons.push('Contains data structure definitions');
    }

    // Common copybook patterns
    if (content.match(/^\s*\d{2}\s+FILLER/m)) {
      score += 10;
      reasons.push('Contains FILLER definitions');
    }

    return { score, reasons };
  }

  /**
   * Analyze CL (Control Language) file characteristics
   */
  private analyzeCL(fileName: string, content: string, lines: string[]) {
    let score = 0;
    const reasons: string[] = [];

    // File extension check
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['cl', 'cle', 'clp', 'cmd'].includes(ext)) {
      score += 20;
      reasons.push(`CL file extension (.${ext})`);
    }

    // CL specific commands
    const clCommands = [
      'PGM',
      'ENDPGM',
      'DCL VAR',
      'CHGVAR',
      'CALL',
      'SBMJOB',
      'CPYF',
      'DLTF',
      'CRTPF',
      'RCVF',
      'MONMSG',
      'IF COND',
      'GOTO',
      'ENDDO'
    ];

    clCommands.forEach(cmd => {
      if (content.includes(cmd)) {
        score += 12;
        reasons.push(`Contains CL command: ${cmd}`);
      }
    });

    // CL variable declarations
    if (content.match(/DCL\s+VAR\s*\(/)) {
      score += 15;
      reasons.push('Contains CL variable declarations');
    }

    // CL program structure
    if (content.includes('PGM') && content.includes('ENDPGM')) {
      score += 20;
      reasons.push('Contains CL program structure (PGM/ENDPGM)');
    }

    return { score, reasons };
  }

  /**
   * Analyze SMED file characteristics
   */
  private analyzeSMED(fileName: string, content: string, lines: string[]) {
    let score = 0;
    const reasons: string[] = [];

    // File extension check
    const ext = fileName.toLowerCase().split('.').pop() || '';
    if (['smed', 'map', 'bms'].includes(ext)) {
      score += 25;
      reasons.push(`SMED/Map file extension (.${ext})`);
    }

    // SMED specific keywords
    const smedKeywords = [
      'SMED',
      'DFHMSD',
      'DFHMDI',
      'DFHMDF',
      'MAP=',
      'MAPSET=',
      'POS=',
      'LENGTH=',
      'ATTRB=',
      'INITIAL=',
      'PICIN=',
      'PICOUT='
    ];

    smedKeywords.forEach(keyword => {
      if (content.includes(keyword)) {
        score += 10;
        reasons.push(`Contains SMED keyword: ${keyword}`);
      }
    });

    // BMS map structure
    if (content.includes('DFHMSD') && content.includes('DFHMDI')) {
      score += 20;
      reasons.push('Contains BMS map structure');
    }

    return { score, reasons };
  }

  /**
   * Detect file encoding (simplified heuristic)
   */
  private detectEncoding(content: string): 'EBCDIC' | 'ASCII' {
    // Check for EBCDIC-specific byte patterns
    const hasEBCDICChars = /[\u0081-\u0089\u0091-\u0099\u00A2-\u00A9\u00C1-\u00C9\u00D1-\u00D9\u00E2-\u00E9\u00F0-\u00F9]/.test(content);
    return hasEBCDICChars ? 'EBCDIC' : 'ASCII';
  }

  /**
   * Check for SQL statements
   */
  private hasSQL(content: string): boolean {
    return content.includes('EXEC SQL') || content.includes('EXEC-SQL');
  }

  /**
   * Check for map statements (CICS)
   */
  private hasMapStatements(content: string): boolean {
    return content.includes('SEND MAP') || content.includes('RECEIVE MAP') || content.includes('DFHMSD');
  }

  /**
   * Check for DATA DIVISION
   */
  private hasDataDivision(content: string): boolean {
    return content.includes('DATA DIVISION');
  }

  /**
   * Analyze a specific file from file system
   */
  async analyzeFileFromPath(filePath: string): Promise<FileAnalysisResult | null> {
    try {
      // This would require Node.js fs module - for demo purposes
      // In a real implementation, you'd read the file here
      console.log(`Analyzing file: ${filePath}`);
      
      // For now, return null as we can't access file system from browser
      return null;
    } catch (error) {
      console.error(`Error analyzing file ${filePath}:`, error);
      return null;
    }
  }
}

// Export singleton instance
export const fileAnalyzer = new FileAnalyzer();

// Convenience function for quick analysis
export function analyzeFileType(fileName: string, content: string, fileSize: number): FileAnalysisResult {
  return fileAnalyzer.analyzeFile(fileName, content, fileSize);
}

// Test function for the CT1510 file
export function testCT1510Analysis(): void {
  const ct1510Content = `       IDENTIFICATION                  DIVISION.                                
       PROGRAM-ID.                     CT1510.                                  
       ENVIRONMENT                     DIVISION.                                
       CONFIGURATION                   SECTION.                                 
      *****************************************************                     
      *  D A T A   D I V I S I O N                                              
      *****************************************************                     
       DATA                            DIVISION.                                
      *===================================================*                     
      *  W O R K I N G - S T O R A G E   S E C T I O N                          
      *===================================================*                     
       WORKING-STORAGE                 SECTION.                                 
      *=                                                                        
           EXEC  SQL  INCLUDE  SQLCA  END-EXEC.                                 
      *=                                                                        
      *--------------------------------------------------                       
      *  GAMEN-AREA                                                             
      *--------------------------------------------------                       
       01  DISPLAY-AREA.                                                        
           COPY  CT1510M.                                                       
       01  DISPLAY-AREA2.                                                       
           COPY  CT1511M.`;

  const result = analyzeFileType('CT1510', ct1510Content, ct1510Content.length);
  console.log('CT1510 Analysis Result:', result);
}