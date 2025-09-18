package com.openasp.cobolg.programs;

import com.openasp.cobolg.data.CobolField;
import com.openasp.cobolg.file.CobolFileManager;
import com.openasp.cobolg.runtime.CobolDisplayRuntime;
import com.openasp.cobolg.runtime.CobolProgram;
import lombok.Data;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Component;

import java.util.Map;

/**
 * COBOL 고객 조회 프로그램 (SUB001)
 * 원본 COBOL을 Java로 변환한 예제
 */
@Component
@CobolProgram(value = "SUB001", 
              description = "Customer Inquiry Program",
              screens = {"SUB001"},
              files = {"CUSTOMER-FILE"})
public class CustomerInquiryProgram {
    
    @Autowired
    private CobolDisplayRuntime displayRuntime;
    
    @Autowired
    private CobolFileManager fileManager;
    
    // DATA DIVISION - Working Storage Section
    @Data
    public static class WorkingStorage {
        @CobolField(pic = "X(10)")
        private String wsCustomerId = "";
        
        @CobolField(pic = "X(30)")
        private String wsCustomerName = "";
        
        @CobolField(pic = "X(50)")
        private String wsCustomerAddr = "";
        
        @CobolField(pic = "X(15)")
        private String wsPhoneNumber = "";
        
        @CobolField(pic = "X(40)")
        private String wsEmailAddr = "";
        
        @CobolField(pic = "X(1)")
        private String wsEndFlag = "N";
        
        @CobolField(pic = "X(50)")
        private String wsMessage = "";
    }
    
    // DATA DIVISION - File Section
    @Data
    public static class CustomerRecord {
        @CobolField(pic = "X(10)", level = 1)
        private String customerId;
        
        @CobolField(pic = "X(30)", level = 5)
        private String customerName;
        
        @CobolField(pic = "X(50)", level = 5)
        private String customerAddr;
        
        @CobolField(pic = "X(15)", level = 5)
        private String phoneNumber;
        
        @CobolField(pic = "X(40)", level = 5)
        private String emailAddr;
    }
    
    private final WorkingStorage ws = new WorkingStorage();
    private CobolFileManager.IndexedFile<CustomerRecord> customerFile;
    
    /**
     * PROCEDURE DIVISION - Main Process
     */
    public void execute() {
        try {
            initialization();
            mainProcess();
            termination();
        } catch (Exception e) {
            System.err.println("프로그램 실행 오류: " + e.getMessage());
            e.printStackTrace();
        }
    }
    
    /**
     * 초기화 섹션
     */
    private void initialization() {
        // COBOL: OPEN INPUT CUSTOMER-FILE
        customerFile = fileManager.openIndexedFile(
            "CUSTOMER-FILE", 
            CustomerRecord.class, 
            "customerId",
            CobolFileManager.FileMode.INPUT
        );
        
        // 초기 화면 표시
        displayScreen();
    }
    
    /**
     * 메인 처리 섹션
     */
    private void mainProcess() {
        ws.setWsEndFlag("N");
        
        while (!"Y".equals(ws.getWsEndFlag())) {
            // 고객 ID 입력 받기
            acceptCustomerId();
            
            if (!"Y".equals(ws.getWsEndFlag())) {
                // 고객 정보 조회
                readCustomerRecord();
                
                // 결과 표시
                displayCustomerInfo();
                
                // 계속 여부 확인
                checkContinue();
            }
        }
    }
    
    /**
     * 종료 처리 섹션
     */
    private void termination() {
        if (customerFile != null) {
            try {
                customerFile.close();
            } catch (Exception e) {
                System.err.println("파일 닫기 오류: " + e.getMessage());
            }
        }
        
        // 종료 메시지 표시
        displayRuntime.display("SUB001", "프로그램을 종료합니다.", 23, 10);
    }
    
    /**
     * 화면 표시 섹션
     */
    private void displayScreen() {
        // COBOL DISPLAY 문들을 Java로 변환
        displayRuntime.eraseScreen("SUB001");
        
        // 제목 표시
        displayRuntime.display("SUB001", "═══════════════════════════════════════", 2, 20);
        displayRuntime.display("SUB001", "           고객 조회 시스템", 3, 20);
        displayRuntime.display("SUB001", "═══════════════════════════════════════", 4, 20);
        
        // 입력 필드 라벨 표시
        displayRuntime.display("SUB001", "고객번호:", 8, 10);
        displayRuntime.display("SUB001", "고객명:", 10, 10);
        displayRuntime.display("SUB001", "주소:", 12, 10);
        displayRuntime.display("SUB001", "전화번호:", 14, 10);
        displayRuntime.display("SUB001", "이메일:", 16, 10);
        
        // 기능키 안내
        displayRuntime.display("SUB001", "F3=종료 F12=취소 Enter=조회", 22, 10);
    }
    
    /**
     * 고객 ID 입력 받기
     */
    private void acceptCustomerId() {
        // 입력 프롬프트 표시
        displayRuntime.display("SUB001", "조회할 고객번호를 입력하세요:", 6, 10);
        
        // COBOL ACCEPT 문을 Java로 변환
        String inputId = displayRuntime.accept("SUB001", "CUSTOMER-ID", 8, 20, 10);
        
        // 입력값 검증
        if (inputId == null || inputId.trim().isEmpty()) {
            ws.setWsMessage("고객번호를 입력해주세요.");
            displayError();
            return;
        }
        
        // F3 키 (종료) 체크
        if ("F3".equalsIgnoreCase(inputId)) {
            ws.setWsEndFlag("Y");
            return;
        }
        
        ws.setWsCustomerId(inputId.trim().toUpperCase());
    }
    
