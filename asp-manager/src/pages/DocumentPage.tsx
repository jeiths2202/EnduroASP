import React from 'react';
import MarkdownRenderer from '../components/MarkdownRenderer';

interface DocumentPageProps {
  isDarkMode: boolean;
}

const DocumentPage: React.FC<DocumentPageProps> = ({ isDarkMode }) => {
  
  return (
    <div className={`h-full ${isDarkMode ? 'bg-gray-900 text-white' : 'bg-white text-gray-900'}`}>
      <div className="flex h-full">
        <div className="flex-1 p-6">
          <MarkdownRenderer 
            content="# ASP 문서

이 페이지는 현재 개발 중입니다.

RAG 기반 채팅은 채팅 페이지에서 이용하실 수 있습니다."
            isDarkMode={isDarkMode}
          />
        </div>
      </div>
    </div>
  );
};

export default DocumentPage;