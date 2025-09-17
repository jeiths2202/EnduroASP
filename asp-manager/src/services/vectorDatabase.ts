// 고급 벡터 데이터베이스 구현
import { DocumentChunk } from './ragService';

// 벡터 임베딩 인터페이스
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

// 검색 결과 인터페이스
export interface VectorSearchResult {
  embedding: VectorEmbedding;
  similarity: number;
  distance: number;
}

// 벡터 임베딩 생성기 (실제 환경에서는 OpenAI API 사용)
class EmbeddingGenerator {
  private readonly dimension = 384; // Sentence-BERT 호환 차원
  
  // 텍스트를 벡터로 변환 (계산 집약적 임베딩)
  async generateEmbedding(text: string, language: 'ko' | 'ja'): Promise<number[]> {
    console.log(`🧮 벡터 임베딩 생성 중... (${text.substring(0, 50)}...)`);
    const startTime = Date.now();
    
    // 텍스트 전처리
    const normalizedText = this.normalizeText(text, language);
    const tokens = this.tokenize(normalizedText, language);
    
    // 계산 집약적 작업들
    const termWeights = this.calculateTermWeights(tokens);
    const contextMatrix = this.buildContextMatrix(tokens, language);
    const semanticFeatures = this.extractSemanticFeatures(tokens, language);
    
    // 다층 벡터 생성 (더 복잡한 계산)
    const baseVector = this.createSemanticVector(tokens, termWeights, language);
    const contextVector = this.applyContextualTransforms(baseVector, contextMatrix);
    const finalVector = this.enhanceWithSemanticFeatures(contextVector, semanticFeatures);
    
    // 추가 정제 과정 (CPU 사용량 증가를 위한 계산)
    const refinedVector = await this.performVectorRefinement(finalVector, tokens, language);
    
    const processingTime = Date.now() - startTime;
    console.log(`✅ 벡터 임베딩 완료 (${processingTime}ms, 차원: ${refinedVector.length})`);
    
    return this.normalizeVector(refinedVector);
  }
  
  private normalizeText(text: string, language: 'ko' | 'ja'): string {
    // 언어별 정규화
    let normalized = text.toLowerCase();
    
    if (language === 'ko') {
      // 한국어 정규화: 조사 제거, 어간 추출 시뮬레이션
      normalized = normalized
        .replace(/[은는이가을를에서로부터까지와과]/g, ' ')
        .replace(/습니다|ㅂ니다|입니다/g, '')
        .replace(/했다|한다|하다/g, '하');
    } else if (language === 'ja') {
      // 일본어 정규화: 조사 제거, 어미 정규화
      normalized = normalized
        .replace(/[はがをにでからまでとや]/g, ' ')
        .replace(/です|ます|だ|である/g, '')
        .replace(/した|する|される/g, 'する');
    }
    
    return normalized.replace(/\s+/g, ' ').trim();
  }
  
  private tokenize(text: string, language: 'ko' | 'ja'): string[] {
    // 언어별 토큰화
    if (language === 'ko') {
      // 한국어: 형태소 분석 시뮬레이션
      return text.split(/\s+/)
        .filter(token => token.length > 1)
        .flatMap(token => this.extractKoreanMorphemes(token));
    } else {
      // 일본어: 형태소 분석 시뮬레이션
      return text.split(/\s+/)
        .filter(token => token.length > 1)
        .flatMap(token => this.extractJapaneseMorphemes(token));
    }
  }
  
  private extractKoreanMorphemes(word: string): string[] {
    // 간단한 한국어 형태소 분석 시뮬레이션
    const morphemes = [];
    
    // 복합어 분해 시뮬레이션
    if (word.includes('관리')) {
      morphemes.push('관리');
    }
    if (word.includes('시스템')) {
      morphemes.push('시스템');
    }
    if (word.includes('데이터베이스')) {
      morphemes.push('데이터베이스', 'DB');
    }
    
    morphemes.push(word);
    return morphemes;
  }
  
