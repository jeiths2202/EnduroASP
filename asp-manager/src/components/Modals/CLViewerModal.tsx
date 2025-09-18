import React from 'react';
import { ArrowPathIcon, PlayIcon } from '@heroicons/react/24/outline';

interface CLData {
  name: string;
  library: string;
  volume: string;
}

interface CLViewerModalProps {
  showCLViewer: boolean;
  selectedCL: CLData | null;
  clContent: string;
  isLoadingCL: boolean;
  onClose: () => void;
  onExecute: () => void;
}

const CLViewerModal: React.FC<CLViewerModalProps> = ({
  showCLViewer,
  selectedCL,
  clContent,
  isLoadingCL,
  onClose,
  onExecute
}) => {
  if (!showCLViewer || !selectedCL) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-3/4 max-w-4xl h-3/4 border border-gray-700 flex flex-col">
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-semibold text-white">
              CLプログラム: {selectedCL.name}
            </h3>
            <p className="text-sm text-gray-400">
              {selectedCL.volume}/{selectedCL.library}
            </p>
          </div>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl"
          >
            ×
          </button>
        </div>
        
        <div className="flex-1 bg-gray-900 rounded p-4 overflow-auto">
          {isLoadingCL ? (
            <div className="flex items-center justify-center h-full">
              <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin" />
              <span className="ml-2 text-gray-400">CLファイル読み込み中...</span>
            </div>
          ) : (
            <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
              {clContent}
            </pre>
          )}
        </div>
        
        <div className="mt-4 flex justify-end space-x-2">
          <button 
            onClick={onExecute}
            disabled={isLoadingCL}
            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:bg-gray-600 disabled:cursor-not-allowed"
          >
            <PlayIcon className="w-4 h-4 inline mr-2" />
            実行
          </button>
          <button 
            onClick={onClose}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};

export default CLViewerModal;