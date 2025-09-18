package com.openasp.cobolg.display;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * COBOL 화면 필드 정의 클래스
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DisplayField {
    
    private String name;           // 필드명
    private String prompt;         // 표시 텍스트 (COBOL의 VALUE 절)
    private FieldType type;        // 필드 타입
    private int row;              // 화면 행 위치 (1부터 시작)
    private int col;              // 화면 열 위치 (1부터 시작)  
    private int length;           // 필드 길이
    private String pictureClause; // COBOL PICTURE 절
    private String value;         // 초기값
    private boolean required;     // 필수 입력 여부
    private boolean protected_;   // 보호 필드 여부 (COBOL PROTECTED)
    private boolean justifiedRight; // 우측 정렬 여부
    private boolean blankWhenZero; // 0일 때 공백 표시
    private String foregroundColor; // 전경색
    private String backgroundColor; // 배경색
    private boolean blink;        // 깜빡임 효과
    private boolean bright;       // 밝게 표시
    private boolean reverse;      // 반전 표시
    private boolean underline;    // 밑줄
    
    /**
     * COBOL DISPLAY 명령어에서 필드 생성
     * 예: DISPLAY "고객번호:" LINE 5 COLUMN 10
     */
    public static DisplayField createStaticField(String text, int row, int col) {
        return DisplayField.builder()
                .type(FieldType.STATIC)
                .prompt(text)
                .row(row)
                .col(col)
                .length(text.length())
                .build();
    }
    
    /**
     * COBOL ACCEPT 명령어에서 필드 생성
     * 예: ACCEPT CUSTOMER-ID LINE 5 COLUMN 20
     */
    public static DisplayField createInputField(String name, int row, int col, int length) {
        return DisplayField.builder()
                .name(name)
                .type(FieldType.INPUT)
                .row(row)
                .col(col)
                .length(length)
                .build();
    }
    
    /**
     * COBOL USING 절에서 필드 생성 (입출력)
     * 예: DISPLAY CUSTOMER-NAME LINE 5 COLUMN 20 USING
     */
    public static DisplayField createInputOutputField(String name, int row, int col, int length) {
        return DisplayField.builder()
                .name(name)
                .type(FieldType.INPUT_OUTPUT)
                .row(row)
                .col(col)
                .length(length)
                .build();
    }
    
    /**
     * 출력 전용 필드 생성
     */
    public static DisplayField createOutputField(String name, int row, int col, int length) {
        return DisplayField.builder()
                .name(name)
                .type(FieldType.OUTPUT)
                .row(row)
                .col(col)
                .length(length)
                .build();
    }
    
    /**
     * 필드 검증
     */
    public boolean isValid() {
        return name != null && !name.trim().isEmpty() &&
               row > 0 && col > 0 && length > 0 &&
               type != null;
    }
    
    /**
     * COBOL 화면 속성을 CSS 클래스로 변환
     */
    public String toCssClass() {
        StringBuilder css = new StringBuilder("cobol-field");
        
        if (type != null) {
            css.append(" field-").append(type.name().toLowerCase());
        }
        
        if (protected_) {
            css.append(" protected");
        }
        
        if (justifiedRight) {
            css.append(" justified-right");
        }
        
        if (bright) {
            css.append(" bright");
        }
        
        if (blink) {
            css.append(" blink");
        }
        
        if (reverse) {
            css.append(" reverse");
        }
        
        if (underline) {
            css.append(" underline");
        }
        
        return css.toString();
    }
    
    /**
     * 인라인 스타일 생성
     */
    public String toInlineStyle() {
        StringBuilder style = new StringBuilder();
        
        style.append("position: absolute;");
        style.append("top: ").append((row - 1) * 20).append("px;");
        style.append("left: ").append((col - 1) * 10).append("px;");
        style.append("width: ").append(length * 10).append("px;");
        
        if (foregroundColor != null) {
            style.append("color: ").append(foregroundColor).append(";");
        }
        
        if (backgroundColor != null) {
            style.append("background-color: ").append(backgroundColor).append(";");
        }
        
        if (justifiedRight) {
            style.append("text-align: right;");
        }
        
        return style.toString();
    }
}

/**
 * 필드 타입 열거형
 */
enum FieldType {
    STATIC,         // 정적 텍스트 (COBOL DISPLAY)
    INPUT,          // 입력 전용 (COBOL ACCEPT)
    OUTPUT,         // 출력 전용 (COBOL DISPLAY FROM)
    INPUT_OUTPUT    // 입출력 (COBOL DISPLAY USING)
}