import { ChevronUpIcon, ChevronDownIcon } from '@heroicons/react/24/outline';

export const getSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
  if (field !== currentField) return null;
  return direction === 'asc' ? ChevronUpIcon : ChevronDownIcon;
};

export const getCatalogSortIcon = (field: string, currentField: string, direction: 'asc' | 'desc') => {
  if (field !== currentField) return null;
  return direction === 'asc' ? ChevronUpIcon : ChevronDownIcon;
};