// Chain-of-Thought 추론 시스템 구현
import { VectorSearchResult } from './realVectorDatabase';
import { DocumentChunk } from './ragService';

// 추론 단계 인터페이스
export interface ReasoningStep {
  step: number;
  type: 'analysis' | 'search' | 'synthesis' | 'validation' | 'conclusion';
  description: string;
  input: string;
  output: string;
  confidence: number;
  reasoning: string;
  metadata?: Record<string, any>;
}

// 추론 결과
export interface ChainOfThoughtResult {
  query: string;
  language: 'ko' | 'ja';
  steps: ReasoningStep[];
  finalAnswer: string;
  confidence: number;
  sources: VectorSearchResult[];
  processingTime: number;
  reasoning_chain: string;
}

// 질문 분석 결과
interface QueryAnalysis {
  intent: 'how_to' | 'what_is' | 'troubleshoot' | 'comparison' | 'procedure' | 'general';
  entities: string[];
  keywords: string[];
  complexity: 'simple' | 'medium' | 'complex';
  requiresMultiStep: boolean;
  domain: string[];
}

// Chain-of-Thought 추론 엔진
export class ChainOfThoughtReasoner {
  
  // 메인 추론 프로세스
  async reason(
    query: string, 
    language: 'ko' | 'ja',
    searchResults: VectorSearchResult[]
  ): Promise<ChainOfThoughtResult> {
    const startTime = Date.now();
    console.log(`🧠 Chain-of-Thought 추론 시작: "${query}"`);
    
    const steps: ReasoningStep[] = [];
    
    try {
      // Step 1: 질문 분석
      const analysis = await this.analyzeQuery(query, language);
      steps.push({
        step: 1,
        type: 'analysis',
        description: language === 'ko' ? '질문 의도 및 구조 분석' : '質問意図と構造の分析',
        input: query,
        output: JSON.stringify(analysis),
        confidence: 0.9,
        reasoning: this.explainAnalysis(analysis, language),
        metadata: { analysis }
      });
      
      // Step 2: 검색 결과 평가
      const evaluatedSources = await this.evaluateSearchResults(searchResults, analysis, language);
      steps.push({
        step: 2,
        type: 'search',
        description: language === 'ko' ? '검색 결과 관련성 평가' : '検索結果の関連性評価',
        input: `${searchResults.length}개 검색 결과`,
        output: `${evaluatedSources.length}개 관련 문서 선별`,
        confidence: 0.85,
        reasoning: this.explainSourceEvaluation(evaluatedSources, language),
        metadata: { selectedSources: evaluatedSources }
      });
      
      // Step 3: 정보 통합 및 추론
      const synthesizedInfo = await this.synthesizeInformation(evaluatedSources, analysis, language);
      steps.push({
        step: 3,
        type: 'synthesis',
        description: language === 'ko' ? '정보 통합 및 논리적 추론' : '情報統合と論理的推論',
        input: '선별된 문서 내용',
        output: '통합된 지식 베이스',
        confidence: 0.88,
        reasoning: this.explainSynthesis(synthesizedInfo, language),
        metadata: { synthesizedInfo }
      });
      
      // Step 4: 답변 검증
      const validation = await this.validateAnswer(synthesizedInfo, query, analysis, language);
      steps.push({
        step: 4,
        type: 'validation',
        description: language === 'ko' ? '답변 일관성 및 완성도 검증' : '回答の一貫性と完成度検証',
        input: '통합된 답변',
        output: '검증된 답변',
        confidence: validation.confidence,
        reasoning: this.explainValidation(validation, language),
        metadata: { validation }
      });
      
      // Step 5: 최종 답변 생성
      const finalAnswer = await this.generateFinalAnswer(synthesizedInfo, analysis, language, steps);
      steps.push({
        step: 5,
        type: 'conclusion',
        description: language === 'ko' ? '최종 답변 생성 및 포맷팅' : '最終回答生成とフォーマット',
        input: '검증된 정보',
        output: '사용자 친화적 답변',
        confidence: 0.92,
        reasoning: this.explainConclusion(finalAnswer, language),
        metadata: { finalAnswer }
      });
      
      // 전체 신뢰도 계산
      const overallConfidence = this.calculateOverallConfidence(steps);
      
      // 추론 체인 생성
      const reasoningChain = this.generateReasoningChain(steps, language);
      
      const result: ChainOfThoughtResult = {
        query,
        language,
        steps,
        finalAnswer,
        confidence: overallConfidence,
        sources: evaluatedSources,
        processingTime: Date.now() - startTime,
        reasoning_chain: reasoningChain
      };
      
      console.log(`✅ Chain-of-Thought 추론 완료 (${result.processingTime}ms, 신뢰도: ${Math.round(overallConfidence * 100)}%)`);
      return result;
      
    } catch (error) {
      console.error('❌ Chain-of-Thought 추론 오류:', error);
      
      // 오류 발생 시 기본 답변 생성
      const fallbackAnswer = language === 'ko'
        ? '죄송합니다. 질문을 처리하는 중에 오류가 발생했습니다. 다시 시도해주세요.'
        : '申し訳ございません。質問の処理中にエラーが発生しました。再度お試しください。';
      
      return {
        query,
        language,
        steps,
        finalAnswer: fallbackAnswer,
        confidence: 0.1,
        sources: [],
        processingTime: Date.now() - startTime,
        reasoning_chain: 'Error occurred during reasoning process'
      };
    }
  }
  
