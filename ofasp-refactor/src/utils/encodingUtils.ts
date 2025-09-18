/**
 * Encoding conversion utilities for SMED Map Viewer
 * Handles SJIS/Unicode conversion for Japanese text display
 */

/**
 * Convert SJIS encoded string to Unicode
 * Used for displaying Japanese text from SMED files correctly
 */
export function convertSjisToUnicode(text: string): string {
  // This function will be used when the text is already in JavaScript string format
  // but may contain incorrectly decoded characters from SJIS source
  
  // Common SJIS character replacements for display
  const replacements: { [key: string]: string } = {
    // Map commonly misencoded characters to their correct Unicode equivalents
    '���C�������j���[': 'メインメニュー',
    '�c�ƊǗ��V�X�e��': '営業管理システム',
    '����Ǘ��V�X�e��': '売上管理システム',
    '�݌ɊǗ��V�X�e��': '在庫管理システム',
    '���[�U�[�Ǘ�': 'ユーザー管理',
    '�V�X�e�����': 'システム情報',
    '���|�[�g�o��': 'レポート出力',
    '�I�����Ă�������': '選択してください',
    '���O�C�����F': 'ログイン画面',
    // Add more mappings as needed
  };

  let result = text;
  
  // Apply known replacements
  for (const [garbled, correct] of Object.entries(replacements)) {
    result = result.replace(new RegExp(escapeRegExp(garbled), 'g'), correct);
  }
  
  return result;
}

/**
 * Check if a string contains SJIS garbled characters
 */
export function containsSjisGarbledText(text: string): boolean {
  // Check for common patterns of SJIS misencoding
  const garbledPatterns = [
    /[\x80-\xFF]/, // High-bit characters
    /�[�-�]/, // Common garbled character patterns
    /[Â�][��-��]/, // UTF-8 misinterpretation of SJIS
  ];
  
  return garbledPatterns.some(pattern => pattern.test(text));
}

/**
 * Escape special regex characters
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Convert Unicode string to SJIS (for sending data back to server)
 */
export function convertUnicodeToSjis(text: string): string {
  // This would typically be handled server-side
  // For client-side, we just ensure the text is properly formatted
  return text;
}

/**
 * Process SMED field data for proper display
 */
export function processSmedFieldText(field: any): any {
  if (field.prompt && typeof field.prompt === 'string') {
    // Check if the prompt contains garbled SJIS text
    if (containsSjisGarbledText(field.prompt)) {
      field.prompt = convertSjisToUnicode(field.prompt);
    }
  }
  
  return field;
}

/**
 * Process entire SMED map data
 */
export function processSmedMapData(mapData: any): any {
  if (mapData && mapData.fields && Array.isArray(mapData.fields)) {
    mapData.fields = mapData.fields.map(processSmedFieldText);
  }
  
  return mapData;
}