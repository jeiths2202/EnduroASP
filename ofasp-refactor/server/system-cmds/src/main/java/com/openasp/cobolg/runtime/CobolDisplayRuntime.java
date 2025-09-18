package com.openasp.cobolg.runtime;

import com.openasp.cobolg.display.CobolDisplayManager;
import com.openasp.cobolg.display.DisplayScreen;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.HashMap;
import java.util.Map;
import java.util.Scanner;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ConcurrentHashMap;

/**
 * COBOL 화면 처리 런타임
 * COBOL의 DISPLAY, ACCEPT 문을 Java에서 실행하기 위한 런타임 환경
 */
@Component
public class CobolDisplayRuntime {
    
    @Autowired
    private CobolDisplayManager displayManager;
    
    // 현재 활성화된 화면 데이터
    private final Map<String, Map<String, String>> screenData = new ConcurrentHashMap<>();
    
    // 화면 입력 대기 상태
    private final Map<String, CompletableFuture<Map<String, String>>> pendingInputs = new ConcurrentHashMap<>();
    
    /**
     * COBOL DISPLAY 문 실행
     * 예: DISPLAY \"Customer ID:\" LINE 5 COLUMN 10
     */
    public void display(String text, int line, int column) {
        display(getCurrentScreenId(), text, line, column);
    }
    
