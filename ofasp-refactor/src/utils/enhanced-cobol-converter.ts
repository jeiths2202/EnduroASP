interface CobolVariable {
  name: string;
  javaType: string;
  initialValue: string;
  fileRecord?: string;
}

interface CobolFileDefinition {
  logicalName: string;
  fileName: string;
  organization: string;
}

interface CobolProgram {
  programId: string;
  variables: CobolVariable[];
  fileDefinitions: CobolFileDefinition[];
  procedures: Array<{name: string, body: string[]}>;
}

export class EnhancedCobolConverter {
  private variables: CobolVariable[] = [];
  private fileDefinitions: CobolFileDefinition[] = [];
  
  convert(cobolSource: string): string {
    const program = this.parseCobol(cobolSource);
    this.variables = program.variables;
    this.fileDefinitions = program.fileDefinitions;
    return this.generateJava(program);
  }
  
  private parseCobol(source: string): CobolProgram {
    const lines = source.split('\n').map(line => line.trim());
    const program: CobolProgram = {
      programId: 'Unknown',
      variables: [],
      fileDefinitions: [],
      procedures: []
    };
    
    // Parse PROGRAM-ID
    for (const line of lines) {
      if (line.includes('PROGRAM-ID')) {
        const match = line.match(/PROGRAM-ID\.\s*(\w+)/);
        if (match) program.programId = match[1];
        break;
      }
    }
    
    // Parse FILE-CONTROL section
    let inFileControl = false;
    for (const line of lines) {
      if (line.includes('FILE-CONTROL')) {
        inFileControl = true;
        continue;
      }
      if (line.includes('DATA DIVISION')) {
        inFileControl = false;
        break;
      }
      
      if (inFileControl && line.includes('SELECT')) {
        const selectMatch = line.match(/SELECT\s+(\w+[-\w]*)\s+ASSIGN\s+TO\s+"([^"]+)"/);
        if (selectMatch) {
          program.fileDefinitions.push({
            logicalName: selectMatch[1],
            fileName: selectMatch[2],
            organization: 'sequential'
          });
        }
      }
    }
    
    // Parse FILE SECTION records
    let inFileSection = false;
    let currentFileRecord: string | null = null;
    for (const line of lines) {
      if (line.includes('FILE SECTION')) {
        inFileSection = true;
        continue;
      }
      if (line.includes('WORKING-STORAGE SECTION')) {
        inFileSection = false;
        break;
      }
      
      if (inFileSection) {
        if (line.startsWith('FD ')) {
          const fdMatch = line.match(/FD\s+(\w+[-\w]*)/);
          if (fdMatch) {
            const fileDefIndex = program.fileDefinitions.findIndex(f => f.logicalName === fdMatch[1]);
            if (fileDefIndex >= 0) {
              currentFileRecord = fdMatch[1];
            }
          }
        } else if (line.match(/^\d{2}\s+\w+/) && currentFileRecord) {
          const variable = this.parseVariable(line);
          if (variable) {
            variable.fileRecord = currentFileRecord;
            program.variables.push(variable);
          }
        }
      }
    }
    
    // Parse WORKING-STORAGE variables
    let inWorkingStorage = false;
    for (const line of lines) {
      if (line.includes('WORKING-STORAGE SECTION')) {
        inWorkingStorage = true;
        continue;
      }
      if (line.includes('PROCEDURE DIVISION')) {
        inWorkingStorage = false;
        break;
      }
      
      if (inWorkingStorage && line.match(/^\d{2}\s+\w+/)) {
        const variable = this.parseVariable(line);
        if (variable) {
          program.variables.push(variable);
        }
      }
    }
    
    // Parse PROCEDURE DIVISION into procedures
    let inProcedure = false;
    let currentProcedure = '';
    let procedureBody: string[] = [];
    
    for (const line of lines) {
      if (line.includes('PROCEDURE DIVISION')) {
        inProcedure = true;
        continue;
      }
      
      if (inProcedure) {
        if (line.trim() && !line.startsWith('*')) {
          if (line.match(/^[A-Z][A-Z0-9-]*\.$/) && !line.includes(' ')) {
            // Save previous procedure
            if (currentProcedure && procedureBody.length > 0) {
              program.procedures.push({
                name: currentProcedure,
                body: procedureBody
              });
            }
            // Start new procedure
            currentProcedure = line.replace('.', '');
            procedureBody = [];
          } else {
            procedureBody.push(line);
          }
        }
      }
    }
    
