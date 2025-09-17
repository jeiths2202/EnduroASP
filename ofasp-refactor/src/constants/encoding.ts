/**
 * Encoding Constants
 * Constants for character encoding conversion
 */

export const ENCODING_CONSTANTS = {
  // Character code ranges
  BYTE_RANGES: {
    MAX_SINGLE_BYTE: 0xFF,
    MAX_DOUBLE_BYTE: 0xFFFF,
    DOUBLE_BYTE_ARRAY_SIZE: 65536,
    SINGLE_BYTE_ARRAY_SIZE: 256,
    ASCII_PRINTABLE_START: 0x20,
    ASCII_PRINTABLE_END: 0x7E,
    LATIN1_EXTENDED_START: 0x80,
    LATIN1_EXTENDED_END: 0xFF
  },
  
  // Japanese encoding specific values
  JAPANESE_CODES: {
    FULL_WIDTH_SPACE: 0x8140,
    SHIFT_JIS_FIRST_BYTE_START: 0x81,
    SHIFT_JIS_FIRST_BYTE_END: 0x9F,
    SHIFT_JIS_SECOND_BYTE_START: 0x40,
    SHIFT_JIS_SECOND_BYTE_END: 0xFC
  },
  
  // SOSI (Shift-Out/Shift-In) codes
  SOSI_CODES: {
    DEFAULT_SO: 0x0E,
    DEFAULT_SI: 0x0F,
    ALTERNATE_SO: 0x1E,
    ALTERNATE_SI: 0x1F
  },
  
  // Conversion modes
  CONVERSION_MODES: {
    EBCDIC_TO_ASCII: 1,
    ASCII_TO_EBCDIC: 2
  },
  
  // Error handling
  ERROR_HANDLING: {
    STRICT: 'strict',
    REPLACE: 'replace',
    IGNORE: 'ignore'
  },
  
  // Replacement characters
  REPLACEMENT_CHARS: {
    UNMAPPED_SINGLE: '?',
    UNMAPPED_DOUBLE: '??',
    SPACE: ' ',
    INVALID_CHAR: '\uFFFD' // Unicode replacement character
  },
  
  // Encoding types
  ENCODING_TYPES: {
    US: 'US',
    JP: 'JP',
    KR: 'KR',
    JAK: 'JAK',
    KEIS: 'KEIS'
  }
};

// Export individual constants for easier access
export const BYTE_RANGES = ENCODING_CONSTANTS.BYTE_RANGES;
export const JAPANESE_CODES = ENCODING_CONSTANTS.JAPANESE_CODES;
export const SOSI_CODES = ENCODING_CONSTANTS.SOSI_CODES;
export const CONVERSION_MODES = ENCODING_CONSTANTS.CONVERSION_MODES;
export const ERROR_HANDLING = ENCODING_CONSTANTS.ERROR_HANDLING;
export const REPLACEMENT_CHARS = ENCODING_CONSTANTS.REPLACEMENT_CHARS;
export const ENCODING_TYPES = ENCODING_CONSTANTS.ENCODING_TYPES;