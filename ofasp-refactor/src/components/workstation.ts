// Common TypeScript interfaces for Workstation management

export interface WorkstationStatus {
  wsname: string;
  status: 'ON' | 'OFF';
  connected: boolean;
  created_at: string;
  updated_at: string;
}

export interface WorkstationQuickToggleProps {
  wsname: string;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
  onStatusChange?: (wsname: string, newStatus: 'ON' | 'OFF') => void;
}

export interface WorkstationInputProps {
  defaultWsname?: string;
  onWsnameChange: (wsname: string, isValid: boolean) => void;
  disabled?: boolean;
  showStatus?: boolean;
  allowEnableDisable?: boolean;
  onStatusToggle?: (wsname: string, newStatus: 'ON' | 'OFF') => void;
}

export interface SmedDisplayData {
  map_file: string;
  fields: Record<string, string>;
  action: string;
  timestamp: string;
}

export interface TerminalRegistrationData {
  session_id: string;
  terminal_id: string;
  user: string;
  wsname: string;
}

export interface ApiError {
  error: string;
  status?: number;
}

export interface WebSocketEventData {
  wsname: string;
  status: string;
}

export type WorkstationStatusType = 'ON' | 'OFF';
export type ComponentSize = 'sm' | 'md' | 'lg';