  private extractJapaneseMorphemes(word: string): string[] {
    // 간단한 일본어 형태소 분석 시뮬레이션
    const morphemes = [];
    
    // 복합어 분해 시뮬레이션
    if (word.includes('システム')) {
      morphemes.push('システム');
    }
    if (word.includes('データベース')) {
      morphemes.push('データベース', 'DB');
    }
    if (word.includes('パスワード')) {
      morphemes.push('パスワード', 'パス');
    }
    
    morphemes.push(word);
    return morphemes;
  }
  
  private calculateTermWeights(tokens: string[]): Map<string, number> {
    const termCount = new Map<string, number>();
    const weights = new Map<string, number>();
    
    // 용어 빈도 계산
    tokens.forEach(token => {
      const count = termCount.get(token) || 0;
      termCount.set(token, count + 1);
    });
    
    // TF 가중치 계산 (로그 스케일링)
    const maxCount = Math.max(...Array.from(termCount.values()));
    termCount.forEach((count, term) => {
      const tf = 0.5 + 0.5 * (count / maxCount);
      weights.set(term, tf);
    });
    
    return weights;
  }
  
  private createSemanticVector(tokens: string[], weights: Map<string, number>, language: 'ko' | 'ja'): number[] {
    const vector = new Array(this.dimension).fill(0);
    
    tokens.forEach(token => {
      const weight = weights.get(token) || 0;
      const hash = this.stringToHash(token + language);
      
      // 해시를 이용한 분산 표현
      for (let i = 0; i < this.dimension; i++) {
        const feature = Math.sin((hash + i) * 0.1) * weight;
        vector[i] += feature;
        
        // 의미적 특성 추가
        if (this.isImportantTerm(token)) {
          vector[i] += Math.cos((hash + i) * 0.05) * weight * 0.5;
        }
      }
    });
    
    return vector;
  }
  
  private isImportantTerm(token: string): boolean {
    // 중요한 용어 판별 (도메인 특화)
    const importantTerms = [
      'ASP', 'システム', '시스템', 'データベース', '데이터베이스',
      'ログイン', '로그인', 'パスワード', '비밀번호', 'エラー', '오류',
      '設定', '설정', '管理', '관리', 'API', 'セキュリティ', '보안'
    ];
    
    return importantTerms.some(term => 
      token.includes(term.toLowerCase()) || term.toLowerCase().includes(token)
    );
  }
  
  private stringToHash(str: string): number {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // 32bit 정수로 변환
    }
    return Math.abs(hash);
  }
  
  // 컨텍스트 매트릭스 구성 (계산 집약적)
  private buildContextMatrix(tokens: string[], language: 'ko' | 'ja'): number[][] {
    const matrixSize = Math.min(tokens.length, 50); // 최대 50x50 매트릭스
    const matrix: number[][] = [];
    
    for (let i = 0; i < matrixSize; i++) {
      matrix[i] = [];
      for (let j = 0; j < matrixSize; j++) {
        // 토큰 간 의미적 거리 계산 (시뮬레이션)
        const token1 = tokens[i] || '';
        const token2 = tokens[j] || '';
        const similarity = this.calculateTokenSimilarity(token1, token2, language);
        
        // 거리 변환 및 가중치 적용
        matrix[i][j] = Math.exp(-similarity * 0.5) * Math.random() * 0.3;
      }
    }
    
    return matrix;
  }
  
  // 의미적 특성 추출 (계산 집약적)
  private extractSemanticFeatures(tokens: string[], language: 'ko' | 'ja'): number[] {
    const features: number[] = new Array(this.dimension).fill(0);
    
    // 각 토큰에 대해 복잡한 특성 계산
    tokens.forEach((token, index) => {
      const tokenHash = this.stringToHash(token);
      
      // 여러 특성 레이어 계산
      for (let layer = 0; layer < 5; layer++) {
        for (let dim = 0; dim < this.dimension; dim++) {
          const featureValue = Math.sin((tokenHash + dim + layer) * 0.01) * 
                              Math.cos((index + dim + layer) * 0.02) *
                              Math.exp(-layer * 0.1);
          features[dim] += featureValue;
        }
      }
    });
    
    return features;
  }
  
  // 컨텍스트 변환 적용 (계산 집약적)
  private applyContextualTransforms(baseVector: number[], contextMatrix: number[][]): number[] {
    const transformed = [...baseVector];
    const matrixSize = contextMatrix.length;
    
    // 매트릭스 곱셈 시뮬레이션
    for (let i = 0; i < Math.min(this.dimension, matrixSize); i++) {
      let sum = 0;
      for (let j = 0; j < matrixSize; j++) {
        sum += baseVector[j % this.dimension] * contextMatrix[i][j];
      }
      transformed[i] = (transformed[i] + sum * 0.3) * 0.7;
    }
    
    return transformed;
  }
  
  // 의미적 특성으로 벡터 강화 (계산 집약적)
  private enhanceWithSemanticFeatures(vector: number[], semanticFeatures: number[]): number[] {
    const enhanced = [...vector];
    
    for (let i = 0; i < this.dimension; i++) {
      // 비선형 변환 적용
      const originalValue = vector[i];
      const semanticValue = semanticFeatures[i];
      
      enhanced[i] = originalValue * 0.7 + semanticValue * 0.3 + 
                    Math.tanh(originalValue + semanticValue) * 0.1;
    }
    
    return enhanced;
  }
  
  // 벡터 정제 과정 (매우 계산 집약적)
  private async performVectorRefinement(vector: number[], tokens: string[], language: 'ko' | 'ja'): Promise<number[]> {
    const refined = [...vector];
    
    // 여러 라운드의 정제 수행
    for (let round = 0; round < 3; round++) {
      console.log(`🔄 벡터 정제 라운드 ${round + 1}/3`);
      
      // 각 차원에 대해 복잡한 계산 수행
      for (let dim = 0; dim < this.dimension; dim++) {
        let refinementValue = 0;
        
        // 토큰별 기여도 계산
        tokens.forEach((token, tokenIndex) => {
          const tokenWeight = this.calculateTokenWeight(token, language);
          const positionWeight = Math.exp(-tokenIndex * 0.1);
          const dimensionWeight = Math.sin((dim + tokenIndex) * 0.05);
          
          refinementValue += tokenWeight * positionWeight * dimensionWeight;
        });
        
        // 비선형 활성화 함수 적용
        refined[dim] = Math.tanh(refined[dim] + refinementValue * 0.1);
      }
      
      // 라운드 간 짧은 지연 (CPU 사용량 시뮬레이션)
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    return refined;
  }
  
  // 토큰 유사도 계산
  private calculateTokenSimilarity(token1: string, token2: string, language: 'ko' | 'ja'): number {
    if (token1 === token2) return 1.0;
    
    // 문자 기반 유사도
    const charSimilarity = this.calculateCharacterSimilarity(token1, token2);
    
    // 의미적 유사도 (간단한 시뮬레이션)
    const semanticSimilarity = this.calculateSemanticSimilarity(token1, token2, language);
    
    return (charSimilarity * 0.4 + semanticSimilarity * 0.6);
  }
  
  // 문자 유사도 계산
  private calculateCharacterSimilarity(str1: string, str2: string): number {
    const len1 = str1.length;
    const len2 = str2.length;
    const maxLen = Math.max(len1, len2);
    
    if (maxLen === 0) return 1.0;
    
    let matches = 0;
    for (let i = 0; i < Math.min(len1, len2); i++) {
      if (str1[i] === str2[i]) matches++;
    }
    
    return matches / maxLen;
  }
  
  // 의미적 유사도 계산
  private calculateSemanticSimilarity(token1: string, token2: string, language: 'ko' | 'ja'): number {
    // 도메인 특화 유사어 그룹
    const similarityGroups = language === 'ko' ? [
      ['시스템', '체계', '구조'],
      ['관리', '운영', '제어'],
      ['오류', '에러', '문제'],
      ['설정', '구성', '환경'],
      ['사용자', '유저', '계정']
    ] : [
      ['システム', '体系', '構造'],
      ['管理', '運営', '制御'],
      ['エラー', '誤り', '問題'],
      ['設定', '構成', '環境'],
      ['ユーザー', '利用者', 'アカウント']
    ];
    
    for (const group of similarityGroups) {
      if (group.includes(token1) && group.includes(token2)) {
        return 0.8;
      }
    }
    
    return 0.1;
  }
  
  // 토큰 가중치 계산
  private calculateTokenWeight(token: string, language: 'ko' | 'ja'): number {
    if (this.isImportantTerm(token)) {
      return 1.5;
    }
    
    // 토큰 길이 기반 가중치
    const lengthWeight = Math.min(token.length / 10, 1.0);
    
    // 언어별 특수 가중치
    const languageWeight = language === 'ko' ? 
      (token.match(/[가-힣]/g) || []).length / token.length :
      (token.match(/[ひらがなカタカナ漢字]/g) || []).length / token.length;
    
    return 0.5 + lengthWeight * 0.3 + languageWeight * 0.2;
  }
  
  private normalizeVector(vector: number[]): number[] {
    // L2 정규화
    const magnitude = Math.sqrt(vector.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude === 0) {
      return vector.map(() => 0);
    }
    
    return vector.map(val => val / magnitude);
  }
}

