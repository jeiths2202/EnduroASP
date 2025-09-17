/**
 * Python Conversion Service Client
 * Uses the Python service for EBCDIC/ASCII conversion
 * NO HARDCODING - all URLs from configuration
 */

import { API_CONFIG } from '../config/api.js';

export interface PythonConversionRequest {
  input_data: string;
  encoding?: string;
  japanese_encoding?: 'utf-8' | 'sjis';
  output_format?: 'json' | 'flat';
  sosi_flag?: boolean;
  out_sosi_flag?: boolean;
  rlen?: number;
  api_key?: string;
  sosi_handling?: 'remove' | 'keep' | 'space';
  sosi_so?: number | string;  // Shift-Out code
  sosi_si?: number | string;  // Shift-In code
}

export interface PythonConversionResponse {
  success: boolean;
  message: string;
  data?: {
    output: string;
    encoding: string;
    sosi_flag: boolean;
    out_sosi_flag: boolean;
    rlen: number;
    input_size: number;
    output_size: number;
  };
  error?: string;
}

export interface PythonServiceInfo {
  version: string;
  supported_encodings: string[];
  sosi_handling_modes: string[];
  error_handling_modes: string[];
  max_input_size: number;
  default_encoding: string;
  default_record_length: number;
}

class PythonConverterService {
  private baseUrl: string;
  private endpoints: typeof API_CONFIG.PYTHON_CONVERTER.ENDPOINTS;

  constructor() {
    this.baseUrl = API_CONFIG.PYTHON_CONVERTER.BASE_URL;
    this.endpoints = API_CONFIG.PYTHON_CONVERTER.ENDPOINTS;
  }

  /**
   * Check if Python service is available
   */
  async checkHealth(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.HEALTH}`);
      if (!response.ok) {
        return false;
      }
      const data = await response.json();
      return data.success === true;
    } catch (error) {
      console.error('Python service health check failed:', error);
      return false;
    }
  }

  /**
   * Get Python service information
   */
  async getServiceInfo(): Promise<PythonServiceInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.INFO}`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Unknown error');
      }
      return result.data;
    } catch (error) {
      console.error('Failed to get service info:', error);
      return null;
    }
  }

  /**
   * Convert EBCDIC to ASCII using Python service
   */
  async convertEbcdicToAscii(request: PythonConversionRequest): Promise<PythonConversionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.EBCDIC_TO_ASCII}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.api_key && { 'X-API-Key': request.api_key })
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('EBCDIC to ASCII conversion failed:', error);
      return {
        success: false,
        message: 'Conversion failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert ASCII to EBCDIC using Python service
   */
  async convertAsciiToEbcdic(request: PythonConversionRequest): Promise<PythonConversionResponse> {
    try {
      const response = await fetch(`${this.baseUrl}${this.endpoints.ASCII_TO_EBCDIC}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(request.api_key && { 'X-API-Key': request.api_key })
        },
        body: JSON.stringify(request)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('ASCII to EBCDIC conversion failed:', error);
      return {
        success: false,
        message: 'Conversion failed',
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Convert EBCDIC to ASCII - simplified interface for compatibility
   */
  async EBCDIC_TO_ASCII(
    input: string,
    output: string | null,
    encoding: string,
    sosi_flag: boolean,
    out_sosi_flag: boolean,
    rlen: number,
    layout: string | null,
    sosi_handling?: 'remove' | 'keep' | 'space',
    sosi_so?: number | string,
    sosi_si?: number | string
  ): Promise<string> {
    const request: PythonConversionRequest = {
      input_data: input,
      encoding,
      sosi_flag,
      out_sosi_flag,
      rlen,
      sosi_handling: sosi_handling || 'remove'
    };

    // Add custom SOSI codes if provided
    if (sosi_so !== undefined) {
      request.sosi_so = sosi_so;
    }
    if (sosi_si !== undefined) {
      request.sosi_si = sosi_si;
    }

    const response = await this.convertEbcdicToAscii(request);
    
    if (!response.success) {
      throw new Error(response.error || 'Conversion failed');
    }

    return response.data?.output || '';
  }

  /**
   * Convert ASCII to EBCDIC - simplified interface for compatibility
   */
  async ASCII_TO_EBCDIC(
    input: string,
    output: string | null,
    encoding: string,
    sosi_flag: boolean,
    out_sosi_flag: boolean,
    rlen: number,
    layout: string | null
  ): Promise<string> {
    const request: PythonConversionRequest = {
      input_data: input,
      encoding,
      sosi_flag,
      out_sosi_flag,
      rlen
    };

    const response = await this.convertAsciiToEbcdic(request);
    
    if (!response.success) {
      throw new Error(response.error || 'Conversion failed');
    }

    return response.data?.output || '';
  }
}

// Export singleton instance
export const pythonConverter = new PythonConverterService();
export default PythonConverterService;