  // Step 1: 질문 분석
  private async analyzeQuery(query: string, language: 'ko' | 'ja'): Promise<QueryAnalysis> {
    const normalizedQuery = query.toLowerCase();
    
    // 의도 분석
    let intent: QueryAnalysis['intent'] = 'general';
    
    if (language === 'ko') {
      if (normalizedQuery.includes('어떻게') || normalizedQuery.includes('방법')) {
        intent = 'how_to';
      } else if (normalizedQuery.includes('무엇') || normalizedQuery.includes('뭐')) {
        intent = 'what_is';
      } else if (normalizedQuery.includes('문제') || normalizedQuery.includes('오류') || normalizedQuery.includes('안돼')) {
        intent = 'troubleshoot';
      } else if (normalizedQuery.includes('차이') || normalizedQuery.includes('비교')) {
        intent = 'comparison';
      } else if (normalizedQuery.includes('절차') || normalizedQuery.includes('순서')) {
        intent = 'procedure';
      }
    } else {
      if (normalizedQuery.includes('どうやって') || normalizedQuery.includes('方法')) {
        intent = 'how_to';
      } else if (normalizedQuery.includes('何') || normalizedQuery.includes('なに')) {
        intent = 'what_is';
      } else if (normalizedQuery.includes('問題') || normalizedQuery.includes('エラー') || normalizedQuery.includes('できない')) {
        intent = 'troubleshoot';
      } else if (normalizedQuery.includes('違い') || normalizedQuery.includes('比較')) {
        intent = 'comparison';
      } else if (normalizedQuery.includes('手順') || normalizedQuery.includes('順序')) {
        intent = 'procedure';
      }
    }
    
    // 엔티티 추출
    const entities = this.extractEntities(query, language);
    
    // 키워드 추출
    const keywords = this.extractKeywords(query, language);
    
    // 복잡도 판단
    const complexity = this.assessComplexity(query, intent);
    
    // 다단계 처리 필요성 판단
    const requiresMultiStep = intent === 'troubleshoot' || intent === 'procedure' || complexity === 'complex';
    
    // 도메인 분류
    const domain = this.classifyDomain(keywords, entities);
    
    return {
      intent,
      entities,
      keywords,
      complexity,
      requiresMultiStep,
      domain
    };
  }
  
  // 엔티티 추출
  private extractEntities(query: string, language: 'ko' | 'ja'): string[] {
    const entities: string[] = [];
    
    // ASP 관련 엔티티
    const aspEntities = ['ASP', 'asp', 'システム', '시스템', 'ログイン', '로그인', 
                        'パスワード', '비밀번호', 'データベース', '데이터베이스'];
    
    aspEntities.forEach(entity => {
      if (query.includes(entity)) {
        entities.push(entity);
      }
    });
    
    return Array.from(new Set(entities)); // 중복 제거
  }
  
