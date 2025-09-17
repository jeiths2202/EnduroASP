export interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  subItems?: MenuItem[];
}

export interface Tab {
  id: string;
  title: string;
  content: React.ReactNode;
  type: 'document' | 'terminal' | 'browser';
  timestamp: Date;
  isModified?: boolean;
}

export interface Theme {
  mode: 'light' | 'dark';
}

export interface User {
  name: string;
  role: string;
}