// Simple enhanced RAG service
import { DocumentChunk, RAGResponse, ragService } from './ragService';

export class EnhancedRagService {
  async initialize(): Promise<void> {
    await ragService.initialize();
  }

  async generateResponse(query: string, language: 'ko' | 'ja'): Promise<RAGResponse> {
    return ragService.generateResponse(query, language);
  }

  async addDocument(content: string, metadata: any, language: 'ko' | 'ja'): Promise<void> {
    return ragService.addDocument(content, metadata, language);
  }

  async getAllDocuments(): Promise<DocumentChunk[]> {
    return ragService.getAllDocuments();
  }
}

export const enhancedRagService = new EnhancedRagService();