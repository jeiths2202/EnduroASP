/**
 * EBCDIC 변환 유틸리티
 * 독립적이고 안정적인 EBCDIC ↔ ASCII 변환 함수
 */

// 기본 EBCDIC to ASCII 매핑 테이블 (US 코드페이지 기준)
const EBCDIC_TO_ASCII_TABLE: { [key: number]: number } = {
  // 제어 문자 (0x00-0x1F)
  0x00: 0x00, 0x01: 0x01, 0x02: 0x02, 0x03: 0x03, 0x04: 0x04, 0x05: 0x05, 0x06: 0x06, 0x07: 0x07,
  0x08: 0x08, 0x09: 0x09, 0x0A: 0x0A, 0x0B: 0x0B, 0x0C: 0x0C, 0x0D: 0x0D, 0x0E: 0x0E, 0x0F: 0x0F,
  0x10: 0x10, 0x11: 0x11, 0x12: 0x12, 0x13: 0x13, 0x14: 0x14, 0x15: 0x15, 0x16: 0x16, 0x17: 0x17,
  0x18: 0x18, 0x19: 0x19, 0x1A: 0x1A, 0x1B: 0x1B, 0x1C: 0x1C, 0x1D: 0x1D, 0x1E: 0x1E, 0x1F: 0x1F,
  
  // 공백 및 특수 문자
  0x40: 0x20, // 공백
  0x41: 0x41, // A
  0x42: 0x42, // B
  0x43: 0x43, // C
  0x44: 0x44, // D
  0x45: 0x45, // E
  0x46: 0x46, // F
  0x47: 0x47, // G
  0x48: 0x48, // H
  0x49: 0x49, // I
  0x4A: 0x5B, // [
  0x4B: 0x2E, // .
  0x4C: 0x3C, // <
  0x4D: 0x28, // (
  0x4E: 0x2B, // +
  0x4F: 0x21, // !
  0x50: 0x26, // &
  0x51: 0x4A, // J
  0x52: 0x4B, // K
  0x53: 0x4C, // L
  0x54: 0x4D, // M
  0x55: 0x4E, // N
  0x56: 0x4F, // O
  0x57: 0x50, // P
  0x58: 0x51, // Q
  0x59: 0x52, // R
  0x5A: 0x5D, // ]
  0x5B: 0x24, // $
  0x5C: 0x2A, // *
  0x5D: 0x29, // )
  0x5E: 0x3B, // ;
  0x5F: 0x5E, // ^
  0x60: 0x2D, // -
  0x61: 0x2F, // /
  0x62: 0x53, // S
  0x63: 0x54, // T
  0x64: 0x55, // U
  0x65: 0x56, // V
  0x66: 0x57, // W
  0x67: 0x58, // X
  0x68: 0x59, // Y
  0x69: 0x5A, // Z
  0x6A: 0x7C, // |
  0x6B: 0x2C, // ,
  0x6C: 0x25, // %
  0x6D: 0x5F, // _
  0x6E: 0x3E, // >
  0x6F: 0x3F, // ?
  0x70: 0x60, // `
  0x71: 0x61, // a
  0x72: 0x62, // b
  0x73: 0x63, // c
  0x74: 0x64, // d
  0x75: 0x65, // e
  0x76: 0x66, // f
  0x77: 0x67, // g
  0x78: 0x68, // h
  0x79: 0x69, // i
  0x7A: 0x3A, // :
  0x7B: 0x23, // #
  0x7C: 0x40, // @
  0x7D: 0x27, // '
  0x7E: 0x3D, // =
  0x7F: 0x22, // "
  0x80: 0x80, // €
  0x81: 0x6A, // j
  0x82: 0x6B, // k
  0x83: 0x6C, // l
  0x84: 0x6D, // m
  0x85: 0x6E, // n
  0x86: 0x6F, // o
  0x87: 0x70, // p
  0x88: 0x71, // q
  0x89: 0x72, // r
  0x8A: 0x81, // 
  0x8B: 0x82, // 
  0x8C: 0x83, // 
  0x8D: 0x84, // 
  0x8E: 0x85, // 
  0x8F: 0x86, // 
  0x90: 0x87, // 
  0x91: 0x73, // s
  0x92: 0x74, // t
  0x93: 0x75, // u
  0x94: 0x76, // v
  0x95: 0x77, // w
  0x96: 0x78, // x
  0x97: 0x79, // y
  0x98: 0x7A, // z
  0x99: 0x88, // 
  0x9A: 0x89, // 
  0x9B: 0x8A, // 
  0x9C: 0x8B, // 
  0x9D: 0x8C, // 
  0x9E: 0x8D, // 
  0x9F: 0x8E, // 
  0xA0: 0x8F, // 
  0xA1: 0x7E, // ~
  0xA2: 0x30, // 0
  0xA3: 0x31, // 1
  0xA4: 0x32, // 2
  0xA5: 0x33, // 3
  0xA6: 0x34, // 4
  0xA7: 0x35, // 5
  0xA8: 0x36, // 6
  0xA9: 0x37, // 7
  0xAA: 0x38, // 8
  0xAB: 0x39, // 9
  0xAC: 0x90, // 
  0xAD: 0x91, // 
  0xAE: 0x92, // 
  0xAF: 0x93, // 
  0xB0: 0x94, // 
  0xB1: 0x95, // 
  0xB2: 0x96, // 
  0xB3: 0x97, // 
  0xB4: 0x98, // 
  0xB5: 0x99, // 
  0xB6: 0x9A, // 
  0xB7: 0x9B, // 
  0xB8: 0x9C, // 
  0xB9: 0x9D, // 
  0xBA: 0x9E, // 
  0xBB: 0x9F, // 
  0xBC: 0xA0, // 
  0xBD: 0xA1, // 
  0xBE: 0xA2, // 
  0xBF: 0xA3, // 
  0xC0: 0x7B, // {
  0xC1: 0x41, // A
  0xC2: 0x42, // B
  0xC3: 0x43, // C
  0xC4: 0x44, // D
  0xC5: 0x45, // E
  0xC6: 0x46, // F
  0xC7: 0x47, // G
  0xC8: 0x48, // H
  0xC9: 0x49, // I
  0xCA: 0xA4, // 
  0xCB: 0xA5, // 
  0xCC: 0xA6, // 
  0xCD: 0xA7, // 
  0xCE: 0xA8, // 
  0xCF: 0xA9, // 
  0xD0: 0x7D, // }
  0xD1: 0x4A, // J
  0xD2: 0x4B, // K
  0xD3: 0x4C, // L
  0xD4: 0x4D, // M
  0xD5: 0x4E, // N
  0xD6: 0x4F, // O
  0xD7: 0x50, // P
  0xD8: 0x51, // Q
  0xD9: 0x52, // R
  0xDA: 0xAA, // 
  0xDB: 0xAB, // 
  0xDC: 0xAC, // 
  0xDD: 0xAD, // 
  0xDE: 0xAE, // 
  0xDF: 0xAF, // 
  0xE0: 0x5C, // \
  0xE1: 0xB0, // 
  0xE2: 0x53, // S
  0xE3: 0x54, // T
  0xE4: 0x55, // U
  0xE5: 0x56, // V
  0xE6: 0x57, // W
  0xE7: 0x58, // X
  0xE8: 0x59, // Y
  0xE9: 0x5A, // Z
  0xEA: 0xB1, // 
  0xEB: 0xB2, // 
  0xEC: 0xB3, // 
  0xED: 0xB4, // 
  0xEE: 0xB5, // 
  0xEF: 0xB6, // 
  0xF0: 0x30, // 0
  0xF1: 0x31, // 1
  0xF2: 0x32, // 2
  0xF3: 0x33, // 3
  0xF4: 0x34, // 4
  0xF5: 0x35, // 5
  0xF6: 0x36, // 6
  0xF7: 0x37, // 7
  0xF8: 0x38, // 8
  0xF9: 0x39, // 9
  0xFA: 0xB7, // 
  0xFB: 0xB8, // 
  0xFC: 0xB9, // 
  0xFD: 0xBA, // 
  0xFE: 0xBB, // 
  0xFF: 0x20  // 공백으로 매핑
};

// SOSI 코드 상수
const SOSI_CODES = {
  SO: 0x0E, // Shift Out - 더블바이트 모드 시작
  SI: 0x0F  // Shift In - 싱글바이트 모드 복귀
};

// 더블바이트 문자 매핑 (예시 - 실제 코드페이지에 따라 다름)
const DOUBLE_BYTE_MAPPINGS: { [key: number]: number } = {
  0x4040: 0x8140, // 전각 공백
  0x4241: 0x8241, // 가
  0x4242: 0x8242, // 나
  // ... 더 많은 매핑 추가 가능
};

/**
 * EBCDIC 변환 옵션
 */
export interface EbcdicConversionOptions {
  useSOSI?: boolean;
  sosiHandling?: 'remove' | 'keep' | 'space';
  errorHandling?: 'strict' | 'replace' | 'ignore';
  debugCallback?: (message: string) => void;
}

/**
 * EBCDIC 변환 결과
 */
export interface EbcdicConversionResult {
  output: string;
  errors: string[];
  warnings: string[];
}

/**
 * EBCDIC 헥스 문자열을 ASCII 문자열로 변환
 * @param hexInput EBCDIC 헥스 문자열 (예: "C4C9E2D7D3C1E8")
 * @param options 변환 옵션
 * @returns 변환 결과
 */
