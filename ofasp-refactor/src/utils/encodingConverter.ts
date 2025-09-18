/**
 * OpenASP Encoding Converter
 * Advanced character code page conversion system
 * Supports multiple encoding types and conversion modes
 */

import { BYTE_RANGES, JAPANESE_CODES, SOSI_CODES, REPLACEMENT_CHARS } from '../constants/encoding';
import { PATHS } from '../constants/paths';

export interface ConversionMap {
  singleByte: Uint8Array;  // Single-byte conversion array
  doubleByte: Uint16Array; // 16-bit values for double-byte conversion
  byteType: Uint8Array;    // Byte type indicator array
  convertType: number;     // Conversion direction
}

export interface ConversionOptions {
  mode: ConversionMode;
  encoding: EncodingType;
  useSOSI: boolean;
  sosiType?: '0E0F' | '1E1F' | 'custom';
  customSO?: string;
  customSI?: string;
  sosiHandling?: 'remove' | 'keep' | 'space';  // SOSI 코드 처리 방식
  errorHandling: ErrorHandling;
  rlen?: number;  // 입력 버퍼 길이
  layout?: string;  // 레이아웃 정보
}

export enum ConversionMode {
  EBCDIC_TO_ASCII = 1,
  ASCII_TO_EBCDIC = 2
}

export enum EncodingType {
  US = 'US',
  JP = 'JP', 
  KR = 'KR',
  JAK = 'JAK',
  KEIS = 'KEIS'
}

export enum ErrorHandling {
  STRICT = 'strict',
  REPLACE = 'replace',
  IGNORE = 'ignore'
}

class EncodingConverter {
  private conversionMaps: Map<string, ConversionMap> = new Map();
  private initialized = false;

  constructor() {
    this.initializeConverters();
  }

  private async initializeConverters() {
    if (this.initialized) return;

    // Initialize conversion maps for each encoding type
    await Promise.all([
      this.loadConversionMap(EncodingType.US),
      this.loadConversionMap(EncodingType.JP),
      this.loadConversionMap(EncodingType.KR),
      this.loadConversionMap(EncodingType.JAK),
      this.loadConversionMap(EncodingType.KEIS)
    ]);

    this.initialized = true;
  }

  private async loadConversionMap(encoding: EncodingType): Promise<void> {
    // Create conversion maps using code page files
    const ebcdicToAsciiMap = await this.createEBCDICToASCIIMap(encoding);
    const asciiToEbcdicMap = await this.createASCIIToEBCDICMap(encoding);

    this.conversionMaps.set(`${encoding}_EBC_TO_ASC`, ebcdicToAsciiMap);
    this.conversionMaps.set(`${encoding}_ASC_TO_EBC`, asciiToEbcdicMap);
  }

  private async createEBCDICToASCIIMap(encoding: EncodingType): Promise<ConversionMap> {
    const byteType = new Uint8Array(BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE);
    
    // Load code page table from file
    const filePath = this.getCodePageFilePath(encoding, ConversionMode.EBCDIC_TO_ASCII);
    const { singleByte, doubleByte } = await this.loadCodePageTable(filePath);
    
    // All bytes are treated as single-byte by default
    // Double-byte processing only happens within SOSI blocks
    for (let i = 0; i < BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE; i++) {
      byteType[i] = 0; // Single byte by default
    }

    return {
      singleByte,
      doubleByte,
      byteType,
      convertType: ConversionMode.EBCDIC_TO_ASCII
    };
  }

  private async createASCIIToEBCDICMap(encoding: EncodingType): Promise<ConversionMap> {
    const byteType = new Uint8Array(BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE);
    
    // Load code page table from file
    const filePath = this.getCodePageFilePath(encoding, ConversionMode.ASCII_TO_EBCDIC);
    const { singleByte, doubleByte } = await this.loadCodePageTable(filePath);
    
    // All bytes are treated as single-byte by default
    // Double-byte processing only happens within SOSI blocks
    for (let i = 0; i < BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE; i++) {
      byteType[i] = 0; // Single byte by default
    }

    return {
      singleByte,
      doubleByte,
      byteType,
      convertType: ConversionMode.ASCII_TO_EBCDIC
    };
  }

