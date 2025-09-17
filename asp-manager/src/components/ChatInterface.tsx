import React, { useState, useRef, useEffect } from 'react';
import {
  PaperAirplaneIcon,
  UserIcon,
  SparklesIcon,
  ArrowPathIcon,
  TrashIcon,
  BugAntIcon,
} from '@heroicons/react/24/outline';
import classNames from 'classnames';
import { ragService } from '../services/ragService';

interface Message {
  id: string;
  type: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  language?: 'ko' | 'ja';
}

interface ChatInterfaceProps {
  isDarkMode: boolean;
}

const ChatInterface: React.FC<ChatInterfaceProps> = ({ isDarkMode }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      type: 'assistant',
      content: 'ASPマニュアルについて何でもお聞きください。日本語でも韓国語でも対応いたします。',
      timestamp: new Date(),
      language: 'ja',
    },
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const detectLanguage = (text: string): 'ko' | 'ja' => {
    // Simple language detection based on character sets
    const koreanRegex = /[ㄱ-ㅎ|ㅏ-ㅣ|가-힣]/;
    const japaneseRegex = /[ひらがな|カタカナ|漢字]/;
    
    if (koreanRegex.test(text)) return 'ko';
    if (japaneseRegex.test(text)) return 'ja';
    return 'ko'; // Default to Korean
  };

  // Initialize simple RAG service
  useEffect(() => {
    const initializeRAG = async () => {
      try {
        await ragService.initialize();
        console.log('✅ Simple RAG service initialized');
      } catch (error) {
        console.error('❌ RAG initialization error:', error);
      }
    };
    
    initializeRAG();
  }, []);

  const getRAGResponse = async (query: string, language: 'ko' | 'ja'): Promise<string> => {
    try {
      const response = await ragService.generateResponse(query, language);
      return response.answer;
    } catch (error) {
      console.error('RAG service error:', error);
      
      const fallbackMessage = language === 'ko'
        ? '죄송합니다. 현재 문서 검색 서비스를 사용할 수 없습니다.'
        : '申し訳ございません。現在、文書検索サービスをご利用いただけません。';
      
      return fallbackMessage;
    }
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      type: 'user',
      content: inputMessage.trim(),
      timestamp: new Date(),
      language: detectLanguage(inputMessage.trim()),
    };

    setMessages(prev => [...prev, userMessage]);
    setInputMessage('');
    setIsLoading(true);
    setIsTyping(true);

    try {
      const response = await getRAGResponse(userMessage.content, userMessage.language || 'ko');
      
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: response,
        timestamp: new Date(),
        language: userMessage.language || 'ko',
      };

      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error getting response:', error);
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        type: 'assistant',
        content: userMessage.language === 'ko' 
          ? '죄송합니다. 응답을 생성하는 중에 오류가 발생했습니다.' 
          : '申し訳ございません。応答の生成中にエラーが発生しました。',
        timestamp: new Date(),
        language: userMessage.language || 'ko',
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
      setIsTyping(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const clearMessages = () => {
    setMessages([
      {
        id: '1',
        type: 'assistant',
        content: 'ASPマニュアルについて何でもお聞きください。日本語でも韓国語でも対応いたします。',
        timestamp: new Date(),
        language: 'ja',
      },
    ]);
  };

  const debugVectorDB = () => {
    console.log('🔍 Simple RAG system debug information:');
    console.log('System: Simple text-based search without vector embeddings');
    console.log('Status: Running with basic document matching');
  };

  return (
    <div className={classNames(
      'flex flex-col h-full',
      isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
    )}>
      {/* Header */}
      <div className={classNames(
        'flex items-center justify-between p-6 border-b',
        isDarkMode 
          ? 'border-gray-700 bg-gray-800' 
          : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-center space-x-3">
          <div className={classNames(
            'w-10 h-10 rounded-full flex items-center justify-center',
            isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
          )}>
            <SparklesIcon className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className={classNames(
              'text-lg font-semibold',
              isDarkMode ? 'text-white' : 'text-gray-900'
            )}>
              ASP マニュアル アシスタント
            </h2>
            <p className={classNames(
              'text-sm',
              isDarkMode ? 'text-gray-400' : 'text-gray-500'
            )}>
              RAGベース文書検索 • 日本語/韓国語対応
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={debugVectorDB}
            className={classNames(
              'p-2 rounded-lg transition-colors',
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            )}
            title="ベクターDBデバッグ"
          >
            <BugAntIcon className="w-5 h-5" />
          </button>
          <button
            onClick={clearMessages}
            className={classNames(
              'p-2 rounded-lg transition-colors',
              isDarkMode 
                ? 'hover:bg-gray-700 text-gray-400 hover:text-white' 
                : 'hover:bg-gray-100 text-gray-500 hover:text-gray-700'
            )}
            title="会話をクリア"
          >
            <TrashIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div key={message.id} className={classNames(
            'flex items-start space-x-3',
            message.type === 'user' ? 'justify-end' : 'justify-start'
          )}>
            {message.type === 'assistant' && (
              <div className={classNames(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
              )}>
                <SparklesIcon className="w-4 h-4 text-white" />
              </div>
            )}
            
            <div className={classNames(
              'max-w-xs lg:max-w-md px-4 py-3 rounded-2xl',
              message.type === 'user' 
                ? isDarkMode 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-blue-500 text-white'
                : isDarkMode 
                  ? 'bg-gray-800 text-gray-100 border border-gray-700' 
                  : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
            )}>
              <p className="text-sm leading-relaxed whitespace-pre-wrap">
                {message.content}
              </p>
              <p className={classNames(
                'text-xs mt-2 opacity-70',
                message.type === 'user' ? 'text-blue-100' : isDarkMode ? 'text-gray-400' : 'text-gray-500'
              )}>
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>

            {message.type === 'user' && (
              <div className={classNames(
                'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
                isDarkMode ? 'bg-gray-700' : 'bg-gray-300'
              )}>
                <UserIcon className={classNames(
                  'w-4 h-4',
                  isDarkMode ? 'text-gray-300' : 'text-gray-600'
                )} />
              </div>
            )}
          </div>
        ))}

        {isTyping && (
          <div className="flex items-start space-x-3">
            <div className={classNames(
              'w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0',
              isDarkMode ? 'bg-blue-600' : 'bg-blue-500'
            )}>
              <SparklesIcon className="w-4 h-4 text-white" />
            </div>
            <div className={classNames(
              'px-4 py-3 rounded-2xl',
              isDarkMode 
                ? 'bg-gray-800 text-gray-100 border border-gray-700' 
                : 'bg-white text-gray-900 border border-gray-200 shadow-sm'
            )}>
              <div className="flex items-center space-x-1">
                <div className={classNames(
                  'w-2 h-2 rounded-full animate-pulse',
                  isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                )} />
                <div className={classNames(
                  'w-2 h-2 rounded-full animate-pulse',
                  isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                )} style={{ animationDelay: '0.2s' }} />
                <div className={classNames(
                  'w-2 h-2 rounded-full animate-pulse',
                  isDarkMode ? 'bg-gray-400' : 'bg-gray-500'
                )} style={{ animationDelay: '0.4s' }} />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={classNames(
        'p-6 border-t',
        isDarkMode 
          ? 'border-gray-700 bg-gray-800' 
          : 'border-gray-200 bg-white'
      )}>
        <div className="flex items-end space-x-3">
          <div className="flex-1">
            <textarea
              ref={inputRef}
              value={inputMessage}
              onChange={(e) => setInputMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="ASPマニュアルについて質問してください... (日本語/한국어)"
              className={classNames(
                'w-full px-4 py-3 rounded-2xl border-2 transition-all duration-200 resize-none',
                'focus:outline-none focus:ring-0',
                isDarkMode 
                  ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400 focus:border-blue-500' 
                  : 'bg-gray-50 border-gray-200 text-gray-900 placeholder-gray-500 focus:border-blue-400'
              )}
              rows={1}
              style={{ minHeight: '48px', maxHeight: '120px' }}
            />
          </div>
          <button
            onClick={handleSendMessage}
            disabled={!inputMessage.trim() || isLoading}
            className={classNames(
              'p-3 rounded-full transition-all duration-200',
              'focus:outline-none focus:ring-2 focus:ring-offset-2',
              isDarkMode ? 'focus:ring-offset-gray-800' : 'focus:ring-offset-white',
              inputMessage.trim() && !isLoading
                ? isDarkMode 
                  ? 'bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500' 
                  : 'bg-blue-500 hover:bg-blue-600 text-white focus:ring-blue-400'
                : isDarkMode 
                  ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
            )}
          >
            {isLoading ? (
              <ArrowPathIcon className="w-5 h-5 animate-spin" />
            ) : (
              <PaperAirplaneIcon className="w-5 h-5" />
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface;