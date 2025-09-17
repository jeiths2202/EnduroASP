export interface DocumentChunk {
  id: string;
  content: string;
  metadata: {
    source: string;
    page?: number;
    section?: string;
    language: 'ko' | 'ja';
  };
}

export interface SearchResult {
  chunk: DocumentChunk;
  score: number;
}

export interface RAGResponse {
  answer: string;
  sources: SearchResult[];
  language: 'ko' | 'ja';
}

class RAGService {
  private documents: DocumentChunk[] = [];
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Simple RAG service with basic document storage
    this.documents = [];
    
    this.initialized = true;
    console.log('✅ RAG 서비스 초기화 완료');
  }

  private calculateSimilarity(query: string, content: string): number {
    const queryWords = query.toLowerCase().split(/\s+/);
    const contentWords = content.toLowerCase().split(/\s+/);
    
    let matches = 0;
    queryWords.forEach(queryWord => {
      if (contentWords.some(contentWord => 
        contentWord.includes(queryWord) || queryWord.includes(contentWord)
      )) {
        matches++;
      }
    });
    
    return matches / queryWords.length;
  }

  async searchDocuments(query: string, language: 'ko' | 'ja'): Promise<SearchResult[]> {
    await this.initialize();

    const results: SearchResult[] = [];

    this.documents.forEach(doc => {
      const score = this.calculateSimilarity(query, doc.content);
      if (score > 0.1) {
        results.push({
          chunk: doc,
          score: score
        });
      }
    });

    results.sort((a, b) => b.score - a.score);
    return results.slice(0, 3);
  }

  async generateResponse(query: string, language: 'ko' | 'ja'): Promise<RAGResponse> {
    const searchResults = await this.searchDocuments(query, language);

    if (searchResults.length === 0) {
      const noResultsMessage = language === 'ko' 
        ? '죄송합니다. 해당 질문에 대한 정보를 ASP 매뉴얼에서 찾을 수 없습니다.'
        : '申し訳ございません。その質問に関する情報をASPマニュアルで見つけることができませんでした。';
      
      return {
        answer: noResultsMessage,
        sources: [],
        language: language
      };
    }

    const relevantContent = searchResults.map(result => result.chunk.content).join('\n\n');
    
    const responseIntro = language === 'ko'
      ? 'ASP 매뉴얼을 검색한 결과:\n\n'
      : 'ASPマニュアルを検索した結果：\n\n';

    const answer = responseIntro + relevantContent;

    return {
      answer: answer,
      sources: searchResults,
      language: language
    };
  }

  async addDocument(content: string, metadata: Omit<DocumentChunk['metadata'], 'language'>, language: 'ko' | 'ja'): Promise<void> {
    const newDoc: DocumentChunk = {
      id: Date.now().toString(),
      content: content,
      metadata: {
        ...metadata,
        language: language
      }
    };

    this.documents.push(newDoc);
  }

  async getAllDocuments(): Promise<DocumentChunk[]> {
    await this.initialize();
    return this.documents;
  }
}

export const ragService = new RAGService();