  // 키워드 추출
  private extractKeywords(query: string, language: 'ko' | 'ja'): string[] {
    const stopWords = language === 'ko' 
      ? ['은', '는', '이', '가', '을', '를', '에', '에서', '로', '으로', '의', '와', '과']
      : ['は', 'が', 'を', 'に', 'で', 'から', 'まで', 'と', 'の', 'や'];
    
    const words = query.toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter(word => word.length > 1 && !stopWords.includes(word));
    
    // TF 기반 중요 키워드 선별
    const wordCount = new Map<string, number>();
    words.forEach(word => {
      wordCount.set(word, (wordCount.get(word) || 0) + 1);
    });
    
    return Array.from(wordCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([word]) => word);
  }
  
  // 복잡도 평가
  private assessComplexity(query: string, intent: QueryAnalysis['intent']): 'simple' | 'medium' | 'complex' {
    const wordCount = query.split(/\s+/).length;
    
    if (intent === 'troubleshoot' || intent === 'procedure') {
      return wordCount > 10 ? 'complex' : 'medium';
    }
    
    if (wordCount < 5) return 'simple';
    if (wordCount < 10) return 'medium';
    return 'complex';
  }
  
  // 도메인 분류
  private classifyDomain(keywords: string[], entities: string[]): string[] {
    const domainMapping = {
      'authentication': ['로그인', 'ログイン', 'パスワード', '비밀번호', '인증', '認証'],
      'database': ['데이터베이스', 'データベース', 'DB', 'SQL', '접속', '接続'],
      'system': ['시스템', 'システム', '설정', '設定', '관리', '管理'],
      'security': ['보안', 'セキュリティ', '권한', '権限', 'IP', 'SSL'],
      'api': ['API', 'REST', 'JSON', '연동', '連携'],
      'troubleshooting': ['문제', '問題', '오류', 'エラー', '해결', '解決']
    };
    
    const domains: string[] = [];
    const allTerms = [...keywords, ...entities];
    
    Object.entries(domainMapping).forEach(([domain, terms]) => {
      if (terms.some(term => allTerms.some(t => t.includes(term) || term.includes(t)))) {
        domains.push(domain);
      }
    });
    
    return domains.length > 0 ? domains : ['general'];
  }
  
