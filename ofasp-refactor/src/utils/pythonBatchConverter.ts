/**
 * Python Batch Conversion Service
 * Optimized for converting entire files at once
 */

import { pythonConverter } from './pythonConverter';

export interface BatchConversionOptions {
  encoding: string;
  useSOSI: boolean;
  sosiHandling: 'remove' | 'keep' | 'space';
  rlen: number;
  sosiSO?: number;
  sosiSI?: number;
}

export class PythonBatchConverter {
  /**
   * Convert entire EBCDIC content to ASCII in a single API call
   * Much faster than line-by-line conversion
   */
  static async convertEbcdicFile(
    hexContent: string,
    options: BatchConversionOptions
  ): Promise<string[]> {
    try {
      // Convert entire content at once
      const result = await pythonConverter.EBCDIC_TO_ASCII(
        hexContent,
        null,
        options.encoding,
        options.useSOSI,
        false,  // out_sosi_flag should be false when using sosi_handling
        hexContent.length / 2,  // Full length, let Python handle chunking
        null,
        options.sosiHandling,
        options.sosiSO,
        options.sosiSI
      );

      // Split result into lines based on record length
      const lines: string[] = [];
      for (let i = 0; i < result.length; i += options.rlen) {
        const line = result.substring(i, i + options.rlen);
        lines.push(line);
      }

      return lines;
    } catch (error) {
      console.error('Batch conversion failed:', error);
      throw error;
    }
  }

  /**
   * Convert with proper line handling
   * Processes in chunks but makes fewer API calls
   */
  static async convertWithLineProcessing(
    bytes: number[],
    options: BatchConversionOptions,
    progressCallback?: (processed: number, total: number) => void
  ): Promise<string[]> {
    const resultLines: string[] = [];
    const chunkSize = 10; // Process 10 lines at a time
    const lineLength = options.rlen;
    const totalLines = Math.ceil(bytes.length / lineLength);

    for (let lineStart = 0; lineStart < bytes.length; lineStart += lineLength * chunkSize) {
      const chunkEnd = Math.min(lineStart + lineLength * chunkSize, bytes.length);
      const chunkBytes = bytes.slice(lineStart, chunkEnd);
      
      // Convert chunk bytes to hex string
      const chunkHex = chunkBytes
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join('');
      
      try {
        // Convert chunk
        const chunkResult = await pythonConverter.EBCDIC_TO_ASCII(
          chunkHex,
          null,
          options.encoding,
          options.useSOSI,
          false,
          chunkBytes.length,  // Actual chunk length
          null,
          options.sosiHandling,
          options.sosiSO,
          options.sosiSI
        );

        // Split chunk result into lines
        for (let i = 0; i < chunkResult.length; i += lineLength) {
          const line = chunkResult.substring(i, i + lineLength);
          if (line) {
            resultLines.push(line.padEnd(lineLength, ' '));
          }
        }

        // Report progress
        if (progressCallback) {
          const processedLines = Math.min(
            Math.ceil(chunkEnd / lineLength),
            totalLines
          );
          progressCallback(processedLines, totalLines);
        }
      } catch (error) {
        console.error(`Failed to convert chunk at ${lineStart}:`, error);
        // Add empty lines for failed chunk
        const failedLines = Math.ceil(chunkBytes.length / lineLength);
        for (let i = 0; i < failedLines; i++) {
          resultLines.push(' '.repeat(lineLength));
        }
      }
    }

    return resultLines;
  }
}

export default PythonBatchConverter;