// 실제 파일 시스템 스캔 및 문서 로더
import { DocumentChunk } from './ragService';

// 지원되는 파일 타입
export interface SupportedFileType {
  extension: string;
  mimeType: string;
  parser: string;
}

// 파일 메타데이터
export interface FileMetadata {
  path: string;
  name: string;
  extension: string;
  size: number;
  lastModified: Date;
  language: 'ko' | 'ja' | 'auto';
  encoding?: string;
}

// 스캔 결과
export interface ScanResult {
  totalFiles: number;
  processedFiles: number;
  skippedFiles: number;
  errors: Array<{ file: string; error: string }>;
  documents: DocumentChunk[];
  processingTime: number;
}

// 파일 시스템 스캐너 클래스
export class FileSystemScanner {
  private readonly supportedFiles: SupportedFileType[] = [
    { extension: '.md', mimeType: 'text/markdown', parser: 'markdown' },
    { extension: '.txt', mimeType: 'text/plain', parser: 'plain' },
    { extension: '.json', mimeType: 'application/json', parser: 'json' },
    { extension: '.pdf', mimeType: 'application/pdf', parser: 'pdf' },
  ];
  
  private readonly manualPaths = [
    '/data/asp-manuals',
    // 추가 매뉴얼 경로들
  ];
  
  // 전체 매뉴얼 디렉토리 스캔
  async scanAllManuals(): Promise<ScanResult> {
    console.log('📂 ASP 매뉴얼 디렉토리 전체 스캔 시작...');
    const startTime = Date.now();
    
    const result: ScanResult = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      documents: [],
      processingTime: 0
    };
    
