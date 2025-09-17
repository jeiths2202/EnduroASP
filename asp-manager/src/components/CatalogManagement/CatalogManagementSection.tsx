import React from 'react';
import {
  ArrowPathIcon,
  ChevronUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';

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

interface CatalogItem {
  name: string;
  type: string;
  library: string;
  volume: string;
  owner: string;
  resource: CatalogResource;
}

interface CatalogManagementSectionProps {
  catalogData: any;
  catalogSortField: string;
  catalogSortDirection: 'asc' | 'desc';
  fetchCatalogData: () => void;
  handleCatalogSort: (field: string) => void;
  handleCLDoubleClick: (resource: {resource: CatalogResource, name: string, library: string, volume: string}) => Promise<void>;
  setSelectedResource: (resource: CatalogItem | null) => void;
  handleDeleteCatalog: (resource: CatalogItem) => void;
}

const CatalogManagementSection: React.FC<CatalogManagementSectionProps> = ({
  catalogData,
  catalogSortField,
  catalogSortDirection,
  fetchCatalogData,
  handleCatalogSort,
  handleCLDoubleClick,
  setSelectedResource,
  handleDeleteCatalog
}) => {
  const getCatalogSortIcon = (field: string) => {
    if (catalogSortField !== field) {
      return null;
    }
    return catalogSortDirection === 'asc' ? 
      <ChevronUpIcon className="w-4 h-4 inline ml-1" /> : 
      <ChevronDownIcon className="w-4 h-4 inline ml-1" />;
  };

  if (!catalogData) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <ArrowPathIcon className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
          <p className="text-gray-400">Loading catalog data...</p>
        </div>
      </div>
    );
  }

  const resources: CatalogItem[] = [];
  
  Object.entries(catalogData).forEach(([volumeName, volume]) => {
    if (typeof volume === 'object' && volume !== null) {
      Object.entries(volume).forEach(([libraryName, library]) => {
        if (typeof library === 'object' && library !== null) {
          Object.entries(library).forEach(([resourceName, resourceData]) => {
            if (typeof resourceData === 'object' && resourceData !== null && 'TYPE' in resourceData) {
              const resource = resourceData as CatalogResource;
              resources.push({
                name: resourceName,
                type: resource.TYPE,
                library: libraryName,
                volume: volumeName,
                owner: 'admin',
                resource: resource
              });
            }
          });
        }
      });
    }
  });

  // Sort resources based on current sort settings
  const sortedResources = [...resources].sort((a, b) => {
    let aValue: any;
    let bValue: any;

    switch (catalogSortField) {
      case 'name':
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
        break;
      case 'type':
        aValue = (a.resource.PGMTYPE || a.type).toLowerCase();
        bValue = (b.resource.PGMTYPE || b.type).toLowerCase();
        break;
      case 'library':
        aValue = a.library.toLowerCase();
        bValue = b.library.toLowerCase();
        break;
      case 'volume':
        aValue = a.volume.toLowerCase();
        bValue = b.volume.toLowerCase();
        break;
      case 'owner':
        aValue = a.owner.toLowerCase();
        bValue = b.owner.toLowerCase();
        break;
      default:
        aValue = a.name.toLowerCase();
        bValue = b.name.toLowerCase();
    }

    if (catalogSortDirection === 'asc') {
      return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
    } else {
      return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
    }
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-white">カタログ管理</h3>
        <button 
          onClick={fetchCatalogData}
          className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
        >
          更新
        </button>
      </div>

      <div className="bg-gray-800 rounded-lg border border-gray-700 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-900">
            <tr>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleCatalogSort('name')}
              >
                <div className="flex items-center">
                  リソース名
                  {getCatalogSortIcon('name')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleCatalogSort('type')}
              >
                <div className="flex items-center">
                  タイプ名
                  {getCatalogSortIcon('type')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleCatalogSort('library')}
              >
                <div className="flex items-center">
                  ライブラリ名
                  {getCatalogSortIcon('library')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleCatalogSort('volume')}
              >
                <div className="flex items-center">
                  ボリューム名
                  {getCatalogSortIcon('volume')}
                </div>
              </th>
              <th 
                className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider cursor-pointer hover:bg-gray-800 transition-colors"
                onClick={() => handleCatalogSort('owner')}
              >
                <div className="flex items-center">
                  所有者
                  {getCatalogSortIcon('owner')}
                </div>
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-300 uppercase tracking-wider">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {sortedResources.map((resource, index) => (
              <tr 
                key={index} 
                className="hover:bg-gray-750 cursor-pointer"
                onDoubleClick={() => {
                  if (resource.resource.PGMTYPE === 'CL') {
                    handleCLDoubleClick(resource);
                  } else {
                    setSelectedResource(resource);
                  }
                }}
              >
                <td className="px-6 py-4 whitespace-nowrap text-sm text-white font-mono">{resource.name}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{resource.resource.PGMTYPE || resource.type}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{resource.library}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{resource.volume}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">{resource.owner}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                  <div className="flex space-x-2">
                    <button
                      disabled
                      className="px-3 py-1 bg-gray-600 text-gray-400 rounded text-xs cursor-not-allowed"
                      title="生成機能は今後対応予定"
                    >
                      生成
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteCatalog(resource);
                      }}
                      className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700 transition-colors"
                      title="カタログを削除"
                    >
                      削除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CatalogManagementSection;