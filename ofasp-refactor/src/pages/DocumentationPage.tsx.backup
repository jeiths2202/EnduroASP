import React, { useState, useEffect } from 'react';
import MarkdownRenderer from '../components/MarkdownRenderer';
import PdfConverter from '../components/PdfConverter';
import { useI18n } from '../hooks/useI18n';
import {
  DocumentTextIcon,
  BookOpenIcon,
  CodeBracketIcon,
  ArrowPathIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  FolderOpenIcon,
  CommandLineIcon,
  DocumentArrowDownIcon
} from '@heroicons/react/24/outline';

interface DocumentationPageProps {
  isDarkMode: boolean;
}

interface DocumentItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  file?: string;
  children?: DocumentItem[];
}

const DocumentationPage: React.FC<DocumentationPageProps> = ({ isDarkMode }) => {
  const { t } = useI18n();
  const [selectedDoc, setSelectedDoc] = useState<string>('cobol-to-java');
  const [docContent, setDocContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set(['command-reference', 'cobol-refactoring', 'manual']));

  // ドキュメント選択時の処理
  const handleDocumentSelect = (id: string, hasChildren: boolean) => {
    if (hasChildren) {
      // 子要素がある場合は展開/折りたたみ
      const newExpandedItems = new Set(expandedItems);
      if (expandedItems.has(id)) {
        newExpandedItems.delete(id);
      } else {
        newExpandedItems.add(id);
      }
      setExpandedItems(newExpandedItems);
    } else {
      // 子要素がない場合は選択
      setSelectedDoc(id);
    }
  };

  // ドキュメントを再帰的に検索
  const findDocumentById = (items: DocumentItem[], id: string): DocumentItem | null => {
    for (const item of items) {
      if (item.id === id) {
        return item;
      }
      if (item.children) {
        const found = findDocumentById(item.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  // ドキュメント一覧
  const documentList = [
    {
      id: 'command-reference',
      title: 'コマンドレファレンス',
      icon: <CodeBracketIcon className="w-5 h-5" />,
      children: [
        {
          id: 'cobol-refactoring',
          title: 'COBOLリファクタリング',
          icon: <CodeBracketIcon className="w-5 h-5" />,
          children: [
            {
              id: 'cobol-to-java',
              title: 'COBOL TO JAVA',
              icon: <CodeBracketIcon className="w-5 h-5" />,
              file: 'COBOL_TO_JAVA.md'
            },
            {
              id: 'cobol-to-c',
              title: 'COBOL TO C',
              icon: <CodeBracketIcon className="w-5 h-5" />,
              file: 'COBOL_TO_C.md'
            },
            {
              id: 'cobol-to-shell',
              title: 'COBOL TO SHELL',
              icon: <CodeBracketIcon className="w-5 h-5" />,
              file: 'COBOL_TO_SHELL.md'
            },
            {
              id: 'cobol-to-python',
              title: 'COBOL TO Python',
              icon: <CodeBracketIcon className="w-5 h-5" />,
              file: 'COBOL_TO_PYTHON.md'
            }
          ]
        },
        {
          id: 'cl-refactoring',
          title: 'CLリファクタリング',
          icon: <CommandLineIcon className="w-5 h-5" />,
          children: [
            {
              id: 'cl-to-shell',
              title: 'CL TO SHELL',
              icon: <CommandLineIcon className="w-5 h-5" />,
              file: 'CL_TO_SHELL.md'
            },
            {
              id: 'cl-to-javascript',
              title: 'CL TO JavaScript',
              icon: <CommandLineIcon className="w-5 h-5" />,
              file: 'CL_TO_JAVASCRIPT.md'
            },
            {
              id: 'cl-to-python',
              title: 'CL TO Python',
              icon: <CommandLineIcon className="w-5 h-5" />,
              file: 'CL_TO_PYTHON.md'
            }
          ]
        }
      ]
    },
    {
      id: 'manual',
      title: 'マニュアル',
      icon: <DocumentTextIcon className="w-5 h-5" />,
      children: [
        {
          id: 'command-mapping',
          title: 'OpenASPコマンドマッピング',
          icon: <CommandLineIcon className="w-5 h-5" />,
          file: 'openASP-command-mapping.html'
        },
        {
          id: 'asp-system-commands',
          title: 'ASPシステムコマンド一覧',
          icon: <DocumentTextIcon className="w-5 h-5" />,
          file: 'asp_system_cmd.md'
        },
        {
          id: 'pdf-converter',
          title: 'PDF変換',
          icon: <DocumentArrowDownIcon className="w-5 h-5" />,
          file: '__pdf_converter__'
        }
      ]
    }
  ];

  // ドキュメント内容をロード
  useEffect(() => {
    const loadDocument = async () => {
      setIsLoading(true);
      try {
        const selectedDocInfo = findDocumentById(documentList, selectedDoc);
        if (selectedDocInfo) {
          if (selectedDocInfo.file && selectedDocInfo.file !== '__pdf_converter__') {
            // 実際のファイルから読み込む
            const content = await fetchDocumentContent(selectedDocInfo.file);
            setDocContent(content);
          } else if (selectedDocInfo.file === '__pdf_converter__') {
            // PDF変換コンポーネントの場合は何もしない
            setDocContent('');
          } else {
            // 파일이 없는 경우 기본 메시지 표시
            setDocContent(`# ${selectedDocInfo.title}\n\n이 섹션의 문서는 준비 중입니다.`);
          }
        }
      } catch (error) {
        console.error('Error loading document:', error);
        setDocContent('# エラー\nドキュメントの読み込みに失敗しました。');
      } finally {
        setIsLoading(false);
      }
    };

    loadDocument();
  }, [selectedDoc]);

  // ドキュメント内容を取得（実際のファイルからの読み込み）
  const fetchDocumentContent = async (filename: string): Promise<string> => {
    // 実際のファイルから読み込み
    try {
      // HTMLファイルの場合は特別処理
      if (filename.endsWith('.html')) {
        return `<iframe src="/${filename}" width="100%" height="800px" frameborder="0" style="border: none;"></iframe>`;
      }
      
      // マークダウンファイルの場合
      let response;
      if (filename === 'asp_system_cmd.md') {
        // publicディレクトリから読み込み
        response = await fetch(`/${filename}`);
      } else {
        // /docsディレクトリから読み込み
        response = await fetch(`/docs/${filename}`);
      }
      
      if (response.ok) {
        const content = await response.text();
        return content;
      }
    } catch (error) {
      console.error('Error fetching document:', error);
    }
    
    // フォールバック: ファイル読み込み失敗時 기본 내용 반환
    return `# ${filename}

ドキュメントファイル "${filename}" を読み込めませんでした。

ファイルが存在しない可能性があります。管理者にお問い合わせください。`;
  };

  // 再帰的なドキュメントアイテムレンダラー
  const renderDocumentItem = (item: DocumentItem, depth: number = 0) => {
    const isExpanded = expandedItems.has(item.id);
    const isSelected = selectedDoc === item.id;
    const hasChildren = Boolean(item.children && item.children.length > 0);
    const paddingLeft = depth * 20 + 12;

    return (
      <div key={item.id}>
        <button
          onClick={() => handleDocumentSelect(item.id, hasChildren)}
          className={`w-full flex items-center py-2 px-3 mb-1 rounded-lg transition-colors ${
            isSelected && !hasChildren
              ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300'
              : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
          }`}
          style={{ paddingLeft: `${paddingLeft}px` }}
        >
          {hasChildren ? (
            isExpanded ? (
              <ChevronDownIcon className="w-4 h-4 flex-shrink-0 mr-2" />
            ) : (
              <ChevronRightIcon className="w-4 h-4 flex-shrink-0 mr-2" />
            )
          ) : (
            <span className="w-6 h-4 flex-shrink-0 mr-2 flex items-center justify-center">
              {item.icon}
            </span>
          )}
          <span className="text-sm font-medium flex-1 text-left">{item.title}</span>
        </button>
        {hasChildren && isExpanded && (
          <div>
            {item.children!.map((child) => renderDocumentItem(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="h-full flex">
      {/* サイドバー */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center">
            <FolderOpenIcon className="w-5 h-5 mr-2" />
            ドキュメント
          </h2>
        </div>
        <nav className="p-2">
          {documentList.map((doc) => renderDocumentItem(doc))}
        </nav>
      </div>

      {/* メインコンテンツ */}
      <div className="flex-1 overflow-auto bg-white dark:bg-gray-900">
        {isLoading ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <ArrowPathIcon className="w-8 h-8 text-blue-500 animate-spin mx-auto mb-4" />
              <p className="text-gray-600 dark:text-gray-400">{t('common.loading')}</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full">
            {docContent.startsWith('<iframe') ? (
              // HTMLファイルの場合は直接HTMLとして表示
              <div 
                className="w-full h-full" 
                dangerouslySetInnerHTML={{ __html: docContent }}
              />
            ) : selectedDoc === 'pdf-converter' ? (
              // PDF変換コンポーネントの場合
              <PdfConverter isDarkMode={isDarkMode} />
            ) : (
              // マークダウンファイルの場合は従来通り
              <div className="max-w-4xl mx-auto p-8">
                <MarkdownRenderer content={docContent} isDarkMode={isDarkMode} />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentationPage;