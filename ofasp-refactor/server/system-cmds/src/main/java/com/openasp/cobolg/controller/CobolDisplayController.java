package com.openasp.cobolg.controller;

import com.openasp.cobolg.display.CobolDisplayManager;
import com.openasp.cobolg.display.DisplayScreen;
import com.openasp.cobolg.display.ValidationResult;
import com.openasp.cobolg.programs.CustomerInquiryProgram;
import com.openasp.cobolg.runtime.CobolDisplayRuntime;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.Set;

/**
 * COBOL 화면 처리 REST API 컨트롤러
 * 웹 프론트엔드와 COBOL 프로그램 간의 인터페이스 제공
 */
@RestController
@RequestMapping("/api/cobol/display")
@CrossOrigin(origins = "*")
public class CobolDisplayController {
    
    @Autowired
    private CobolDisplayManager displayManager;
    
    @Autowired
    private CobolDisplayRuntime displayRuntime;
    
    @Autowired
    private CustomerInquiryProgram customerInquiryProgram;
    
    /**
     * 화면 정의 조회
     */
    @GetMapping("/screen/{screenId}")
    public ResponseEntity<DisplayScreen> getScreen(@PathVariable String screenId) {
        DisplayScreen screen = displayManager.getScreen(screenId);
        if (screen == null) {
            return ResponseEntity.notFound().build();
        }
        return ResponseEntity.ok(screen);
    }
    
