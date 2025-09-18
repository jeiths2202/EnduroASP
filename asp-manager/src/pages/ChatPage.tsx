import React from 'react';
import ChatInterface from '../components/ChatInterface';

interface ChatPageProps {
  isDarkMode: boolean;
}

const ChatPage: React.FC<ChatPageProps> = ({ isDarkMode }) => {
  return (
    <div className="h-full flex flex-col">
      <ChatInterface isDarkMode={isDarkMode} />
    </div>
  );
};

export default ChatPage;