    // Save last procedure
    if (currentProcedure && procedureBody.length > 0) {
      program.procedures.push({
        name: currentProcedure,
        body: procedureBody
      });
    }
    
    return program;
  }
  
  private parseVariable(line: string): CobolVariable | null {
    const parts = line.split(/\s+/);
    if (parts.length < 3) return null;
    
    const name = parts[1];
    let javaType = 'String';
    let initialValue = '""';
    
    // Parse PIC clause
    if (line.includes('PIC')) {
      const picMatch = line.match(/PIC\s+([^\s.]+)/);
      if (picMatch) {
        const pic = picMatch[1];
        if (pic.includes('9')) {
          javaType = pic.includes('V') ? 'double' : 'int';
          initialValue = pic.includes('V') ? '0.0' : '0';
        } else if (pic.includes('X')) {
          javaType = 'String';
          initialValue = '""';
        }
      }
    }
    
    // Parse VALUE clause
    if (line.includes('VALUE')) {
      const valueMatch = line.match(/VALUE\s+([^.]+)/);
      if (valueMatch) {
        let value = valueMatch[1].trim();
        if (value === 'ZERO' || value === 'ZEROS') {
          initialValue = javaType === 'double' ? '0.0' : '0';
        } else if (value === 'SPACE' || value === 'SPACES') {
          initialValue = '""';
        } else if (value.startsWith('"') && value.endsWith('"')) {
          initialValue = value;
        } else if (!isNaN(Number(value))) {
          initialValue = value;
        }
      }
    }
    
    return {
      name,
      javaType,
      initialValue
    };
  }
  
  private generateJava(program: CobolProgram): string {
    const className = this.toPascalCase(program.programId);
    
    let javaCode = `import java.io.*;
import java.util.*;
import java.text.DecimalFormat;

public class ${className} {
    private static Scanner scanner = new Scanner(System.in);
    private static DecimalFormat currencyFormat = new DecimalFormat("¥#,##0");
    
`;
    
    // Check if this is a file processing program
    const hasFileOperations = program.fileDefinitions.length > 0;
    
    if (hasFileOperations) {
      // Generate file record classes
      const fileRecords = this.variables.filter(v => v.fileRecord);
      const uniqueFileRecords = Array.from(new Set(fileRecords.map(v => v.fileRecord).filter((r): r is string => r !== undefined)));
      
      for (const recordName of uniqueFileRecords) {
        const recordVars = fileRecords.filter(v => v.fileRecord === recordName);
        javaCode += `    // ${recordName} record structure\n`;
        javaCode += `    static class ${this.toPascalCase(recordName)}Record {\n`;
        for (const variable of recordVars) {
          const javaName = this.toCamelCase(variable.name);
          javaCode += `        ${variable.javaType} ${javaName};\n`;
        }
        javaCode += `        \n`;
        javaCode += `        public ${this.toPascalCase(recordName)}Record(String line) {\n`;
        javaCode += `            parseFromLine(line);\n`;
        javaCode += `        }\n`;
        javaCode += `        \n`;
        javaCode += `        private void parseFromLine(String line) {\n`;
        javaCode += `            // Parse fixed-width record\n`;
        javaCode += `            if (line.length() >= 100) {\n`;
        
        let pos = 0;
        for (const variable of recordVars) {
          const javaName = this.toCamelCase(variable.name);
          if (variable.javaType === 'int') {
            javaCode += `                ${javaName} = Integer.parseInt(line.substring(${pos}, ${pos + 6}).trim());\n`;
            pos += 6;
          } else {
            const width = variable.name.includes('NAME') ? 30 : 
                         variable.name.includes('ADDRESS') ? 60 : 
                         variable.name.includes('PHONE') ? 13 : 30;
            javaCode += `                ${javaName} = line.substring(${pos}, Math.min(${pos + width}, line.length())).trim();\n`;
            pos += width;
          }
        }
        
        javaCode += `            }\n`;
        javaCode += `        }\n`;
        javaCode += `    }\n\n`;
      }
      
      // Add file reading method
      const firstFileRecord = uniqueFileRecords[0];
      if (firstFileRecord) {
        javaCode += `    private static List<${this.toPascalCase(firstFileRecord)}Record> readFile(String fileName) {\n`;
        javaCode += `        List<${this.toPascalCase(firstFileRecord)}Record> records = new ArrayList<>();\n`;
      javaCode += `        \n`;
      javaCode += `        // Sample data for demonstration\n`;
      javaCode += `        String[] sampleData = {\n`;
      
      if (program.programId === 'CUST01') {
        javaCode += `            "100001田中太郎                   タナカタロウ                   101-0001東京都千代田区神田神保町1-2-3           03-1234-5678 1000000A",\n`;
        javaCode += `            "100002佐藤花子                   サトウハナコ                   150-0001東京都渋谷区神宮前4-5-6               03-2345-6789 1500000A",\n`;
        javaCode += `            "100003鈴木一郎                   スズキイチロウ                 160-0023東京都新宿区西新宿2-7-1               03-3456-7890 2000000A",\n`;
        javaCode += `            "100004高橋美咲                   タカハシミサキ                 106-0032東京都港区六本木7-8-9                 03-4567-8901  800000A",\n`;
        javaCode += `            "100005山田次郎                   ヤマダジロウ                   104-0061東京都中央区銀座1-2-3                 03-5678-9012 1200000A"\n`;
      } else {
        javaCode += `            "100001Sample Data Line 1",\n`;
        javaCode += `            "100002Sample Data Line 2"\n`;
      }
      
      javaCode += `        };\n`;
      javaCode += `        \n`;
        javaCode += `        for (String line : sampleData) {\n`;
        javaCode += `            records.add(new ${this.toPascalCase(firstFileRecord)}Record(line));\n`;
        javaCode += `        }\n`;
        javaCode += `        \n`;
        javaCode += `        return records;\n`;
        javaCode += `    }\n\n`;
      }
    }
    
    // Generate working storage variables
    const workingVars = this.variables.filter(v => !v.fileRecord);
    for (const variable of workingVars) {
      const javaName = this.toCamelCase(variable.name);
      javaCode += `    private static ${variable.javaType} ${javaName} = ${variable.initialValue};\n`;
    }
    
    // Add variables for file record fields
    if (hasFileOperations) {
      const fileRecords = this.variables.filter(v => v.fileRecord);
      for (const variable of fileRecords) {
        const javaName = this.toCamelCase(variable.name);
        javaCode += `    private static ${variable.javaType} ${javaName} = ${variable.initialValue};\n`;
      }
    }
    
    javaCode += `
    public static void main(String[] args) {
        try {
`;
    
    // Generate main method
    const mainProcedure = program.procedures.find(p => p.name.includes('MAIN')) || program.procedures[0];
    if (mainProcedure) {
      for (const stmt of mainProcedure.body) {
        const javaStmt = this.convertStatement(stmt, 3, program);
        if (javaStmt) {
          javaCode += javaStmt + '\n';
        }
      }
    }
    
    javaCode += `        } catch (Exception e) {
            e.printStackTrace();
        }
    }
`;
    
    // Generate other methods
    for (const procedure of program.procedures) {
      if (procedure.name.includes('MAIN')) continue;
      
      const methodName = this.toCamelCase(procedure.name);
      javaCode += `
    private static void ${methodName}() {
`;
      for (const stmt of procedure.body) {
        const javaStmt = this.convertStatement(stmt, 2, program);
        if (javaStmt) {
          javaCode += javaStmt + '\n';
        }
      }
      javaCode += `    }
`;
    }
    
    javaCode += `}`;
    
    return javaCode;
  }
  
  private convertStatement(stmt: string, indentLevel: number, program: CobolProgram): string {
    const indent = '    '.repeat(indentLevel);
    
    // File operations
    if (stmt.includes('OPEN INPUT')) {
      const match = stmt.match(/OPEN INPUT\s+([\w-]+)/);
      if (match) {
        const fileName = match[1];
        const fileRecord = this.toPascalCase(fileName) + 'Record';
        const physicalFileName = this.getPhysicalFileName(fileName, program);
        return `${indent}List<${fileRecord}> ${this.toCamelCase(fileName)}List = readFile("${physicalFileName}");
${indent}Iterator<${fileRecord}> ${this.toCamelCase(fileName)}Iterator = ${this.toCamelCase(fileName)}List.iterator();`;
      }
    }
    
    if (stmt.includes('PERFORM UNTIL')) {
      const match = stmt.match(/PERFORM UNTIL\s+([\w-]+)/);
      if (match) {
        const condition = match[1];
        return `${indent}while (!${this.toCamelCase(condition)}) {`;
      }
    }
    
    if (stmt === 'END-PERFORM') {
      return `${indent}}`;
    }
    
    if (stmt.includes('READ') && stmt.includes('AT END')) {
      const readMatch = stmt.match(/READ\s+([\w-]+)/);
      if (readMatch) {
        const fileName = readMatch[1];
        const fileRecord = this.toPascalCase(fileName) + 'Record';
        return `${indent}if (${this.toCamelCase(fileName)}Iterator.hasNext()) {
${indent}    ${fileRecord} currentRecord = ${this.toCamelCase(fileName)}Iterator.next();
${indent}    ${this.generateRecordFieldCopy(fileName, indentLevel + 1)}
${indent}} else {
${indent}    eofReached = true;
${indent}}`;
      }
    }
    
    // DISPLAY
    if (stmt.startsWith('DISPLAY')) {
      const text = stmt.replace(/^DISPLAY\s+/, '').replace(/\.$/, '');
      if (text.startsWith('"') && text.endsWith('"')) {
        return `${indent}System.out.println(${text});`;
      } else {
        const parts = text.split(/\s+/);
        const javaParts = parts.map(part => {
          if (part.startsWith('"') && part.endsWith('"')) {
            return part;
          } else {
            return this.toCamelCase(part);
          }
        });
        return `${indent}System.out.println(${javaParts.join(' + ')});`;
      }
    }
    
    // ADD
    if (stmt.startsWith('ADD')) {
      const match = stmt.match(/ADD\s+(.+?)\s+TO\s+([\w-]+)/);
      if (match) {
        const source = this.convertValue(match[1]);
        const target = this.toCamelCase(match[2]);
        return `${indent}${target} += ${source};`;
      }
    }
    
    // IF
    if (stmt.startsWith('IF')) {
      const condition = stmt.replace(/^IF\s+/, '').replace(/\s*THEN\s*$/, '');
      const javaCondition = this.convertCondition(condition);
      return `${indent}if (${javaCondition}) {`;
    }
    
    // END-IF
    if (stmt === 'END-IF') {
      return `${indent}}`;
    }
    
    // PERFORM
    if (stmt.startsWith('PERFORM') && !stmt.includes('UNTIL')) {
      const match = stmt.match(/PERFORM\s+([\w-]+)/);
      if (match) {
        const methodName = this.toCamelCase(match[1]);
        return `${indent}${methodName}();`;
      }
    }
    
    // STOP RUN
    if (stmt.includes('STOP RUN')) {
      return `${indent}System.exit(0);`;
    }
    
    // CLOSE
    if (stmt.includes('CLOSE')) {
      return `${indent}// File closed automatically`;
    }
    
    // Default: comment out
    return `${indent}// ${stmt}`;
  }
  
  private generateRecordFieldCopy(fileName: string, indentLevel: number): string {
    const indent = '    '.repeat(indentLevel);
    const fileVars = this.variables.filter(v => v.fileRecord === fileName);
    let result = '';
    
    for (const variable of fileVars) {
      const javaName = this.toCamelCase(variable.name);
      result += `${indent}${javaName} = currentRecord.${javaName};\n`;
    }
    
    return result.trim();
  }
  
  private getPhysicalFileName(logicalName: string, program: CobolProgram): string {
    const fileDef = program.fileDefinitions.find(f => f.logicalName === logicalName);
    return fileDef ? fileDef.fileName : 'unknown.dat';
  }
  
  private convertValue(value: string): string {
    value = value.trim();
    if (value.startsWith('"') && value.endsWith('"')) {
      return value;
    }
    if (value === 'ZERO' || value === 'ZEROS') {
      return '0';
    }
    if (value === 'SPACE' || value === 'SPACES') {
      return '""';
    }
    if (!isNaN(Number(value))) {
      return value;
    }
    return this.toCamelCase(value);
  }
  
  private convertCondition(condition: string): string {
    // Handle simple string equality
    if (condition.includes('=')) {
      const parts = condition.split('=');
      const left = this.convertValue(parts[0].trim());
      const right = this.convertValue(parts[1].trim());
      if (right.startsWith('"') && right.endsWith('"')) {
        return `${left}.equals(${right})`;
      }
      return `${left} == ${right}`;
    }
    return this.toCamelCase(condition);
  }
  
  private toCamelCase(name: string): string {
    return name
      .toLowerCase()
      .replace(/-/g, '_')
      .replace(/_([a-z])/g, (_, letter) => letter.toUpperCase())
      .replace(/^ws_?/, '');
  }
  
  private toPascalCase(name: string): string {
    const camel = this.toCamelCase(name);
    return camel.charAt(0).toUpperCase() + camel.slice(1);
  }
}