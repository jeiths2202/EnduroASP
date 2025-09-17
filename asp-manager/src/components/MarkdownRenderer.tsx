import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
// @ts-ignore
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
// @ts-ignore
import { vscDarkPlus, vs } from 'react-syntax-highlighter/dist/esm/styles/prism';

interface MarkdownRendererProps {
  content: string;
  isDarkMode: boolean;
}

const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content, isDarkMode }) => {
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
        // コードブロックのカスタムレンダリング
        code({ node, inline, className, children, ...props }: any) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : '';
          
          if (!inline && language) {
            return (
              <div className="relative group">
                <div className="absolute top-0 right-0 px-2 py-1 text-xs text-gray-400 dark:text-gray-600">
                  {language}
                </div>
                <SyntaxHighlighter
                  style={isDarkMode ? vscDarkPlus : vs}
                  language={language}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: '0.375rem',
                    fontSize: '0.875rem',
                  }}
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          }
          
          return (
            <code className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-sm font-mono" {...props}>
              {children}
            </code>
          );
        },
        // テーブルのカスタムスタイリング
        table({ children }) {
          return (
            <div className="overflow-x-auto my-4">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                {children}
              </table>
            </div>
          );
        },
        thead({ children }) {
          return (
            <thead className="bg-gray-50 dark:bg-gray-800">
              {children}
            </thead>
          );
        },
        th({ children }) {
          return (
            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
              {children}
            </th>
          );
        },
        td({ children }) {
          return (
            <td className="px-4 py-2 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
              {children}
            </td>
          );
        },
        // リンクのカスタムスタイリング
        a({ href, children }) {
          return (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              {children}
            </a>
          );
        },
        // 画像のカスタムスタイリング
        img({ src, alt }) {
          return (
            <img
              src={src}
              alt={alt}
              className="rounded-lg shadow-md max-w-full h-auto my-4"
            />
          );
        },
        // ブロッククォートのカスタムスタイリング
        blockquote({ children }) {
          return (
            <blockquote className="border-l-4 border-gray-300 dark:border-gray-700 pl-4 my-4 italic text-gray-700 dark:text-gray-300">
              {children}
            </blockquote>
          );
        },
      }}
    >
      {content}
    </ReactMarkdown>
    </div>
  );
};

export default MarkdownRenderer;