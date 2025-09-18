import React, { useState, useEffect } from 'react';
import {
  DocumentTextIcon,
  ArrowPathIcon,
  FolderOpenIcon,
  EyeIcon,
  DocumentArrowDownIcon,
  PhotoIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import MarkdownRenderer from './MarkdownRenderer';

interface PdfFile {
  name: string;
  path: string;
  fullPath: string;
  size: number;
  modified: string;
}

interface ConversionResult {
  success: boolean;
  content: string;
  format: string;
  images: string[];
  outputDir: string;
}

interface PdfConverterProps {
  isDarkMode: boolean;
}

const PdfConverter: React.FC<PdfConverterProps> = ({ isDarkMode }) => {
  const [pdfFiles, setPdfFiles] = useState<PdfFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<PdfFile | null>(null);
  const [outputFormat, setOutputFormat] = useState<'markdown' | 'html'>('markdown');
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [conversionResult, setConversionResult] = useState<ConversionResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conversionHistory, setConversionHistory] = useState<Array<{
    file: string;
    format: string;
    timestamp: string;
    success: boolean;
  }>>([]);

  // PDF 파일 목록 로드
  useEffect(() => {
    loadPdfFiles();
  }, []);

  const loadPdfFiles = async () => {
    setIsLoadingFiles(true);
    try {
      const response = await fetch('http://localhost:3001/api/pdf-files');
      if (response.ok) {
        const files = await response.json();
        setPdfFiles(files);
      } else {
        setError('PDF ファイルの読み込みに失敗しました');
      }
    } catch (error) {
      console.error('Error loading PDF files:', error);
      setError('サーバーとの接続に失敗しました');
    } finally {
      setIsLoadingFiles(false);
    }
  };

  const convertPdf = async () => {
    if (!selectedFile) return;

    setIsLoading(true);
    setError(null);
    setConversionResult(null);

    try {
      const response = await fetch('http://localhost:3001/api/convert-pdf', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath: selectedFile.path,
          outputFormat: outputFormat
        }),
      });

      const result = await response.json();

      if (result.success) {
        setConversionResult(result);
        
        // 변환 히스토리에 추가
        const historyItem = {
          file: selectedFile.name,
          format: outputFormat,
          timestamp: new Date().toISOString(),
          success: true
        };
        setConversionHistory(prev => [historyItem, ...prev.slice(0, 9)]);
      } else {
        setError(result.error || '変換に失敗しました');
        
        // 실패 히스토리에 추가
        const historyItem = {
          file: selectedFile.name,
          format: outputFormat,
          timestamp: new Date().toISOString(),
          success: false
        };
        setConversionHistory(prev => [historyItem, ...prev.slice(0, 9)]);
      }
    } catch (error) {
      console.error('Conversion error:', error);
      setError('変換処理でエラーが発生しました');
    } finally {
      setIsLoading(false);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* ヘッダー */}
      <div className="border-b border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center mb-4">
          <DocumentArrowDownIcon className="w-8 h-8 text-blue-600 dark:text-blue-400 mr-3" />
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              PDF変換ツール
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Markerを使用してPDFをMarkdownまたはHTMLに変換
            </p>
          </div>
        </div>

        {/* 統計情報 */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <DocumentTextIcon className="w-5 h-5 text-blue-600 dark:text-blue-400 mr-2" />
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                利用可能PDF
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-900 dark:text-blue-100 mt-1">
              {pdfFiles.length}
            </p>
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
              <span className="text-sm font-medium text-green-900 dark:text-green-100">
                成功した変換
              </span>
            </div>
            <p className="text-2xl font-bold text-green-900 dark:text-green-100 mt-1">
              {conversionHistory.filter(h => h.success).length}
            </p>
          </div>
          
          <div className="bg-orange-50 dark:bg-orange-900/20 rounded-lg p-4">
            <div className="flex items-center">
              <ClockIcon className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2" />
              <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                処理中
              </span>
            </div>
            <p className="text-2xl font-bold text-orange-900 dark:text-orange-100 mt-1">
              {isLoading ? '1' : '0'}
            </p>
          </div>
          
          <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
            <div className="flex items-center">
              <PhotoIcon className="w-5 h-5 text-gray-600 dark:text-gray-400 mr-2" />
              <span className="text-sm font-medium text-gray-900 dark:text-gray-100">
                抽出画像
              </span>
            </div>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {conversionResult?.images?.length || 0}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* サイドバー - PDF選択 */}
        <div className="w-80 border-r border-gray-200 dark:border-gray-700 flex flex-col">
          {/* PDF選択エリア */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                PDFファイル選択
              </h3>
              <button
                onClick={loadPdfFiles}
                disabled={isLoadingFiles}
                className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
              >
                <ArrowPathIcon className={`w-5 h-5 ${isLoadingFiles ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* 出力形式選択 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                出力形式
              </label>
              <div className="flex space-x-2">
                <button
                  onClick={() => setOutputFormat('markdown')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    outputFormat === 'markdown'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  Markdown
                </button>
                <button
                  onClick={() => setOutputFormat('html')}
                  className={`flex-1 py-2 px-3 rounded-md text-sm font-medium transition-colors ${
                    outputFormat === 'html'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  HTML
                </button>
              </div>
            </div>

            {/* 変換ボタン */}
            <button
              onClick={convertPdf}
              disabled={!selectedFile || isLoading}
              className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                !selectedFile || isLoading
                  ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'
              }`}
            >
              {isLoading ? (
                <div className="flex items-center justify-center">
                  <ArrowPathIcon className="w-4 h-4 animate-spin mr-2" />
                  変換中...
                </div>
              ) : (
                `${outputFormat.toUpperCase()}に変換`
              )}
            </button>
          </div>

          {/* PDFファイル一覧 */}
          <div className="flex-1 overflow-auto">
            {isLoadingFiles ? (
              <div className="flex items-center justify-center p-8">
                <ArrowPathIcon className="w-6 h-6 animate-spin text-gray-400 mr-2" />
                <span className="text-gray-600 dark:text-gray-400">読み込み中...</span>
              </div>
            ) : pdfFiles.length === 0 ? (
              <div className="p-4 text-center text-gray-500 dark:text-gray-400">
                <FolderOpenIcon className="w-12 h-12 mx-auto mb-2 opacity-50" />
                <p>PDFファイルが見つかりません</p>
              </div>
            ) : (
              <div className="p-2">
                {pdfFiles.map((file, index) => (
                  <button
                    key={index}
                    onClick={() => setSelectedFile(file)}
                    className={`w-full p-3 mb-2 rounded-lg text-left transition-colors ${
                      selectedFile?.path === file.path
                        ? 'bg-blue-50 dark:bg-blue-900/20 border-2 border-blue-200 dark:border-blue-700'
                        : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 border-2 border-transparent'
                    }`}
                  >
                    <div className="flex items-start">
                      <DocumentTextIcon className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                          {file.path}
                        </p>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs text-gray-400">
                            {formatFileSize(file.size)}
                          </span>
                          <span className="text-xs text-gray-400">
                            {formatDate(file.modified)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* メインコンテンツエリア */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* エラー表示 */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-400 p-4 m-4">
              <div className="flex">
                <ExclamationTriangleIcon className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {/* 変換結果表示エリア */}
          <div className="flex-1 overflow-auto p-6">
            {!conversionResult && !isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <EyeIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    PDFを選択して変換してください
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    左側からPDFファイルを選択し、出力形式を選んで変換ボタンを押してください
                  </p>
                </div>
              </div>
            ) : isLoading ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center">
                  <ArrowPathIcon className="w-16 h-16 text-blue-500 animate-spin mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-2">
                    変換処理中...
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400">
                    PDFを{outputFormat.toUpperCase()}に変換しています。しばらくお待ちください。
                  </p>
                </div>
              </div>
            ) : conversionResult ? (
              <div>
                <div className="mb-6 p-4 bg-green-50 dark:bg-green-900/20 rounded-lg">
                  <div className="flex items-center">
                    <CheckCircleIcon className="w-5 h-5 text-green-600 dark:text-green-400 mr-2" />
                    <span className="text-green-800 dark:text-green-200 font-medium">
                      変換完了: {conversionResult.format.toUpperCase()}
                    </span>
                  </div>
                  {conversionResult.images.length > 0 && (
                    <p className="text-green-700 dark:text-green-300 text-sm mt-1">
                      {conversionResult.images.length}個の画像が抽出されました
                    </p>
                  )}
                </div>

                {/* 変換結果表示 */}
                <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
                  {conversionResult.format === 'html' ? (
                    <div 
                      className="p-6 prose dark:prose-invert max-w-none"
                      dangerouslySetInnerHTML={{ __html: conversionResult.content }}
                    />
                  ) : (
                    <div className="p-6">
                      <MarkdownRenderer 
                        content={conversionResult.content} 
                        isDarkMode={isDarkMode} 
                      />
                    </div>
                  )}
                </div>

                {/* 抽出された画像表示 */}
                {conversionResult.images.length > 0 && (
                  <div className="mt-6">
                    <h4 className="text-lg font-medium text-gray-900 dark:text-white mb-4">
                      抽出された画像 ({conversionResult.images.length}個)
                    </h4>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {conversionResult.images.map((image, index) => (
                        <div key={index} className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                          <img
                            src={`http://localhost:3001/api/images/${conversionResult.outputDir.split('/').pop()}/${image}`}
                            alt={`Extracted image ${index + 1}`}
                            className="w-full h-32 object-cover rounded"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                          <p className="text-xs text-gray-600 dark:text-gray-400 mt-1 truncate">
                            {image}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        </div>

        {/* 変換履歴サイドバー */}
        {conversionHistory.length > 0 && (
          <div className="w-64 border-l border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
            <div className="p-4">
              <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-4">
                変換履歴
              </h3>
              <div className="space-y-2">
                {conversionHistory.map((history, index) => (
                  <div
                    key={index}
                    className={`p-2 rounded text-xs ${
                      history.success
                        ? 'bg-green-100 dark:bg-green-900/20 text-green-800 dark:text-green-200'
                        : 'bg-red-100 dark:bg-red-900/20 text-red-800 dark:text-red-200'
                    }`}
                  >
                    <p className="font-medium truncate">{history.file}</p>
                    <p className="opacity-75">{history.format.toUpperCase()}</p>
                    <p className="opacity-50">{formatDate(history.timestamp)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PdfConverter;