// 메모리 기반 벡터 데이터베이스
export class VectorDatabase {
  private embeddings: Map<string, VectorEmbedding> = new Map();
  private generator: EmbeddingGenerator = new EmbeddingGenerator();
  private indexByLanguage: Map<string, VectorEmbedding[]> = new Map();
  
  // 문서 추가 및 인덱싱
  async addDocument(document: DocumentChunk): Promise<void> {
    console.log(`벡터 데이터베이스에 문서 추가 중: ${document.metadata.source}`);
    
    try {
      // 문서를 청크로 분할 (실제로는 더 정교한 청크 전략 사용)
      const chunks = this.chunkDocument(document);
      
      for (let i = 0; i < chunks.length; i++) {
        const chunk = chunks[i];
        const embeddingId = `${document.id}_chunk_${i}`;
        
        // 벡터 임베딩 생성
        const vector = await this.generator.generateEmbedding(
          chunk, 
          document.metadata.language
        );
        
        const embedding: VectorEmbedding = {
          id: embeddingId,
          vector: vector,
          metadata: {
            documentId: document.id,
            chunkIndex: i,
            text: chunk,
            language: document.metadata.language,
            source: document.metadata.source,
            section: document.metadata.section,
            timestamp: new Date()
          }
        };
        
        this.embeddings.set(embeddingId, embedding);
        
        // 언어별 인덱스 구축
        const langKey = document.metadata.language;
        if (!this.indexByLanguage.has(langKey)) {
          this.indexByLanguage.set(langKey, []);
        }
        this.indexByLanguage.get(langKey)!.push(embedding);
      }
      
      console.log(`문서 인덱싱 완료: ${chunks.length}개 청크 생성`);
    } catch (error) {
      console.error(`문서 인덱싱 오류: ${document.metadata.source}`, error);
    }
  }
  