    /**
     * 고객 레코드 읽기
     */
    private void readCustomerRecord() {
        try {
            // COBOL: READ CUSTOMER-FILE KEY IS CUSTOMER-ID
            CustomerRecord customer = customerFile.readByKey(ws.getWsCustomerId());
            
            if (customer == null) {
                // 고객 정보 없음
                ws.setWsMessage("고객번호 " + ws.getWsCustomerId() + "를 찾을 수 없습니다.");
                clearCustomerInfo();
                displayError();
            } else {
                // 고객 정보 설정
                ws.setWsCustomerName(customer.getCustomerName());
                ws.setWsCustomerAddr(customer.getCustomerAddr());
                ws.setWsPhoneNumber(customer.getPhoneNumber());
                ws.setWsEmailAddr(customer.getEmailAddr());
                ws.setWsMessage("조회가 완료되었습니다.");
            }
            
        } catch (Exception e) {
            ws.setWsMessage("파일 읽기 오류: " + e.getMessage());
            clearCustomerInfo();
            displayError();
        }
    }
    
    /**
     * 고객 정보 표시
     */
    private void displayCustomerInfo() {
        // 고객 정보를 화면에 표시
        Map<String, String> fieldValues = Map.of(
            "CUSTOMER-ID", ws.getWsCustomerId(),
            "CUSTOMER-NAME", ws.getWsCustomerName(),
            "CUSTOMER-ADDR", ws.getWsCustomerAddr(),
            "PHONE-NUMBER", ws.getWsPhoneNumber(),
            "EMAIL-ADDR", ws.getWsEmailAddr()
        );
        
        // 필드별로 표시
        displayRuntime.display("SUB001", ws.getWsCustomerId(), 8, 20);
        displayRuntime.display("SUB001", ws.getWsCustomerName(), 10, 20);
        displayRuntime.display("SUB001", ws.getWsCustomerAddr(), 12, 20);
        displayRuntime.display("SUB001", ws.getWsPhoneNumber(), 14, 20);
        displayRuntime.display("SUB001", ws.getWsEmailAddr(), 16, 20);
        
        // 메시지 표시
        displayRuntime.display("SUB001", ws.getWsMessage(), 20, 10);
        
        // 웹소켓으로 전체 데이터 전송
        displayRuntime.receiveWebInput("SUB001", fieldValues);
    }
    
    /**
     * 고객 정보 지우기
     */
    private void clearCustomerInfo() {
        ws.setWsCustomerName("");
        ws.setWsCustomerAddr("");
        ws.setWsPhoneNumber("");
        ws.setWsEmailAddr("");
        
        // 화면에서 정보 지우기
        displayRuntime.display("SUB001", "                              ", 10, 20);
        displayRuntime.display("SUB001", "                                                  ", 12, 20);
        displayRuntime.display("SUB001", "               ", 14, 20);
        displayRuntime.display("SUB001", "                                        ", 16, 20);
    }
    
    /**
     * 오류 메시지 표시
     */
    private void displayError() {
        // 오류 메시지를 빨간색으로 표시
        displayRuntime.setScreenAttribute("SUB001", "foreground_color", "#FF0000");
        displayRuntime.display("SUB001", ws.getWsMessage(), 20, 10);
        
        // 3초 후 원래 색상으로 복원
        try {
            Thread.sleep(3000);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        displayRuntime.setScreenAttribute("SUB001", "foreground_color", "#00FF00");
        displayRuntime.display("SUB001", "                                                  ", 20, 10);
    }
    
    /**
     * 계속 여부 확인
     */
    private void checkContinue() {
        displayRuntime.display("SUB001", "다른 고객을 조회하시겠습니까? (Y/N):", 18, 10);
        
        String response = displayRuntime.accept("SUB001", "CONTINUE-FLAG", 18, 45, 1);
        
        if ("N".equalsIgnoreCase(response) || "F3".equalsIgnoreCase(response)) {
            ws.setWsEndFlag("Y");
        } else {
            // 화면 지우고 다시 시작
            clearCustomerInfo();
            displayRuntime.display("SUB001", "                                         ", 18, 10);
            displayRuntime.display("SUB001", "                                                  ", 20, 10);
        }
    }
    
    /**
     * 외부에서 웹 입력 데이터 수신 (REST API에서 호출)
     */
    public void handleWebInput(Map<String, String> inputData) {
        // 웹에서 받은 입력 데이터 처리
        if (inputData.containsKey("CUSTOMER-ID")) {
            ws.setWsCustomerId(inputData.get("CUSTOMER-ID"));
            readCustomerRecord();
            displayCustomerInfo();
        }
        
        if (inputData.containsKey("CONTINUE-FLAG")) {
            String continueFlag = inputData.get("CONTINUE-FLAG");
            if ("N".equalsIgnoreCase(continueFlag)) {
                ws.setWsEndFlag("Y");
            }
        }
    }
    
    /**
     * 현재 화면 상태 조회 (REST API에서 호출)
     */
    public Map<String, String> getCurrentScreenState() {
        return Map.of(
            "CUSTOMER-ID", ws.getWsCustomerId(),
            "CUSTOMER-NAME", ws.getWsCustomerName(),
            "CUSTOMER-ADDR", ws.getWsCustomerAddr(),
            "PHONE-NUMBER", ws.getWsPhoneNumber(),
            "EMAIL-ADDR", ws.getWsEmailAddr(),
            "MESSAGE", ws.getWsMessage(),
            "END-FLAG", ws.getWsEndFlag()
        );
    }
}