    try {
      for (const basePath of this.manualPaths) {
        console.log(`📁 스캔 중: ${basePath}`);
        const pathResult = await this.scanDirectory(basePath);
        
        result.totalFiles += pathResult.totalFiles;
        result.processedFiles += pathResult.processedFiles;
        result.skippedFiles += pathResult.skippedFiles;
        result.errors.push(...pathResult.errors);
        result.documents.push(...pathResult.documents);
      }
      
      result.processingTime = Date.now() - startTime;
      
      console.log(`✅ 스캔 완료: ${result.processedFiles}/${result.totalFiles} 파일 처리`);
      console.log(`⏱️ 처리 시간: ${result.processingTime}ms`);
      
      return result;
      
    } catch (error) {
      console.error('❌ 파일 시스템 스캔 오류:', error);
      result.errors.push({ file: 'SCAN_ERROR', error: String(error) });
      result.processingTime = Date.now() - startTime;
      return result;
    }
  }
  
  // 특정 디렉토리 스캔 (재귀적)
  async scanDirectory(dirPath: string): Promise<ScanResult> {
    const result: ScanResult = {
      totalFiles: 0,
      processedFiles: 0,
      skippedFiles: 0,
      errors: [],
      documents: [],
      processingTime: 0
    };
    
    try {
      // 브라우저 환경에서는 파일 시스템 직접 접근 불가
      // Node.js 환경 시뮬레이션으로 대체
      const fileList = await this.simulateDirectoryScan(dirPath);
      
      result.totalFiles = fileList.length;
      
      for (const fileInfo of fileList) {
        try {
          if (this.isSupportedFile(fileInfo.extension)) {
            console.log(`📄 처리 중: ${fileInfo.name} (${fileInfo.extension})`);
            const document = await this.loadDocument(fileInfo);
            if (document) {
              result.documents.push(document);
              result.processedFiles++;
              console.log(`✅ 처리 완료: ${fileInfo.name}`);
            } else {
              result.skippedFiles++;
              console.log(`⚠️ 처리 실패: ${fileInfo.name}`);
            }
          } else {
            result.skippedFiles++;
            console.log(`⏭️ 지원하지 않는 파일: ${fileInfo.name}`);
          }
        } catch (error) {
          result.errors.push({ 
            file: fileInfo.path, 
            error: String(error) 
          });
          result.skippedFiles++;
        }
      }
      
    } catch (error) {
      result.errors.push({ 
        file: dirPath, 
        error: `디렉토리 접근 오류: ${error}` 
      });
    }
    
    return result;
  }
  
  // 실제 디렉토리 스캔 - API 서버를 통해 파일 목록 가져오기
  private async simulateDirectoryScan(dirPath: string): Promise<FileMetadata[]> {
    try {
      // API 서버에서 디렉토리 구조 가져오기 (프록시 사용)
      const response = await fetch(`/api/files/structure`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to get directory structure');
      }
      
      const files: FileMetadata[] = [];
      
      // 재귀적으로 파일 메타데이터 추출
      const extractFiles = (nodes: any[]) => {
        nodes.forEach(node => {
          if (node.type === 'file' && (node.name.endsWith('.md') || node.name.endsWith('.pdf'))) {
            // 언어 감지
            let language: 'ko' | 'ja' = 'ko';
            if (node.name.includes('日本') || node.name.includes('マニュアル') || 
                node.name.includes('ステップ') || node.name.includes('トラブル') ||
                node.name.includes('使用説明書') || node.name.includes('文法書') ||
                node.name.includes('システム') || node.name.includes('ファイル') ||
                node.name.includes('プログラム')) {
              language = 'ja';
            }
            
            files.push({
              path: node.path, // API에서 제공하는 상대 경로 사용
              name: node.name,
              extension: node.extension,
              size: node.size || 1000,
              lastModified: new Date(),
              language: language
            });
          } else if (node.type === 'directory' && node.children) {
            extractFiles(node.children);
          }
        });
      };
      
      extractFiles(data.structure);
      
      console.log(`📁 실제 스캔 결과: ${files.length}개 파일 발견`);
      files.forEach(file => {
        console.log(`  - ${file.path} (${file.language})`);
      });
      
      return files;
      
    } catch (error) {
      console.error('❌ API 서버 접속 실패:', error);
      console.error('💡 API 서버(포트 3008)가 실행 중인지 확인하세요');
      
      // API 서버 없이는 파일 스캔 불가
      throw new Error('API 서버에 접속할 수 없습니다. 파일 시스템 스캔을 위해서는 API 서버가 필요합니다.');
    }
  }
  
  // 지원되는 파일 타입 확인
  private isSupportedFile(extension: string): boolean {
    return this.supportedFiles.some(type => type.extension === extension.toLowerCase());
  }
  
  // 개별 문서 로드
  private async loadDocument(fileInfo: FileMetadata): Promise<DocumentChunk | null> {
    console.log(`📄 문서 로드 중: ${fileInfo.name}`);
    
    try {
      // 실제 환경에서는 파일 시스템에서 읽기
      const content = await this.simulateFileRead(fileInfo);
      
      if (!content || content.trim().length === 0) {
        console.warn(`⚠️ 빈 파일: ${fileInfo.name}`);
        return null;
      }
      
      // 언어 자동 감지 (필요한 경우)
      const detectedLanguage = fileInfo.language === 'auto' 
        ? this.detectLanguage(content)
        : fileInfo.language;
      
      // 문서 청크 생성
      const document: DocumentChunk = {
        id: this.generateDocumentId(fileInfo),
        content: this.preprocessContent(content, detectedLanguage),
        metadata: {
          source: fileInfo.path,
          language: detectedLanguage,
          section: this.extractSection(fileInfo.path),
          page: 1 // 마크다운 파일의 경우 페이지 개념 없음
        }
      };
      
      console.log(`✅ 문서 로드 완료: ${fileInfo.name} (${detectedLanguage})`);
      return document;
      
    } catch (error) {
      console.error(`❌ 문서 로드 실패: ${fileInfo.name}`, error);
      throw error;
    }
  }
  
  // 실제 파일 읽기 - API 서버를 통해 파일 내용 가져오기
  private async simulateFileRead(fileInfo: FileMetadata): Promise<string> {
    try {
      // API 서버에서 파일 내용 가져오기 (프록시 사용)
      const response = await fetch(`/api/files/content?filePath=${encodeURIComponent(fileInfo.path)}`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to read file');
      }
      
      const content = data.content;
      
      console.log(`✅ 파일 읽기 성공: ${fileInfo.path}`);
      console.log(`📄 내용 미리보기: ${content.substring(0, 100)}...`);
      
      return content;
      
    } catch (error) {
      console.error(`❌ API 서버로 파일 읽기 실패: ${fileInfo.path}`, error);
      console.error('💡 API 서버(포트 3008)가 실행 중인지 확인하세요');
      
      // API 서버 없이는 파일 읽기 불가
      throw new Error(`파일을 읽을 수 없습니다: ${fileInfo.path}. API 서버 연결이 필요합니다.`);
    }
  }
  
  // 언어 자동 감지
  private detectLanguage(content: string): 'ko' | 'ja' {
    const koreanChars = (content.match(/[가-힣]/g) || []).length;
    const japaneseChars = (content.match(/[ひらがなカタカナ]/g) || []).length;
    
    return koreanChars > japaneseChars ? 'ko' : 'ja';
  }
  
  // 문서 ID 생성
  private generateDocumentId(fileInfo: FileMetadata): string {
    const timestamp = fileInfo.lastModified.getTime();
    const hash = this.simpleHash(fileInfo.path);
    return `doc_${hash}_${timestamp}`;
  }
  
  // 간단한 해시 함수
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash).toString(36);
  }
  
  // 콘텐츠 전처리
  private preprocessContent(content: string, language: 'ko' | 'ja'): string {
    let processed = content;
    
    // 마크다운 헤더 제거
    processed = processed.replace(/^#+\s*/gm, '');
    
    // 과도한 공백 정리
    processed = processed.replace(/\n\s*\n\s*\n/g, '\\n\\n');
    
    // 언어별 특수 처리
    if (language === 'ko') {
      // 한국어 특수 문자 정리
      processed = processed.replace(/[""]/g, '"');
      processed = processed.replace(/['']/g, "'");
    } else if (language === 'ja') {
      // 일본어 특수 문자 정리
      processed = processed.replace(/[「」]/g, '"');
      processed = processed.replace(/[『』]/g, "'");
    }
    
    return processed.trim();
  }
  
  // 파일 경로에서 섹션 추출
  private extractSection(filePath: string): string {
    const pathParts = filePath.split('/');
    const fileName = pathParts[pathParts.length - 1];
    const directory = pathParts[pathParts.length - 2];
    
    // 디렉토리 기반 섹션 매핑
    const sectionMap: Record<string, string> = {
      'advanced': '고급 설정',
      'troubleshooting': '문제 해결',
      'api': 'API 가이드',
      'security': '보안 설정',
      'asp-manuals': '기본 매뉴얼'
    };
    
    return sectionMap[directory] || fileName.replace(/\.(md|txt)$/i, '');
  }
  
  // 증분 스캔 (변경된 파일만)
  async scanIncremental(lastScanTime: Date): Promise<ScanResult> {
    console.log(`📄 증분 스캔 시작 (기준 시간: ${lastScanTime.toISOString()})`);
    
    const fullResult = await this.scanAllManuals();
    
    // 마지막 스캔 이후 변경된 파일만 필터링
    const changedDocuments = fullResult.documents.filter(doc => {
      // 실제 환경에서는 파일의 마지막 수정 시간과 비교
      return true; // 시뮬레이션에서는 모든 문서 반환
    });
    
    return {
      ...fullResult,
      documents: changedDocuments,
      processedFiles: changedDocuments.length
    };
  }
}

// 싱글톤 인스턴스
export const fileSystemScanner = new FileSystemScanner();