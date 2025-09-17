package com.openasp.cobolg.display;

import lombok.Data;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * 검증 결과 클래스
 */
@Data
public class ValidationResult {
    
    private final Map<String, List<String>> errors = new HashMap<>();
    private final Map<String, List<String>> warnings = new HashMap<>();
    
    /**
     * 오류 추가
     */
    public void addError(String field, String message) {
        errors.computeIfAbsent(field, k -> new ArrayList<>()).add(message);
    }
    
    /**
     * 경고 추가
     */
    public void addWarning(String field, String message) {
        warnings.computeIfAbsent(field, k -> new ArrayList<>()).add(message);
    }
    
    /**
     * 검증 성공 여부
     */
    public boolean isValid() {
        return errors.isEmpty();
    }
    
    /**
     * 오류 개수
     */
    public int getErrorCount() {
        return errors.values().stream().mapToInt(List::size).sum();
    }
    
    /**
     * 경고 개수
     */
    public int getWarningCount() {
        return warnings.values().stream().mapToInt(List::size).sum();
    }
    
    /**
     * 모든 오류 메시지 반환
     */
    public List<String> getAllErrors() {
        List<String> allErrors = new ArrayList<>();
        errors.forEach((field, messages) -> 
            messages.forEach(message -> 
                allErrors.add(field + ": " + message)
            )
        );
        return allErrors;
    }
    
    /**
     * 모든 경고 메시지 반환
     */
    public List<String> getAllWarnings() {
        List<String> allWarnings = new ArrayList<>();
        warnings.forEach((field, messages) -> 
            messages.forEach(message -> 
                allWarnings.add(field + ": " + message)
            )
        );
        return allWarnings;
    }
}