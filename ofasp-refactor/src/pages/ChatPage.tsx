import React, { useState, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  PhotoIcon,
  DocumentIcon,
  TrashIcon,
  UserIcon,
  CpuChipIcon,
  FolderOpenIcon,
  CloudArrowUpIcon,
  ChevronDownIcon
} from '@heroicons/react/24/outline';
import { useI18n } from '../hooks/useI18n';
import SplitLayout from '../components/SplitLayout';
import ArtifactWindow from '../components/ArtifactWindow';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  files?: FileData[];
  ragResults?: RagResult[];
}

interface RagResult {
  file: string;
  path: string;
  snippet: string;
  similarity?: number;
  rank?: number;
}

interface FileData {
  name: string;
  type: string;
  url: string;
  size: number;
}

interface ModelInfo {
  name: string;
  displayName: string;
  description: string;
}

interface ChatPageProps {
  isDarkMode: boolean;
}

interface ArtifactData {
  content: string;
  contentType: 'code' | 'html' | 'markdown' | 'text';
  language: string;
  title?: string;
}

const ChatPage: React.FC<ChatPageProps> = ({ isDarkMode }) => {
  const { t } = useI18n();
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<FileData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [apiStatus, setApiStatus] = useState<'checking' | 'connected' | 'disconnected'>('checking');
  
  // Model selection state
  const [selectedModel, setSelectedModel] = useState<string>('Gemma3 270M');
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [availableModels, setAvailableModels] = useState<ModelInfo[]>([]);
  
  // Artifact state
  const [artifactData, setArtifactData] = useState<ArtifactData | null>(null);
  const [showArtifactWindow, setShowArtifactWindow] = useState(false);
  const [isArtifactFullscreen, setIsArtifactFullscreen] = useState(false);
  
  // RAG state
  const [useRAG, setUseRAG] = useState(false);
  const [ragStatus, setRagStatus] = useState<'checking' | 'available' | 'unavailable'>('checking');

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Check API connection and load models on mount
  useEffect(() => {
    const checkApiConnection = async () => {
      try {
        const response = await fetch('/api/health');
        if (response.ok) {
          setApiStatus('connected');
          console.log('Chat API connected successfully');
          
          // Load available models
          try {
            const modelsResponse = await fetch('/api/models');
            if (modelsResponse.ok) {
              const modelsData = await modelsResponse.json();
              setAvailableModels(modelsData.models || []);
              
              // Set default model to first available model if current selection is not available
              if (modelsData.models && modelsData.models.length > 0) {
                const modelNames = modelsData.models.map((m: any) => m.friendly_name);
                if (!modelNames.includes(selectedModel)) {
                  setSelectedModel(modelsData.models[0].friendly_name);
                }
              }
            }
          } catch (modelError) {
            console.error('Failed to load models:', modelError);
          }
          
          // Check RAG service availability
          try {
            const ragResponse = await fetch('/api/rag/status');
            if (ragResponse.ok) {
              const ragData = await ragResponse.json();
              setRagStatus(ragData.available ? 'available' : 'unavailable');
              console.log('RAG Service status:', ragData.available ? 'available' : 'unavailable');
            } else {
              setRagStatus('unavailable');
            }
          } catch (ragError) {
            console.error('Failed to check RAG status:', ragError);
            setRagStatus('unavailable');
          }
        } else {
          setApiStatus('disconnected');
          console.error('Chat API health check failed:', response.status);
        }
      } catch (error) {
        setApiStatus('disconnected');
        console.error('Chat API connection failed:', error);
      }
    };

    checkApiConnection();
  }, []);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    Array.from(files).forEach(file => {
      const fileData: FileData = {
        name: file.name,
        type: file.type,
        url: URL.createObjectURL(file),
        size: file.size
      };
      setAttachedFiles(prev => [...prev, fileData]);
    });
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const convertFileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() && attachedFiles.length === 0) return;
    if (apiStatus !== 'connected') {
      alert('API サーバーに接続されていません。サーバーが起動しているか確認してください。');
      return;
    }

    const newMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage,
      timestamp: new Date(),
      files: attachedFiles.length > 0 ? [...attachedFiles] : undefined
    };

    setMessages(prev => [...prev, newMessage]);
    const messageText = inputMessage;
    setInputMessage('');
    const currentFiles = [...attachedFiles];
    setAttachedFiles([]);
    setIsLoading(true);

    try {
      // Start with simple text-only request first
      let requestPayload: {
        message: string;
        files: Array<{
          name: string;
          type: string;
          data: string;
          size: number;
        }>;
        use_rag: boolean;
        model: string;
      } = {
        message: messageText,
        files: [],
        use_rag: useRAG && ragStatus === 'available',
        model: selectedModel
      };

      // Only process files if we have them and message sending works
      if (currentFiles && currentFiles.length > 0) {
        console.log('Processing files:', currentFiles.length);
        const filesForAPI: Array<{
          name: string;
          type: string;
          data: string;
          size: number;
        }> = [];
        
        for (const fileData of currentFiles) {
          try {
            console.log('Processing file:', fileData.name);
            // Convert blob URL back to base64
            const response = await fetch(fileData.url);
            if (!response.ok) {
              throw new Error(`Failed to fetch blob: ${response.status}`);
            }
            const blob = await response.blob();
            const file = new File([blob], fileData.name, { type: fileData.type });
            const base64 = await convertFileToBase64(file);
            
            filesForAPI.push({
              name: fileData.name,
              type: fileData.type,
              data: base64,
              size: fileData.size
            });
            console.log('File processed successfully:', fileData.name);
          } catch (fileError) {
            console.error('Failed to process file:', fileData.name, fileError);
            // Continue with other files even if one fails
          }
        }
        
        requestPayload.files = filesForAPI;
      }
      
      console.log('Sending chat request:', {
        message: messageText,
        fileCount: requestPayload.files.length,
        hasMessage: !!messageText,
        model: selectedModel
      });

      // Call our chat API backend
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestPayload),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('API error response:', errorText);
        throw new Error(`HTTP error! status: ${response.status}, response: ${errorText}`);
      }

      const data = await response.json();
      console.log('Response data:', data);

      let responseText = data.response || 'Sorry, I could not generate a response.';
      
      // Add file processing information if available (keep this in main content)
      if (data.processed_files && data.processed_files.length > 0) {
        responseText += '\n\n📎 処理したファイル:';
        data.processed_files.forEach((file: any) => {
          responseText += `\n- ${file.description}`;
        });
      }

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: responseText,
        timestamp: new Date(),
        ragResults: data.rag_results || []
      };

      setMessages(prev => [...prev, assistantMessage]);
      
      // Extract artifacts if Qwen2.5 Coder is selected
      if (shouldShowArtifactWindow) {
        const artifacts = extractArtifacts(responseText);
        if (artifacts) {
          setArtifactData(artifacts);
          setShowArtifactWindow(true);
        }
      }
    } catch (error) {
      console.error('Error calling chat API:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: 'エラーが発生しました。チャットAPIサーバーが正常に動作していることを確認してください。',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const clearChat = () => {
    setMessages([]);
    setAttachedFiles([]);
    setArtifactData(null);
    setShowArtifactWindow(false);
  };

  // Check if current model should show artifact window
  const shouldShowArtifactWindow = selectedModel === 'Qwen2.5 Coder 1.5B';

  // Extract code blocks or artifacts from response
  const extractArtifacts = (content: string): ArtifactData | null => {
    // Look for code blocks with various patterns
    const patterns = [
      /```(\w+)?\n([\s\S]*?)```/g,  // Standard markdown code blocks
      /~~~(\w+)?\n([\s\S]*?)~~~/g,  // Alternative code blocks
      /<code[^>]*>([\s\S]*?)<\/code>/g, // HTML code tags
    ];
    
    for (const pattern of patterns) {
      const match = pattern.exec(content);
      if (match) {
        const language = match[1] || 'javascript';
        const code = (match[2] || match[1]).trim();
        
        if (code.length > 10) { // Only show meaningful code blocks
          // Determine content type based on language
          let contentType: 'code' | 'html' | 'markdown' | 'text' = 'code';
          const lang = language.toLowerCase();
          
          if (lang === 'html' || lang === 'htm') contentType = 'html';
          else if (lang === 'markdown' || lang === 'md') contentType = 'markdown';
          else if (lang === 'text' || lang === 'txt') contentType = 'text';
          
          return {
            content: code,
            contentType,
            language: lang,
            title: `Generated ${language.toUpperCase()} Code`
          };
        }
      }
    }
    
    return null;
  };

  const handleToggleArtifactFullscreen = () => {
    setIsArtifactFullscreen(!isArtifactFullscreen);
  };

  const renderChatContent = () => (
    <div className="flex flex-col h-full bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <CpuChipIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
            <div>
              <h1 className="text-xl font-semibold text-gray-900 dark:text-white">
                {t('common.chat')} - {selectedModel}
              </h1>
              <p className="text-sm text-gray-500 dark:text-gray-400 flex items-center space-x-2">
                <span>AI assistant powered by {selectedModel} model</span>
                <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                  apiStatus === 'connected' 
                    ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
                    : apiStatus === 'disconnected'
                    ? 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
                    : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
                }`}>
                  {apiStatus === 'connected' ? '🟢 Connected' : 
                   apiStatus === 'disconnected' ? '🔴 Disconnected' : 
                   '🟡 Checking...'}
                </span>
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-4">
            {/* Model Selection Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsModelDropdownOpen(!isModelDropdownOpen)}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <CpuChipIcon className="w-4 h-4 mr-2" />
                <span className="mr-2">{selectedModel}</span>
                <ChevronDownIcon className={`w-4 h-4 transition-transform ${isModelDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isModelDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setIsModelDropdownOpen(false)}
                  />
                  
                  {/* Dropdown */}
                  <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-20">
                    <div className="py-1">
                      {availableModels.map((model: any) => (
                        <button
                          key={model.name}
                          onClick={() => {
                            setSelectedModel(model.friendly_name);
                            setIsModelDropdownOpen(false);
                            // Hide artifact window if switching away from Qwen2.5 Coder
                            if (model.friendly_name !== 'Qwen2.5 Coder 1.5B') {
                              setShowArtifactWindow(false);
                              setArtifactData(null);
                            }
                          }}
                          className={`w-full flex items-start px-4 py-3 text-sm text-left hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${
                            selectedModel === model.friendly_name 
                              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' 
                              : 'text-gray-700 dark:text-gray-300'
                          }`}
                        >
                          <CpuChipIcon className="w-4 h-4 mr-3 mt-0.5 flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <div className="font-medium">{model.friendly_name}</div>
                            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                              Model: {model.name} | Size: {Math.round(model.size / 1024 / 1024 / 1024 * 10) / 10}GB
                            </div>
                          </div>
                          {selectedModel === model.friendly_name && (
                            <span className="ml-2 text-blue-600 dark:text-blue-400 flex-shrink-0">✓</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}
            </div>
            
            {/* RAG Toggle */}
            {ragStatus === 'available' && (
              <div className="flex items-center space-x-2">
                <label className="flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useRAG}
                    onChange={(e) => setUseRAG(e.target.checked)}
                    className="sr-only"
                  />
                  <div className={`relative inline-block w-10 h-6 rounded-full transition-colors ${
                    useRAG 
                      ? 'bg-blue-600 dark:bg-blue-500' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}>
                    <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform ${
                      useRAG ? 'translate-x-4' : 'translate-x-0'
                    }`} />
                  </div>
                  <span className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                    RAG
                  </span>
                </label>
                <div className="text-xs text-gray-500 dark:text-gray-400">
                  {useRAG ? '文書検索 ON' : '文書検索 OFF'}
                </div>
              </div>
            )}
            
            <div className="flex items-center space-x-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-2 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="ファイルをアップロード"
            >
              <FolderOpenIcon className="w-5 h-5" />
            </button>
            <button
              onClick={clearChat}
              className="p-2 text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="チャットをクリア"
            >
              <TrashIcon className="w-5 h-5" />
            </button>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <CpuChipIcon className="w-16 h-16 text-gray-300 dark:text-gray-600 mb-4" />
            <h3 className="text-lg font-medium text-gray-600 dark:text-gray-400 mb-2">
              {selectedModel} AI Assistantへようこそ
            </h3>
            <p className="text-gray-500 dark:text-gray-500 max-w-md">
              質問やファイルを共有して、AIアシスタントと対話を始めましょう。
              画像、文書、その他のファイルもサポートしています。
            </p>
          </div>
        ) : (
          messages.map((message) => (
            <div
              key={message.id}
              className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div className={`flex max-w-3xl ${message.type === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 ${message.type === 'user' ? 'ml-3' : 'mr-3'}`}>
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    message.type === 'user' 
                      ? 'bg-blue-600 dark:bg-blue-500' 
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}>
                    {message.type === 'user' ? (
                      <UserIcon className="w-5 h-5 text-white" />
                    ) : (
                      <CpuChipIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                    )}
                  </div>
                </div>
                
                <div className={`rounded-lg px-4 py-3 ${
                  message.type === 'user'
                    ? 'bg-blue-600 text-white'
                    : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 border border-gray-200 dark:border-gray-700'
                }`}>
                  {message.files && message.files.length > 0 && (
                    <div className="mb-3 space-y-2">
                      {message.files.map((file, index) => (
                        <div
                          key={index}
                          className={`flex items-center space-x-2 p-2 rounded ${
                            message.type === 'user'
                              ? 'bg-blue-500 bg-opacity-50'
                              : 'bg-gray-50 dark:bg-gray-700'
                          }`}
                        >
                          {file.type.startsWith('image/') ? (
                            <PhotoIcon className="w-4 h-4" />
                          ) : (
                            <DocumentIcon className="w-4 h-4" />
                          )}
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">{file.name}</p>
                            <p className="text-xs opacity-75">{formatFileSize(file.size)}</p>
                          </div>
                          {file.type.startsWith('image/') && (
                            <img
                              src={file.url}
                              alt={file.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <p className="whitespace-pre-wrap">{message.content}</p>
                  
                  {/* RAG Results */}
                  {message.ragResults && message.ragResults.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-600">
                      <div className="flex items-center mb-2">
                        <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
                          📚 参考資料 ({message.ragResults.length}件)
                        </span>
                      </div>
                      <div className="space-y-2">
                        {message.ragResults.map((result, index) => (
                          <div key={index} className="bg-gray-50 dark:bg-gray-700 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                                {result.file}
                              </span>
                              {result.similarity && (
                                <span className="text-xs text-gray-500 dark:text-gray-400">
                                  {Math.round(result.similarity * 100)}% 一致
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-600 dark:text-gray-400 line-clamp-2">
                              {result.snippet}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  <div className={`text-xs mt-2 ${
                    message.type === 'user' ? 'text-blue-100' : 'text-gray-500 dark:text-gray-400'
                  }`}>
                    {message.timestamp.toLocaleTimeString('ja-JP', { 
                      hour: '2-digit', 
                      minute: '2-digit' 
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
        
        {isLoading && (
          <div className="flex justify-start">
            <div className="flex">
              <div className="flex-shrink-0 mr-3">
                <div className="w-8 h-8 rounded-full bg-gray-300 dark:bg-gray-600 flex items-center justify-center">
                  <CpuChipIcon className="w-5 h-5 text-gray-700 dark:text-gray-300" />
                </div>
              </div>
              <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3">
                <div className="flex items-center space-x-2">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                  <span className="text-gray-600 dark:text-gray-400">考え中...</span>
                </div>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white dark:bg-gray-800 border-t border-gray-200 dark:border-gray-700 px-6 py-4">
        {/* Attached Files */}
        {attachedFiles.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-2">
            {attachedFiles.map((file, index) => (
              <div
                key={index}
                className="flex items-center space-x-2 bg-gray-100 dark:bg-gray-700 rounded-lg px-3 py-2"
              >
                {file.type.startsWith('image/') ? (
                  <PhotoIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                ) : (
                  <DocumentIcon className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                )}
                <span className="text-sm text-gray-700 dark:text-gray-300 truncate max-w-32">
                  {file.name}
                </span>
                <button
                  onClick={() => removeFile(index)}
                  className="text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                >
                  <TrashIcon className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="メッセージを入力してください..."
              rows={1}
              className="w-full px-4 py-3 bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg border-0 resize-none focus:ring-2 focus:ring-blue-500 focus:outline-none"
              style={{ minHeight: '48px', maxHeight: '120px' }}
              onInput={(e) => {
                const target = e.target as HTMLTextAreaElement;
                target.style.height = 'auto';
                target.style.height = target.scrollHeight + 'px';
              }}
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.pdf,.doc,.docx,.txt,.md"
              onChange={handleFileUpload}
              className="hidden"
            />
            
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-3 text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              title="ファイルを添付"
            >
              <CloudArrowUpIcon className="w-5 h-5" />
            </button>
            
            <button
              onClick={sendMessage}
              disabled={isLoading || (!inputMessage.trim() && attachedFiles.length === 0) || apiStatus !== 'connected'}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 dark:disabled:bg-gray-600 text-white rounded-lg transition-colors disabled:cursor-not-allowed"
              title={apiStatus !== 'connected' ? 'API サーバーに接続されていません' : '送信'}
            >
              <PaperAirplaneIcon className="w-5 h-5" />
            </button>
          </div>
        </div>
        
        <div className="mt-2 text-xs text-gray-500 dark:text-gray-400 text-center">
          Enter キーで送信 • Shift + Enter で改行 • 画像やドキュメントをドラッグ&ドロップできます
        </div>
      </div>
    </div>
  );

  // Main render with conditional split layout
  if (shouldShowArtifactWindow && showArtifactWindow && !isArtifactFullscreen) {
    return (
      <SplitLayout
        direction="horizontal"
        defaultSplit={60}
        minSize={30}
        isDarkMode={isDarkMode}
        className="h-full"
      >
        {renderChatContent()}
        <ArtifactWindow
          isDarkMode={isDarkMode}
          content={artifactData?.content || ''}
          contentType={artifactData?.contentType || 'code'}
          language={artifactData?.language || 'javascript'}
          onToggleFullscreen={handleToggleArtifactFullscreen}
          isFullscreen={isArtifactFullscreen}
        />
      </SplitLayout>
    );
  }

  // Fullscreen artifact or regular chat
  if (isArtifactFullscreen && artifactData) {
    return (
      <ArtifactWindow
        isDarkMode={isDarkMode}
        content={artifactData.content}
        contentType={artifactData.contentType}
        language={artifactData.language}
        onToggleFullscreen={handleToggleArtifactFullscreen}
        isFullscreen={isArtifactFullscreen}
      />
    );
  }

  return renderChatContent();
};

export default ChatPage;