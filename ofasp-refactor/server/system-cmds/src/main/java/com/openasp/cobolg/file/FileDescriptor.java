package com.openasp.cobolg.file;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * COBOL FILE SECTION의 FD (File Description) 정의 클래스
 * 모든 FILE SECTION 파라미터를 Java로 매핑
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileDescriptor {
    
    // FD 절
    private String fileName;                    // FD file-name
    
    // BLOCK CONTAINS 절
    private BlockContains blockContains;        // BLOCK CONTAINS 정보
    
    // RECORD CONTAINS 절
    private RecordContains recordContains;      // RECORD CONTAINS 정보
    
    // LABEL RECORDS 절
    private LabelRecords labelRecords;          // STANDARD/OMITTED
    
    // VALUE OF 절
    private ValueOf[] valueOfClauses;           // VALUE OF 정보들
    
    // DATA RECORDS ARE 절
    private String[] dataRecords;               // 레코드 타입 이름들
    
    // LINAGE IS 절 (프린터 파일용)
    private LinageClause linage;                // 페이지 레이아웃 정보
    
    // CODE-SET IS 절
    private String codeSet;                     // 문자 인코딩
    
    /**
     * BLOCK CONTAINS 정보 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class BlockContains {
        private BlockType type;                 // RECORDS 또는 CHARACTERS
        private int size;                       // 블록 크기
        
        public enum BlockType {
            RECORDS("레코드 단위 블로킹") {
                @Override
                public int calculateBlockSize(int recordLength, int blockSize) {
                    return recordLength * blockSize;
                }
            },
            CHARACTERS("문자 단위 블로킹") {
                @Override
                public int calculateBlockSize(int recordLength, int blockSize) {
                    return blockSize;
                }
            };
            
            private final String description;
            
            BlockType(String description) {
                this.description = description;
            }
            
            public abstract int calculateBlockSize(int recordLength, int blockSize);
        }
        
        /**
         * 실제 블록 크기 계산
         */
        public int calculateActualBlockSize(int recordLength) {
            return type.calculateBlockSize(recordLength, size);
        }
        
        /**
         * 블록당 레코드 수 계산
         */
        public int getRecordsPerBlock(int recordLength) {
            if (type == BlockType.RECORDS) {
                return size;
            } else {
                return size / recordLength;
            }
        }
    }
    
    /**
     * RECORD CONTAINS 정보 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class RecordContains {
        private RecordType type;                // FIXED 또는 VARYING
        private int fixedSize;                  // 고정 크기 (FIXED일 때)
        private int minSize;                    // 최소 크기 (VARYING일 때)
        private int maxSize;                    // 최대 크기 (VARYING일 때)
        private String dependingOnField;        // DEPENDING ON 필드명
        
        public enum RecordType {
            FIXED("고정 길이 레코드") {
                @Override
                public boolean isValidRecordLength(int length, RecordContains record) {
                    return length == record.fixedSize;
                }
            },
            VARYING("가변 길이 레코드") {
                @Override
                public boolean isValidRecordLength(int length, RecordContains record) {
                    return length >= record.minSize && length <= record.maxSize;
                }
            };
            
            private final String description;
            
            RecordType(String description) {
                this.description = description;
            }
            
            public abstract boolean isValidRecordLength(int length, RecordContains record);
        }
        
        /**
         * 레코드 길이 검증
         */
        public boolean validateRecordLength(int length) {
            return type.isValidRecordLength(length, this);
        }
        
        /**
         * 현재 레코드 길이 반환 (DEPENDING ON 고려)
         */
        public int getCurrentRecordLength(Object recordObject) {
            if (type == RecordType.FIXED) {
                return fixedSize;
            }
            
            if (dependingOnField != null && recordObject != null) {
                try {
                    // 리플렉션으로 DEPENDING ON 필드 값 조회
                    var field = recordObject.getClass().getDeclaredField(dependingOnField);
                    field.setAccessible(true);
                    return (Integer) field.get(recordObject);
                } catch (Exception e) {
                    // 실패 시 최대 크기 반환
                    return maxSize;
                }
            }
            
            return maxSize;
        }
    }
    
    /**
     * LABEL RECORDS 열거형
     */
    public enum LabelRecords {
        STANDARD("표준 라벨 사용") {
            @Override
            public boolean requiresLabel() { return true; }
        },
        OMITTED("라벨 없음") {
            @Override
            public boolean requiresLabel() { return false; }
        };
        
        private final String description;
        
        LabelRecords(String description) {
            this.description = description;
        }
        
        public abstract boolean requiresLabel();
    }
    
    /**
     * VALUE OF 절 정보 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ValueOf {
        private String implementorName;         // 구현체별 이름
        private String value;                   // 값 (리터럴 또는 데이터명)
        private boolean isLiteral;              // 리터럴 여부
        
        /**
         * 실제 값 조회
         */
        public String resolveValue(Object workingStorageObject) {
            if (isLiteral) {
                return value;
            }
            
            try {
                // 데이터명인 경우 해당 필드에서 값 조회
                var field = workingStorageObject.getClass().getDeclaredField(value);
                field.setAccessible(true);
                return (String) field.get(workingStorageObject);
            } catch (Exception e) {
                return value; // 실패 시 원본 반환
            }
        }
    }
    
    /**
     * LINAGE IS 절 정보 클래스 (프린터 파일용)
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LinageClause {
        private int linesPerPage;               // 페이지당 라인 수
        private Integer footingAt;              // 푸터 시작 라인
        private Integer linesAtTop;             // 상단 여백 라인
        private Integer linesAtBottom;          // 하단 여백 라인
        
        /**
         * 실제 내용 라인 수 계산
         */
        public int getContentLines() {
            int contentLines = linesPerPage;
            
            if (linesAtTop != null) {
                contentLines -= linesAtTop;
            }
            
            if (linesAtBottom != null) {
                contentLines -= linesAtBottom;
            }
            
            return Math.max(1, contentLines);
        }
        
        /**
         * 푸터 영역 라인 수 계산
         */
        public int getFooterLines() {
            if (footingAt == null) {
                return 0;
            }
            
            int footerStart = footingAt;
            int footerEnd = linesPerPage;
            
            if (linesAtBottom != null) {
                footerEnd -= linesAtBottom;
            }
            
            return Math.max(0, footerEnd - footerStart + 1);
        }
        
        /**
         * 페이지 레이아웃 생성
         */
        public PageLayout createPageLayout() {
            return PageLayout.builder()
                .totalLines(linesPerPage)
                .topMargin(linesAtTop != null ? linesAtTop : 0)
                .bottomMargin(linesAtBottom != null ? linesAtBottom : 0)
                .footingStartLine(footingAt != null ? footingAt : linesPerPage)
                .contentLines(getContentLines())
                .footerLines(getFooterLines())
                .build();
        }
    }
    
    /**
     * 페이지 레이아웃 클래스
     */
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class PageLayout {
        private int totalLines;
        private int topMargin;
        private int bottomMargin;
        private int footingStartLine;
        private int contentLines;
        private int footerLines;
        
        /**
         * 라인이 헤더 영역인지 확인
         */
        public boolean isHeaderLine(int lineNumber) {
            return lineNumber <= topMargin;
        }
        
        /**
         * 라인이 내용 영역인지 확인
         */
        public boolean isContentLine(int lineNumber) {
            return lineNumber > topMargin && lineNumber < footingStartLine;
        }
        
        /**
         * 라인이 푸터 영역인지 확인
         */
        public boolean isFooterLine(int lineNumber) {
            return lineNumber >= footingStartLine && 
                   lineNumber <= (totalLines - bottomMargin);
        }
    }
    
    /**
     * 파일 기술자 검증
     */
    public ValidationResult validate() {
        ValidationResult result = new ValidationResult();
        
        // 필수 필드 검증
        if (fileName == null || fileName.trim().isEmpty()) {
            result.addError("fileName", "파일명은 필수입니다");
        }
        
        // BLOCK CONTAINS 검증
        if (blockContains != null) {
            if (blockContains.getSize() <= 0) {
                result.addError("blockContains", "블록 크기는 양수여야 합니다");
            }
        }
        
        // RECORD CONTAINS 검증
        if (recordContains != null) {
            if (recordContains.getType() == RecordContains.RecordType.FIXED) {
                if (recordContains.getFixedSize() <= 0) {
                    result.addError("recordContains", "고정 레코드 크기는 양수여야 합니다");
                }
            } else if (recordContains.getType() == RecordContains.RecordType.VARYING) {
                if (recordContains.getMinSize() <= 0) {
                    result.addError("recordContains", "최소 레코드 크기는 양수여야 합니다");
                }
                if (recordContains.getMaxSize() < recordContains.getMinSize()) {
                    result.addError("recordContains", "최대 크기는 최소 크기보다 크거나 같아야 합니다");
                }
            }
        }
        
        // LINAGE 검증
        if (linage != null) {
            if (linage.getLinesPerPage() <= 0) {
                result.addError("linage", "페이지당 라인 수는 양수여야 합니다");
            }
            
            if (linage.getFootingAt() != null && 
                linage.getFootingAt() > linage.getLinesPerPage()) {
                result.addError("linage", "푸터 시작 라인이 페이지 크기를 초과합니다");
            }
        }
        
        return result;
    }
    
    /**
     * COBOL 소스 코드 생성
     */
    public String generateCobolSource() {
        StringBuilder cobol = new StringBuilder();
        
        cobol.append("       FD ").append(fileName).append("\n");
        
        if (blockContains != null) {
            cobol.append("           BLOCK CONTAINS ")
                 .append(blockContains.getSize()).append(" ")
                 .append(blockContains.getType().name()).append("\n");
        }
        
        if (recordContains != null) {
            if (recordContains.getType() == RecordContains.RecordType.FIXED) {
                cobol.append("           RECORD CONTAINS ")
                     .append(recordContains.getFixedSize())
                     .append(" CHARACTERS").append("\n");
            } else {
                cobol.append("           RECORD IS VARYING IN SIZE FROM ")
                     .append(recordContains.getMinSize())
                     .append(" TO ").append(recordContains.getMaxSize())
                     .append(" CHARACTERS");
                if (recordContains.getDependingOnField() != null) {
                    cobol.append("\n               DEPENDING ON ")
                         .append(recordContains.getDependingOnField());
                }
                cobol.append("\n");
            }
        }
        
        if (labelRecords != null) {
            cobol.append("           LABEL RECORDS ARE ")
                 .append(labelRecords.name()).append("\n");
        }
        
        if (valueOfClauses != null) {
            for (ValueOf valueOf : valueOfClauses) {
                cobol.append("           VALUE OF ")
                     .append(valueOf.getImplementorName())
                     .append(" IS ");
                if (valueOf.isLiteral()) {
                    cobol.append("\"").append(valueOf.getValue()).append("\"");
                } else {
                    cobol.append(valueOf.getValue());
                }
                cobol.append("\n");
            }
        }
        
        if (dataRecords != null && dataRecords.length > 0) {
            cobol.append("           DATA RECORDS ARE ");
            for (int i = 0; i < dataRecords.length; i++) {
                if (i > 0) cobol.append(", ");
                cobol.append(dataRecords[i]);
            }
            cobol.append("\n");
        }
        
        if (linage != null) {
            cobol.append("           LINAGE IS ")
                 .append(linage.getLinesPerPage()).append(" LINES");
            
            if (linage.getFootingAt() != null) {
                cobol.append("\n               WITH FOOTING AT ")
                     .append(linage.getFootingAt());
            }
            
            if (linage.getLinesAtTop() != null) {
                cobol.append("\n               LINES AT TOP ")
                     .append(linage.getLinesAtTop());
            }
            
            if (linage.getLinesAtBottom() != null) {
                cobol.append("\n               LINES AT BOTTOM ")
                     .append(linage.getLinesAtBottom());
            }
            
            cobol.append("\n");
        }
        
        if (codeSet != null && !codeSet.trim().isEmpty()) {
            cobol.append("           CODE-SET IS ").append(codeSet).append("\n");
        }
        
        return cobol.toString();
    }
}