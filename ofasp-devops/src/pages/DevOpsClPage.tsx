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

interface DevOpsClPageProps {
  isDarkMode: boolean;
}

const DevOpsClPage: React.FC<DevOpsClPageProps> = ({ isDarkMode }) => {
  const { t, tn } = useI18n();
  const [sourceCode, setSourceCode] = useState('');
  const [targetLanguage, setTargetLanguage] = useState<'shell' | 'javascript' | 'python'>('shell');
  const [transformedCode, setTransformedCode] = useState('');
  const [isTransforming, setIsTransforming] = useState(false);
  const [fileName, setFileName] = useState('');
  const [pipelineStatus, setPipelineStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const targetLanguages = [
    { value: 'shell', label: t('languages.shell'), icon: '📜' },
    { value: 'javascript', label: t('languages.javascript'), icon: '🟨' },
    { value: 'python', label: t('languages.python'), icon: '🐍' },
  ];

  const handleRefactor = async () => {
    if (!sourceCode.trim()) return;
    
    setIsTransforming(true);
    setPipelineStatus('running');
    
    setTimeout(() => {
      const templates = {
        shell: `#!/bin/bash
# DevOps Pipeline Generated - CL to Shell Conversion

set -euo pipefail

# Original CL commands converted to shell
echo "DevOps: CL commands converted to Shell"

# File operations
cp source.txt target.txt

# Program execution
./converted_program

# Job control
echo "Batch job completed successfully"

# Exit handling
trap 'echo "Script interrupted"; exit 1' INT TERM`,

        javascript: `#!/usr/bin/env node
/**
 * DevOps Pipeline Generated - CL to JavaScript Conversion
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

console.log("DevOps: CL commands converted to JavaScript");

try {
    // File operations
    fs.copyFileSync('source.txt', 'target.txt');
    
    // Program execution
    execSync('./converted_program', { stdio: 'inherit' });
    
    // Job completion
    console.log("Batch job completed successfully");
    
} catch (error) {
    console.error("Error in CL conversion:", error.message);
    process.exit(1);
}

// Error handling
process.on('SIGINT', () => {
    console.log("Script interrupted");
    process.exit(1);
});`,

        python: `#!/usr/bin/env python3
"""
DevOps Pipeline Generated - CL to Python Conversion
"""

import os
import sys
import shutil
import subprocess
import signal
from pathlib import Path

def signal_handler(signum, frame):
    """Handle interrupt signals"""
    print("Script interrupted")
    sys.exit(1)

def main():
    """Main conversion logic"""
    try:
        print("DevOps: CL commands converted to Python")
        
        # File operations
        shutil.copy('source.txt', 'target.txt')
        
        # Program execution
        subprocess.run(['./converted_program'], check=True)
        
        # Job completion
        print("Batch job completed successfully")
        
    except subprocess.CalledProcessError as e:
        print(f"Program execution failed: {e}")
        sys.exit(1)
    except FileNotFoundError as e:
        print(f"File operation failed: {e}")
        sys.exit(1)
    except Exception as e:
        print(f"Unexpected error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    # Set up signal handling
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    main()`
      };
      
      setTransformedCode(templates[targetLanguage]);
      setIsTransforming(false);
      setPipelineStatus('success');
    }, 2500);
  };

  const handleDeployPipeline = () => {
    setPipelineStatus('running');
    setTimeout(() => {
      setPipelineStatus('success');
    }, 1500);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        setSourceCode(content);
        setFileName(file.name);
        setTransformedCode('');
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
            DevOps CL Converter
          </h1>
          <div className={`ml-auto px-4 py-2 rounded-lg ${getPipelineStatusColor()} bg-opacity-10`}>
            <span className={`font-medium ${getPipelineStatusColor()}`}>
              {getPipelineStatusText()}
            </span>
          </div>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          IBM i CL to Modern Language Conversion with Automated CI/CD Pipeline
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
              File Operations
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
                Select CL File
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
                disabled={!transformedCode || pipelineStatus === 'running'}
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
              CL Source Code
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
                {isTransforming ? 'Converting...' : 'Convert'}
              </button>
            </div>
          </div>
          <div className="p-4">
            <textarea
              value={sourceCode}
              onChange={(e) => setSourceCode(e.target.value)}
              placeholder="Enter CL source code or upload a file..."
              className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Converted {targetLanguage.toUpperCase()} Code
            </h3>
            {transformedCode && (
              <button className="flex items-center px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition-colors">
                <CloudArrowDownIcon className="w-4 h-4 mr-2" />
                Download
              </button>
            )}
          </div>
          <div className="p-4">
            {isTransforming ? (
              <div className="flex items-center justify-center h-96">
                <div className="text-center">
                  <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
                  <p className="text-gray-600 dark:text-gray-400">
                    Converting CL to {targetLanguage.toUpperCase()}...
                  </p>
                </div>
              </div>
            ) : (
              <textarea
                value={transformedCode}
                readOnly
                placeholder={`Converted ${targetLanguage.toUpperCase()} code will appear here...`}
                className="w-full h-96 font-mono text-sm bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-600 rounded-lg p-4 text-gray-900 dark:text-white resize-none"
              />
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 border border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          CL Command Reference
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">File Operations</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>CPYF (Copy File)</div>
              <div>DLTF (Delete File)</div>
              <div>CRTPF (Create Physical File)</div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Program Execution</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>CALL (Call Program)</div>
              <div>SBMJOB (Submit Job)</div>
              <div>EVOKE (Evoke Program)</div>
            </div>
          </div>
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4">
            <h4 className="font-medium text-gray-900 dark:text-white mb-2">Variable Handling</h4>
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>DCL (Declare Variable)</div>
              <div>CHGVAR (Change Variable)</div>
              <div>RTVJOBA (Retrieve Job Attributes)</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DevOpsClPage;