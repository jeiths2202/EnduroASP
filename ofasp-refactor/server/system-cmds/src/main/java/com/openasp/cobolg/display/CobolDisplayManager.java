package com.openasp.cobolg.display;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

import javax.annotation.PostConstruct;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * COBOL 화면 표시 관리자
 * 기존 SMED 시스템과 통합하여 COBOL Display Files를 웹 UI로 변환
 */
@Component
public class CobolDisplayManager {
    
    private final Map<String, DisplayScreen> screens = new ConcurrentHashMap<>();
    private final ObjectMapper objectMapper = new ObjectMapper();
    
    @Autowired
    private RestTemplate restTemplate;
    
    private final String displayFilesPath = "src/main/resources/display-files";
    private final String reactComponentsPath = "src/main/webapp/components/generated";
    
    @PostConstruct
    public void initializeScreens() {
        loadDisplayFiles();
        createDefaultScreens();
    }
    
    /**
     * 화면 정의 파일 로드
     */
    private void loadDisplayFiles() {
        try {
            Path displayDir = Paths.get(displayFilesPath);
            if (!Files.exists(displayDir)) {
                Files.createDirectories(displayDir);
                return;
            }
            
            Files.walk(displayDir)
                 .filter(path -> path.toString().endsWith(".json"))
                 .forEach(this::loadDisplayFile);
                 
        } catch (IOException e) {
            System.err.println("화면 정의 파일 로드 실패: " + e.getMessage());
        }
    }
    
    /**
     * 개별 화면 정의 파일 로드
     */
    private void loadDisplayFile(Path filePath) {
        try {
            String content = Files.readString(filePath);
            DisplayScreen screen = objectMapper.readValue(content, DisplayScreen.class);
            screens.put(screen.getScreenId(), screen);
            
            System.out.println("화면 정의 로드 완료: " + screen.getScreenId());
            
        } catch (IOException e) {
            System.err.println("화면 정의 파일 로드 실패 - " + filePath + ": " + e.getMessage());
        }
    }
    
    /**
     * 기본 화면들 생성 (기존 SMED 시스템과 호환)
     */
    private void createDefaultScreens() {
        // MAIN001 화면 정의
        DisplayScreen mainScreen = DisplayScreen.builder()
            .screenId("MAIN001")
            .title("ASP COBOL G System - Main Menu")
            .description("메인 메뉴 화면")
            .build()
            .addField(DisplayField.createStaticField("ASP COBOL G System", 3, 25))
            .addField(DisplayField.createStaticField("================", 4, 25))
            .addField(DisplayField.createStaticField("1. Customer Inquiry", 8, 20))
            .addField(DisplayField.createStaticField("2. File Processing", 10, 20))
            .addField(DisplayField.createStaticField("3. Report Generation", 12, 20))
            .addField(DisplayField.createStaticField("9. Exit", 16, 20))
            .addField(DisplayField.createStaticField("Select Option:", 20, 20))
            .addField(DisplayField.createInputField("SEL", 20, 35, 1));
        
        screens.put("MAIN001", mainScreen);
        
        // SUB001 화면 정의 (Customer Inquiry)
        DisplayScreen subScreen = DisplayScreen.builder()
            .screenId("SUB001")
            .title("Customer Inquiry")
            .description("고객 조회 화면")
            .build()
            .addField(DisplayField.createStaticField("Customer Inquiry", 3, 30))
            .addField(DisplayField.createStaticField("===============", 4, 30))
            .addField(DisplayField.createStaticField("Customer ID:", 8, 10))
            .addField(DisplayField.createInputField("CUSTOMER-ID", 8, 25, 10))
            .addField(DisplayField.createStaticField("Customer Name:", 10, 10))
            .addField(DisplayField.createOutputField("CUSTOMER-NAME", 10, 25, 30))
            .addField(DisplayField.createStaticField("Address:", 12, 10))
            .addField(DisplayField.createOutputField("CUSTOMER-ADDR", 12, 25, 50))
            .addField(DisplayField.createStaticField("F3=Exit F12=Cancel", 22, 10));
        
        screens.put("SUB001", subScreen);
        
        // 추가 기본 화면들...
        createCustomerInputScreen();
        createFileProcessingScreen();
    }
    
