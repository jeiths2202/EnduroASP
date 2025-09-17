package com.openasp.cobolg.data;

/**
 * COBOL 데이터 변환 중 발생하는 예외
 */
public class CobolDataConversionException extends RuntimeException {
    
    public CobolDataConversionException(String message) {
        super(message);
    }
    
    public CobolDataConversionException(String message, Throwable cause) {
        super(message, cause);
    }
}