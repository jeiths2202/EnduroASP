export interface MenuItem {
  id: string;
  label: string;
  icon: React.ReactNode;
  badge?: number;
  onClick?: () => void;
}

export interface Tab {
  id: string;
  title: string;
  content: React.ReactNode;
  type?: 'chat' | 'document' | 'settings';
  timestamp?: Date;
}

export interface Theme {
  mode: 'light' | 'dark';
}

export interface User {
  id: string;
  name: string;
  avatar?: string;
  role: string;
}