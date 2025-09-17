import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  FolderOpenIcon,
  DocumentIcon,
  ArrowRightIcon,
  DocumentArrowDownIcon,
  CheckIcon,
} from '@heroicons/react/24/outline';
import { pythonConverter } from '../utils/pythonConverter';

interface FileInfo {
  name: string;
  size: number;
  lastModified: Date;
  path: string;
  type: 'file' | 'directory';
  selected: boolean;
  file?: File; // Add File object for processing
}

interface LayoutField {
  name: string;
  level: string;
  type: 'PIC' | 'COMP' | 'COMP-3';
  picture: string;
  length: number;
  position: number;
  description?: string;
}

interface ConversionResult {
  success: boolean;
  fileName: string;
  originalSize: number;
  convertedSize: number;
  records: ConvertedRecord[];
  log: string[];
  timestamp: string;
  executedCommand?: string;
  conversionOptions?: any;
}

interface ConvertedRecord {
  recordNumber: number;
  fields: ConvertedField[];
  rawData: string;
}

interface ConvertedField {
  name: string;
  value: string;
  type: 'PIC' | 'COMP' | 'COMP-3';
  length: number;
  position: number;
  isBinary: boolean;
  hexValue?: string;
}

interface DatasetConversionPageProps {
  isDarkMode: boolean;
}

