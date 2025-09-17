import React, { useState } from 'react';
import { ChevronDownIcon, LanguageIcon } from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';
import { availableLanguages, Language } from '../i18n';

const LanguageSelector: React.FC = () => {
  const { language, setLanguage } = useI18n();
  const [isOpen, setIsOpen] = useState(false);

  const currentLanguage = availableLanguages.find(lang => lang.code === language);

  const handleLanguageChange = (newLanguage: Language) => {
    setLanguage(newLanguage);
    setIsOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
      >
        <LanguageIcon className="w-4 h-4 mr-2" />
        <span className="mr-1">{currentLanguage?.flag}</span>
        <span className="mr-2">{currentLanguage?.name}</span>
        <ChevronDownIcon className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown */}
          <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
            <div className="py-1">
              {availableLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChange(lang.code)}
                  className={`w-full flex items-center px-4 py-2 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                    language === lang.code 
                      ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                      : 'text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <span className="mr-3 text-lg">{lang.flag}</span>
                  <span className="font-medium">{lang.name}</span>
                  {language === lang.code && (
                    <span className="ml-auto text-blue-600 dark:text-blue-400">✓</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default LanguageSelector;