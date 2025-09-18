// TypeScript interfaces for Position-based SMED rendering

/**
 * Position-based field definition
 * Contains only position and length information, no field names
 */
export interface PositionField {
  /** Row position (1-based, 1-24) */
  row: number;
  /** Column position (1-based, 1-80) */
  col: number;
  /** Field length in characters */
  length: number;
}

/**
 * Props for SmedPositionDisplay component
 */
export interface SmedPositionDisplayProps {
  /** Name of the SMED map */
  mapName: string;
  /** Array of position field definitions */
  mapData?: Array<PositionField>;
  /** Initial data array (index-based matching with mapData) */
  initialData?: string[];
  /** Callback when field data changes */
  onDataChange?: (data: string[]) => void;
  /** Callback for key events (F keys, Enter, etc.) */
  onKeyEvent?: (key: string, data: string[]) => void;
  /** Enable dark mode styling */
  isDarkMode?: boolean;
}

/**
 * API request structure for position-based rendering
 */
export interface PositionRenderRequest {
  /** Map name to render */
  map_name: string;
  /** Current field data array */
  field_data: string[];
  /** Optional terminal ID */
  terminal_id?: string;
  /** Optional workstation name */
  wsname?: string;
}

/**
 * API response structure for position-based rendering
 */
export interface PositionRenderResponse {
  /** Success flag */
  success: boolean;
  /** Updated field data array */
  data?: string[];
  /** Position field definitions (if changed) */
  position_fields?: PositionField[];
  /** Error message if success is false */
  error?: string;
  /** Additional metadata */
  metadata?: {
    /** Timestamp of response */
    timestamp: string;
    /** Number of fields processed */
    field_count: number;
    /** Map file used */
    map_file: string;
  };
}

/**
 * WebSocket event data for SMED position updates
 */
export interface SmedPositionWebSocketEvent {
  /** Event type */
  action: 'smed_position_update' | 'smed_position_data';
  /** Map name */
  map_name: string;
  /** Updated field data */
  field_data: string[];
  /** Position field definitions */
  position_fields?: PositionField[];
  /** Session information */
  session_id?: string;
  /** Terminal information */
  terminal_id?: string;
  /** Workstation name */
  wsname?: string;
  /** Event timestamp */
  timestamp: string;
}

/**
 * Key event data for WebSocket transmission
 */
export interface SmedPositionKeyEvent {
  /** Key pressed (F1, F2, ENTER, etc.) */
  key: string;
  /** Current field data at time of key press */
  field_data: string[];
  /** Currently focused field index */
  focused_field_index?: number;
  /** Cursor position */
  cursor_position?: {
    row: number;
    col: number;
  };
}

/**
 * Grid cell position
 */
export interface GridPosition {
  /** Row index (0-based, 0-23) */
  row: number;
  /** Column index (0-based, 0-79) */
  col: number;
}

/**
 * Character rendering information
 */
export interface CharacterInfo {
  /** Character to render */
  char: string;
  /** Position in grid */
  position: GridPosition;
  /** Field index this character belongs to (-1 if not part of field) */
  fieldIndex: number;
  /** Whether this is a full-width character */
  isFullWidth: boolean;
  /** Whether this position is focused */
  isFocused: boolean;
  /** Whether this position has cursor */
  hasCursor: boolean;
}

/**
 * Grid rendering state
 */
export interface GridState {
  /** 24x80 character grid */
  grid: string[][];
  /** Currently focused field index */
  focusedFieldIndex: number | null;
  /** Current cursor position */
  cursorPosition: GridPosition;
  /** Whether grid is ready for rendering */
  isReady: boolean;
}

/**
 * Connection state information
 */
export interface ConnectionState {
  /** Whether WebSocket is connected */
  isConnected: boolean;
  /** Whether currently loading data */
  isLoading: boolean;
  /** Last error message */
  lastError?: string;
  /** Connection health status */
  isHealthy: boolean;
}

/**
 * SMED Position Display component state
 */
export interface SmedPositionDisplayState {
  /** Grid rendering state */
  grid: GridState;
  /** Field data array */
  fieldData: string[];
  /** Connection state */
  connection: ConnectionState;
  /** Map data (position fields) */
  mapData: PositionField[];
  /** Component configuration */
  config: {
    mapName: string;
    isDarkMode: boolean;
  };
}

/**
 * Validation result for position fields
 */
export interface PositionFieldValidation {
  /** Whether field is valid */
  isValid: boolean;
  /** Error message if invalid */
  error?: string;
  /** Normalized field (with corrections if needed) */
  normalizedField?: PositionField;
}

/**
 * Utility functions type definitions
 */
export type PositionFieldValidator = (field: PositionField) => PositionFieldValidation;
export type FullWidthChecker = (char: string) => boolean;
export type GridRenderer = (grid: string[][], mapData: PositionField[], fieldData: string[]) => string[][];

/**
 * Event handler type definitions
 */
export type KeyEventHandler = (key: string, fieldData: string[]) => void | Promise<void>;
export type DataChangeHandler = (data: string[]) => void;
export type CellClickHandler = (row: number, col: number) => void;
export type FieldFocusHandler = (fieldIndex: number) => void;

/**
 * Constants for position-based rendering
 */
export const SMED_POSITION_CONSTANTS = {
  /** Grid dimensions */
  GRID: {
    ROWS: 24,
    COLS: 80,
    CELL_WIDTH: 10,  // pixels
    CELL_HEIGHT: 20, // pixels
  },
  /** Character encoding */
  ENCODING: {
    EMPTY_CHAR: ' ',
    FILL_CHAR: '_',
    FULL_WIDTH_PLACEHOLDER: '',
  },
  /** API endpoints */
  API: {
    POSITION_RENDER: '/api/smed/position-render',
    WEBSOCKET_ENDPOINT: 'http://localhost:8000',
  },
  /** Event types */
  EVENTS: {
    KEY_EVENT: 'smed_position_key_event',
    DATA_UPDATE: 'smed_position_data_update',
    FIELD_FOCUS: 'smed_position_field_focus',
  },
} as const;

/**
 * Type guard functions
 */
export const isPositionField = (obj: any): obj is PositionField => {
  return obj && 
         typeof obj.row === 'number' && 
         typeof obj.col === 'number' && 
         typeof obj.length === 'number' &&
         obj.row >= 1 && obj.row <= 24 &&
         obj.col >= 1 && obj.col <= 80 &&
         obj.length > 0;
};

export const isPositionRenderResponse = (obj: any): obj is PositionRenderResponse => {
  return obj && typeof obj.success === 'boolean';
};

export const isSmedPositionWebSocketEvent = (obj: any): obj is SmedPositionWebSocketEvent => {
  return obj && 
         typeof obj.action === 'string' &&
         typeof obj.map_name === 'string' &&
         Array.isArray(obj.field_data);
};