// Multi-language support for ASP Manager
export interface LanguageTexts {
  // ASP Map Editor texts
  mapEditor: {
    statusMessage: string;
    fieldTypes: {
      text: string;
      input: string;
      output: string;
      button: string;
    };
    buttons: {
      loadSmed: string;
      saveSmed: string;
      preview: string;
      clear: string;
      execute: string;
      addField: string;
    };
    properties: {
      title: string;
      name: string;
      type: string;
      position: string;
      size: string;
      value: string;
      cssClass: string;
      attributes: string;
      backgroundColor: string;
      textColor: string;
    };
    preview: {
      title: string;
      close: string;
    };
    messages: {
      fieldAdded: string;
      fieldDeleted: string;
      smedLoaded: string;
      smedSaved: string;
      error: string;
    };
  };
}

export const languages: Record<string, LanguageTexts> = {
  ko: {
    mapEditor: {
      statusMessage: '드래그 앤 드롭으로 필드를 추가하고, 클릭으로 선택하여 속성을 편집하세요.',
      fieldTypes: {
        text: '텍스트',
        input: '입력',
        output: '출력',
        button: '버튼'
      },
      buttons: {
        loadSmed: 'SMED 불러오기',
        saveSmed: 'SMED 저장',
        preview: '미리보기',
        clear: '화면 지우기',
        execute: '실행',
        addField: '필드 추가'
      },
      properties: {
        title: '필드 속성',
        name: '이름',
        type: '타입',
        position: '위치',
        size: '크기',
        value: '값',
        cssClass: 'CSS 클래스',
        attributes: '속성',
        backgroundColor: '배경색',
        textColor: '텍스트 색상'
      },
      preview: {
        title: 'SMED 맵 미리보기',
        close: '닫기'
      },
      messages: {
        fieldAdded: '필드가 추가되었습니다.',
        fieldDeleted: '필드가 삭제되었습니다.',
        smedLoaded: 'SMED 파일이 로드되었습니다.',
        smedSaved: 'SMED 파일이 저장되었습니다.',
        error: '오류가 발생했습니다.'
      }
    }
  },
  ja: {
    mapEditor: {
      statusMessage: 'ドラッグアンドドロップでフィールドを追加し、クリックで選択してプロパティを編集してください。',
      fieldTypes: {
        text: 'テキスト',
        input: '入力',
        output: '出力',
        button: 'ボタン'
      },
      buttons: {
        loadSmed: 'SMED読み込み',
        saveSmed: 'SMED保存',
        preview: 'プレビュー',
        clear: '画面クリア',
        execute: '実行',
        addField: 'フィールド追加'
      },
      properties: {
        title: 'フィールドプロパティ',
        name: '名前',
        type: 'タイプ',
        position: '位置',
        size: 'サイズ',
        value: '値',
        cssClass: 'CSSクラス',
        attributes: '属性',
        backgroundColor: '背景色',
        textColor: 'テキスト色'
      },
      preview: {
        title: 'SMEDマッププレビュー',
        close: '閉じる'
      },
      messages: {
        fieldAdded: 'フィールドが追加されました。',
        fieldDeleted: 'フィールドが削除されました。',
        smedLoaded: 'SMEDファイルが読み込まれました。',
        smedSaved: 'SMEDファイルが保存されました。',
        error: 'エラーが発生しました。'
      }
    }
  },
  en: {
    mapEditor: {
      statusMessage: 'Drag and drop to add fields, click to select and edit properties.',
      fieldTypes: {
        text: 'Text',
        input: 'Input',
        output: 'Output',
        button: 'Button'
      },
      buttons: {
        loadSmed: 'Load SMED',
        saveSmed: 'Save SMED',
        preview: 'Preview',
        clear: 'Clear Screen',
        execute: 'Execute',
        addField: 'Add Field'
      },
      properties: {
        title: 'Field Properties',
        name: 'Name',
        type: 'Type',
        position: 'Position',
        size: 'Size',
        value: 'Value',
        cssClass: 'CSS Class',
        attributes: 'Attributes',
        backgroundColor: 'Background Color',
        textColor: 'Text Color'
      },
      preview: {
        title: 'SMED Map Preview',
        close: 'Close'
      },
      messages: {
        fieldAdded: 'Field added.',
        fieldDeleted: 'Field deleted.',
        smedLoaded: 'SMED file loaded.',
        smedSaved: 'SMED file saved.',
        error: 'An error occurred.'
      }
    }
  }
};

// Language detection and management
export const getLanguage = (): string => {
  // Check localStorage first
  const savedLang = localStorage.getItem('asp-language');
  if (savedLang && languages[savedLang]) {
    return savedLang;
  }
  
  // Check browser language
  const browserLang = navigator.language.split('-')[0];
  if (languages[browserLang]) {
    return browserLang;
  }
  
  // Default to English (changed from Korean)
  return 'en';
};

export const setLanguage = (lang: string): void => {
  if (languages[lang]) {
    localStorage.setItem('asp-language', lang);
  }
};

export const getText = (path: string): string => {
  const lang = getLanguage();
  const texts = languages[lang];
  
  const keys = path.split('.');
  let result: any = texts;
  
  for (const key of keys) {
    if (result && typeof result === 'object' && key in result) {
      result = result[key];
    } else {
      // Fallback to Korean if path not found
      result = languages.ko;
      for (const fallbackKey of keys) {
        if (result && typeof result === 'object' && fallbackKey in result) {
          result = result[fallbackKey];
        } else {
          return path; // Return path if not found
        }
      }
      break;
    }
  }
  
  return typeof result === 'string' ? result : path;
};