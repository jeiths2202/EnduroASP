import React, { useState, useRef } from 'react';
import { 
  CodeBracketIcon,
  ArrowPathIcon,
  PlayIcon,
  CloudArrowDownIcon,
  FolderOpenIcon,
  RocketLaunchIcon,
  BuildingOfficeIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';

interface DevOpsCobolPageProps {
  isDarkMode: boolean;
}

const DevOpsCobolPage: React.FC<DevOpsCobolPageProps> = ({ isDarkMode }) => {
  const { t, tn } = useI18n();
  const [sourceCode, setSourceCode] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'java' | 'c' | 'shell' | 'python'>('java');
  const [convertedCode, setConvertedCode] = useState('');
  const [isConverting, setIsConverting] = useState(false);
  const [fileName, setFileName] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetLanguages = [
    { value: 'java', label: t('languages.java'), icon: '☕' },
    { value: 'c', label: t('languages.c'), icon: '⚡' },
    { value: 'shell', label: t('languages.shell'), icon: '📜' },
    { value: 'python', label: t('languages.python'), icon: '🐍' },
  ];

  const handleConvert = async () => {
    if (!sourceCode.trim()) return;
    
    setIsConverting(true);
    setPipelineStatus('running');
    
    setTimeout(() => {
      const templates = {
        java: `// DevOps Pipeline Generated - COBOL to Java Conversion
package com.openaspax.converted;

import java.io.*;
import java.util.*;
import com.openaspax.runtime.*;

public class ConvertedProgram {
    private static final Logger logger = LoggerFactory.getLogger(ConvertedProgram.class);
    
    public static void main(String[] args) {
        try {
            // Original COBOL logic converted to Java
            ProgramData data = new ProgramData();
            processMainLogic(data);
            logger.info("Program completed successfully");
        } catch (Exception e) {
            logger.error("Program execution failed", e);
            System.exit(1);
        }
    }
    
    private static void processMainLogic(ProgramData data) {
        // COBOL conversion logic here
        System.out.println("DevOps: COBOL program converted and ready for deployment");
    }
}`,
        c: `/* DevOps Pipeline Generated - COBOL to C Conversion */
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

int main() {
    printf("DevOps: COBOL program converted to C\\n");
    
    // Original COBOL logic converted to C
    char working_storage[1000];
    memset(working_storage, 0, sizeof(working_storage));
    
    // Main processing logic
    process_cobol_logic();
    
    printf("Program completed successfully\\n");
    return 0;
}

void process_cobol_logic() {
    // COBOL conversion logic here
}`,
        shell: `#!/bin/bash
# DevOps Pipeline Generated - COBOL to Shell Conversion

set -euo pipefail

# Original COBOL program converted to shell script
echo "DevOps: COBOL program converted to Shell"

# Working storage equivalent
declare -A WORKING_STORAGE

# Main processing
main() {
    echo "Starting COBOL conversion..."
    
    # Process original COBOL logic
    process_cobol_logic
    
    echo "Program completed successfully"
}

process_cobol_logic() {
    # COBOL conversion logic here
    echo "Processing COBOL business logic..."
}

main "$@"`,
        python: `#!/usr/bin/env python3
"""
DevOps Pipeline Generated - COBOL to Python Conversion
"""

import sys
import logging
from dataclasses import dataclass
from typing import Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class WorkingStorage:
    """COBOL Working Storage equivalent"""
    data: Dict[str, Any] = None
    
    def __post_init__(self):
        if self.data is None:
            self.data = {}

def main():
    """Main program logic"""
    try:
        logger.info("DevOps: COBOL program converted to Python")
        
        # Initialize working storage
        ws = WorkingStorage()
        
        # Process original COBOL logic
        process_cobol_logic(ws)
        
        logger.info("Program completed successfully")
        
    except Exception as e:
        logger.error(f"Program execution failed: {e}")
        sys.exit(1)

def process_cobol_logic(working_storage: WorkingStorage):
    """COBOL conversion logic here"""
    print("Processing COBOL business logic...")

if __name__ == "__main__":
    main()`
      };
      
      setConvertedCode(templates[targetLanguage]);
      setIsConverting(false);
      setPipelineStatus('success');
    }, 3000);
  };

  const handleDeployPipeline = () => {
    setPipelineStatus('running');
    setTimeout(() => {
      setPipelineStatus('success');
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
        setConvertedCode('');
        setPipelineStatus('idle');
      };
      reader.readAsText(file);
    }
    
    if (event.target) {
      event.target.value = '';
    }
  };

  const handleFileSelect = () => {
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
      fileInputRef.current.click();
    }
  };

  const getPipelineStatusColor = () => {
    switch (pipelineStatus) {
      case 'running': return 'text-yellow-600';
      case 'success': return 'text-green-600';
      case 'failed': return 'text-red-600';
      default: return 'text-gray-600';
    }
  };

  const getPipelineStatusText = () => {
    switch (pipelineStatus) {
      case 'running': return 'Pipeline Running...';
      case 'success': return 'Pipeline Success ✓';
      case 'failed': return 'Pipeline Failed ✗';
      default: return 'Ready for Deployment';
    }
  };

  return (
    <div className="h-full p-8">
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <BuildingOfficeIcon className="w-8 h-8 text-blue-600 mr-3" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            DevOps COBOL Converter
          </h1>
          <div className={`ml-auto px-4 py-2 rounded-lg ${getPipelineStatusColor()} bg-opacity-10`}>
            <span className={`font-medium ${getPipelineStatusColor()}`}>
              {getPipelineStatusText()}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          COBOL to Modern Language Conversion with Automated CI/CD Pipeline
        </p>
      </div>

      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Conversion Settings
        </h3>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Target Language
            </label>
            <div className="grid grid-cols-2 gap-2">
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
                    <div className="text-xl mb-1">{lang.icon}</div>
                    <div className={`text-xs font-medium ${
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
              File Operations
            </label>
            <div className="space-y-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileUpload}
                accept=".cbl,.cob,.cobol,.txt"
                className="hidden"
              />
              <button
                onClick={handleFileSelect}
                className="w-full flex items-center justify-center px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <FolderOpenIcon className="w-4 h-4 mr-2" />
                Select COBOL File
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              DevOps Pipeline
            </label>
            <div className="space-y-2">
              <button
                onClick={handleDeployPipeline}
                disabled={!convertedCode || pipelineStatus === 'running'}
                className="w-full flex items-center justify-center px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg transition-colors"
              >
                <RocketLaunchIcon className="w-4 h-4 mr-2" />
                Deploy to Pipeline
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              COBOL Source Code
            </h3>
            <div className="flex space-x-2">
              <button
                onClick={handleConvert}
                disabled={!sourceCode.trim() || isConverting}
                className="flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white rounded-lg transition-colors"
              >
                {isConverting ? (
                  <ArrowPathIcon className="w-4 h-4 mr-2 animate-spin" />
                ) : (
                  <PlayIcon className="w-4 h-4 mr-2" />
                )}
                {isConverting ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="Enter COBOL source code or upload a file..."
              className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Converted {targetLanguage.toUpperCase()} Code
            </h3>
            {convertedCode && (
              <button className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                Download
              </button>
            )}
          </div>
          <div className="p-4">
            {isConverting ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Converting COBOL to {targetLanguage.toUpperCase()}...
                  </p>
                </div>
              </div>
            ) : (
              <textarea
                value={convertedCode}
                readOnly
                placeholder={`Converted ${targetLanguage.toUpperCase()} code will appear here...`}
                className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevOpsCobolPage;