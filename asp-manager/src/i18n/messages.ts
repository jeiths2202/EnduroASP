/**
 * Internationalization Messages
 * All user-facing strings should be defined here
 */

export const MESSAGES = {
  ja: {
    welcome: 'ASPマニュアルについて何でもお聞きください。日本語でも韓国語でも対応いたします。',
    placeholder: 'ASPマニュアルについて質問してください... (日本語/한국어)',
    loading: '読み込み中...',
    error: 'エラーが発生しました',
    noResults: '結果が見つかりませんでした',
    searching: '検索中...',
    sendMessage: 'メッセージを送信',
    clearChat: 'チャットをクリア'
  },
  ko: {
    welcome: 'ASP 매뉴얼에 대해 무엇이든 물어보세요. 일본어나 한국어로 답변해드립니다.',
    placeholder: 'ASP 매뉴얼에 대해 질문해주세요... (일본어/한국어)',
    loading: '로딩 중...',
    error: '오류가 발생했습니다',
    noResults: '결과를 찾을 수 없습니다',
    searching: '검색 중...',
    sendMessage: '메시지 전송',
    clearChat: '채팅 지우기'
  },
  en: {
    welcome: 'Please ask anything about the ASP manual. We support Japanese and Korean.',
    placeholder: 'Please ask about the ASP manual... (Japanese/Korean)',
    loading: 'Loading...',
    error: 'An error occurred',
    noResults: 'No results found',
    searching: 'Searching...',
    sendMessage: 'Send Message',
    clearChat: 'Clear Chat'
  }
};

export const ERROR_MESSAGES = {
  ja: {
    networkError: 'ネットワークエラーが発生しました',
    serverError: 'サーバーエラーが発生しました',
    invalidInput: '無効な入力です',
    fileNotFound: 'ファイルが見つかりません'
  },
  ko: {
    networkError: '네트워크 오류가 발생했습니다',
    serverError: '서버 오류가 발생했습니다',
    invalidInput: '잘못된 입력입니다',
    fileNotFound: '파일을 찾을 수 없습니다'
  },
  en: {
    networkError: 'Network error occurred',
    serverError: 'Server error occurred',
    invalidInput: 'Invalid input',
    fileNotFound: 'File not found'
  }
};