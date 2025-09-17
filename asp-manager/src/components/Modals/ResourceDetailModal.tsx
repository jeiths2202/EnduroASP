import React from 'react';

interface CatalogResource {
  TYPE: string;
  PGMTYPE?: string;
  MAPTYPE?: string;
  RECTYPE?: string;
  RECLEN?: number;
  ENCODING?: string;
  DESCRIPTION: string;
  VERSION?: string;
  CREATED: string;
  UPDATED: string;
  [key: string]: any;
}

interface ResourceDetailModalProps {
  selectedResource: {resource: CatalogResource, name: string, library: string, volume: string} | null;
  isSubmittingJob: boolean;
  onClose: () => void;
  onSubmitJob: (name: string, library: string, volume: string) => void;
}

const ResourceDetailModal: React.FC<ResourceDetailModalProps> = ({
  selectedResource,
  isSubmittingJob,
  onClose,
  onSubmitJob
}) => {
  if (!selectedResource) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-96 max-w-full border border-gray-700">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-semibold text-white">リソース詳細</h3>
          <button 
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>
        
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">名前:</p>
              <p className="text-white font-mono">{selectedResource.name}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">タイプ:</p>
              <p className="text-white">{selectedResource.resource.TYPE}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">ライブラリ:</p>
              <p className="text-white">{selectedResource.library}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">ボリューム:</p>
              <p className="text-white">{selectedResource.volume}</p>
            </div>
          </div>
          
          <div>
            <p className="text-gray-400 text-sm">説明:</p>
            <p className="text-white">{selectedResource.resource.DESCRIPTION}</p>
          </div>
          
          {selectedResource.resource.VERSION && (
            <div>
              <p className="text-gray-400 text-sm">バージョン:</p>
              <p className="text-white">{selectedResource.resource.VERSION}</p>
            </div>
          )}
          
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-gray-400 text-sm">作成日:</p>
              <p className="text-white text-xs">{new Date(selectedResource.resource.CREATED).toLocaleString('ja-JP')}</p>
            </div>
            <div>
              <p className="text-gray-400 text-sm">更新日:</p>
              <p className="text-white text-xs">{new Date(selectedResource.resource.UPDATED).toLocaleString('ja-JP')}</p>
            </div>
          </div>
          
          {selectedResource.resource.TYPE === 'PGM' && (
            <div className="mt-4 pt-4 border-t border-gray-700">
              <button 
                className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-gray-600 disabled:cursor-not-allowed"
                disabled={isSubmittingJob}
                onClick={() => {
                  onSubmitJob(selectedResource.name, selectedResource.library, selectedResource.volume);
                }}
              >
                {isSubmittingJob ? '実行中...' : 'JOB実行 (SBMJOB)'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ResourceDetailModal;