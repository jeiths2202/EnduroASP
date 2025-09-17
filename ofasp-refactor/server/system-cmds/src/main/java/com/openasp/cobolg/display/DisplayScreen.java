package com.openasp.cobolg.display;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * COBOL 표시 화면 정의 클래스
 * COBOL Display Files를 웹 UI로 변환하기 위한 메타데이터
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class DisplayScreen {
    
    private String screenId;
    private String title;
    private String description;
    private int rows = 24;          // COBOL 화면 기본 24행
    private int columns = 80;       // COBOL 화면 기본 80열
    
    @Builder.Default
    private List<DisplayField> fields = new ArrayList<>();
    
    @Builder.Default
    private Map<String, String> attributes = new HashMap<>();
    
    private String backgroundColor = "#000000";  // COBOL 기본 검은 배경
    private String foregroundColor = "#00FF00";  // COBOL 기본 녹색 글자
    
    /**
     * 필드 추가
     */
    public DisplayScreen addField(DisplayField field) {
        if (!fields.contains(field)) {
            fields.add(field);
        }
        return this;
    }
    
    /**
     * 필드 검색
     */
    public DisplayField findField(String fieldName) {
        return fields.stream()
                .filter(field -> fieldName.equals(field.getName()))
                .findFirst()
                .orElse(null);
    }
    
    /**
     * 입력 필드만 추출
     */
    public List<DisplayField> getInputFields() {
        return fields.stream()
                .filter(field -> field.getType() == FieldType.INPUT || 
                                field.getType() == FieldType.INPUT_OUTPUT)
                .toList();
    }
    
    /**
     * 출력 필드만 추출
     */
    public List<DisplayField> getOutputFields() {
        return fields.stream()
                .filter(field -> field.getType() == FieldType.OUTPUT || 
                                field.getType() == FieldType.INPUT_OUTPUT)
                .toList();
    }
    
    /**
     * 화면 검증
     */
    public ValidationResult validate() {
        ValidationResult result = new ValidationResult();
        
        // 화면 크기 검증
        if (rows <= 0 || rows > 50) {
            result.addError("rows", "화면 행수는 1~50 사이여야 합니다: " + rows);
        }
        
        if (columns <= 0 || columns > 200) {
            result.addError("columns", "화면 열수는 1~200 사이여야 합니다: " + columns);
        }
        
        // 필드 위치 검증
        for (DisplayField field : fields) {
            if (field.getRow() > rows) {
                result.addError(field.getName(), 
                    "필드 행 위치가 화면 범위를 벗어났습니다: " + field.getRow());
            }
            
            if (field.getCol() + field.getLength() > columns) {
                result.addError(field.getName(), 
                    "필드가 화면 너비를 벗어났습니다: " + field.getCol() + "+" + field.getLength());
            }
        }
        
        return result;
    }
    
    /**
     * React 컴포넌트 생성
     */
    public String generateReactComponent() {
        StringBuilder jsx = new StringBuilder();
        
        jsx.append("import React, { useState, useEffect } from 'react';\n");
        jsx.append("import './CobolScreen.css';\n\n");
        
        jsx.append("export const ").append(screenId).append(" = ({ data, onFieldChange, onSubmit }) => {\n");
        jsx.append("  const [formData, setFormData] = useState(data || {});\n\n");
        
        jsx.append("  const handleFieldChange = (fieldName, value) => {\n");
        jsx.append("    const newData = { ...formData, [fieldName]: value };\n");
        jsx.append("    setFormData(newData);\n");
        jsx.append("    if (onFieldChange) onFieldChange(fieldName, value, newData);\n");
        jsx.append("  };\n\n");
        
        jsx.append("  return (\n");
        jsx.append("    <div className='cobol-screen' \n");
        jsx.append("         style={{ \n");
        jsx.append("           backgroundColor: '").append(backgroundColor).append("',\n");
        jsx.append("           color: '").append(foregroundColor).append("',\n");
        jsx.append("           width: '").append(columns * 10).append("px',\n");
        jsx.append("           height: '").append(rows * 20).append("px'\n");
        jsx.append("         }}>\n");
        
        jsx.append("      <h2 className='screen-title'>").append(title).append("</h2>\n");
        
        // 필드 생성
        for (DisplayField field : fields) {
            jsx.append(generateFieldJSX(field));
        }
        
        jsx.append("    </div>\n");
        jsx.append("  );\n");
        jsx.append("};\n");
        
        return jsx.toString();
    }
    
    /**
     * 개별 필드 JSX 생성
     */
    private String generateFieldJSX(DisplayField field) {
        StringBuilder jsx = new StringBuilder();
        
        jsx.append("      <div className='field-container' \n");
        jsx.append("           style={{\n");
        jsx.append("             position: 'absolute',\n");
        jsx.append("             top: '").append((field.getRow() - 1) * 20).append("px',\n");
        jsx.append("             left: '").append((field.getCol() - 1) * 10).append("px'\n");
        jsx.append("           }}>\n");
        
        switch (field.getType()) {
            case STATIC:
                jsx.append("        <span className='static-text'>")
                   .append(field.getPrompt())
                   .append("</span>\n");
                break;
                
            case INPUT:
                jsx.append("        <input\n");
                jsx.append("          type='text'\n");
                jsx.append("          name='").append(field.getName()).append("'\n");
                jsx.append("          maxLength={").append(field.getLength()).append("}\n");
                jsx.append("          value={formData['").append(field.getName()).append("'] || ''}\n");
                jsx.append("          onChange={(e) => handleFieldChange('").append(field.getName()).append("', e.target.value)}\n");
                jsx.append("          className='cobol-input'\n");
                jsx.append("          style={{ width: '").append(field.getLength() * 10).append("px' }}\n");
                if (field.isRequired()) {
                    jsx.append("          required\n");
                }
                jsx.append("        />\n");
                break;
                
            case OUTPUT:
                jsx.append("        <span className='output-field'>")
                   .append("{formData['").append(field.getName()).append("'] || ''}")
                   .append("</span>\n");
                break;
                
            case INPUT_OUTPUT:
                jsx.append("        <input\n");
                jsx.append("          type='text'\n");
                jsx.append("          name='").append(field.getName()).append("'\n");
                jsx.append("          maxLength={").append(field.getLength()).append("}\n");
                jsx.append("          value={formData['").append(field.getName()).append("'] || ''}\n");
                jsx.append("          onChange={(e) => handleFieldChange('").append(field.getName()).append("', e.target.value)}\n");
                jsx.append("          className='cobol-input-output'\n");
                jsx.append("        />\n");
                break;
        }
        
        jsx.append("      </div>\n");
        return jsx.toString();
    }
}