import jaTranslations from './ja.json';
import enTranslations from './en.json';
import koTranslations from './ko.json';

export type Language = 'ja' | 'en' | 'ko';

export interface Translations {
  [key: string]: any;
}

const translations: Record<Language, Translations> = {
  ja: jaTranslations,
  en: enTranslations,
  ko: koTranslations,
};

export const getTranslation = (language: Language, key: string, params?: Record<string, string>): string => {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return key; // Return key if translation not found
    }
  }
  
  if (typeof value !== 'string') {
    return key;
  }
  
  // Replace parameters if provided
  if (params) {
    let result = value;
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), paramValue);
    });
    return result;
  }
  
  return value;
};

export const getNestedTranslation = (language: Language, key: string): any => {
  const keys = key.split('.');
  let value: any = translations[language];
  
  for (const k of keys) {
    if (value && typeof value === 'object') {
      value = value[k];
    } else {
      return null;
    }
  }
  
  return value;
};

export const availableLanguages: { code: Language; name: string; flag: string }[] = [
  { code: 'ja', name: '日本語', flag: '🇯🇵' },
  { code: 'en', name: 'English', flag: '🇺🇸' },
  { code: 'ko', name: '한국어', flag: '🇰🇷' },
];

export default translations;