  // 문서 청킹 (의미 단위 분할)
  private chunkDocument(document: DocumentChunk): string[] {
    const text = document.content;
    const maxChunkSize = 300; // 최대 청크 크기
    const overlapSize = 50;   // 청크 간 겹침
    
    // 문장 단위로 분할
    const sentences = text.split(/[.。!?！？\n]+/).filter(s => s.trim().length > 10);
    
    const chunks: string[] = [];
    let currentChunk = '';
    let sentenceBuffer: string[] = [];
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      if (!trimmedSentence) continue;
      
      // 현재 청크에 문장 추가 시 크기 확인
      const potentialChunk = currentChunk + (currentChunk ? '. ' : '') + trimmedSentence;
      
      if (potentialChunk.length <= maxChunkSize) {
        currentChunk = potentialChunk;
        sentenceBuffer.push(trimmedSentence);
      } else {
        // 현재 청크 완성
        if (currentChunk) {
          chunks.push(currentChunk);
        }
        
        // 새 청크 시작 (겹침 적용)
        const overlapSentences = sentenceBuffer.slice(-Math.ceil(overlapSize / 50));
        currentChunk = overlapSentences.concat([trimmedSentence]).join('. ');
        sentenceBuffer = overlapSentences.concat([trimmedSentence]);
      }
    }
    
    // 마지막 청크 추가
    if (currentChunk) {
      chunks.push(currentChunk);
    }
    
