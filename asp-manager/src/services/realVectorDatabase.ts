// Simple vector database without TensorFlow.js complexity
import { DocumentChunk } from './ragService';

export interface VectorEmbedding {
  id: string;
  vector: number[];
  metadata: {
    documentId: string;
    chunkIndex: number;
    text: string;
    language: 'ko' | 'ja';
    source: string;
    section?: string;
    timestamp: Date;
  };
}

export interface VectorSearchResult {
  embedding: VectorEmbedding;
  similarity: number;
  distance: number;
  chunk: DocumentChunk;
  score: number;
}

export class SimpleVectorDatabase {
  private embeddings: Map<string, VectorEmbedding> = new Map();
  private isInitialized = false;

  async initialize(): Promise<void> {
    if (this.isInitialized) {
      console.log('📦 Simple vector database already initialized');
      return;
    }

    console.log('✅ Simple vector database initialized (no TensorFlow.js)');
    this.isInitialized = true;
  }

  async addDocument(document: DocumentChunk): Promise<void> {
    const id = `${document.id}_0`;
    
    // Create simple embedding based on text length and content hash
    const vector = this.createSimpleEmbedding(document.content);
    
    const vectorEmbedding: VectorEmbedding = {
      id,
      vector,
      metadata: {
        documentId: document.id,
        chunkIndex: 0,
        text: document.content,
        language: document.metadata.language,
        source: document.metadata.source,
        section: document.metadata.section,
        timestamp: new Date()
      }
    };

    this.embeddings.set(id, vectorEmbedding);
    console.log(`✅ Document added to simple vector database: ${id}`);
  }

  async search(query: string, options: {
    topK?: number;
    threshold?: number;
    language?: 'ko' | 'ja' | 'all';
  } = {}): Promise<VectorSearchResult[]> {
    if (this.embeddings.size === 0) {
      console.log('🔍 Vector database is empty');
      return [];
    }

    const { topK = 5, threshold = 0.3, language = 'all' } = options;
    const queryVector = this.createSimpleEmbedding(query);

    const similarities: { embedding: VectorEmbedding; similarity: number }[] = [];

    Array.from(this.embeddings.values()).forEach(embedding => {
      if (language !== 'all' && embedding.metadata.language !== language) {
        return;
      }

      const similarity = this.calculateSimilarity(queryVector, embedding.vector);
      if (similarity >= threshold) {
        similarities.push({ embedding, similarity });
      }
    });

    similarities.sort((a, b) => b.similarity - a.similarity);
    const topResults = similarities.slice(0, topK);

    return topResults.map(({ embedding, similarity }) => ({
      embedding,
      similarity,
      distance: 1 - similarity,
      chunk: {
        id: embedding.metadata.documentId,
        content: embedding.metadata.text,
        metadata: {
          source: embedding.metadata.source,
          section: embedding.metadata.section,
          language: embedding.metadata.language
        }
      },
      score: similarity
    }));
  }

  private createSimpleEmbedding(text: string): number[] {
    // Create a simple 16-dimensional embedding based on text features
    const vector = new Array(16).fill(0);
    const words = text.toLowerCase().split(/\s+/);
    
    // Basic features: length, word count, character frequencies
    vector[0] = Math.min(text.length / 1000, 1); // normalized length
    vector[1] = Math.min(words.length / 100, 1); // normalized word count
    
    // Character frequency features
    const chars = 'abcdefghijklmnopqrstuvwxyz가나다라마바사아자차카타파하';
    for (let i = 0; i < 14 && i < chars.length; i++) {
      const char = chars[i];
      const freq = (text.toLowerCase().match(new RegExp(char, 'g')) || []).length;
      vector[i + 2] = Math.min(freq / text.length, 1);
    }
    
    return vector;
  }

  private calculateSimilarity(vectorA: number[], vectorB: number[]): number {
    if (vectorA.length !== vectorB.length) {
      return 0;
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < vectorA.length; i++) {
      dotProduct += vectorA[i] * vectorB[i];
      normA += vectorA[i] * vectorA[i];
      normB += vectorB[i] * vectorB[i];
    }

    normA = Math.sqrt(normA);
    normB = Math.sqrt(normB);

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (normA * normB);
  }

  getStatus() {
    return {
      isInitialized: this.isInitialized,
      totalEmbeddings: this.embeddings.size,
      backend: 'simple'
    };
  }

  clear(): void {
    this.embeddings.clear();
    console.log('🗑️ Simple vector database cleared');
  }

  dispose(): void {
    this.embeddings.clear();
    this.isInitialized = false;
    console.log('🧹 Simple vector database cleared');
  }
}

// Export a singleton instance
export const simpleVectorDatabase = new SimpleVectorDatabase();