/**
 * Path Constants
 * All file and directory paths used throughout the application
 */

export const PATHS = {
  DATA_DIRECTORIES: {
    ASP_MANUALS: process.env.ASP_MANUALS_PATH || '/data/asp-manuals',
    TEMP_CONVERSION: process.env.TEMP_CONVERSION_PATH || '/tmp/pdf_conversion',
    ASSETS: {
      SRC_CLLIB: process.env.SRC_CLLIB_PATH || '/data/assets/SRC.CLLIB',
      SRC1_COBLIB: process.env.SRC1_COBLIB_PATH || '/data/assets/SRC1.COBLIB',
      DEMO_COBOL: process.env.DEMO_COBOL_PATH || '/data/assets/DEMO/COBOL',
      DEMO_COPYBOOK: process.env.DEMO_COPYBOOK_PATH || '/data/assets/DEMO/COPYBOOK'
    }
  },
  CODE_PAGES: {
    BASE_PATH: process.env.REACT_APP_CODEPAGES_PATH || '/codepages',
    EBCDIC_TO_ASCII: {
      US: '/codepages/EBCASCUS.txt',
      JP: '/codepages/EBCASCJP.txt',
      JAK: '/codepages/JEFASCK.txt',
      KEIS: '/codepages/KEISASCK.txt'
    },
    ASCII_TO_EBCDIC: {
      US: '/codepages/ASCEBCUS.txt',
      JP: '/codepages/ASCEBCJP.txt',
      JAK: '/codepages/ASCJEFK.txt',
      KEIS: '/codepages/ASCJEISK.txt'
    }
  }
};