    return chunks.length > 0 ? chunks : [text]; // 최소 1개 청크 보장
  }
  
  // 벡터 유사도 검색
  async search(query: string, language: 'ko' | 'ja', limit: number = 10): Promise<VectorSearchResult[]> {
    console.log(`🔍 벡터 검색 실행: "${query}" (${language})`);
    
    try {
      // 쿼리 벡터 생성
      const queryVector = await this.generator.generateEmbedding(query, language);
      
      // 언어별 후보 임베딩 선택
      const candidates = this.getCandidateEmbeddings(language);
      console.log(`📊 검색 후보: ${candidates.length}개 임베딩`);
      
      // 코사인 유사도 계산
      const results: VectorSearchResult[] = [];
      
      for (const embedding of candidates) {
        const similarity = this.calculateCosineSimilarity(queryVector, embedding.vector);
        const distance = 1 - similarity; // 거리는 1 - 유사도
        
        console.log(`📄 문서 "${embedding.metadata.text.substring(0, 50)}..." 유사도: ${similarity.toFixed(3)}`);
        
        // 임계값 필터링 (더 낮은 임계값으로 변경)
        if (similarity > 0.1) { // 최소 유사도 임계값 낮춤
          results.push({
            embedding,
            similarity,
            distance
          });
        }
      }
      
      // 유사도 기준 정렬
      results.sort((a, b) => b.similarity - a.similarity);
      
      console.log(`벡터 검색 완료: ${results.length}개 결과 중 상위 ${limit}개 반환`);
      return results.slice(0, limit);
      
    } catch (error) {
      console.error('벡터 검색 오류:', error);
      return [];
    }
  }
  
  // 후보 임베딩 선택 (언어 기반 + 하이브리드)
  private getCandidateEmbeddings(language: 'ko' | 'ja'): VectorEmbedding[] {
    const primaryCandidates = this.indexByLanguage.get(language) || [];
    const secondaryCandidates = this.indexByLanguage.get(language === 'ko' ? 'ja' : 'ko') || [];
    
    // 주 언어 70% + 보조 언어 30% 비율로 검색
    const primaryCount = Math.ceil(primaryCandidates.length * 0.7);
    const secondaryCount = Math.floor(secondaryCandidates.length * 0.3);
    
    return [
      ...primaryCandidates.slice(0, primaryCount),
      ...secondaryCandidates.slice(0, secondaryCount)
    ];
  }
  
  // 코사인 유사도 계산
  private calculateCosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('벡터 차원이 일치하지 않습니다');
    }
    
    let dotProduct = 0;
    let magnitude1 = 0;
    let magnitude2 = 0;
    
    for (let i = 0; i < vector1.length; i++) {
      dotProduct += vector1[i] * vector2[i];
      magnitude1 += vector1[i] * vector1[i];
      magnitude2 += vector2[i] * vector2[i];
    }
    
    magnitude1 = Math.sqrt(magnitude1);
    magnitude2 = Math.sqrt(magnitude2);
    
    if (magnitude1 === 0 || magnitude2 === 0) {
      return 0;
    }
    
    return dotProduct / (magnitude1 * magnitude2);
  }
  
  // 데이터베이스 통계 정보
  getStats(): { totalEmbeddings: number; byLanguage: Record<string, number> } {
    const stats = {
      totalEmbeddings: this.embeddings.size,
      byLanguage: {} as Record<string, number>
    };
    
    this.indexByLanguage.forEach((embeddings, language) => {
      stats.byLanguage[language] = embeddings.length;
    });
    
    return stats;
  }
  
  // 디버그: 모든 저장된 임베딩 정보 출력
  debugPrintAllEmbeddings(): void {
    console.log('=== 벡터 DB 디버그 정보 ===');
    console.log(`총 임베딩 수: ${this.embeddings.size}`);
    
    let count = 0;
    this.embeddings.forEach((embedding, id) => {
      count++;
      console.log(`\n[임베딩 ${count}] ID: ${id}`);
      console.log(`- 문서 ID: ${embedding.metadata.documentId}`);
      console.log(`- 청크 인덱스: ${embedding.metadata.chunkIndex}`);
      console.log(`- 언어: ${embedding.metadata.language}`);
      console.log(`- 소스: ${embedding.metadata.source}`);
      console.log(`- 섹션: ${embedding.metadata.section}`);
      console.log(`- 텍스트 (처음 200자): ${embedding.metadata.text.substring(0, 200)}...`);
      console.log(`- 벡터 차원: ${embedding.vector.length}`);
      console.log(`- 벡터 샘플 (처음 5개): [${embedding.vector.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);
    });
    
    console.log('\n=== 언어별 인덱스 ===');
    this.indexByLanguage.forEach((embeddings, language) => {
      console.log(`${language}: ${embeddings.length}개 임베딩`);
    });
  }
  
  // 디버그: 특정 쿼리에 대한 상세 검색 정보
  async debugSearch(query: string, language: 'ko' | 'ja'): Promise<void> {
    console.log(`\n=== 벡터 검색 디버그: "${query}" (${language}) ===`);
    
    // 쿼리 벡터 생성
    const queryVector = await this.generator.generateEmbedding(query, language);
    console.log(`쿼리 벡터 생성됨 (차원: ${queryVector.length})`);
    console.log(`쿼리 벡터 샘플: [${queryVector.slice(0, 5).map(v => v.toFixed(3)).join(', ')}...]`);
    
    // 모든 임베딩과의 유사도 계산
    const allResults: { embedding: VectorEmbedding; similarity: number }[] = [];
    
    this.embeddings.forEach((embedding) => {
      const similarity = this.calculateCosineSimilarity(queryVector, embedding.vector);
      allResults.push({ embedding, similarity });
    });
    
    // 유사도 순으로 정렬
    allResults.sort((a, b) => b.similarity - a.similarity);
    
    console.log(`\n전체 ${allResults.length}개 임베딩과의 유사도 결과:`);
    allResults.slice(0, 10).forEach((result, index) => {
      console.log(`\n[Top ${index + 1}] 유사도: ${result.similarity.toFixed(4)}`);
      console.log(`- 언어: ${result.embedding.metadata.language}`);
      console.log(`- 소스: ${result.embedding.metadata.source}`);
      console.log(`- 텍스트: ${result.embedding.metadata.text.substring(0, 150)}...`);
    });
  }
  
  // 데이터베이스 초기화
  clear(): void {
    this.embeddings.clear();
    this.indexByLanguage.clear();
    console.log('벡터 데이터베이스가 초기화되었습니다');
  }
}

// 싱글톤 인스턴스
export const vectorDatabase = new VectorDatabase();