  // Step 2: 검색 결과 평가
  private async evaluateSearchResults(
    searchResults: VectorSearchResult[], 
    analysis: QueryAnalysis, 
    language: 'ko' | 'ja'
  ): Promise<VectorSearchResult[]> {
    
    const scoredResults = searchResults.map(result => {
      let relevanceScore = result.similarity;
      
      // 언어 일치 보너스
      if (result.embedding.metadata.language === language) {
        relevanceScore *= 1.2;
      }
      
      // 도메인 일치 보너스
      const content = result.embedding.metadata.text.toLowerCase();
      analysis.domain.forEach(domain => {
        if (this.isDomainRelevant(content, domain)) {
          relevanceScore *= 1.15;
        }
      });
      
      // 의도 적합성 보너스
      if (this.isIntentRelevant(content, analysis.intent, language)) {
        relevanceScore *= 1.1;
      }
      
      return {
        ...result,
        similarity: Math.min(relevanceScore, 1.0) // 최대값 1.0으로 제한
      };
    });
    
    // 상위 5개 결과만 선별
    return scoredResults
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 5)
      .filter(result => result.similarity > 0.3); // 최소 임계값
  }
  
  // 도메인 관련성 확인
  private isDomainRelevant(content: string, domain: string): boolean {
    const domainKeywords = {
      'authentication': ['login', 'password', 'auth', '로그인', '비밀번호', 'ログイン', 'パスワード'],
      'database': ['database', 'db', 'sql', '데이터베이스', 'データベース'],
      'system': ['system', 'config', '시스템', '설정', 'システム', '設定'],
      'security': ['security', 'secure', '보안', 'セキュリティ'],
      'api': ['api', 'rest', 'json'],
      'troubleshooting': ['error', 'problem', '오류', '문제', 'エラー', '問題']
    };
    
    const keywords = domainKeywords[domain as keyof typeof domainKeywords] || [];
    return keywords.some(keyword => content.includes(keyword));
  }
  
  // 의도 관련성 확인
  private isIntentRelevant(content: string, intent: QueryAnalysis['intent'], language: 'ko' | 'ja'): boolean {
    const intentKeywords = {
      'how_to': language === 'ko' ? ['방법', '절차', '단계'] : ['方法', '手順', 'ステップ'],
      'troubleshoot': language === 'ko' ? ['해결', '문제', '오류'] : ['解決', '問題', 'エラー'],
      'what_is': language === 'ko' ? ['정의', '개념', '설명'] : ['定義', '概念', '説明'],
      'procedure': language === 'ko' ? ['순서', '절차', '과정'] : ['順序', '手順', 'プロセス'],
      'comparison': language === 'ko' ? ['차이', '비교', '대비'] : ['違い', '比較', '対比'],
      'general': language === 'ko' ? ['일반', '기본', '개요'] : ['一般', '基本', '概要']
    };
    
    const keywords = intentKeywords[intent] || [];
    return keywords.some(keyword => content.includes(keyword));
  }
  
  // Step 3: 정보 통합
  private async synthesizeInformation(
    sources: VectorSearchResult[], 
    analysis: QueryAnalysis, 
    language: 'ko' | 'ja'
  ): Promise<any> {
    
    const synthesizedInfo = {
      primaryConcepts: this.extractPrimaryConcepts(sources, analysis),
      procedures: this.extractProcedures(sources, analysis),
      troubleshootingSteps: this.extractTroubleshootingSteps(sources, analysis),
      keyInsights: this.extractKeyInsights(sources, analysis, language),
      conflictingInfo: this.identifyConflicts(sources),
      confidence: this.calculateSynthesisConfidence(sources)
    };
    
    return synthesizedInfo;
  }
  
  // 주요 개념 추출
  private extractPrimaryConcepts(sources: VectorSearchResult[], analysis: QueryAnalysis): string[] {
    const concepts: string[] = [];
    
    sources.forEach(source => {
      const content = source.embedding.metadata.text;
      
      // ASP 관련 정의나 설명 문장 추출
      const sentences = content.split(/[.。!?！？]/).filter(s => s.trim().length > 10);
      
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        // ASP 관련 정의 문장 찾기
        if (trimmed.includes('ASP') && (trimmed.includes('는') || trimmed.includes('は') || trimmed.includes('란') || trimmed.includes('とは'))) {
          concepts.push(trimmed);
        }
        // 다른 키워드 기반 중요 문장 추출
        analysis.keywords.forEach(keyword => {
          if (trimmed.toLowerCase().includes(keyword.toLowerCase()) && trimmed.length > 20) {
            concepts.push(trimmed);
          }
        });
      });
    });
    
    return Array.from(new Set(concepts)).slice(0, 3); // 상위 3개만
  }
  
  // 절차 추출
  private extractProcedures(sources: VectorSearchResult[], analysis: QueryAnalysis): string[] {
    if (analysis.intent !== 'how_to' && analysis.intent !== 'procedure') {
      return [];
    }
    
    const procedures: string[] = [];
    
    sources.forEach(source => {
      const content = source.embedding.metadata.text;
      // 숫자로 시작하는 단계들을 찾기
      const steps = content.match(/\d+[.)]\s*[^\\n]+/g) || [];
      procedures.push(...steps);
    });
    
    return procedures;
  }
  
  // 문제 해결 단계 추출
  private extractTroubleshootingSteps(sources: VectorSearchResult[], analysis: QueryAnalysis): string[] {
    if (analysis.intent !== 'troubleshoot') {
      return [];
    }
    
    const steps: string[] = [];
    
    sources.forEach(source => {
      const content = source.embedding.metadata.text;
      // 문제 해결 관련 패턴 찾기
      const troubleSteps = content.match(/(확인|check|검증|verify)[^\\n.。]+/gi) || [];
      steps.push(...troubleSteps);
    });
    
    return steps;
  }
  
  // 핵심 인사이트 추출 (개선된 버전)
  private extractKeyInsights(sources: VectorSearchResult[], analysis: QueryAnalysis, language: 'ko' | 'ja'): string[] {
    const insights: string[] = [];
    
    console.log('🔍 인사이트 추출 시작:', { 
      sourcesCount: sources.length, 
      intent: analysis.intent,
      keywords: analysis.keywords 
    });
    
    sources.forEach((source, index) => {
      const content = source.embedding.metadata.text;
      console.log(`📄 문서 ${index + 1} 내용:`, content.substring(0, 200) + '...');
      
      // 문장 단위로 분할 (더 정교한 분할)
      const sentences = content.split(/[.。!?！？\n]+/).filter(s => s.trim().length > 20);
      
      // what_is 질문인 경우 정의/설명 문장 우선 추출
      if (analysis.intent === 'what_is') {
        sentences.forEach(sentence => {
          const trimmed = sentence.trim();
          
          // ASP 정의를 포함하는 문장 찾기
          if (trimmed.includes('ASP') && (
              trimmed.includes('는') || trimmed.includes('은') || trimmed.includes('란') ||
              trimmed.includes('は') || trimmed.includes('とは') || trimmed.includes('である')
            )) {
            insights.push(trimmed);
            console.log('✅ ASP 정의 문장 발견:', trimmed);
          }
          
          // 시스템/서비스 설명 문장
          else if ((trimmed.includes('시스템') || trimmed.includes('システム') || 
                   trimmed.includes('플랫폼') || trimmed.includes('プラットフォーム') ||
                   trimmed.includes('서비스') || trimmed.includes('サービス') ||
                   trimmed.includes('기능') || trimmed.includes('機能') ||
                   trimmed.includes('プログラム') || trimmed.includes('프로그램')) &&
                   trimmed.length > 40) {
            insights.push(trimmed);
            console.log('✅ 시스템 설명 문장 발견:', trimmed);
          }
          
          // 처리/작업 관련 설명
          else if ((trimmed.includes('処理') || trimmed.includes('처리') ||
                   trimmed.includes('実行') || trimmed.includes('실행') ||
                   trimmed.includes('作業') || trimmed.includes('작업') ||
                   trimmed.includes('操作') || trimmed.includes('조작')) &&
                   trimmed.length > 30) {
            insights.push(trimmed);
            console.log('✅ 처리 관련 문장 발견:', trimmed);
          }
        });
      }
      
      // 모든 질문 유형에 대해 키워드가 포함된 중요한 문장들
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        const keywordMatches = analysis.keywords.filter(keyword => 
          trimmed.toLowerCase().includes(keyword.toLowerCase())
        );
        
        // 키워드 밀도가 높고 충분한 길이의 문장 (최소 길이 증가)
        if (keywordMatches.length > 0 && trimmed.length > 40 && trimmed.length < 300) {
          // 중복 체크 후 추가
          if (!insights.some(existing => existing.includes(trimmed.substring(0, 50)))) {
            insights.push(trimmed);
            console.log(`✅ 키워드(${keywordMatches.join(', ')}) 포함 문장:`, trimmed);
          }
        }
      });
      
      // 구체적인 정보가 포함된 문장들 추가 추출
      sentences.forEach(sentence => {
        const trimmed = sentence.trim();
        
        // 숫자나 구체적인 값이 포함된 설명
        if (/\d+/.test(trimmed) && trimmed.length > 30 && trimmed.length < 200) {
          if (!insights.some(existing => existing.includes(trimmed.substring(0, 30)))) {
            insights.push(trimmed);
            console.log('✅ 구체적 정보 문장 발견:', trimmed);
          }
        }
      });
    });
    
    const uniqueInsights = Array.from(new Set(insights));
    console.log('📋 최종 추출된 인사이트:', uniqueInsights);
    
    return uniqueInsights.slice(0, 8); // 더 많은 인사이트 반환
  }
  
  // 충돌 정보 식별
  private identifyConflicts(sources: VectorSearchResult[]): string[] {
    // 간단한 충돌 감지 (실제로는 더 정교한 NLP 필요)
    const conflicts: string[] = [];
    
    // 여기서는 기본적인 충돌만 감지
    if (sources.length > 1) {
      const languages = new Set(sources.map(s => s.embedding.metadata.language));
      if (languages.size > 1) {
        conflicts.push('다국어 문서 간 일관성 확인 필요');
      }
    }
    
    return conflicts;
  }
  
  // 통합 신뢰도 계산
  private calculateSynthesisConfidence(sources: VectorSearchResult[]): number {
    if (sources.length === 0) return 0;
    
    const avgSimilarity = sources.reduce((sum, s) => sum + s.similarity, 0) / sources.length;
    const sourceCount = Math.min(sources.length / 3, 1); // 최대 3개 소스에서 1.0
    
    return avgSimilarity * sourceCount;
  }
  
  // Step 4: 답변 검증
  private async validateAnswer(synthesizedInfo: any, query: string, analysis: QueryAnalysis, language: 'ko' | 'ja'): Promise<any> {
    const validation = {
      completeness: this.assessCompleteness(synthesizedInfo, analysis),
      consistency: this.assessConsistency(synthesizedInfo),
      accuracy: this.assessAccuracy(synthesizedInfo, analysis),
      relevance: this.assessRelevance(synthesizedInfo, query, analysis),
      confidence: 0
    };
    
    validation.confidence = (validation.completeness + validation.consistency + validation.accuracy + validation.relevance) / 4;
    
    return validation;
  }
  
  // 완성도 평가
  private assessCompleteness(synthesizedInfo: any, analysis: QueryAnalysis): number {
    let score = 0.5; // 기본 점수
    
    if (synthesizedInfo.primaryConcepts.length > 0) score += 0.2;
    if (analysis.intent === 'how_to' && synthesizedInfo.procedures.length > 0) score += 0.2;
    if (analysis.intent === 'troubleshoot' && synthesizedInfo.troubleshootingSteps.length > 0) score += 0.2;
    if (synthesizedInfo.keyInsights.length > 0) score += 0.1;
    
    return Math.min(score, 1.0);
  }
  
  // 일관성 평가
  private assessConsistency(synthesizedInfo: any): number {
    return synthesizedInfo.conflictingInfo.length === 0 ? 0.9 : 0.6;
  }
  
  // 정확도 평가
  private assessAccuracy(synthesizedInfo: any, analysis: QueryAnalysis): number {
    // 도메인별 가중치 적용
    const domainRelevance = analysis.domain.length > 0 ? 0.9 : 0.7;
    return synthesizedInfo.confidence * domainRelevance;
  }
  
  // 관련성 평가
  private assessRelevance(synthesizedInfo: any, query: string, analysis: QueryAnalysis): number {
    const keywordCoverage = synthesizedInfo.primaryConcepts.length / Math.max(analysis.keywords.length, 1);
    return Math.min(keywordCoverage, 1.0);
  }
  
  // Step 5: 최종 답변 생성
  private async generateFinalAnswer(synthesizedInfo: any, analysis: QueryAnalysis, language: 'ko' | 'ja', steps: ReasoningStep[]): Promise<string> {
    
    // 답변이 비어있는 경우를 위한 디버깅
    console.log('🔍 답변 생성 디버그:', {
      primaryConcepts: synthesizedInfo.primaryConcepts,
      keyInsights: synthesizedInfo.keyInsights,
      intent: analysis.intent
    });
    
    let answer = '';
    
    // what_is 질문인 경우 상세하고 구조화된 답변
    if (analysis.intent === 'what_is') {
      if (synthesizedInfo.keyInsights.length > 0) {
        // 주요 정의 문장 선택
        const mainDefinition = synthesizedInfo.keyInsights.find((insight: string) => 
          insight.includes('ASP') && (
            insight.includes('시스템') || insight.includes('システム') ||
            insight.includes('는') || insight.includes('は') || insight.includes('とは')
          )
        );
        
        if (mainDefinition) {
          answer = `🔍 **핵심 정의**\n${mainDefinition}\n\n`;
        }
        
        // 추가 설명과 특징들
        const additionalInfo = synthesizedInfo.keyInsights.filter((insight: string) => 
          insight !== mainDefinition && insight.length > 50
        );
        
        if (additionalInfo.length > 0) {
          answer += `📋 **주요 특징 및 기능**\n`;
          additionalInfo.slice(0, 4).forEach((insight: string, index: number) => {
            answer += `${index + 1}. ${insight}\n`;
          });
          answer += '\n';
        }
        
        // 기본 답변이 없는 경우 첫 번째 인사이트 사용
        if (!answer && synthesizedInfo.keyInsights.length > 0) {
          answer = `📖 **ASP 관련 정보**\n${synthesizedInfo.keyInsights[0]}\n\n`;
          
          if (synthesizedInfo.keyInsights.length > 1) {
            answer += `📋 **추가 정보**\n`;
            synthesizedInfo.keyInsights.slice(1, 3).forEach((insight: string, index: number) => {
              answer += `• ${insight}\n`;
            });
          }
        }
      } else if (synthesizedInfo.primaryConcepts.length > 0) {
        answer = `📖 **관련 정보**\n${synthesizedInfo.primaryConcepts[0]}\n`;
      } else {
        // 벡터 검색 결과가 없는 경우
        console.warn('⚠️ 벡터 검색 결과에서 관련 정보를 찾을 수 없습니다');
        answer = language === 'ko' 
          ? '죄송합니다. 해당 질문에 대한 구체적인 정보를 매뉴얼에서 찾을 수 없습니다. ASP 시스템에 대한 다른 질문을 시도해보세요.'
          : '申し訳ございません。その質問に関する具体的な情報をマニュアルで見つけることができませんでした。ASPシステムに関する他の質問をお試しください。';
      }
    } else {
      // 다른 질문 유형에 대한 기존 로직
      const templates = this.getAnswerTemplates(language);
      answer += templates.intro.replace('{intent}', this.getIntentLabel(analysis.intent, language));
      
      // 주요 내용
      if (synthesizedInfo.primaryConcepts.length > 0) {
        answer += templates.concepts;
        synthesizedInfo.primaryConcepts.forEach((concept: string) => {
          answer += `• ${concept}\n`;
        });
        answer += '\n';
      }
      
      // 절차 (how-to 질문인 경우)
      if (analysis.intent === 'how_to' && synthesizedInfo.procedures.length > 0) {
        answer += templates.procedures;
        synthesizedInfo.procedures.forEach((proc: string, index: number) => {
          answer += `${index + 1}. ${proc}\n`;
        });
        answer += '\n';
      }
      
      // 문제 해결 (troubleshoot 질문인 경우)
      if (analysis.intent === 'troubleshoot' && synthesizedInfo.troubleshootingSteps.length > 0) {
        answer += templates.troubleshooting;
        synthesizedInfo.troubleshootingSteps.forEach((step: string, index: number) => {
          answer += `${index + 1}. ${step}\n`;
        });
        answer += '\n';
      }
      
      // 핵심 인사이트
      if (synthesizedInfo.keyInsights.length > 0) {
        answer += templates.insights;
        synthesizedInfo.keyInsights.forEach((insight: string) => {
          answer += `• ${insight}\n`;
        });
        answer += '\n';
      }
    }
    
    // 신뢰도 정보 (간소화)
    const confidencePercent = Math.round(synthesizedInfo.confidence * 100);
    if (confidencePercent > 70) {
      answer += `\n📊 신뢰도: ${confidencePercent}%`;
    }
    
    return answer.trim();
  }
  
  // 답변 템플릿
  private getAnswerTemplates(language: 'ko' | 'ja') {
    if (language === 'ko') {
      return {
        intro: 'ASP 매뉴얼에서 찾은 "{intent}" 에 대한 답변입니다:\n\n',
        concepts: '🔍 주요 내용:\n',
        procedures: '📋 수행 절차:\n',
        troubleshooting: '🔧 문제 해결 단계:\n',
        insights: '💡 세부 정보:\n',
        confidence: '\n📊 답변 신뢰도: {confidence}%'
      };
    } else {
      return {
        intro: 'ASPマニュアルからの"{intent}"に関する回答です：\n\n',
        concepts: '🔍 主要内容：\n',
        procedures: '📋 実行手順：\n',
        troubleshooting: '🔧 問題解決ステップ：\n',
        insights: '💡 詳細情報：\n',
        confidence: '\n📊 回答信頼度: {confidence}%'
      };
    }
  }
  
  // 의도 라벨
  private getIntentLabel(intent: QueryAnalysis['intent'], language: 'ko' | 'ja'): string {
    const labels = {
      'ko': {
        'how_to': '방법 안내',
        'what_is': '개념 설명',
        'troubleshoot': '문제 해결',
        'comparison': '비교 분석',
        'procedure': '절차 안내',
        'general': '일반 질문'
      },
      'ja': {
        'how_to': '方法案内',
        'what_is': '概念説明',
        'troubleshoot': '問題解決',
        'comparison': '比較分析',
        'procedure': '手順案内',
        'general': '一般質問'
      }
    };
    
    return labels[language][intent];
  }
  
  // 전체 신뢰도 계산
  private calculateOverallConfidence(steps: ReasoningStep[]): number {
    const weights = [0.15, 0.2, 0.25, 0.25, 0.15]; // 각 단계별 가중치
    
    let weightedSum = 0;
    let totalWeight = 0;
    
    steps.forEach((step, index) => {
      const weight = weights[index] || 0.1;
      weightedSum += step.confidence * weight;
      totalWeight += weight;
    });
    
    return totalWeight > 0 ? weightedSum / totalWeight : 0.5;
  }
  
  // 추론 체인 생성
  private generateReasoningChain(steps: ReasoningStep[], language: 'ko' | 'ja'): string {
    const chainHeader = language === 'ko' 
      ? '🧠 추론 과정 (Chain-of-Thought):\\n\\n'
      : '🧠 推論プロセス (Chain-of-Thought)：\\n\\n';
    
    let chain = chainHeader;
    
    steps.forEach(step => {
      chain += `**Step ${step.step}: ${step.description}**\\n`;
      chain += `추론: ${step.reasoning}\\n`;
      chain += `신뢰도: ${Math.round(step.confidence * 100)}%\\n\\n`;
    });
    
    return chain;
  }
  
  // 각 단계별 추론 설명 메서드들
  private explainAnalysis(analysis: QueryAnalysis, language: 'ko' | 'ja'): string {
    return language === 'ko'
      ? `질문 의도를 "${analysis.intent}"로 분석하고, ${analysis.keywords.length}개의 핵심 키워드를 추출했습니다. 복잡도는 ${analysis.complexity} 수준입니다.`
      : `質問意図を"${analysis.intent}"と分析し、${analysis.keywords.length}個のキーワードを抽出しました。複雑度は${analysis.complexity}レベルです。`;
  }
  
  private explainSourceEvaluation(sources: VectorSearchResult[], language: 'ko' | 'ja'): string {
    return language === 'ko'
      ? `벡터 유사도와 도메인 적합성을 기준으로 ${sources.length}개의 관련 문서를 선별했습니다.`
      : `ベクトル類似度とドメイン適合性に基づいて${sources.length}個の関連文書を選別しました。`;
  }
  
  private explainSynthesis(synthesizedInfo: any, language: 'ko' | 'ja'): string {
    return language === 'ko'
      ? `선별된 문서들을 분석하여 ${synthesizedInfo.primaryConcepts.length}개의 핵심 개념을 도출했습니다.`
      : `選別された文書を分析して${synthesizedInfo.primaryConcepts.length}個の核心概念を導出しました。`;
  }
  
  private explainValidation(validation: any, language: 'ko' | 'ja'): string {
    return language === 'ko'
      ? `답변의 완성도(${Math.round(validation.completeness * 100)}%), 일관성(${Math.round(validation.consistency * 100)}%), 정확도(${Math.round(validation.accuracy * 100)}%)를 검증했습니다.`
      : `回答の完成度(${Math.round(validation.completeness * 100)}%)、一貫性(${Math.round(validation.consistency * 100)}%)、正確度(${Math.round(validation.accuracy * 100)}%)を検証しました。`;
  }
  
  private explainConclusion(finalAnswer: string, language: 'ko' | 'ja'): string {
    return language === 'ko'
      ? '검증된 정보를 바탕으로 구조화된 최종 답변을 생성했습니다.'
      : '検証された情報に基づいて構造化された最終回答を生成しました。';
  }
}

// 싱글톤 인스턴스
export const chainOfThoughtReasoner = new ChainOfThoughtReasoner();