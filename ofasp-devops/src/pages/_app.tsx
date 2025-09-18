import React, { useState, useEffect } from 'react';
import type { AppProps } from 'next/app';
import { I18nContext, createI18nContextValue } from '../hooks/useI18n';
import { Language } from '../i18n';
import '../styles/globals.css';

function MyApp({ Component, pageProps }: AppProps) {
  const [language, setLanguage] = useState<Language>('ja');

  useEffect(() => {
    // Load language from localStorage
    const savedLanguage = localStorage.getItem('language') as Language;
    if (savedLanguage && ['ja', 'en', 'ko'].includes(savedLanguage)) {
      setLanguage(savedLanguage);
    } else {
      // Set Japanese as default if no saved language
      setLanguage('ja');
    }
  }, []);

  useEffect(() => {
    // Save language to localStorage
    localStorage.setItem('language', language);
  }, [language]);

  const i18nContextValue = createI18nContextValue(language, setLanguage);

  return (
    <I18nContext.Provider value={i18nContextValue}>
      <Component {...pageProps} />
    </I18nContext.Provider>
  );
}

export default MyApp;