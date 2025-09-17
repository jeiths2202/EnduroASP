import { createContext, useContext } from 'react';
import { Language, getTranslation, getNestedTranslation } from '../i18n';

export interface I18nContextType {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string, params?: Record<string, string>) => string;
  tn: (key: string) => any;
}

export const I18nContext = createContext<I18nContextType | undefined>(undefined);

export const useI18n = (): I18nContextType => {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
};

export const createI18nContextValue = (
  language: Language,
  setLanguage: (language: Language) => void
): I18nContextType => ({
  language,
  setLanguage,
  t: (key: string, params?: Record<string, string>) => getTranslation(language, key, params),
  tn: (key: string) => getNestedTranslation(language, key),
});