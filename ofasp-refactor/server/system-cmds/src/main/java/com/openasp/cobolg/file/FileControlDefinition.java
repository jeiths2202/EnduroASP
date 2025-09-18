package com.openasp.cobolg.file;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * COBOL FILE-CONTROL 섹션 정의 클래스
 * 모든 FILE-CONTROL 파라미터를 Java로 매핑
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class FileControlDefinition {
    
    // SELECT 절
    private String fileName;                    // SELECT file-name
    
    // ASSIGN TO 절
    private String assignTo;                    // ASSIGN TO external-name
    private AssignmentType assignmentType;      // DISK, PRINTER, TERMINAL 등
    
    // ORGANIZATION IS 절
    private OrganizationType organization;      // SEQUENTIAL, INDEXED, RELATIVE
    
    // ACCESS MODE IS 절  
    private AccessMode accessMode;              // SEQUENTIAL, RANDOM, DYNAMIC
    
    // KEY 관련 절들
    private String recordKey;                   // RECORD KEY IS key-name
    private String[] alternateKeys;             // ALTERNATE RECORD KEY IS
    private boolean[] allowDuplicates;          // WITH/WITHOUT DUPLICATES
    private String relativeKey;                 // RELATIVE KEY IS key-name
    
    // FILE STATUS IS 절
    private String fileStatusField;             // FILE STATUS IS status-field
    
    // SYMBOLIC DESTINATION 절 🔴 CRITICAL
    private SymbolicDestination symbolicDestination;
    
    // 기타 절들
    private LockMode lockMode;                  // LOCK MODE IS lock-type
    private String passwordField;               // PASSWORD IS password-field
    private int reserveAreas;                   // RESERVE integer AREAS
    
    /**
     * ASSIGN TO 타입 열거형
     */
    public enum AssignmentType {
        DISK("DISK", "디스크 파일") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return basePath + "/" + assignment + "/";
            }
        },
        PRINTER("PRINTER", "프린터 출력") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return "/dev/printer/" + assignment;
            }
        },
        TERMINAL("TERMINAL", "터미널 I/O") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return "/dev/terminal/" + assignment;
            }
        },
        TAPE("TAPE", "테이프 장치") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return "/dev/tape/" + assignment;
            }
        },
        CONSOLE("CONSOLE", "콘솔 장치") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return "/dev/console/" + assignment;
            }
        },
        LITERAL("LITERAL", "직접 경로") {
            @Override
            public String resolvePhysicalPath(String assignment, String basePath) {
                return assignment; // 그대로 사용
            }
        };
        
        private final String code;
        private final String description;
        
        AssignmentType(String code, String description) {
            this.code = code;
            this.description = description;
        }
        
        public abstract String resolvePhysicalPath(String assignment, String basePath);
        
        public static AssignmentType fromAssignment(String assignment) {
            if (assignment.startsWith("DISK")) return DISK;
            if (assignment.equals("PRINTER")) return PRINTER;
            if (assignment.equals("TERMINAL")) return TERMINAL;
            if (assignment.startsWith("TAPE")) return TAPE;
            if (assignment.equals("CONSOLE")) return CONSOLE;
            return LITERAL; // 기본값
        }
    }
    
    /**
     * ORGANIZATION 타입 열거형
     */
    public enum OrganizationType {
        SEQUENTIAL("순차 파일") {
            @Override
            public boolean supportsKeys() { return false; }
            @Override
            public boolean supportsRandomAccess() { return false; }
        },
        INDEXED("색인 파일") {
            @Override
            public boolean supportsKeys() { return true; }
            @Override
            public boolean supportsRandomAccess() { return true; }
        },
        RELATIVE("상대 파일") {
            @Override
            public boolean supportsKeys() { return true; } // 상대 키
            @Override
            public boolean supportsRandomAccess() { return true; }
        },
        LINE_SEQUENTIAL("줄 순차 파일") {
            @Override
            public boolean supportsKeys() { return false; }
            @Override
            public boolean supportsRandomAccess() { return false; }
        };
        
        private final String description;
        
        OrganizationType(String description) {
            this.description = description;
        }
        
        public abstract boolean supportsKeys();
        public abstract boolean supportsRandomAccess();
    }
    
    /**
     * ACCESS MODE 열거형
     */
    public enum AccessMode {
        SEQUENTIAL("순차 접근", false, true),
        RANDOM("랜덤 접근", true, false),
        DYNAMIC("동적 접근", true, true);
        
        private final String description;
        private final boolean supportsRandomAccess;
        private final boolean supportsSequentialAccess;
        
        AccessMode(String description, boolean random, boolean sequential) {
            this.description = description;
            this.supportsRandomAccess = random;
            this.supportsSequentialAccess = sequential;
        }
        
        public boolean isCompatibleWith(OrganizationType organization) {
            if (this == RANDOM || this == DYNAMIC) {
                return organization.supportsRandomAccess();
            }
            return true; // SEQUENTIAL은 모든 조직과 호환
        }
    }
    
    /**
     * SYMBOLIC DESTINATION 열거형 🔴 CRITICAL IMPLEMENTATION
     */
    public enum SymbolicDestination {
        DSP("Display", "화면 표시 출력") {
            @Override
            public OutputHandler createHandler() {
                return new DisplayOutputHandler();
            }
        },
        PRT("Printer", "프린터 출력") {
            @Override
            public OutputHandler createHandler() {
                return new PrinterOutputHandler();
            }
        },
        APL("Application", "애플리케이션 간 통신") {
            @Override
            public OutputHandler createHandler() {
                return new ApplicationOutputHandler();
            }
        };
        
        private final String code;
        private final String description;
        
        SymbolicDestination(String code, String description) {
            this.code = code;
            this.description = description;
        }
        
        public abstract OutputHandler createHandler();
    }
    
    /**
     * LOCK MODE 열거형
     */
    public enum LockMode {
        MANUAL("수동 잠금"),
        AUTOMATIC("자동 잠금"),
        EXCLUSIVE("배타적 잠금");
        
        private final String description;
        
        LockMode(String description) {
            this.description = description;
        }
    }
    
    /**
     * 파일 정의 검증
     */
    public ValidationResult validate() {
        ValidationResult result = new ValidationResult();
        
        // 필수 필드 검증
        if (fileName == null || fileName.trim().isEmpty()) {
            result.addError("fileName", "파일명은 필수입니다");
        }
        
        if (assignTo == null || assignTo.trim().isEmpty()) {
            result.addError("assignTo", "ASSIGN TO는 필수입니다");
        }
        
        // 조직과 접근 모드 호환성 검증
        if (organization != null && accessMode != null) {
            if (!accessMode.isCompatibleWith(organization)) {
                result.addError("accessMode", 
                    String.format("접근 모드 %s는 조직 %s와 호환되지 않습니다", 
                        accessMode, organization));
            }
        }
        
        // 색인 파일 키 검증
        if (organization == OrganizationType.INDEXED) {
            if (recordKey == null || recordKey.trim().isEmpty()) {
                result.addError("recordKey", "색인 파일에는 RECORD KEY가 필요합니다");
            }
        }
        
        // 상대 파일 키 검증
        if (organization == OrganizationType.RELATIVE) {
            if (relativeKey == null || relativeKey.trim().isEmpty()) {
                result.addError("relativeKey", "상대 파일에는 RELATIVE KEY가 필요합니다");
            }
        }
        
        // 대체 키 배열 크기 검증
        if (alternateKeys != null && allowDuplicates != null) {
            if (alternateKeys.length != allowDuplicates.length) {
                result.addError("alternateKeys", 
                    "대체 키와 중복 허용 배열의 크기가 일치하지 않습니다");
            }
        }
        
        return result;
    }
    
    /**
     * 파일 핸들러 생성
     */
    public CobolFileHandler createFileHandler() {
        ValidationResult validation = validate();
        if (!validation.isValid()) {
            throw new IllegalStateException("파일 정의가 유효하지 않습니다: " + 
                validation.getAllErrors());
        }
        
        return CobolFileHandlerFactory.create(this);
    }
    
    /**
     * COBOL 소스 코드 생성
     */
    public String generateCobolSource() {
        StringBuilder cobol = new StringBuilder();
        
        cobol.append("       SELECT ").append(fileName).append("\n");
        cobol.append("           ASSIGN TO ").append(assignTo).append("\n");
        
        if (organization != null) {
            cobol.append("           ORGANIZATION IS ")
                 .append(organization.name()).append("\n");
        }
        
        if (accessMode != null) {
            cobol.append("           ACCESS MODE IS ")
                 .append(accessMode.name()).append("\n");
        }
        
        if (recordKey != null && !recordKey.trim().isEmpty()) {
            cobol.append("           RECORD KEY IS ").append(recordKey).append("\n");
        }
        
        if (alternateKeys != null) {
            for (int i = 0; i < alternateKeys.length; i++) {
                cobol.append("           ALTERNATE RECORD KEY IS ")
                     .append(alternateKeys[i]);
                if (allowDuplicates != null && i < allowDuplicates.length) {
                    cobol.append(allowDuplicates[i] ? " WITH DUPLICATES" : " WITHOUT DUPLICATES");
                }
                cobol.append("\n");
            }
        }
        
        if (relativeKey != null && !relativeKey.trim().isEmpty()) {
            cobol.append("           RELATIVE KEY IS ").append(relativeKey).append("\n");
        }
        
        if (fileStatusField != null && !fileStatusField.trim().isEmpty()) {
            cobol.append("           FILE STATUS IS ").append(fileStatusField).append("\n");
        }
        
        if (symbolicDestination != null) {
            cobol.append("           SYMBOLIC DESTINATION ")
                 .append(symbolicDestination.name()).append("\n");
        }
        
        if (lockMode != null) {
            cobol.append("           LOCK MODE IS ")
                 .append(lockMode.name()).append("\n");
        }
        
        if (passwordField != null && !passwordField.trim().isEmpty()) {
            cobol.append("           PASSWORD IS ").append(passwordField).append("\n");
        }
        
        if (reserveAreas > 0) {
            cobol.append("           RESERVE ").append(reserveAreas)
                 .append(" AREAS").append("\n");
        }
        
        return cobol.toString();
    }
}