export function convertEbcdicToAscii(
  hexInput: string,
  options: EbcdicConversionOptions = {}
): EbcdicConversionResult {
  const {
    useSOSI = false,
    sosiHandling = 'remove',
    errorHandling = 'replace',
    debugCallback
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  
  debugCallback?.('=== EBCDIC → ASCII 변환 시작 ===');
  debugCallback?.(`입력 헥스: ${hexInput}`);
  debugCallback?.(`옵션: useSOSI=${useSOSI}, sosiHandling=${sosiHandling}, errorHandling=${errorHandling}`);

  // 헥스 문자열을 바이트 배열로 변환
  const cleanHex = hexInput.replace(/\s/g, '').toUpperCase();
  if (cleanHex.length % 2 !== 0) {
    warnings.push('입력 헥스 문자열의 길이가 홀수입니다.');
  }

  const bytes: number[] = [];
  for (let i = 0; i < cleanHex.length; i += 2) {
    const hexByte = cleanHex.substr(i, 2);
    const byte = parseInt(hexByte, 16);
    if (isNaN(byte)) {
      const error = `잘못된 헥스 바이트: ${hexByte}`;
      if (errorHandling === 'strict') {
        throw new Error(error);
      }
      errors.push(error);
      continue;
    }
    bytes.push(byte);
  }

  debugCallback?.(`파싱된 바이트 수: ${bytes.length}`);
  debugCallback?.(`바이트 배열: ${bytes.map(b => '0x' + b.toString(16).padStart(2, '0').toUpperCase()).join(' ')}`);

  // SOSI 코드 위치 사전 스캔
  if (useSOSI) {
    const soPositions = bytes.map((b, i) => b === SOSI_CODES.SO ? i : -1).filter(i => i >= 0);
    const siPositions = bytes.map((b, i) => b === SOSI_CODES.SI ? i : -1).filter(i => i >= 0);
    
    debugCallback?.(`SOSI 코드 위치: SO=${soPositions.join(', ')}, SI=${siPositions.join(', ')}`);
  }

  // 바이트 배열을 ASCII 문자열로 변환
  let result = '';
  let i = 0;
  let isInDoubleByte = false;

  while (i < bytes.length) {
    const byte = bytes[i];
    
    debugCallback?.(`[${i}] 처리 중: 0x${byte.toString(16).padStart(2, '0').toUpperCase()}, 모드: ${isInDoubleByte ? '더블바이트' : '싱글바이트'}`);

    if (useSOSI) {
      // SOSI 코드 처리
      if (byte === SOSI_CODES.SO) {
        debugCallback?.(`  → SOSI: Shift-Out 발견 - 더블바이트 모드 시작`);
        isInDoubleByte = true;
        
        // SOSI 코드 처리
        if (sosiHandling === 'keep') {
          result += String.fromCharCode(byte);
        } else if (sosiHandling === 'space') {
          result += ' ';
        }
        // 'remove'인 경우 아무것도 추가하지 않음
        
        i++;
        continue;
      } else if (byte === SOSI_CODES.SI) {
        debugCallback?.(`  → SOSI: Shift-In 발견 - 싱글바이트 모드 복귀`);
        isInDoubleByte = false;
        
        // SOSI 코드 처리
        if (sosiHandling === 'keep') {
          result += String.fromCharCode(byte);
        } else if (sosiHandling === 'space') {
          result += ' ';
        }
        // 'remove'인 경우 아무것도 추가하지 않음
        
        i++;
        continue;
      }

      // 더블바이트 모드에서 데이터 처리
      if (isInDoubleByte) {
        if (i + 1 < bytes.length) {
          const nextByte = bytes[i + 1];
          
          // 다음 바이트가 SI인지 확인
          if (nextByte === SOSI_CODES.SI) {
            debugCallback?.(`  → 더블바이트 모드에서 홀수 바이트 발견 (다음이 SI)`);
            // 현재 바이트를 싱글바이트로 처리
            const asciiValue = EBCDIC_TO_ASCII_TABLE[byte] || 0x20;
            result += String.fromCharCode(asciiValue);
            debugCallback?.(`  → 싱글바이트 처리: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} → 0x${asciiValue.toString(16).padStart(2, '0').toUpperCase()} ('${String.fromCharCode(asciiValue)}')`);
          } else {
            // 정상적인 더블바이트 처리
            const doubleByteValue = (byte << 8) | nextByte;
            debugCallback?.(`  → 더블바이트 처리: 0x${doubleByteValue.toString(16).padStart(4, '0').toUpperCase()}`);
            
            // 더블바이트 매핑 확인
            const mappedValue = DOUBLE_BYTE_MAPPINGS[doubleByteValue];
            if (mappedValue) {
              // 매핑된 값이 있으면 적절히 처리
              if (mappedValue === 0x8140) {
                result += ' '; // 전각 공백을 일반 공백으로
              } else {
                result += ' '; // 기본적으로 공백으로 처리
              }
              debugCallback?.(`  → 더블바이트 매핑: 0x${doubleByteValue.toString(16).padStart(4, '0').toUpperCase()} → 0x${mappedValue.toString(16).padStart(4, '0').toUpperCase()}`);
            } else {
              // 매핑이 없으면 공백으로 처리
              result += ' ';
              debugCallback?.(`  → 더블바이트 매핑 없음: 0x${doubleByteValue.toString(16).padStart(4, '0').toUpperCase()} → 공백`);
            }
            
            i += 2;
            continue;
          }
        } else {
          // 더블바이트 모드에서 마지막 바이트
          debugCallback?.(`  → 더블바이트 모드에서 마지막 바이트`);
          const asciiValue = EBCDIC_TO_ASCII_TABLE[byte] || 0x20;
          result += String.fromCharCode(asciiValue);
          debugCallback?.(`  → 싱글바이트 처리: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} → 0x${asciiValue.toString(16).padStart(2, '0').toUpperCase()} ('${String.fromCharCode(asciiValue)}')`);
        }
      }
    }

    // 싱글바이트 모드 또는 SOSI 미사용 시 처리
    if (!isInDoubleByte || !useSOSI) {
      const asciiValue = EBCDIC_TO_ASCII_TABLE[byte];
      
      if (asciiValue !== undefined) {
        result += String.fromCharCode(asciiValue);
        debugCallback?.(`  → 싱글바이트 변환: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} → 0x${asciiValue.toString(16).padStart(2, '0').toUpperCase()} ('${String.fromCharCode(asciiValue)}')`);
      } else {
        // 매핑이 없는 경우
        const error = `매핑되지 않은 EBCDIC 바이트: 0x${byte.toString(16).padStart(2, '0').toUpperCase()}`;
        if (errorHandling === 'strict') {
          throw new Error(error);
        } else if (errorHandling === 'replace') {
          result += '?';
          debugCallback?.(`  → 매핑 없음: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} → '?'`);
        } else {
          debugCallback?.(`  → 매핑 없음: 0x${byte.toString(16).padStart(2, '0').toUpperCase()} → 무시`);
        }
        errors.push(error);
      }
    }

    i++;
  }

  debugCallback?.(`최종 결과: "${result}"`);
  debugCallback?.(`오류 수: ${errors.length}, 경고 수: ${warnings.length}`);
  debugCallback?.('=== 변환 완료 ===');

  return {
    output: result,
    errors,
    warnings
  };
}

/**
 * ASCII 문자열을 EBCDIC 헥스 문자열로 변환
 * @param asciiInput ASCII 문자열
 * @param options 변환 옵션
 * @returns 변환 결과
 */
export function convertAsciiToEbcdic(
  asciiInput: string,
  options: EbcdicConversionOptions = {}
): EbcdicConversionResult {
  const {
    errorHandling = 'replace',
    debugCallback
  } = options;

  const errors: string[] = [];
  const warnings: string[] = [];
  
  debugCallback?.('=== ASCII → EBCDIC 변환 시작 ===');
  debugCallback?.(`입력 문자열: "${asciiInput}"`);

  // ASCII to EBCDIC 역방향 매핑 생성
  const asciiToEbcdicTable: { [key: number]: number } = {};
  for (const [ebcdic, ascii] of Object.entries(EBCDIC_TO_ASCII_TABLE)) {
    asciiToEbcdicTable[ascii] = parseInt(ebcdic);
  }

  let result = '';
  
  for (let i = 0; i < asciiInput.length; i++) {
    const char = asciiInput[i];
    const asciiValue = char.charCodeAt(0);
    
    const ebcdicValue = asciiToEbcdicTable[asciiValue];
    
    if (ebcdicValue !== undefined) {
      result += ebcdicValue.toString(16).padStart(2, '0').toUpperCase();
      debugCallback?.(`  → ASCII 변환: '${char}' (0x${asciiValue.toString(16).padStart(2, '0').toUpperCase()}) → 0x${ebcdicValue.toString(16).padStart(2, '0').toUpperCase()}`);
    } else {
      const error = `매핑되지 않은 ASCII 문자: '${char}' (0x${asciiValue.toString(16).padStart(2, '0').toUpperCase()})`;
      if (errorHandling === 'strict') {
        throw new Error(error);
      } else if (errorHandling === 'replace') {
        result += '40'; // EBCDIC 공백
        debugCallback?.(`  → 매핑 없음: '${char}' → 0x40 (공백)`);
      } else {
        debugCallback?.(`  → 매핑 없음: '${char}' → 무시`);
      }
      errors.push(error);
    }
  }

  debugCallback?.(`최종 결과: ${result}`);
  debugCallback?.(`오류 수: ${errors.length}, 경고 수: ${warnings.length}`);
  debugCallback?.('=== 변환 완료 ===');

  return {
    output: result,
    errors,
    warnings
  };
}