    /**
     * 고객 입력 화면 생성
     */
    private void createCustomerInputScreen() {
        DisplayScreen screen = DisplayScreen.builder()
            .screenId("CUSTOMER-INPUT")
            .title("Customer Data Entry")
            .description("고객 정보 입력 화면")
            .build()
            .addField(DisplayField.createStaticField("Customer Data Entry", 2, 25))
            .addField(DisplayField.createStaticField("==================", 3, 25))
            .addField(DisplayField.createStaticField("Customer ID:", 6, 5))
            .addField(DisplayField.createInputField("CUSTOMER-ID", 6, 20, 10))
            .addField(DisplayField.createStaticField("Name:", 8, 5))
            .addField(DisplayField.createInputField("CUSTOMER-NAME", 8, 20, 30))
            .addField(DisplayField.createStaticField("Address:", 10, 5))
            .addField(DisplayField.createInputField("CUSTOMER-ADDR", 10, 20, 50))
            .addField(DisplayField.createStaticField("Phone:", 12, 5))
            .addField(DisplayField.createInputField("PHONE-NUMBER", 12, 20, 15))
            .addField(DisplayField.createStaticField("Email:", 14, 5))
            .addField(DisplayField.createInputField("EMAIL-ADDR", 14, 20, 40))
            .addField(DisplayField.createStaticField("Enter=Save F3=Exit F12=Cancel", 22, 5));
        
        screens.put("CUSTOMER-INPUT", screen);
    }
    
    /**
     * 파일 처리 화면 생성
     */
    private void createFileProcessingScreen() {
        DisplayScreen screen = DisplayScreen.builder()
            .screenId("FILE-PROCESS")
            .title("File Processing")
            .description("파일 처리 화면")
            .build()
            .addField(DisplayField.createStaticField("File Processing Menu", 2, 25))
            .addField(DisplayField.createStaticField("===================", 3, 25))
            .addField(DisplayField.createStaticField("Input File:", 6, 5))
            .addField(DisplayField.createInputField("INPUT-FILE", 6, 20, 30))
            .addField(DisplayField.createStaticField("Output File:", 8, 5))
            .addField(DisplayField.createInputField("OUTPUT-FILE", 8, 20, 30))
            .addField(DisplayField.createStaticField("Processing Type:", 10, 5))
            .addField(DisplayField.createInputField("PROCESS-TYPE", 10, 25, 1))
            .addField(DisplayField.createStaticField("(S)equential (I)ndexed (R)elative", 11, 25))
            .addField(DisplayField.createStaticField("Records Processed:", 16, 5))
            .addField(DisplayField.createOutputField("RECORD-COUNT", 16, 25, 10))
            .addField(DisplayField.createStaticField("Status:", 18, 5))
            .addField(DisplayField.createOutputField("PROCESS-STATUS", 18, 15, 20))
            .addField(DisplayField.createStaticField("Enter=Process F3=Exit", 22, 5));
        
        screens.put("FILE-PROCESS", screen);
    }
    
    /**
     * 화면 조회
     */
    public DisplayScreen getScreen(String screenId) {
        return screens.get(screenId);
    }
    
    /**
     * 화면 등록
     */
    public void registerScreen(DisplayScreen screen) {
        screens.put(screen.getScreenId(), screen);
    }
    
    /**
     * COBOL DISPLAY 문 처리
     * 예: DISPLAY \"Customer ID:\" LINE 5 COLUMN 10
     */
    public void processDisplayStatement(String screenId, String text, int line, int column) {
        DisplayScreen screen = screens.computeIfAbsent(screenId, 
            id -> DisplayScreen.builder().screenId(id).title(id).build());
        
        DisplayField field = DisplayField.createStaticField(text, line, column);
        screen.addField(field);
    }
    
    /**
     * COBOL ACCEPT 문 처리
     * 예: ACCEPT CUSTOMER-ID LINE 5 COLUMN 25
     */
    public void processAcceptStatement(String screenId, String fieldName, int line, int column, int length) {
        DisplayScreen screen = screens.computeIfAbsent(screenId, 
            id -> DisplayScreen.builder().screenId(id).title(id).build());
        
        DisplayField field = DisplayField.createInputField(fieldName, line, column, length);
        screen.addField(field);
    }
    
    /**
     * 화면을 SMED 형식으로 변환 (기존 시스템과 호환)
     */
    public Map<String, Object> convertToSmedFormat(String screenId) {
        DisplayScreen screen = screens.get(screenId);
        if (screen == null) {
            throw new IllegalArgumentException("화면을 찾을 수 없습니다: " + screenId);
        }
        
        Map<String, Object> smedData = new HashMap<>();
        smedData.put("screenId", screenId);
        smedData.put("title", screen.getTitle());
        
        List<Map<String, Object>> fields = new ArrayList<>();
        for (DisplayField field : screen.getFields()) {
            Map<String, Object> smedField = new HashMap<>();
            smedField.put("name", field.getName() != null ? field.getName() : "field_" + fields.size());
            smedField.put("row", field.getRow());
            smedField.put("col", field.getCol());
            smedField.put("length", field.getLength());
            smedField.put("type", field.getType().name().toLowerCase());
            
            if (field.getPrompt() != null) {
                smedField.put("prompt", field.getPrompt());
                smedField.put("text", field.getPrompt()); // SMED 호환성
            }
            
            if (field.getValue() != null && !field.getValue().isEmpty()) {
                smedField.put("value", field.getValue());
            }
            
            fields.add(smedField);
        }
        
        smedData.put("fields", fields);
        return smedData;
    }
    
    /**
     * 화면 데이터를 WebSocket으로 전송 (기존 SMED 시스템 호환)
     */
    public void sendToWebSocket(String screenId, Map<String, String> fieldValues) {
        try {
            Map<String, Object> smedData = convertToSmedFormat(screenId);
            
            // 필드 값 업데이트
            @SuppressWarnings("unchecked")
            List<Map<String, Object>> fields = (List<Map<String, Object>>) smedData.get("fields");
            
            for (Map<String, Object> field : fields) {
                String fieldName = (String) field.get("name");
                if (fieldValues.containsKey(fieldName)) {
                    field.put("value", fieldValues.get(fieldName));
                }
            }
            
            // WebSocket으로 전송
            String jsonData = objectMapper.writeValueAsString(smedData);
            
            // 기존 SMED 시스템의 broadcast endpoint 호출
            try {
                Map<String, Object> broadcastData = new HashMap<>();
                broadcastData.put("type", "smed_display");
                broadcastData.put("data", smedData);
                
                restTemplate.postForEntity("http://localhost:3001/broadcast-smed", 
                    broadcastData, String.class);
                    
                System.out.println("SMED 데이터 WebSocket 전송 완료: " + screenId);
                
            } catch (Exception e) {
                System.err.println("WebSocket 전송 실패: " + e.getMessage());
                
                // 대체 방법: 파일로 저장
                saveSmedDataToFile(screenId, jsonData);
            }
            
        } catch (JsonProcessingException e) {
            System.err.println("SMED 데이터 JSON 변환 실패: " + e.getMessage());
        }
    }
    
    /**
     * SMED 데이터를 파일로 저장 (fallback 방법)
     */
    private void saveSmedDataToFile(String screenId, String jsonData) {
        try {
            Path outputPath = Paths.get("/tmp/smed_" + screenId + "_" + System.currentTimeMillis() + ".json");
            Files.writeString(outputPath, jsonData);
            System.out.println("SMED 데이터 파일 저장: " + outputPath);
        } catch (IOException e) {
            System.err.println("SMED 데이터 파일 저장 실패: " + e.getMessage());
        }
    }
    
    /**
     * React 컴포넌트 생성 및 저장
     */
    public void generateReactComponent(String screenId) {
        DisplayScreen screen = screens.get(screenId);
        if (screen == null) {
            throw new IllegalArgumentException("화면을 찾을 수 없습니다: " + screenId);
        }
        
        try {
            // React 컴포넌트 생성
            String jsx = screen.generateReactComponent();
            
            // 파일로 저장
            Path componentDir = Paths.get(reactComponentsPath);
            if (!Files.exists(componentDir)) {
                Files.createDirectories(componentDir);
            }
            
            Path componentFile = componentDir.resolve(screenId + ".tsx");
            Files.writeString(componentFile, jsx);
            
            System.out.println("React 컴포넌트 생성 완료: " + componentFile);
            
            // CSS 파일도 생성
            generateCssFile(screenId, screen);
            
        } catch (IOException e) {
            System.err.println("React 컴포넌트 생성 실패: " + e.getMessage());
        }
    }
    
    /**
     * CSS 파일 생성
     */
    private void generateCssFile(String screenId, DisplayScreen screen) throws IOException {
        StringBuilder css = new StringBuilder();
        
        css.append("/* Generated CSS for COBOL screen: ").append(screenId).append(" */\n\n");
        
        css.append(".cobol-screen {\n");
        css.append("  font-family: 'Courier New', monospace;\n");
        css.append("  font-size: 14px;\n");
        css.append("  line-height: 20px;\n");
        css.append("  position: relative;\n");
        css.append("  background: ").append(screen.getBackgroundColor()).append(";\n");
        css.append("  color: ").append(screen.getForegroundColor()).append(";\n");
        css.append("  padding: 20px;\n");
        css.append("  border: 2px solid #333;\n");
        css.append("  overflow: hidden;\n");
        css.append("}\n\n");
        
        css.append(".screen-title {\n");
        css.append("  text-align: center;\n");
        css.append("  margin-bottom: 20px;\n");
        css.append("  color: ").append(screen.getForegroundColor()).append(";\n");
        css.append("}\n\n");
        
        css.append(".field-container {\n");
        css.append("  position: absolute;\n");
        css.append("}\n\n");
        
        css.append(".static-text {\n");
        css.append("  color: ").append(screen.getForegroundColor()).append(";\n");
        css.append("  user-select: none;\n");
        css.append("}\n\n");
        
        css.append(".cobol-input {\n");
        css.append("  background: transparent;\n");
        css.append("  border: none;\n");
        css.append("  border-bottom: 1px solid ").append(screen.getForegroundColor()).append(";\n");
        css.append("  color: ").append(screen.getForegroundColor()).append(";\n");
        css.append("  font: inherit;\n");
        css.append("  outline: none;\n");
        css.append("  padding: 0;\n");
        css.append("}\n\n");
        
        css.append(".cobol-input:focus {\n");
        css.append("  background: rgba(0, 255, 0, 0.1);\n");
        css.append("  border-bottom: 2px solid #00FF00;\n");
        css.append("}\n\n");
        
        css.append(".output-field {\n");
        css.append("  color: #FFFF00;\n");
        css.append("  background: rgba(255, 255, 0, 0.1);\n");
        css.append("  padding: 2px;\n");
        css.append("}\n\n");
        
        css.append(".cobol-input-output {\n");
        css.append("  background: rgba(255, 255, 255, 0.1);\n");
        css.append("  border: 1px solid ").append(screen.getForegroundColor()).append(";\n");
        css.append("  color: ").append(screen.getForegroundColor()).append(";\n");
        css.append("  font: inherit;\n");
        css.append("  outline: none;\n");
        css.append("  padding: 2px;\n");
        css.append("}\n");
        
        // CSS 파일 저장
        Path cssFile = Paths.get(reactComponentsPath, screenId + ".css");
        Files.writeString(cssFile, css.toString());
        
        System.out.println("CSS 파일 생성 완료: " + cssFile);
    }
    
    /**
     * 화면 검증
     */
    public ValidationResult validateScreen(String screenId) {
        DisplayScreen screen = screens.get(screenId);
        if (screen == null) {
            ValidationResult result = new ValidationResult();
            result.addError("screen", "화면을 찾을 수 없습니다: " + screenId);
            return result;
        }
        
        return screen.validate();
    }
    
    /**
     * 등록된 모든 화면 ID 목록 반환
     */
    public Set<String> getAllScreenIds() {
        return new HashSet<>(screens.keySet());
    }
    
    /**
     * 화면 정의를 JSON 파일로 저장
     */
    public void saveScreenDefinition(String screenId) {
        DisplayScreen screen = screens.get(screenId);
        if (screen == null) {
            throw new IllegalArgumentException("화면을 찾을 수 없습니다: " + screenId);
        }
        
        try {
            Path displayDir = Paths.get(displayFilesPath);
            if (!Files.exists(displayDir)) {
                Files.createDirectories(displayDir);
            }
            
            String json = objectMapper.writerWithDefaultPrettyPrinter()
                                    .writeValueAsString(screen);
            
            Path jsonFile = displayDir.resolve(screenId + ".json");
            Files.writeString(jsonFile, json);
            
            System.out.println("화면 정의 저장 완료: " + jsonFile);
            
        } catch (IOException e) {
            System.err.println("화면 정의 저장 실패: " + e.getMessage());
        }
    }
}