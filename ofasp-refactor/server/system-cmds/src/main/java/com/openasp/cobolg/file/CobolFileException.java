package com.openasp.cobolg.file;

/**
 * COBOL 파일 처리 중 발생하는 예외
 */
public class CobolFileException extends RuntimeException {
    
    public CobolFileException(String message) {
        super(message);
    }
    
    public CobolFileException(String message, Throwable cause) {
        super(message, cause);
    }
}