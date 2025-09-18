import React from 'react';
import { ArrowPathIcon } from '@heroicons/react/24/outline';

interface CatalogResource {
  TYPE: string;
  PGMTYPE?: string;
  MAPTYPE?: string;
  RECTYPE?: string;
  RECFM?: string;
  RECLEN?: number;
  LRECL?: number;
  ENCODING?: string;
  DESCRIPTION: string;
  VERSION?: string;
  CREATED: string;
  UPDATED: string;
  [key: string]: any;
}

interface DatasetInfo {
  name: string;
  type: string;
  library: string;
  volume: string;
  rectype?: string;
  reclen?: number;
  encoding?: string;
  description: string;
}

interface DatasetManagementSectionProps {
  catalogData: any;
  isLoadingDataset: boolean;
  setActiveSection: (section: string) => void;
  viewDataset: (dataset: DatasetInfo) => void;
  editDataset: (dataset: DatasetInfo) => void;
  deleteDataset: (dataset: DatasetInfo) => void;
}

const DatasetManagementSection: React.FC<DatasetManagementSectionProps> = ({
  catalogData,
  isLoadingDataset,
  setActiveSection,
  viewDataset,
  editDataset,
  deleteDataset
}) => {
  if (!catalogData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading dataset information...</p>
        </div>
      </div>
    );
  }

  const datasets: DatasetInfo[] = [];
  
  Object.entries(catalogData).forEach(([volumeName, volume]) => {
    if (typeof volume === 'object' && volume !== null) {
      Object.entries(volume).forEach(([libraryName, library]) => {
        if (typeof library === 'object' && library !== null) {
          Object.entries(library).forEach(([resourceName, resourceData]) => {
            if (typeof resourceData === 'object' && resourceData !== null && 'TYPE' in resourceData) {
              const resource = resourceData as CatalogResource;
              if (resource.TYPE === 'DATASET') {
                datasets.push({
                  name: resourceName,
                  type: resource.TYPE,
                  library: libraryName,
                  volume: volumeName,
                  rectype: resource.RECTYPE || resource.RECFM,
                  reclen: resource.RECLEN || resource.LRECL,
                  encoding: resource.ENCODING,
                  description: resource.DESCRIPTION || 'No description'
                } as DatasetInfo);
              }
            }
          });
        }
      });
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">Dataset Management</h3>
        <div className="flex space-x-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
            Create Dataset
          </button>
          <button 
            onClick={() => setActiveSection('catalog')}
            className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Catalog Browse
          </button>
        </div>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Dataset Name</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Record Type</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Library</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Volume</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Description</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {datasets.map((dataset, index) => (
              <tr key={index} className="hover:bg-gray-750">
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">{dataset.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{dataset.rectype || 'N/A'}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{dataset.library}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{dataset.volume}</td>
                <td className="px-6 py-4 text-sm text-gray-300">{dataset.description}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm">
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => viewDataset(dataset)}
                      className="text-blue-400 hover:text-blue-300 disabled:text-gray-500"
                      disabled={isLoadingDataset}
                    >
                      表示
                    </button>
                    <button 
                      onClick={() => editDataset(dataset)}
                      className="text-green-400 hover:text-green-300"
                    >
                      編集
                    </button>
                    <button 
                      onClick={() => deleteDataset(dataset)}
                      className="text-red-400 hover:text-red-300"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {datasets.length === 0 && (
          <div className="p-8 text-center text-gray-400">
            No datasets found in catalog
          </div>
        )}
      </div>
    </div>
  );
};

export default DatasetManagementSection;