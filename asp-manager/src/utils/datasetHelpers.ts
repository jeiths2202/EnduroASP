export const formatDatasetContent = (
  content: string,
  rectype: string = 'FB',
  reclen: number = 80,
  currentPage: number = 1,
  recordsPerPage: number = 100,
  encoding: string = 'utf8'
): { content: string; totalRecords: number } => {
  if (!content) return { content: '', totalRecords: 0 };
  
  try {
    let lines: string[] = [];
    let totalRecords = 0;
    
    if (rectype === 'VB') {
      lines = content.split('\n').filter(line => line.length > 0);
    } else {
      const contentBytes = new TextEncoder().encode(content);
      const recordCount = Math.ceil(contentBytes.length / reclen);
      
      for (let i = 0; i < recordCount; i++) {
        const start = i * reclen;
        const end = Math.min(start + reclen, contentBytes.length);
        const recordBytes = contentBytes.slice(start, end);
        const recordStr = new TextDecoder().decode(recordBytes);
        lines.push(recordStr.padEnd(reclen));
      }
    }
    
    totalRecords = lines.length;
    
    const startIdx = (currentPage - 1) * recordsPerPage;
    const endIdx = startIdx + recordsPerPage;
    const pageLines = lines.slice(startIdx, endIdx);
    
    let formattedContent = '';
    pageLines.forEach((line, index) => {
      const lineNumber = startIdx + index + 1;
      formattedContent += `${lineNumber.toString().padStart(6, '0')}: ${line}\n`;
    });
    
    return {
      content: formattedContent,
      totalRecords
    };
  } catch (error) {
    console.error('Error formatting dataset content:', error);
    return { content: content, totalRecords: 1 };
  }
};

export const getCharAtPosition = (content: string, position: number): {char: string, hex: string, pos: number} | null => {
  if (position < 0 || position >= content.length) return null;
  
  const char = content[position];
  const charCode = char.charCodeAt(0);
  const hex = charCode.toString(16).toUpperCase().padStart(2, '0');
  
  return {
    char,
    hex,
    pos: position
  };
};

export const getByteLength = (str: string): number => {
  return new TextEncoder().encode(str).length;
};