  // Cache for loaded code page tables
  private static codePageCache = new Map<string, { singleByte: Uint8Array; doubleByte: Uint16Array }>();

  private async loadCodePageTable(filePath: string): Promise<{ singleByte: Uint8Array; doubleByte: Uint16Array }> {
    // Check cache first
    if (EncodingConverter.codePageCache.has(filePath)) {
      return EncodingConverter.codePageCache.get(filePath)!;
    }

    // Load code page table from file
    const singleByte = new Uint8Array(BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE);
    const doubleByte = new Uint16Array(BYTE_RANGES.DOUBLE_BYTE_ARRAY_SIZE); // Changed to Uint16Array to handle values > 255
    
    try {
      // console.log(`Loading code page table from: ${filePath}`);
      const response = await fetch(filePath);
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const content = await response.text();
      const lines = content.split('\n');
      
      let isDoubleByte = false;
      let singleByteCount = 0;
      let doubleByteCount = 0;
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed === '[Double byte mapping table]') {
          isDoubleByte = true;
          // console.log(`Found double byte mapping section`);
          continue;
        }
        
        if (trimmed === '[Single byte mapping table]') {
          isDoubleByte = false;
          // console.log(`Found single byte mapping section`);
          continue;
        }
        
        // Parse mapping lines like "00 - 00" or "4040 - 8140"
        const match = trimmed.match(/^([0-9A-Fa-f]+)\s*-\s*([0-9A-Fa-f]+)$/);
        if (match) {
          const from = parseInt(match[1], 16);
          const to = parseInt(match[2], 16);
          
          if (isDoubleByte) {
            if (from < BYTE_RANGES.DOUBLE_BYTE_ARRAY_SIZE) {
              doubleByte[from] = to;
              doubleByteCount++;
              // Debug specific mapping
              if (from === 0x4040) {
                // console.log(`Found 0x4040 mapping: from=0x${from.toString(16).toUpperCase()}, to=0x${to.toString(16).toUpperCase()}`);
                // console.log(`Setting doubleByte[${from}] = ${to}`);
                // console.log(`Verification: doubleByte[${from}] = ${doubleByte[from]}`);
              }
            }
          } else {
            if (from < BYTE_RANGES.SINGLE_BYTE_ARRAY_SIZE) {
              singleByte[from] = to;
              singleByteCount++;
              // Debug single byte mapping that might conflict
              if (from === 0x40) {
                // console.log(`Found single byte 0x40 mapping: 0x${to.toString(16).toUpperCase()}`);
                // console.log(`Setting singleByte[${from}] = ${to}`);
              }
            }
          }
        }
      }
      
      // console.log(`Loaded ${singleByteCount} single byte mappings and ${doubleByteCount} double byte mappings`);
      
      // Debug: Check 0x4040 mapping after loading
      if (doubleByte[0x4040] !== 0) {
        // console.log(`After loading, doubleByte[0x4040] = ${doubleByte[0x4040]} (0x${doubleByte[0x4040].toString(16).toUpperCase()})`);
      }
      
      const result = { singleByte, doubleByte };
      
      // Cache the result
      EncodingConverter.codePageCache.set(filePath, result);
      