const DatasetConversionPage: React.FC<DatasetConversionPageProps> = ({ isDarkMode }) => {
  const [selectedFiles, setSelectedFiles] = useState<FileInfo[]>([]);
  const [convertedResults, setConvertedResults] = useState<string>('');
  const [isConverting, setIsConverting] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState<string>('');
  const [layoutOptions, setLayoutOptions] = useState<string[]>([]);
  const [useSOSI, setUseSOSI] = useState<boolean>(false);
  const [sosiType, setSosiType] = useState<'0E0F' | '1E1F' | 'custom'>('0E0F');
  const [customSO, setCustomSO] = useState('0E');
  const [customSI, setCustomSI] = useState('0F');
  const [sosiHandling, setSosiHandling] = useState<'remove' | 'keep' | 'space'>('remove');
  const [layoutContent, setLayoutContent] = useState<string>('');
  const [loadingLayout, setLoadingLayout] = useState<boolean>(false);
  const [conversionResults, setConversionResults] = useState<ConversionResult[]>([]);
  const [encodingType, setEncodingType] = useState<string>('JP'); // EBCDIC encoding type
  const [catalogData, setCatalogData] = useState<any>(null); // Catalog data for dataset types
  
  // Dataset Browser State
  const [showDatasetBrowser, setShowDatasetBrowser] = useState(false);
  const [serverVolumes, setServerVolumes] = useState<string[]>([]);
  const [serverLibraries, setServerLibraries] = useState<{[key: string]: string[]}>({});
  const [serverDatasets, setServerDatasets] = useState<{[key: string]: any}>({});
  const [selectedServerVolume, setSelectedServerVolume] = useState<string>('');
  const [selectedServerLibrary, setSelectedServerLibrary] = useState<string>('');
  const [selectedServerDataset, setSelectedServerDataset] = useState<string>('');
  
  // New parameters from ebcdic_dataset_converter.py
  const [outputFormat, setOutputFormat] = useState<'json' | 'flat'>('json');
  const [japaneseEncoding, setJapaneseEncoding] = useState<'utf-8' | 'sjis'>('utf-8');
  const [volumeName, setVolumeName] = useState<string>('DISK01');
  const [libraryName, setLibraryName] = useState<string>('TESTLIB');
  const [datasetName, setDatasetName] = useState<string>('');
  const [useJsonSchema, setUseJsonSchema] = useState<boolean>(false);
  const [jsonSchemaPath, setJsonSchemaPath] = useState<string>('');
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dirInputRef = useRef<HTMLInputElement>(null);

  // Load layout options and catalog data
  useEffect(() => {
    const loadCatalogData = async () => {
      try {
        // Load layout options from server
        const layoutResponse = await fetch('http://localhost:8000/api/catalog/layout');
        if (layoutResponse.ok) {
          const layoutData = await layoutResponse.json();
          const options = Object.keys(layoutData || {});
          setLayoutOptions(options);
          console.log('Layout options loaded:', options);
        } else {
          console.warn('Layout API not available, using default options');
          setLayoutOptions(['SAM001']);
        }

        // Load full catalog data for dataset type detection
        try {
          const catalogResponse = await fetch('http://localhost:8000/config/catalog.json');
          if (catalogResponse.ok) {
            const fullCatalog = await catalogResponse.json();
            setCatalogData(fullCatalog);
            console.log('Catalog data loaded for dataset type detection');
          }
        } catch (catalogError) {
          console.warn('Could not load full catalog data:', catalogError);
        }
      } catch (error) {
        console.error('Failed to load catalog data:', error);
        setLayoutOptions(['SAM001']);
      }
    };

    loadCatalogData();
  }, []);

  // Detect dataset type from catalog
  const detectDatasetType = useCallback((fileName: string) => {
    if (!catalogData) return null;

    // Search through catalog for matching dataset
    for (const volumeName in catalogData) {
      const volume = catalogData[volumeName];
      if (typeof volume === 'object') {
        for (const libraryName in volume) {
          const library = volume[libraryName];
          if (typeof library === 'object') {
            for (const datasetName in library) {
              if (datasetName === fileName || fileName.startsWith(datasetName)) {
                const dataset = library[datasetName];
                return {
                  volume: volumeName,
                  library: libraryName,
                  name: datasetName,
                  type: dataset.TYPE,
                  description: dataset.DESCRIPTION,
                  recfm: dataset.RECFM,
                  lrecl: dataset.LRECL,
                  encoding: dataset.ENCODING || 'JP'
                };
              }
            }
          }
        }
      }
    }
    return null;
  }, [catalogData]);

  // Load server catalog data for dataset browser
  const loadServerCatalogData = useCallback(async () => {
    try {
      // Load volumes
      const volumesResponse = await fetch('http://localhost:8000/api/catalog/volumes');
      if (volumesResponse.ok) {
        const volumesData = await volumesResponse.json();
        if (volumesData.success && volumesData.volumes) {
          setServerVolumes(volumesData.volumes);
          
          // Load libraries for each volume
          const librariesData: {[key: string]: string[]} = {};
          const datasetsData: {[key: string]: any} = {};
          
          for (const volume of volumesData.volumes) {
            try {
              const libResponse = await fetch(`http://localhost:8000/api/catalog/libraries/${volume}`);
              if (libResponse.ok) {
                const libData = await libResponse.json();
                if (libData.success && libData.libraries) {
                  librariesData[volume] = libData.libraries;
                  
                  // Load datasets for each library
                  for (const library of libData.libraries) {
                    try {
                      const datasetResponse = await fetch(`http://localhost:8000/api/catalog/datasets/${volume}/${library}`);
                      if (datasetResponse.ok) {
                        const datasetData = await datasetResponse.json();
                        if (datasetData.success) {
                          const key = `${volume}/${library}`;
                          datasetsData[key] = datasetData.datasets;
                        }
                      }
                    } catch (error) {
                      console.warn(`Failed to load datasets for ${volume}/${library}:`, error);
                    }
                  }
                }
              }
            } catch (error) {
              console.warn(`Failed to load libraries for volume ${volume}:`, error);
            }
          }
          
          setServerLibraries(librariesData);
          setServerDatasets(datasetsData);
        }
      }
    } catch (error) {
      console.error('Failed to load server catalog data:', error);
    }
  }, []);

  // Create sample layout content for demonstration
  const createSampleLayoutContent = useCallback((layoutName: string): string => {
    return `* ${layoutName} Layout Definition
* Generated: ${new Date().toLocaleString('ja-JP')}
* Record Format: Fixed Block (FB)
* Record Length: 80 bytes
* 
* Field Definitions:
* POS  LEN  TYPE  NAME           DESCRIPTION
* ---  ---  ----  -------------  --------------------------------
*   1    5  NUM   EMPLOYEE-ID    社員番号
*   6   20  CHAR  EMPLOYEE-NAME  社員名 (漢字)
*  26   10  CHAR  DEPARTMENT     部署コード
*  36    8  DATE  HIRE-DATE      入社年月日 (YYYYMMDD)
*  44    1  CHAR  STATUS         ステータス (A:有効, I:無効)
*  45   15  CHAR  EMAIL          電子メール
*  60   21  CHAR  RESERVED       予備領域
* 
* Sample Record:
* 00001田中太郎           SALES     20240401A tanakataro@example.com                     
* 00002佐藤花子           ADMIN     20230315A satohana@example.com                       
* 00003山田次郎           DEVELOP   20220710A yamada@example.com                         `;
  }, []);

  // Load layout content when selected layout changes
  useEffect(() => {
    const loadLayoutContent = async () => {
      if (!selectedLayout) {
        setLayoutContent('');
        return;
      }

      setLoadingLayout(true);
      try {
        // Load layout content from server (port 8000) with SJIS to UTF-8 conversion
        const response = await fetch(`http://localhost:8000/api/layout/content/${selectedLayout}`);
        if (response.ok) {
          const result = await response.json();
          if (result.success) {
            // Content is already converted from SJIS to Unicode by the server
            setLayoutContent(result.content);
            console.log('Layout content loaded from server:', {
              layout_name: result.layout_name,
              file_path: result.file_path,
              content_length: result.content.length
            });
          } else {
            console.error('Failed to load layout:', result.error);
            const sampleContent = createSampleLayoutContent(selectedLayout);
            setLayoutContent(sampleContent);
          }
        } else {
          console.warn(`Layout API returned ${response.status}, using fallback`);
          // Fallback: create sample layout content
          const sampleContent = createSampleLayoutContent(selectedLayout);
          setLayoutContent(sampleContent);
        }
      } catch (error) {
        console.error('Failed to load layout content:', error);
        const sampleContent = createSampleLayoutContent(selectedLayout);
        setLayoutContent(sampleContent);
      } finally {
        setLoadingLayout(false);
      }
    };

    loadLayoutContent();
  }, [selectedLayout, createSampleLayoutContent]);

  const handleFileSelect = () => {
    fileInputRef.current?.click();
  };

  const handleDirectorySelect = () => {
    dirInputRef.current?.click();
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileInfos: FileInfo[] = Array.from(files).map(file => ({
        name: file.name,
        size: file.size,
        lastModified: new Date(file.lastModified),
        path: file.name,
        type: 'file' as const,
        selected: false,
        file: file // Store the actual File object
      }));
      setSelectedFiles(fileInfos);
    }
  };

  // Parse COBOL layout content to extract field definitions
  const parseLayoutFields = (layoutContent: string): LayoutField[] => {
    const fields: LayoutField[] = [];
    const lines = layoutContent.split('\n');
    let currentPosition = 1;

    for (const line of lines) {
      // Skip comments and empty lines
      if (line.trim().startsWith('*') || line.trim() === '') continue;

      // Match COBOL field definition pattern
      // Example: "03 PNO      PIC 9(5)." or "05 EMPLOYEE-ID PIC X(10)."
      const fieldMatch = line.match(/^\s*(\d+)\s+([A-Z0-9_-]+)\s+PIC\s+([X9SNVZ()\-]+)\.?(?:\s+(COMP(-3)?))?\s*/i);
      if (fieldMatch) {
        const [, level, name, picture, comp, comp3] = fieldMatch;
        
        // Calculate field length from PIC clause
        let length = 0;
        if (picture.includes('(') && picture.includes(')')) {
          const lengthMatch = picture.match(/\((\d+)\)/);
          length = lengthMatch ? parseInt(lengthMatch[1]) : 1;
        } else {
          // Count X, 9, S, N, V, Z characters
          const chars = picture.match(/[X9SNVZ]/g);
          length = chars ? chars.length : 1;
        }

        // Determine field type based on PIC clause and COMP specification
        let type: 'PIC' | 'COMP' | 'COMP-3' = 'PIC';
        if (comp3 || line.toUpperCase().includes('COMP-3')) {
          type = 'COMP-3';
          // COMP-3 fields typically use (length + 1) / 2 bytes
          length = Math.ceil((length + 1) / 2);
        } else if (comp || line.toUpperCase().includes('COMP ')) {
          type = 'COMP';
          // COMP fields are typically 2, 4, or 8 bytes depending on length
          if (length <= 4) length = 2;
          else if (length <= 9) length = 4;
          else length = 8;
        }

        fields.push({
          name,
          level,
          type,
          picture,
          length,
          position: currentPosition,
          description: line.trim()
        });

        currentPosition += length;
      }
    }

    return fields;
  };

  // Convert EBCDIC data using layout fields
  const convertDatasetWithLayout = async (fileData: ArrayBuffer, fields: LayoutField[], datasetEncoding?: string): Promise<ConvertedRecord[]> => {
    const records: ConvertedRecord[] = [];
    const dataView = new DataView(fileData);
    const totalLength = fields.reduce((sum, field) => sum + field.length, 0);
    
    if (totalLength === 0) {
      throw new Error('レイアウトフィールドが正しく解析されませんでした');
    }

    const recordCount = Math.floor(fileData.byteLength / totalLength);
    
    for (let recordIndex = 0; recordIndex < Math.min(recordCount, 1000); recordIndex++) { // Limit to 1000 records for performance
      const recordOffset = recordIndex * totalLength;
      const convertedFields: ConvertedField[] = [];
      
      for (const field of fields) {
        const fieldOffset = recordOffset + field.position - 1;
        const fieldData = new Uint8Array(fileData, fieldOffset, field.length);
        
        let convertedValue = '';
        let hexValue = '';
        let isBinary = false;

        // Convert field data based on type
        if (field.type === 'COMP' || field.type === 'COMP-3') {
          // COMP/COMP-3 fields: preserve binary data as-is
          isBinary = true;
          hexValue = Array.from(fieldData)
            .map(b => b.toString(16).padStart(2, '0').toUpperCase())
            .join(' ');
          
          if (field.type === 'COMP-3') {
            // COMP-3: Packed decimal format
            convertedValue = `[COMP-3: ${hexValue}]`;
          } else {
            // COMP: Binary integer
            convertedValue = `[COMP: ${hexValue}]`;
          }
        } else {
          // PIC fields: convert EBCDIC to SJIS
          // Check if this is a Zoned Decimal field (PIC 9)
          const isZonedDecimal = field.picture.includes('9');
          
          try {
            // Convert EBCDIC bytes to hexadecimal string representation
            const hexString = Array.from(fieldData)
              .map(b => b.toString(16).padStart(2, '0'))
              .join('');

            // Use the new EBCDIC dataset converter with proper encoding settings
            const conversionParams = {
              input_data: hexString,
              encoding: datasetEncoding || encodingType,
              japanese_encoding: japaneseEncoding, // Use UI setting
              output_format: outputFormat,
              sosi_flag: useSOSI && !isZonedDecimal,
              out_sosi_flag: useSOSI && !isZonedDecimal,
              sosi_handling: sosiHandling,
              rlen: field.length,
              volume_name: volumeName,
              library_name: libraryName,
              dataset_name: datasetName
            };

            // Use the new API server endpoint for better EBCDIC conversion
            const response = await fetch('http://localhost:8000/api/convert/ebcdic-dataset', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(conversionParams)
            });
            
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const conversionResult = await response.json();
            
            if (!conversionResult.success) {
              throw new Error(conversionResult.error || 'Conversion failed');
            }

            // Process successful conversion result
            if (conversionResult.data) {
              let output = conversionResult.data.output;
              
              // For Zoned Decimal fields, add special annotation
              if (isZonedDecimal) {
                // Remove trailing spaces and show original hex for debugging
                output = output.trim();
                convertedValue = `${output} [PIC 9: ${hexString.substring(0, Math.min(16, hexString.length))}${hexString.length > 16 ? '...' : ''}]`;
              } else {
                convertedValue = output;
              }
            } else {
              convertedValue = `[変換エラー: データなし]`;
            }
          } catch (error) {
            console.error('EBCDIC conversion error:', error);
            convertedValue = `[変換エラー: ${error instanceof Error ? error.message : 'Unknown error'}]`;
          }
        }

        convertedFields.push({
          name: field.name,
          value: convertedValue,
          type: field.type,
          length: field.length,
          position: field.position,
          isBinary,
          hexValue
        });
      }

      // Create raw data representation
      const recordData = new Uint8Array(fileData, recordOffset, totalLength);
      const rawData = Array.from(recordData)
        .map(b => b.toString(16).padStart(2, '0').toUpperCase())
        .join(' ');

      records.push({
        recordNumber: recordIndex + 1,
        fields: convertedFields,
        rawData
      });
    }

    return records;
  };

  const handleFileSelection = (index: number) => {
    const updatedFiles = [...selectedFiles];
    updatedFiles[index].selected = !updatedFiles[index].selected;
    setSelectedFiles(updatedFiles);
  };

  const handleSelectAll = () => {
    const allSelected = selectedFiles.every(file => file.selected);
    const updatedFiles = selectedFiles.map(file => ({
      ...file,
      selected: !allSelected
    }));
    setSelectedFiles(updatedFiles);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (date: Date): string => {
    return date.toLocaleDateString('ja-JP') + ' ' + date.toLocaleTimeString('ja-JP');
  };

  const handleConvert = async () => {
    const selectedFilesList = selectedFiles.filter(file => file.selected);
    if (selectedFilesList.length === 0 || !selectedLayout || !layoutContent) return;
    
    setIsConverting(true);
    setConversionResults([]);
    
    try {
      // Parse layout fields
      const layoutFields = parseLayoutFields(layoutContent);
      if (layoutFields.length === 0) {
        throw new Error('レイアウトからフィールド定義を解析できませんでした');
      }

      const results: ConversionResult[] = [];
      const log: string[] = [];
      
      log.push(`=== EBCDIC データセット変換開始 ===`);
      log.push(`変換時刻: ${new Date().toLocaleString('ja-JP')}`);
      log.push(`レイアウト: ${selectedLayout}`);
      log.push(`インコーディング: ${encodingType}`);
      log.push(`SOSI処理: ${sosiHandling}`);
      log.push(`解析されたフィールド数: ${layoutFields.length}`);
      log.push('');

      for (const fileInfo of selectedFilesList) {
        if (!fileInfo.file) continue;

        log.push(`--- ファイル変換開始: ${fileInfo.name} ---`);
        log.push(`元ファイルサイズ: ${formatFileSize(fileInfo.size)}`);
        
        // Detect dataset type from catalog
        const datasetInfo = detectDatasetType(fileInfo.name);
        let fileEncodingType = encodingType;
        
        if (datasetInfo) {
          log.push(`カタログ検出: ${datasetInfo.type} (${datasetInfo.description})`);
          log.push(`レコード形式: ${datasetInfo.recfm}, 長さ: ${datasetInfo.lrecl}`);
          
          // Use dataset-specific encoding if available
          if (datasetInfo.encoding && datasetInfo.encoding !== encodingType) {
            fileEncodingType = datasetInfo.encoding;
            log.push(`エンコーディング: ${encodingType} → ${fileEncodingType} (カタログ指定)`);
          }
        } else {
          log.push(`カタログ検出: 見つからない (デフォルト設定使用)`);
        }
        
        try {
          // Initialize command and options storage for this file
          let executedCommand = '';
          let conversionOptions = {};
          
          // Pre-build command information based on actual ebcdic_dataset_converter.py syntax
          const inputFilePath = `/tmp/uploads/${fileInfo.name}`;
          const outputFilePath = volumeName && libraryName && datasetName 
            ? `volume/${volumeName}/${libraryName}/${datasetName}`
            : `/tmp/output/${fileInfo.name}.converted`;
            
          const commandParts = [
            'python ebcdic_dataset_converter.py',
            inputFilePath,
            outputFilePath,
            `volume/DISK01/LAYOUT/${selectedLayout}.LAYOUT`
          ];
          
          // Add options with --catalog-name
          commandParts.push(`--format ${outputFormat}`);
          commandParts.push(`--japanese-encoding ${japaneseEncoding}`);
          
          // Add catalog name option if specified
          if (datasetName) {
            commandParts.push(`--catalog-name ${datasetName}`);
          }
          
          // SOSI handling options
          if (customSO !== '0E') {
            commandParts.push(`--so-code 0x${customSO}`);
          }
          if (customSI !== '0F') {
            commandParts.push(`--si-code 0x${customSI}`);
          }
          
          // Convert sosiHandling to uppercase for actual command
          const sosiHandlingUpper = sosiHandling.toUpperCase();
          if (sosiHandlingUpper !== 'SPACE') {
            commandParts.push(`--sosi-handling ${sosiHandlingUpper}`);
          }
          
          if (volumeName && volumeName !== 'DISK01') {
            commandParts.push(`--volume ${volumeName}`);
          }
          if (libraryName && libraryName !== 'TESTLIB') {
            commandParts.push(`--library ${libraryName}`);
          }
          
          executedCommand = commandParts.join(' ');
          
          conversionOptions = {
            encoding: fileEncodingType,
            japanese_encoding: japaneseEncoding,
            output_format: outputFormat,
            sosi_flag: useSOSI,
            sosi_handling: sosiHandling,
            record_length: 80,
            volume_name: volumeName,
            library_name: libraryName,
            dataset_name: datasetName
          };
          
          // Read file as ArrayBuffer
          const fileData = await new Promise<ArrayBuffer>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target?.result as ArrayBuffer);
            reader.onerror = (e) => reject(new Error('ファイル読み込みエラー'));
            reader.readAsArrayBuffer(fileInfo.file!);
          });

          log.push(`1. ファイルアップロード: ${fileInfo.name}`);
          log.push(`2. データセット インコーディングタイプ: ${fileEncodingType}`);
          log.push(`3. SOSI コード設定: SO=${customSO}, SI=${customSI}`);
          log.push(`4. SOSI コード変換: ${sosiHandling}`);
          log.push(`5. 出力形式: ${outputFormat}`);
          log.push(`6. 日本語エンコーディング: ${japaneseEncoding}`);
          
          // Convert file data to base64 for upload
          const uint8Array = new Uint8Array(fileData);
          const binaryString = uint8Array.reduce((data, byte) => data + String.fromCharCode(byte), '');
          const base64Data = btoa(binaryString);
          
          log.push(`7. CLI変換実行開始...`);
          
          // Call new CLI API
          const cliResponse = await fetch('http://localhost:8000/api/convert/ebcdic-dataset-cli', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              file_data: base64Data,
              file_name: fileInfo.name,
              layout_name: selectedLayout,
              volume_name: volumeName,
              library_name: libraryName,
              catalog_name: datasetName,
              output_format: outputFormat,
              japanese_encoding: japaneseEncoding,
              so_code: `0x${customSO}`,
              si_code: `0x${customSI}`,
              sosi_handling: sosiHandling.toUpperCase()
            })
          });
          
          if (!cliResponse.ok) {
            throw new Error(`CLI API failed: HTTP ${cliResponse.status}`);
          }
          
          const cliResult = await cliResponse.json();
          
          if (!cliResult.success) {
            throw new Error(cliResult.error || 'CLI conversion failed');
          }
          
          log.push(`8. ✅ CLI変換完了`);
          log.push(`9. 出力ファイル: ${cliResult.data.output_file_path}`);
          log.push(`10. 実行コマンド: ${cliResult.data.executed_command}`);
          
          if (cliResult.data.stdout) {
            log.push(`11. CLI標準出力:`);
            cliResult.data.stdout.split('\n').forEach((line: string) => {
              if (line.trim()) log.push(`    ${line}`);
            });
          }
          
          // Create dummy records for display (since we're using CLI now)
          const convertedRecords: ConvertedRecord[] = [{
            recordNumber: 1,
            fields: [{
              name: 'CLI_OUTPUT',
              value: cliResult.data.output_content || 'See server file: ' + cliResult.data.output_file_path,
              position: 1,
              length: (cliResult.data.output_content || '').length,
              type: 'PIC',
              isBinary: false,
              hexValue: ''
            }],
            rawData: 'CLI conversion completed'
          }];
          
          // Update command info from CLI result
          executedCommand = cliResult.data.executed_command;
          conversionOptions = cliResult.data.conversion_options;
          
          // Register dataset in catalog.json if volume/library/dataset names are provided
          if (volumeName && libraryName && datasetName) {
            try {
              log.push(`8. カタログ登録開始: ${volumeName}/${libraryName}/${datasetName}`);
              
              const registerResponse = await fetch('http://localhost:8000/api/catalog/dataset', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                  volume: volumeName,
                  library: libraryName,
                  dataset: datasetName,
                  dataset_info: {
                    TYPE: 'DATASET',
                    RECFM: outputFormat === 'flat' ? 'FB' : 'VB',
                    LRECL: 80,
                    ENCODING: japaneseEncoding === 'sjis' ? 'shift_jis' : japaneseEncoding,
                    DESCRIPTION: `Dataset converted from ${fileInfo.name} via UI`,
                    OUTPUT_FORMAT: outputFormat,
                    RECORDS_COUNT: convertedRecords.length,
                    ORIGINAL_FILE: fileInfo.name,
                    LAYOUT_USED: selectedLayout,
                    CONVERTED_AT: new Date().toISOString()
                  }
                })
              });
              
              if (registerResponse.ok) {
                const registerResult = await registerResponse.json();
                if (registerResult.success) {
                  log.push(`9. ✅ カタログ登録完了: ${registerResult.message}`);
                } else {
                  log.push(`9. ❌ カタログ登録失敗: ${registerResult.error || 'Unknown error'}`);
                }
              } else {
                log.push(`9. ❌ カタログ登録API呼び出し失敗: HTTP ${registerResponse.status}`);
              }
            } catch (catalogError) {
              log.push(`9. ❌ カタログ登録エラー: ${catalogError}`);
              console.error('Catalog registration error:', catalogError);
            }
          } else {
            log.push(`8. カタログ登録スキップ: ボリューム/ライブラリ/データセット名が未指定`);
          }

          // Add command information to log
          log.push('');
          log.push('=== 実行コマンド情報 ===');
          log.push(`コマンド: ${executedCommand}`);
          log.push('');
          log.push('=== 変換オプション ===');
          Object.entries(conversionOptions).forEach(([key, value]) => {
            log.push(`${key}: ${value}`);
          });
          log.push('');

          const result: ConversionResult = {
            success: true,
            fileName: fileInfo.name,
            originalSize: fileInfo.size,
            convertedSize: convertedRecords.reduce((sum, record) => 
              sum + record.fields.reduce((fieldSum, field) => fieldSum + field.value.length, 0), 0),
            records: convertedRecords,
            log: [...log],
            timestamp: new Date().toISOString(),
            executedCommand: executedCommand,
            conversionOptions: conversionOptions
          };

          results.push(result);
          log.push(`✅ ${fileInfo.name} 変換完了`);
          log.push('');

        } catch (fileError) {
          log.push(`❌ ${fileInfo.name} 変換失敗: ${fileError}`);
          log.push('');
          
          const result: ConversionResult = {
            success: false,
            fileName: fileInfo.name,
            originalSize: fileInfo.size,
            convertedSize: 0,
            records: [],
            log: [...log],
            timestamp: new Date().toISOString()
          };
          results.push(result);
        }
      }

      log.push(`=== 変換処理完了 ===`);
      log.push(`処理ファイル数: ${selectedFilesList.length}`);
      log.push(`成功: ${results.filter(r => r.success).length}`);
      log.push(`失敗: ${results.filter(r => !r.success).length}`);

      setConversionResults(results);
      setConvertedResults(log.join('\n'));

    } catch (error) {
      console.error('変換エラー:', error);
      setConvertedResults(`変換中にエラーが発生しました:\n${error}`);
    } finally {
      setIsConverting(false);
    }
  };

  const downloadResults = () => {
    if (!convertedResults) return;
    
    const blob = new Blob([convertedResults], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dataset_conversion_results_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const selectedCount = selectedFiles.filter(file => file.selected).length;

  return (
    <div className="h-full p-6 bg-gray-50 dark:bg-gray-900">
      <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">
        データセット変換
      </h1>

      {/* ファイル選択エリア */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          データセットファイル選択
        </h2>
        <div className="flex space-x-4">
          <button
            onClick={handleFileSelect}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <DocumentIcon className="w-5 h-5 mr-2" />
            ファイル選択
          </button>
          <button
            onClick={handleDirectorySelect}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
          >
            <FolderOpenIcon className="w-5 h-5 mr-2" />
            ディレクトリ選択
          </button>
        </div>
        
        <input
          ref={fileInputRef}
          type="file"
          multiple
          onChange={handleFileChange}
          className="hidden"
          accept=".dat,.txt,.csv,.fix,.vsam,.seq,.ps,.ksds"
        />
        <input
          ref={dirInputRef}
          type="file"
          {...({ webkitdirectory: '' } as any)}
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* レイアウト/コピーブック選択 */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          レイアウト/コピーブック選択
        </h2>
        
        {/* Two-column layout for selection and preview */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left side: Layout and encoding selection */}
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                レイアウト選択
              </label>
              <select
                value={selectedLayout}
                onChange={(e) => setSelectedLayout(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">レイアウトを選択してください</option>
                {layoutOptions.map((layout) => (
                  <option key={layout} value={layout}>
                    {layout}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                EBCDICエンコーディングタイプ
              </label>
              <select
                value={encodingType}
                onChange={(e) => setEncodingType(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="JP">JP - 日本語 (Shift-JIS)</option>
                <option value="US">US - 英語 (ASCII)</option>
                <option value="JAK">JAK - 日本語 (Shift-JIS)</option>
                <option value="KEIS">KEIS - 韓国語</option>
                <option value="KR">KR - 韓国語 (KS X 1001)</option>
              </select>
            </div>
          </div>
          
          {/* Right side: Layout preview */}
          <div>
            <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              レイアウトプレビュー
              {selectedLayout && (
                <span className="ml-2 text-xs text-blue-600 dark:text-blue-400">
                  ({selectedLayout} - SJIS→UTF-8 変換済み)
                </span>
              )}
            </h3>
            <div className="h-64 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
              {loadingLayout ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <span className="ml-2 text-sm text-gray-600 dark:text-gray-400">
                    サーバーからレイアウトファイルを読み込み中...
                  </span>
                </div>
              ) : layoutContent ? (
                <div className="space-y-2">
                  <div className="text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-600 pb-1">
                    ファイル: /home/aspuser/app/volume/DISK01/LAYOUT/{selectedLayout}.LAYOUT
                  </div>
                  <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                    {layoutContent}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-500 dark:text-gray-400">
                  <p className="text-sm">レイアウトを選択してください</p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Dataset Conversion Parameters - New section for CLI parameters */}
        <div className="mt-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            データセット変換パラメータ
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Output Format */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                出力フォーマット
              </label>
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="outputFormat"
                    value="json"
                    checked={outputFormat === 'json'}
                    onChange={(e) => setOutputFormat(e.target.value as 'json' | 'flat')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    JSON (レコード構造付き)
                  </span>
                </label>
                <label className="flex items-center">
                  <input
                    type="radio"
                    name="outputFormat"
                    value="flat"
                    checked={outputFormat === 'flat'}
                    onChange={(e) => setOutputFormat(e.target.value as 'json' | 'flat')}
                    className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                  />
                  <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                    FLAT (固定長ブロック)
                  </span>
                </label>
              </div>
            </div>

            {/* Japanese Encoding */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                日本語エンコーディング
              </label>
              <select
                value={japaneseEncoding}
                onChange={(e) => setJapaneseEncoding(e.target.value as 'utf-8' | 'sjis')}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="utf-8">UTF-8</option>
                <option value="sjis">Shift_JIS</option>
              </select>
            </div>

            {/* Volume Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ボリューム名
              </label>
              <input
                type="text"
                value={volumeName}
                onChange={(e) => setVolumeName(e.target.value)}
                placeholder="DISK01"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Library Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                ライブラリ名
              </label>
              <input
                type="text"
                value={libraryName}
                onChange={(e) => setLibraryName(e.target.value)}
                placeholder="TESTLIB"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* Catalog Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                カタログ名
              </label>
              <input
                type="text"
                value={datasetName}
                onChange={(e) => setDatasetName(e.target.value)}
                placeholder="SAM001"
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>

            {/* JSON Schema Option */}
            <div>
              <label className="flex items-center mb-2">
                <input
                  type="checkbox"
                  checked={useJsonSchema}
                  onChange={(e) => setUseJsonSchema(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                />
                <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  JSONスキーマファイル使用
                </span>
              </label>
              
              {useJsonSchema && (
                <div className="mt-2">
                  <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                    サーバー上のスキーマファイルパス
                  </label>
                  <input
                    type="text"
                    value={jsonSchemaPath}
                    onChange={(e) => setJsonSchemaPath(e.target.value)}
                    placeholder="/tmp/schema.json"
                    className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                  {jsonSchemaPath && (
                    <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
                      スキーマパス: {jsonSchemaPath}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* SOSI Processing Option */}
        <div className="mt-6">
          <label className="flex items-center mb-4">
            <input
              type="checkbox"
              checked={useSOSI}
              onChange={(e) => setUseSOSI(e.target.checked)}
              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
            />
            <span className="ml-2 text-sm font-medium text-gray-900 dark:text-gray-300">
              Use SOSI (Shift-Out/Shift-In) processing for double-byte characters
            </span>
          </label>
          
          {useSOSI && (
            <div className="space-y-4">
              {/* SOSI Code Type */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  SOSI Code Type
                </h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sosiType"
                      value="0E0F"
                      checked={sosiType === '0E0F'}
                      onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Standard (SO: 0x0E, SI: 0x0F)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sosiType"
                      value="1E1F"
                      checked={sosiType === '1E1F'}
                      onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Alternative (SO: 0x1E, SI: 0x1F)
                    </span>
                  </label>
                  
                  <div className="flex items-center space-x-2">
                    <label className="flex items-center">
                      <input
                        type="radio"
                        name="sosiType"
                        value="custom"
                        checked={sosiType === 'custom'}
                        onChange={(e) => setSosiType(e.target.value as '0E0F' | '1E1F' | 'custom')}
                        className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                      />
                      <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                        Custom:
                      </span>
                    </label>
                    <span className="text-xs text-gray-600 dark:text-gray-400">SO:</span>
                    <input
                      type="text"
                      value={customSO}
                      onChange={(e) => setCustomSO(e.target.value.toUpperCase())}
                      disabled={sosiType !== 'custom'}
                      maxLength={2}
                      placeholder="0E"
                      className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50"
                    />
                    <span className="text-xs text-gray-600 dark:text-gray-400">SI:</span>
                    <input
                      type="text"
                      value={customSI}
                      onChange={(e) => setCustomSI(e.target.value.toUpperCase())}
                      disabled={sosiType !== 'custom'}
                      maxLength={2}
                      placeholder="0F"
                      className="w-12 px-2 py-1 text-xs border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white disabled:bg-gray-100 dark:disabled:bg-gray-800 disabled:opacity-50"
                    />
                  </div>
                </div>
              </div>
              
              {/* SOSI Code Handling */}
              <div>
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                  SOSI Code Handling
                </h4>
                <div className="flex flex-wrap gap-4">
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sosiHandling"
                      value="remove"
                      checked={sosiHandling === 'remove'}
                      onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Remove SOSI codes (出力から削除)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sosiHandling"
                      value="keep"
                      checked={sosiHandling === 'keep'}
                      onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Keep SOSI codes (0x0E/0x0F 保持)
                    </span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="radio"
                      name="sosiHandling"
                      value="space"
                      checked={sosiHandling === 'space'}
                      onChange={(e) => setSosiHandling(e.target.value as 'remove' | 'keep' | 'space')}
                      className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 focus:ring-blue-500 dark:focus:ring-blue-600 dark:ring-offset-gray-800 focus:ring-2 dark:bg-gray-700 dark:border-gray-600"
                    />
                    <span className="ml-2 text-sm text-gray-700 dark:text-gray-300">
                      Convert to spaces (0x20に変換)
                    </span>
                  </label>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ファイルリスト */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              データセットファイル ({selectedFiles.length}件)
            </h2>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600 dark:text-gray-400">
                選択: {selectedCount}件
              </span>
              <button
                onClick={handleSelectAll}
                className="flex items-center px-3 py-1 text-sm bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                全選択
              </button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border border-gray-200 dark:border-gray-700 rounded-lg">
            {selectedFiles.map((file, index) => (
              <div
                key={index}
                className={`p-3 border-b border-gray-200 dark:border-gray-700 transition-colors ${
                  file.selected ? 'bg-blue-50 dark:bg-blue-900/20' : 'hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <input
                      type="checkbox"
                      checked={file.selected}
                      onChange={() => handleFileSelection(index)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                    <DocumentIcon className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{file.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {formatFileSize(file.size)} • {formatDate(file.lastModified)}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 変換エリア */}
      {selectedFiles.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
            データセット変換実行
          </h2>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 変換設定・実行 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
                変換設定
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-2">
                    選択されたファイル: {selectedCount}件
                  </label>
                  <label className="block text-sm text-gray-600 dark:text-gray-400 mb-4">
                    レイアウト: {selectedLayout || '未選択'}
                  </label>
                </div>
                
                <button
                  onClick={handleConvert}
                  disabled={selectedCount === 0 || !selectedLayout || isConverting}
                  className="w-full flex items-center justify-center px-6 py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors"
                >
                  {isConverting ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      変換中...
                    </>
                  ) : (
                    <>
                      <ArrowRightIcon className="w-5 h-5 mr-2" />
                      変換実行
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    loadServerCatalogData();
                    setShowDatasetBrowser(true);
                  }}
                  className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <FolderOpenIcon className="w-5 h-5 mr-2" />
                  サーバー上のデータセット参照
                </button>
                
                <div className="space-y-2">
                  {convertedResults && (
                    <button
                      onClick={downloadResults}
                      className="w-full flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                    >
                      <DocumentArrowDownIcon className="w-5 h-5 mr-2" />
                      結果ダウンロード
                    </button>
                  )}
                  
                </div>
              </div>
            </div>

            {/* 変換結果表示 */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                変換結果
              </h3>
              <div className="h-80 overflow-auto border border-gray-200 dark:border-gray-700 rounded-lg p-4 bg-gray-50 dark:bg-gray-900">
                <pre className="font-mono text-xs text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
                  {convertedResults || 'ファイルを選択し、レイアウトを選択して変換ボタンを押してください。'}
                </pre>
              </div>
            </div>
          </div>
        </div>
      )}


      {/* Dataset Browser Modal */}
      {showDatasetBrowser && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                サーバー上のデータセット参照
              </h3>
              <button
                onClick={() => setShowDatasetBrowser(false)}
                className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              >
                <span className="sr-only">Close</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            <div className="p-4 space-y-4 max-h-[75vh] overflow-auto">
              {/* Volume/Library/Dataset Browser */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Volumes */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ボリューム ({serverVolumes.length})
                  </h4>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-auto">
                    {serverVolumes.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        読み込み中...
                      </div>
                    ) : (
                      serverVolumes.map((volume) => (
                        <button
                          key={volume}
                          onClick={() => {
                            setSelectedServerVolume(volume);
                            setSelectedServerLibrary('');
                            setSelectedServerDataset('');
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedServerVolume === volume ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="flex items-center">
                            <FolderOpenIcon className="w-4 h-4 mr-2" />
                            {volume}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Libraries */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    ライブラリ {selectedServerVolume && `(${serverLibraries[selectedServerVolume]?.length || 0})`}
                  </h4>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-auto">
                    {!selectedServerVolume ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        ボリュームを選択してください
                      </div>
                    ) : serverLibraries[selectedServerVolume]?.length === 0 ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        ライブラリがありません
                      </div>
                    ) : (
                      serverLibraries[selectedServerVolume]?.map((library) => (
                        <button
                          key={library}
                          onClick={() => {
                            setSelectedServerLibrary(library);
                            setSelectedServerDataset('');
                          }}
                          className={`w-full text-left px-3 py-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedServerLibrary === library ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="flex items-center">
                            <DocumentIcon className="w-4 h-4 mr-2" />
                            {library}
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                </div>

                {/* Datasets */}
                <div>
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    データセット
                  </h4>
                  <div className="border border-gray-200 dark:border-gray-700 rounded-lg max-h-64 overflow-auto">
                    {!selectedServerLibrary ? (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        ライブラリを選択してください
                      </div>
                    ) : serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`] ? (
                      Object.keys(serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`] || {}).map((dataset) => (
                        <button
                          key={dataset}
                          onClick={() => setSelectedServerDataset(dataset)}
                          className={`w-full text-left px-3 py-2 border-b border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                            selectedServerDataset === dataset ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-gray-900 dark:text-white'
                          }`}
                        >
                          <div className="flex items-center">
                            <DocumentIcon className="w-4 h-4 mr-2" />
                            <div>
                              <div className="font-medium">{dataset}</div>
                              <div className="text-xs text-gray-500 dark:text-gray-400">
                                {serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`][dataset]?.TYPE || 'Unknown'}
                                {serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`][dataset]?.LRECL && 
                                  ` - ${serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`][dataset].LRECL}B`
                                }
                              </div>
                            </div>
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                        データセットがありません
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Dataset Details */}
              {selectedServerDataset && serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`]?.[selectedServerDataset] && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-3">
                    データセット詳細: {selectedServerVolume}/{selectedServerLibrary}/{selectedServerDataset}
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    {Object.entries(serverDatasets[`${selectedServerVolume}/${selectedServerLibrary}`][selectedServerDataset]).map(([key, value]) => (
                      <div key={key}>
                        <span className="font-medium text-gray-700 dark:text-gray-300">{key}:</span>
                        <span className="ml-2 text-gray-900 dark:text-white">{String(value)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex justify-end space-x-2 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => setShowDatasetBrowser(false)}
                  className="px-4 py-2 text-gray-700 dark:text-gray-300 bg-gray-100 dark:bg-gray-700 rounded-md hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  閉じる
                </button>
                {selectedServerDataset && (
                  <>
                    <button
                      onClick={() => {
                        // Set the volume/library/dataset names in the form
                        setVolumeName(selectedServerVolume);
                        setLibraryName(selectedServerLibrary);
                        setDatasetName(selectedServerDataset);
                        setShowDatasetBrowser(false);
                      }}
                      className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                    >
                      このデータセットを選択
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DatasetConversionPage;