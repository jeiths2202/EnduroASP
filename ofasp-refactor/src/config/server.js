/**
 * Server Configuration
 * Configuration for server-side components
 */

export const SERVER_CONFIG = {
  FILE_SERVER: {
    PORT: process.env.FILE_SERVER_PORT || 3006,
    HOST: process.env.FILE_SERVER_HOST || 'localhost'
  },
  PDF_CONVERTER: {
    PORT: process.env.PDF_CONVERTER_PORT || 3001,
    HOST: process.env.PDF_CONVERTER_HOST || 'localhost'
  },
  ASP_MANAGER: {
    PORT: process.env.ASP_MANAGER_PORT || 3007,
    HOST: process.env.ASP_MANAGER_HOST || 'localhost'
  },
  SMED_INTERFACE: {
    PORT: process.env.SMED_INTERFACE_PORT || 3000,
    HOST: process.env.SMED_INTERFACE_HOST || 'localhost'
  }
};