    /**
     * 화면을 SMED 형식으로 조회 (기존 시스템 호환)
     */
    @GetMapping("/screen/{screenId}/smed")
    public ResponseEntity<Map<String, Object>> getScreenSmed(@PathVariable String screenId) {
        try {
            Map<String, Object> smedData = displayManager.convertToSmedFormat(screenId);
            return ResponseEntity.ok(smedData);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }
    
    /**
     * 모든 화면 목록 조회
     */
    @GetMapping("/screens")
    public ResponseEntity<Set<String>> getAllScreens() {
        Set<String> screenIds = displayManager.getAllScreenIds();
        return ResponseEntity.ok(screenIds);
    }
    
    /**
     * 화면 입력 데이터 처리
     */
    @PostMapping("/screen/{screenId}/input")
    public ResponseEntity<Map<String, Object>> processScreenInput(
            @PathVariable String screenId,
            @RequestBody Map<String, String> inputData) {
        
        try {
            // 입력 데이터를 런타임에 전달
            displayRuntime.receiveWebInput(screenId, inputData);
            
            // 프로그램별 처리
            Map<String, Object> response = new HashMap<>();
            
            switch (screenId) {
                case "SUB001":
                    customerInquiryProgram.handleWebInput(inputData);
                    response.put("screenData", customerInquiryProgram.getCurrentScreenState());
                    break;
                    
                case "MAIN001":
                    response = processMainMenuInput(inputData);
                    break;
                    
                default:
                    response.put("message", "화면 처리 완료");
                    response.put("screenData", displayRuntime.getScreenData(screenId));
            }
            
            response.put("status", "success");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * 메인 메뉴 입력 처리
     */
    private Map<String, Object> processMainMenuInput(Map<String, String> inputData) {
        Map<String, Object> response = new HashMap<>();
        
        String selection = inputData.get("SEL");
        if (selection != null) {
            switch (selection.trim()) {
                case "1":
                    // 고객 조회로 이동
                    response.put("action", "navigate");
                    response.put("targetScreen", "SUB001");
                    response.put("message", "고객 조회 화면으로 이동합니다.");
                    break;
                    
                case "2":
                    // 파일 처리로 이동
                    response.put("action", "navigate");
                    response.put("targetScreen", "FILE-PROCESS");
                    response.put("message", "파일 처리 화면으로 이동합니다.");
                    break;
                    
                case "3":
                    // 리포트 생성으로 이동
                    response.put("action", "navigate");
                    response.put("targetScreen", "REPORT-GEN");
                    response.put("message", "리포트 생성 화면으로 이동합니다.");
                    break;
                    
                case "9":
                    // 프로그램 종료
                    response.put("action", "exit");
                    response.put("message", "프로그램을 종료합니다.");
                    break;
                    
                default:
                    response.put("action", "error");
                    response.put("message", "잘못된 선택입니다. 1, 2, 3, 9 중에서 선택하세요.");
            }
        } else {
            response.put("action", "error");
            response.put("message", "옵션을 선택해주세요.");
        }
        
        return response;
    }
    
    /**
     * 기능키 처리 (F1-F12)
     */
    @PostMapping("/screen/{screenId}/function-key")
    public ResponseEntity<Map<String, Object>> processFunctionKey(
            @PathVariable String screenId,
            @RequestBody Map<String, Object> keyData) {
        
        Map<String, Object> response = new HashMap<>();
        String key = (String) keyData.get("key");
        
        @SuppressWarnings("unchecked")
        Map<String, String> fieldValues = (Map<String, String>) keyData.get("fieldValues");
        
        try {
            switch (key) {
                case "F3":
                    // 종료
                    response.put("action", "exit");
                    response.put("message", "프로그램을 종료합니다.");
                    break;
                    
                case "F12":
                    // 취소/이전
                    response.put("action", "cancel");
                    response.put("message", "이전 화면으로 돌아갑니다.");
                    break;
                    
                case "Enter":
                    // 입력 완료
                    return processScreenInput(screenId, fieldValues);
                    
                default:
                    response.put("action", "ignore");
                    response.put("message", "지원되지 않는 기능키입니다: " + key);
            }
            
            response.put("status", "success");
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, Object> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * 화면 상태 조회
     */
    @GetMapping("/screen/{screenId}/state")
    public ResponseEntity<Map<String, String>> getScreenState(@PathVariable String screenId) {
        Map<String, String> screenData = displayRuntime.getScreenData(screenId);
        return ResponseEntity.ok(screenData);
    }
    
    /**
     * 화면 검증
     */
    @PostMapping("/screen/{screenId}/validate")
    public ResponseEntity<ValidationResult> validateScreen(@PathVariable String screenId) {
        ValidationResult result = displayManager.validateScreen(screenId);
        return ResponseEntity.ok(result);
    }
    
    /**
     * React 컴포넌트 생성
     */
    @PostMapping("/screen/{screenId}/generate-component")
    public ResponseEntity<Map<String, String>> generateReactComponent(@PathVariable String screenId) {
        try {
            displayManager.generateReactComponent(screenId);
            
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "React 컴포넌트가 생성되었습니다.");
            response.put("componentPath", "/components/generated/" + screenId + ".tsx");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * 화면 정의 저장
     */
    @PostMapping("/screen/{screenId}/save")
    public ResponseEntity<Map<String, String>> saveScreenDefinition(@PathVariable String screenId) {
        try {
            displayManager.saveScreenDefinition(screenId);
            
            Map<String, String> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", "화면 정의가 저장되었습니다.");
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            Map<String, String> errorResponse = new HashMap<>();
            errorResponse.put("status", "error");
            errorResponse.put("message", e.getMessage());
            return ResponseEntity.badRequest().body(errorResponse);
        }
    }
    
    /**
     * 프로그램 실행
     */
    @PostMapping("/program/{programId}/execute")
    public ResponseEntity<Map<String, Object>> executeProgram(
            @PathVariable String programId,
            @RequestBody(required = false) Map<String, String> parameters) {
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            switch (programId) {
                case "SUB001":
                    // 고객 조회 프로그램 실행
                    customerInquiryProgram.execute();
                    response.put("status", "success");
                    response.put("message", "고객 조회 프로그램이 시작되었습니다.");
                    response.put("screenId", "SUB001");
                    response.put("screenData", customerInquiryProgram.getCurrentScreenState());
                    break;
                    
                default:
                    response.put("status", "error");
                    response.put("message", "지원되지 않는 프로그램입니다: " + programId);
                    return ResponseEntity.badRequest().body(response);
            }
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            response.put("status", "error");
            response.put("message", "프로그램 실행 중 오류 발생: " + e.getMessage());
            return ResponseEntity.badRequest().body(response);
        }
    }
    
    /**
     * 현재 실행 중인 프로그램 상태 조회
     */
    @GetMapping("/program/{programId}/status")
    public ResponseEntity<Map<String, Object>> getProgramStatus(@PathVariable String programId) {
        Map<String, Object> response = new HashMap<>();
        
        switch (programId) {
            case "SUB001":
                response.put("status", "running");
                response.put("screenData", customerInquiryProgram.getCurrentScreenState());
                response.put("currentScreen", "SUB001");
                break;
                
            default:
                response.put("status", "not_found");
                response.put("message", "프로그램을 찾을 수 없습니다: " + programId);
                return ResponseEntity.notFound().build();
        }
        
        return ResponseEntity.ok(response);
    }
}