    /**
     * 특정 화면에 DISPLAY 문 실행
     */
    public void display(String screenId, String text, int line, int column) {
        displayManager.processDisplayStatement(screenId, text, line, column);
        
        // 화면 데이터 업데이트
        Map<String, String> data = screenData.computeIfAbsent(screenId, k -> new HashMap<>());
        data.put(\"display_\" + line + \"_\" + column, text);
        
        // WebSocket으로 실시간 전송
        displayManager.sendToWebSocket(screenId, data);
        
        System.out.println(String.format(\"[COBOL DISPLAY] Screen: %s, Line: %d, Col: %d, Text: %s\", 
            screenId, line, column, text));
    }
    
    /**
     * COBOL ACCEPT 문 실행
     * 예: ACCEPT CUSTOMER-ID LINE 5 COLUMN 25
     */
    public String accept(String fieldName, int line, int column, int length) {
        return accept(getCurrentScreenId(), fieldName, line, column, length);
    }
    
    /**
     * 특정 화면에서 ACCEPT 문 실행
     */
    public String accept(String screenId, String fieldName, int line, int column, int length) {
        // 화면에 입력 필드 등록
        displayManager.processAcceptStatement(screenId, fieldName, line, column, length);
        
        // 현재 화면 데이터 가져오기
        Map<String, String> data = screenData.computeIfAbsent(screenId, k -> new HashMap<>());
        
        // WebSocket으로 화면 전송
        displayManager.sendToWebSocket(screenId, data);
        
        // 웹 환경에서는 비동기 입력 대기
        if (isWebEnvironment()) {
            return waitForWebInput(screenId, fieldName);
        } else {
            // 콘솔 환경에서는 직접 입력 받기
            return acceptFromConsole(fieldName, length);
        }
    }
    
    /**
     * 웹 환경에서 입력 대기
     */
    private String waitForWebInput(String screenId, String fieldName) {
        try {
            CompletableFuture<Map<String, String>> future = new CompletableFuture<>();
            pendingInputs.put(screenId + \":\" + fieldName, future);
            
            System.out.println(String.format(\"[COBOL ACCEPT] 웹 입력 대기: Screen=%s, Field=%s\", 
                screenId, fieldName));
            
            // 웹에서 입력이 올 때까지 대기 (타임아웃 30초)
            Map<String, String> inputData = future.get(30, java.util.concurrent.TimeUnit.SECONDS);
            
            return inputData.getOrDefault(fieldName, \"\");
            
        } catch (Exception e) {
            System.err.println(\"웹 입력 대기 중 오류: \" + e.getMessage());
            return \"\";
        }
    }
    
    /**
     * 콘솔에서 직접 입력 받기
     */
    private String acceptFromConsole(String fieldName, int length) {
        Scanner scanner = new Scanner(System.in);
        System.out.print(String.format(\"[COBOL ACCEPT] %s (최대 %d자): \", fieldName, length));
        
        String input = scanner.nextLine();
        if (input.length() > length) {
            input = input.substring(0, length);
        }
        
        return input;
    }
    
    /**
     * 웹에서 입력 데이터 수신 처리
     */
    public void receiveWebInput(String screenId, Map<String, String> fieldValues) {
        System.out.println(String.format(\"[COBOL ACCEPT] 웹 입력 수신: Screen=%s, Data=%s\", 
            screenId, fieldValues));
        
        // 화면 데이터 업데이트
        Map<String, String> data = screenData.computeIfAbsent(screenId, k -> new HashMap<>());
        data.putAll(fieldValues);
        
        // 대기 중인 입력 요청들 처리
        for (String fieldName : fieldValues.keySet()) {
            String key = screenId + \":\" + fieldName;
            CompletableFuture<Map<String, String>> future = pendingInputs.remove(key);
            
            if (future != null) {
                future.complete(fieldValues);
            }
        }
    }
    
    /**
     * 화면 지우기 (COBOL의 ERASE 기능)
     */
    public void eraseScreen(String screenId) {
        screenData.remove(screenId);
        
        // 빈 화면 데이터 전송
        displayManager.sendToWebSocket(screenId, new HashMap<>());
        
        System.out.println(\"[COBOL ERASE] 화면 지우기: \" + screenId);
    }
    
    /**
     * 커서 위치 이동
     */
    public void setCursor(int line, int column) {
        setCursor(getCurrentScreenId(), line, column);
    }
    
    /**
     * 특정 화면의 커서 위치 이동
     */
    public void setCursor(String screenId, int line, int column) {
        System.out.println(String.format(\"[COBOL CURSOR] Screen: %s, Line: %d, Col: %d\", 
            screenId, line, column));
        
        // 커서 위치 정보를 화면 데이터에 포함
        Map<String, String> data = screenData.computeIfAbsent(screenId, k -> new HashMap<>());
        data.put(\"_cursor_line\", String.valueOf(line));
        data.put(\"_cursor_col\", String.valueOf(column));
        
        displayManager.sendToWebSocket(screenId, data);
    }
    
    /**
     * 화면 속성 설정 (색상, 깜빡임 등)
     */
    public void setScreenAttribute(String screenId, String attribute, String value) {
        Map<String, String> data = screenData.computeIfAbsent(screenId, k -> new HashMap<>());
        data.put(\"_attr_\" + attribute, value);
        
        displayManager.sendToWebSocket(screenId, data);
        
        System.out.println(String.format(\"[COBOL ATTR] Screen: %s, %s = %s\", 
            screenId, attribute, value));
    }
    
    /**
     * 현재 화면 ID 반환 (스레드별로 관리)
     */
    private String getCurrentScreenId() {
        // 현재 실행 중인 COBOL 프로그램의 화면 ID 반환
        // 실제 구현에서는 스레드 로컬이나 컨텍스트에서 가져옴
        String threadName = Thread.currentThread().getName();
        return threadName.contains(\"MAIN001\") ? \"MAIN001\" : 
               threadName.contains(\"SUB001\") ? \"SUB001\" : \"DEFAULT\";
    }
    
    /**
     * 웹 환경 여부 확인
     */
    private boolean isWebEnvironment() {
        // 환경 변수나 시스템 프로퍼티로 확인
        return !\"console\".equals(System.getProperty(\"cobol.display.mode\", \"web\"));
    }
    
    /**
     * 화면 데이터 조회
     */
    public Map<String, String> getScreenData(String screenId) {
        return new HashMap<>(screenData.getOrDefault(screenId, Map.of()));
    }
    
    /**
     * 모든 화면 데이터 조회
     */
    public Map<String, Map<String, String>> getAllScreenData() {
        Map<String, Map<String, String>> result = new HashMap<>();
        screenData.forEach((key, value) -> result.put(key, new HashMap<>(value)));
        return result;
    }
    
    /**
     * 화면 입력 완료 대기
     */
    public Map<String, String> waitForScreenInput(String screenId) {
        try {
            CompletableFuture<Map<String, String>> future = new CompletableFuture<>();
            pendingInputs.put(screenId + \":_complete\", future);
            
            System.out.println(\"[COBOL SCREEN] 화면 입력 대기: \" + screenId);
            
            // 입력 완료까지 대기
            return future.get(60, java.util.concurrent.TimeUnit.SECONDS);
            
        } catch (Exception e) {
            System.err.println(\"화면 입력 대기 중 오류: \" + e.getMessage());
            return new HashMap<>();
        }
    }
    
    /**
     * 화면 입력 완료 신호 처리
     */
    public void completeScreenInput(String screenId, Map<String, String> fieldValues) {
        receiveWebInput(screenId, fieldValues);
        
        // 전체 화면 입력 완료 신호 처리
        String key = screenId + \":_complete\";
        CompletableFuture<Map<String, String>> future = pendingInputs.remove(key);
        
        if (future != null) {
            future.complete(fieldValues);
        }
    }
}