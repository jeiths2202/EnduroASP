import React, { useState, useRef } from 'react';
import { 
  CodeBracketIcon,
  ArrowPathIcon,
  PlayIcon,
  CloudArrowDownIcon,
  FolderOpenIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';

interface ClAXPageProps {
  isDarkMode: boolean;
}

const ClAXPage: React.FC<ClAXPageProps> = ({ isDarkMode }) => {
  const { t, tn } = useI18n();
  const [sourceCode, setSourceCode] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'shell' | 'javascript' | 'python'>('shell');
  const [transformedCode, setTransformedCode] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [fileName, setFileName] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetLanguages = [
    { value: 'shell', label: t('languages.shell'), icon: '📜' },
    { value: 'javascript', label: t('languages.javascript'), icon: '🟨' },
    { value: 'python', label: t('languages.python'), icon: '🐍' },
  ];

  const handleRefactor = async () => {
    if (!sourceCode.trim()) return;
    
    setIsTransforming(true);
    
    // 실제 refactoring API 호출이 들어갈 부분
    setTimeout(() => {
      setTransformedCode(`// Transformed from CL to ${targetLanguage.toUpperCase()}
// Original CL commands converted to ${targetLanguage}

${targetLanguage === 'shell' ? `#!/bin/bash
# Converted CL commands
echo "Starting batch job..."
# File operations
cp source.txt target.txt
# Program execution
./converted_program
echo "Batch job completed"` : targetLanguage === 'javascript' ? `#!/usr/bin/env node
// Converted CL commands
const fs = require('fs');
const { execSync } = require('child_process');

console.log("Starting batch job...");
// File operations
fs.copyFileSync('source.txt', 'target.txt');
// Program execution
execSync('./converted_program');
console.log("Batch job completed");` : `#!/usr/bin/env python3
import os
import shutil
import subprocess

# Converted CL commands
print("Starting batch job...")
# File operations
shutil.copy('source.txt', 'target.txt')
# Program execution
subprocess.run(['./converted_program'])
print("Batch job completed")`}
`);
      setIsTransforming(false);
    }, 2000);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setSourceCode(content);
        setFileName(file.name);
        // 새 파일 선택 시 이전 변환 결과 초기화
        setTransformedCode('');
      };
      reader.readAsText(file);
    }
    
    // 파일 선택 후 input을 초기화하여 동일 파일 재선택 가능하도록 함
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleFileSelect = () => {
    // 파일 input을 강제로 초기화한 후 클릭
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  return (
    <div className="h-full p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
          {t('clAX.title')}
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          {t('clAX.subtitle')}
        </p>
      </div>

      {/* 설정 패널 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('clAX.settingsTitle')}
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clAX.targetLanguage')}
            </label>
            <div className="grid grid-cols-3 gap-2">
              {targetLanguages.map((lang) => (
                <button
                  key={lang.value}
                  onClick={() => setTargetLanguage(lang.value as any)}
                  className={`p-3 rounded-lg border transition-colors ${
                    targetLanguage === lang.value
                      ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
                      : 'bg-gray-50 dark:bg-gray-700 border-gray-200 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-600'
                  }`}
                >
                  <div className="text-center">
                    <div className="text-2xl mb-1">{lang.icon}</div>
                    <div className={`text-sm font-medium ${
                      targetLanguage === lang.value
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-900 dark:text-white'
                    }`}>
                      {lang.label}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('clAX.quickActions')}
            </label>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".cl,.cle,.clp,.txt"
                className="hidden"
              />
              <button
                onClick={handleFileSelect}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <FolderOpenIcon className="w-4 h-4 mr-2" />
                {t('common.selectFile')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 코드 편집 영역 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* 소스 코드 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('clAX.sourceCode')}
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handleRefactor}
                disabled={!sourceCode.trim() || isTransforming}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {isTransforming ? (
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PlayIcon className="w-4 h-4 mr-2" />
                )}
                {isTransforming ? t('clAX.transforming') : t('clAX.executeTransform')}
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder={t('clAX.sourcePlaceholder')}
              className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        {/* 리팩토링된 코드 */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              {t('clAX.transformedCode')}
            </h3>
            {transformedCode && (
              <button className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                {t('common.download')}
              </button>
            )}
          </div>
          <div className="p-4">
            {isTransforming ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    {t('clAX.converting', { language: targetLanguage.toUpperCase() })}
                  </p>
                </div>
              </div>
            ) : (
              <textarea
                value={transformedCode}
                readOnly
                placeholder={t('clAX.transformedPlaceholder', { language: targetLanguage.toUpperCase() })}
                className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none"
              />
            )}
          </div>
        </div>
      </div>

      {/* CL 명령어 참조 */}
      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          {t('clAX.commandReference')}
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('clAX.fileOperations')}</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {tn('clAX.commands.fileOps').map((cmd: string, index: number) => (
                <div key={index}>{cmd}</div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('clAX.programExecution')}</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {tn('clAX.commands.programExec').map((cmd: string, index: number) => (
                <div key={index}>{cmd}</div>
              ))}
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">{t('clAX.variableHandling')}</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              {tn('clAX.commands.variables').map((cmd: string, index: number) => (
                <div key={index}>{cmd}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ClAXPage;