      return result;
    } catch (error) {
      console.error(`Failed to load code page table from ${filePath}:`, error);
      throw new Error(`Failed to load code page table: ${filePath}`);
    }
  }

  private getCodePageFilePath(encoding: EncodingType, mode: ConversionMode): string {
    // Use paths configuration
    
    const pathMap = mode === ConversionMode.EBCDIC_TO_ASCII 
      ? PATHS.CODE_PAGES.EBCDIC_TO_ASCII 
      : PATHS.CODE_PAGES.ASCII_TO_EBCDIC;
    
    switch (encoding) {
      case EncodingType.US:
        return pathMap.US;
      
      case EncodingType.JP:
        return pathMap.JP;
      
      case EncodingType.JAK:
        return pathMap.JAK;
      
      case EncodingType.KEIS:
        return pathMap.KEIS;
      
      case EncodingType.KR:
        // Use US tables as fallback for KR (no specific KR tables provided)
        return pathMap.US;
      
      default:
        return pathMap.US;
    }
  }

  public async convert(
    input: string | Uint8Array, 
    options: ConversionOptions,
    debugCallback?: (message: string) => void
  ): Promise<{ output: Uint8Array | string; errors: string[] }> {
    await this.initializeConverters();

    const mapKey = `${options.encoding}_${options.mode === ConversionMode.EBCDIC_TO_ASCII ? 'EBC_TO_ASC' : 'ASC_TO_EBC'}`;
    debugCallback?.(`변환 맵 키: ${mapKey}`);
    
    const conversionMap = this.conversionMaps.get(mapKey);

    if (!conversionMap) {
      debugCallback?.(`❌ 변환 맵을 찾을 수 없음: ${mapKey}`);
      throw new Error(`Conversion map not found for ${mapKey}`);
    }

    debugCallback?.(`✅ 변환 맵 로드 완료`);
    debugCallback?.(`변환 타입: ${conversionMap.convertType}`);

    const errors: string[] = [];
    
    if (options.mode === ConversionMode.EBCDIC_TO_ASCII) {
      return this.convertEBCDICToASCII(input as string, conversionMap, options, errors, debugCallback);
    } else {
      return this.convertASCIIToEBCDIC(input as string, conversionMap, options, errors, debugCallback);
    }
  }

  private convertEBCDICToASCII(
    hexInput: string, 
    map: ConversionMap, 
    options: ConversionOptions,
    errors: string[],
    debugCallback?: (message: string) => void
  ): { output: string; errors: string[] } {
    const cleanInput = hexInput.replace(/\s/g, '');
    debugCallback?.(`정제된 입력: ${cleanInput}`);
    const bytes: number[] = [];
    
    // Parse hex input
    debugCallback?.(`헥스 파싱 시작...`);
    for (let i = 0; i < cleanInput.length; i += 2) {
      const hex = cleanInput.substr(i, 2);
      const byte = parseInt(hex, 16);
      if (isNaN(byte)) {
        debugCallback?.(`❌ 잘못된 헥스 바이트: ${hex}`);
        if (options.errorHandling === ErrorHandling.STRICT) {
          throw new Error(`Invalid hex byte: ${hex}`);
        }
        errors.push(`Invalid hex byte: ${hex}`);
        continue;
      }
      bytes.push(byte);
    }

    debugCallback?.(`파싱된 바이트 수: ${bytes.length}`);
    debugCallback?.(`바이트 배열: [${bytes.map(b => '0x' + b.toString(16).toUpperCase()).join(', ')}]`);
    
    // Check for any input validation issues
    if (cleanInput.length % 2 !== 0) {
      debugCallback?.(`⚠️ 경고: 입력 길이가 홀수입니다 (${cleanInput.length}). 마지막 바이트가 불완전할 수 있습니다.`);
    }

    let result = '';
    let i = 0;

    debugCallback?.(`바이트별 변환 시작...`);
    
    // SOSI processing variables
    let sosiCodes: { SO: number; SI: number };
    
    if (options.sosiType === 'custom') {
      const customSO = parseInt(options.customSO || SOSI_CODES.DEFAULT_SO.toString(16), 16);
      const customSI = parseInt(options.customSI || SOSI_CODES.DEFAULT_SI.toString(16), 16);
      sosiCodes = { SO: customSO, SI: customSI };
      debugCallback?.(`커스텀 SOSI 코드 파싱: SO=${options.customSO}(${customSO}), SI=${options.customSI}(${customSI})`);
    } else if (options.sosiType === '1E1F') {
      sosiCodes = { SO: SOSI_CODES.ALTERNATE_SO, SI: SOSI_CODES.ALTERNATE_SI };
    } else {
      sosiCodes = { SO: SOSI_CODES.DEFAULT_SO, SI: SOSI_CODES.DEFAULT_SI };
    }
    
    let isInDoubleByte = false;
    
    debugCallback?.(`SOSI 모드: ${options.useSOSI ? '활성화' : '비활성화'}`);
    if (options.useSOSI) {
      debugCallback?.(`SOSI 코드: SO=0x${sosiCodes.SO.toString(16).toUpperCase()}, SI=0x${sosiCodes.SI.toString(16).toUpperCase()}`);
    } else {
      // Check if input contains potential SOSI codes and warn user
      const hasPotentialSOSI = bytes.some(byte => 
        byte === SOSI_CODES.DEFAULT_SO || byte === SOSI_CODES.DEFAULT_SI || 
        byte === SOSI_CODES.ALTERNATE_SO || byte === SOSI_CODES.ALTERNATE_SI
      );
      if (hasPotentialSOSI) {
        const sosiCodesStr = `0x${SOSI_CODES.DEFAULT_SO.toString(16).toUpperCase()}, 0x${SOSI_CODES.DEFAULT_SI.toString(16).toUpperCase()}, 0x${SOSI_CODES.ALTERNATE_SO.toString(16).toUpperCase()}, 0x${SOSI_CODES.ALTERNATE_SI.toString(16).toUpperCase()}`;
        debugCallback?.(`⚠️ 경고: 입력에 잠재적 SOSI 코드가 포함됨 (${sosiCodesStr}). SOSI 모드를 활성화하면 올바른 변환이 가능할 수 있습니다.`);
      }
    }
    
    // 입력 바이트 배열에서 SOSI 코드 위치 확인
    for (let idx = 0; idx < bytes.length; idx++) {
      if (bytes[idx] === 0x0E) {
        debugCallback?.(`🔍 0x0E(SO) 발견: 위치 ${idx}`);
      } else if (bytes[idx] === 0x0F) {
        debugCallback?.(`🔍 0x0F(SI) 발견: 위치 ${idx}`);
      }
    }
    
    while (i < bytes.length) {
      const byte = bytes[i];
      debugCallback?.(`[${i}] 바이트 처리 시작: 0x${byte.toString(16).toUpperCase()}, isInDoubleByte: ${isInDoubleByte}`);
      
      if (options.useSOSI) {
        // Check for SOSI control characters first, before processing data
        if (byte === sosiCodes.SO) {
          debugCallback?.(`SOSI: Shift-Out (0x${byte.toString(16).toUpperCase()}) - 더블바이트 모드 시작`);
          isInDoubleByte = true;
          
          // Handle SOSI code based on user preference
          const sosiHandling = options.sosiHandling || 'remove';
          if (sosiHandling === 'keep') {
            // Keep the SOSI code as-is
            result += String.fromCharCode(byte);
            debugCallback?.(`  → SOSI 코드 유지: 0x${byte.toString(16).toUpperCase()}`);
          } else if (sosiHandling === 'space') {
            // Convert to space
            result += ' ';
            debugCallback?.(`  → SOSI 코드를 공백으로 변환: 0x20`);
          } else {
            // Remove (default)
            debugCallback?.(`  → SOSI 코드 제거`);
          }
          
          i++;
          continue;
        } else if (byte === sosiCodes.SI) {
          debugCallback?.(`SOSI: Shift-In (0x${byte.toString(16).toUpperCase()}) - 싱글바이트 모드 복귀`);
          isInDoubleByte = false;
          
          // Handle SOSI code based on user preference
          const sosiHandling = options.sosiHandling || 'remove';
          if (sosiHandling === 'keep') {
            // Keep the SOSI code as-is
            result += String.fromCharCode(byte);
            debugCallback?.(`  → SOSI 코드 유지: 0x${byte.toString(16).toUpperCase()}`);
          } else if (sosiHandling === 'space') {
            // Convert to space
            result += ' ';
            debugCallback?.(`  → SOSI 코드를 공백으로 변환: 0x20`);
          } else {
            // Remove (default)
            debugCallback?.(`  → SOSI 코드 제거`);
          }
          
          i++;
          continue;
        }
        
        // Process data based on current SOSI state
        if (isInDoubleByte) {
          debugCallback?.(`✅ 더블바이트 모드에서 처리 중: 0x${byte.toString(16).toUpperCase()}`);
          
          // Check if current byte is SI (Shift-In) before processing as double-byte
          if (byte === sosiCodes.SI) {
            debugCallback?.(`SOSI: Shift-In (0x${byte.toString(16).toUpperCase()}) found in double-byte mode - 싱글바이트 모드 복귀`);
            isInDoubleByte = false;
            
            // Handle SOSI code based on user preference
            const sosiHandling = options.sosiHandling || 'remove';
            if (sosiHandling === 'keep') {
              // Keep the SOSI code as-is
              result += String.fromCharCode(byte);
              debugCallback?.(`  → SOSI 코드 유지: 0x${byte.toString(16).toUpperCase()}`);
            } else if (sosiHandling === 'space') {
              // Convert to space
              result += ' ';
              debugCallback?.(`  → SOSI 코드를 공백으로 변환: 0x20`);
            } else {
              // Remove (default)
              debugCallback?.(`  → SOSI 코드 제거`);
            }
            
            i++;
            continue;
          }
          
          // In double-byte mode: ALL data must be processed in 2-byte pairs
          if (i + 1 < bytes.length) {
            const nextByte = bytes[i + 1];
            debugCallback?.(`  다음 바이트: 0x${nextByte.toString(16).toUpperCase()}`);
            
            // Check if next byte is SI - if so, treat current byte as single and let SI be processed normally
            if (nextByte === sosiCodes.SI) {
              debugCallback?.(`더블바이트 모드에서 홀수 바이트 0x${byte.toString(16).toUpperCase()} 발견 (다음이 SI)`);
              // Process current byte as single-byte since we can't form a proper double-byte pair
              const converted = map.singleByte[byte];
              const char = String.fromCharCode(converted);
              debugCallback?.(`홀수 바이트를 싱글바이트로 처리: 0x${byte.toString(16).toUpperCase()} → ASCII: 0x${converted.toString(16).toUpperCase()} ('${char}')`);
              result += char;
              i++;
              continue;
            }
            
            // Process as proper double-byte character
            const doubleByteIndex = (byte << 8) | nextByte;
            debugCallback?.(`SOSI 더블바이트: 0x${byte.toString(16).toUpperCase()}${nextByte.toString(16).toUpperCase()}`);
            debugCallback?.(`  더블바이트 인덱스: ${doubleByteIndex} (0x${doubleByteIndex.toString(16).toUpperCase()})`);
            
            // Check if we have a valid mapping for this double-byte index
            if (doubleByteIndex < map.doubleByte.length) {
              const converted = map.doubleByte[doubleByteIndex];
              debugCallback?.(`  매핑된 값: ${converted} (0x${converted.toString(16).toUpperCase()})`);
              
              // Process double-byte conversion based on actual code page table
              if (converted === 0) {
                // Unmapped double-byte character - use fallback
                result += ' ';
                debugCallback?.(`  ⚠️ 매핑되지 않은 더블바이트: 0x${doubleByteIndex.toString(16).toUpperCase()} → 공백`);
              } else {
                // Successfully mapped double-byte character
                if (converted === 0x8140) {
                  // Japanese full-width space (0x8140 → ' ')
                  result += ' ';
                  debugCallback?.(`  → ASCII: 0x${converted.toString(16).toUpperCase()} (전각 공백 → 공백)`);
                } else if (converted <= 0xFF) {
                  // Single-byte result
                  result += String.fromCharCode(converted);
                  debugCallback?.(`  → ASCII: 0x${converted.toString(16).toUpperCase()} ('${String.fromCharCode(converted)}')`);
                } else {
                  // Double-byte result - try Shift-JIS decoding for JP encoding
                  if (options.encoding === EncodingType.JP && converted >= 0x8140) {
                    try {
                      // Convert to Shift-JIS bytes and then to string
                      const highByte = (converted >> 8) & 0xFF;
                      const lowByte = converted & 0xFF;
                      
                      // Create Shift-JIS bytes
                      const sjisBytes = new Uint8Array([highByte, lowByte]);
                      
                      // Try to decode as Shift-JIS
                      const decoder = new TextDecoder('shift_jis');
                      const sjisChar = decoder.decode(sjisBytes);
                      
                      result += sjisChar;
                      debugCallback?.(`  → Shift-JIS: 0x${converted.toString(16).toUpperCase()} → '${sjisChar}'`);
                    } catch (e) {
                      // Fallback to space if Shift-JIS decoding fails
                      result += ' ';
                      debugCallback?.(`  → Shift-JIS decoding failed: 0x${converted.toString(16).toUpperCase()} → 공백`);
                    }
                  } else {
                    // For non-JP encodings or other double-byte values, use space
                    result += ' ';
                    debugCallback?.(`  → ASCII: 0x${converted.toString(16).toUpperCase()} (non-printable, using space)`);
                  }
                }
              }
            } else {
              debugCallback?.(`  → 변환 실패 (범위 초과: ${doubleByteIndex} >= ${map.doubleByte.length})`);
              // Use fallback for out-of-range double-byte
              result += ' ';
            }
            i += 2;
            continue;
          } else {
            // Last byte in double-byte mode with no pair
            // Check if last byte is SI
            if (byte === sosiCodes.SI) {
              debugCallback?.(`SOSI: Shift-In (0x${byte.toString(16).toUpperCase()}) found (last byte) - 싱글바이트 모드 복귀`);
              isInDoubleByte = false;
              
              // Handle SOSI code based on user preference
              const sosiHandling = options.sosiHandling || 'remove';
              if (sosiHandling === 'keep') {
                // Keep the SOSI code as-is
                result += String.fromCharCode(byte);
                debugCallback?.(`  → SOSI 코드 유지: 0x${byte.toString(16).toUpperCase()}`);
              } else if (sosiHandling === 'space') {
                // Convert to space
                result += ' ';
                debugCallback?.(`  → SOSI 코드를 공백으로 변환: 0x20`);
              } else {
                // Remove (default)
                debugCallback?.(`  → SOSI 코드 제거`);
              }
              
              i++;
              continue;
            }
            
            // Process as single byte
            debugCallback?.(`⚠️ 더블바이트 모드에서 홀수 바이트 0x${byte.toString(16).toUpperCase()} (마지막 바이트)`);
            const converted = map.singleByte[byte];
            const char = String.fromCharCode(converted);
            debugCallback?.(`홀수 바이트를 싱글바이트로 처리: 0x${byte.toString(16).toUpperCase()} → ASCII: 0x${converted.toString(16).toUpperCase()} ('${char}')`);
            result += char;
            i++;
            continue;
          }
        } else {
          debugCallback?.(`🔹 싱글바이트 모드에서 처리 중: 0x${byte.toString(16).toUpperCase()}`);
        }
      }
      
      // Single-byte character processing (default for non-SOSI or outside SOSI blocks)
      const converted = map.singleByte[byte];
      const char = String.fromCharCode(converted);
      debugCallback?.(`싱글바이트: 0x${byte.toString(16).toUpperCase()} → ASCII: 0x${converted.toString(16).toUpperCase()} ('${char}')`);
      result += char;
      i++;
    }

    debugCallback?.(`최종 결과: "${result}"`);
    return { output: result, errors };
  }

  private convertASCIIToEBCDIC(
    input: string, 
    map: ConversionMap, 
    options: ConversionOptions,
    errors: string[],
    debugCallback?: (message: string) => void
  ): { output: string; errors: string[] } {
    let result = '';
    debugCallback?.(`ASCII to EBCDIC 변환 시작...`);
    debugCallback?.(`입력 문자열: "${input}"`);

    for (let i = 0; i < input.length; i++) {
      const charCode = input.charCodeAt(i);
      const char = input.charAt(i);
      
      if (charCode > 255) {
        // Handle Unicode characters (would need double-byte mapping)
        debugCallback?.(`❌ 유니코드 문자 발견: '${char}' (0x${charCode.toString(16).toUpperCase()})`);
        this.handleConversionError(charCode, options, errors, result);
        continue;
      }

      const converted = map.singleByte[charCode];
      const hexValue = converted.toString(16).toUpperCase().padStart(2, '0');
      debugCallback?.(`ASCII: '${char}' (0x${charCode.toString(16).toUpperCase()}) → EBCDIC: 0x${hexValue}`);
      result += hexValue;
    }

    debugCallback?.(`최종 EBCDIC 결과: ${result}`);
    return { output: result, errors };
  }

  private handleConversionError(
    byte: number, 
    options: ConversionOptions, 
    errors: string[], 
    result: string
  ): void {
    const errorMsg = `Unable to convert byte: 0x${byte.toString(16).toUpperCase()}`;
    
    switch (options.errorHandling) {
      case ErrorHandling.STRICT:
        throw new Error(errorMsg);
      case ErrorHandling.REPLACE:
        result += '?';
        errors.push(errorMsg);
        break;
      case ErrorHandling.IGNORE:
        errors.push(errorMsg);
        break;
    }
  }

  public getSupportedEncodings(): EncodingType[] {
    return Object.values(EncodingType);
  }

  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * EBCDIC to ASCII 변환 (새로운 시그니처)
   * @param input 입력 버퍼 (헥스 문자열)
   * @param output 출력 버퍼 (참조용, 실제로는 반환값 사용)
   * @param encoding 인코딩 타입
   * @param sosi_flag SOSI 처리 여부
   * @param out_sosi_flag 출력에 SOSI 코드 유지 여부
   * @param rlen 입력 버퍼 길이 (소스의 경우 80)
   * @param layout 레이아웃 정보 (소스의 경우 null)
   * @returns 변환된 ASCII 문자열
   */
  public async EBCDIC_TO_ASCII(
    input: string,
    output: string | null,
    encoding: EncodingType,
    sosi_flag: boolean,
    out_sosi_flag: boolean,
    rlen: number,
    layout: string | null
  ): Promise<string> {
    const options: ConversionOptions = {
      mode: ConversionMode.EBCDIC_TO_ASCII,
      encoding,
      useSOSI: sosi_flag,
      sosiHandling: out_sosi_flag ? 'keep' : 'remove',
      errorHandling: ErrorHandling.REPLACE,
      rlen,
      layout: layout || undefined
    };

    const result = await this.convert(input, options);
    return result.output as string;
  }

  /**
   * ASCII to EBCDIC 변환 (새로운 시그니처)
   * @param input 입력 버퍼 (ASCII 문자열)
   * @param output 출력 버퍼 (참조용, 실제로는 반환값 사용)
   * @param encoding 인코딩 타입
   * @param sosi_flag SOSI 처리 여부
   * @param out_sosi_flag 출력에 SOSI 코드 유지 여부
   * @param rlen 입력 버퍼 길이
   * @param layout 레이아웃 정보
   * @returns 변환된 EBCDIC 헥스 문자열
   */
  public async ASCII_TO_EBCDIC(
    input: string,
    output: string | null,
    encoding: EncodingType,
    sosi_flag: boolean,
    out_sosi_flag: boolean,
    rlen: number,
    layout: string | null
  ): Promise<string> {
    const options: ConversionOptions = {
      mode: ConversionMode.ASCII_TO_EBCDIC,
      encoding,
      useSOSI: sosi_flag,
      sosiHandling: out_sosi_flag ? 'keep' : 'remove',
      errorHandling: ErrorHandling.REPLACE,
      rlen,
      layout: layout || undefined
    };

    const result = await this.convert(input, options);
    return result.output as string;
  }
}

// Export singleton instance
export const encodingConverter = new EncodingConverter();
export default EncodingConverter;