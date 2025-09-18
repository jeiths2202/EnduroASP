package com.openasp.cobolg.file;

import com.openasp.cobolg.data.CobolDataType;
import com.openasp.cobolg.data.CobolField;

import java.lang.reflect.Field;
import java.util.ArrayList;
import java.util.List;

/**
 * COBOL 레코드 파싱 및 포맷팅 클래스
 * Java 객체와 COBOL 레코드 문자열 간 변환 처리
 */
public class CobolRecordParser<T> {
    
    private final Class<T> recordClass;
    private final List<FieldMapping> fieldMappings;
    
    public CobolRecordParser(Class<T> recordClass) {
        this.recordClass = recordClass;
        this.fieldMappings = analyzeFields(recordClass);
    }
    
    /**
     * COBOL 레코드 문자열을 Java 객체로 파싱
     */
    public T parseRecord(String recordLine) {
        try {
            T instance = recordClass.getDeclaredConstructor().newInstance();
            
            int currentPosition = 0;
            for (FieldMapping mapping : fieldMappings) {
                String fieldValue = extractFieldValue(recordLine, currentPosition, mapping.length);
                Object convertedValue = mapping.dataType.convertToJava(fieldValue, mapping.pictureClause);
                
                mapping.field.setAccessible(true);
                mapping.field.set(instance, convertedValue);
                
                currentPosition += mapping.length;
            }
            
            return instance;
            
        } catch (Exception e) {
            throw new CobolFileException("레코드 파싱 실패: " + recordLine, e);
        }
    }
    
    /**
     * Java 객체를 COBOL 레코드 문자열로 포맷팅
     */
    public String formatRecord(T record) {
        try {
            StringBuilder recordLine = new StringBuilder();
            
            for (FieldMapping mapping : fieldMappings) {
                mapping.field.setAccessible(true);
                Object fieldValue = mapping.field.get(record);
                
                String cobolValue = mapping.dataType.convertFromJava(fieldValue, mapping.pictureClause);
                recordLine.append(cobolValue);
            }
            
            return recordLine.toString();
            
        } catch (Exception e) {
            throw new CobolFileException("레코드 포맷팅 실패: " + record, e);
        }
    }
    
    /**
     * 특정 필드 값 추출
     */
    public String extractFieldValue(T record, String fieldName) {
        try {
            Field field = findField(fieldName);
            field.setAccessible(true);
            Object value = field.get(record);
            
            return value != null ? value.toString() : "";
            
        } catch (Exception e) {
            throw new CobolFileException("필드 값 추출 실패: " + fieldName, e);
        }
    }
    
    /**
     * 클래스 필드 분석 및 매핑 정보 생성
     */
    private List<FieldMapping> analyzeFields(Class<T> clazz) {
        List<FieldMapping> mappings = new ArrayList<>();
        
        Field[] fields = clazz.getDeclaredFields();
        for (Field field : fields) {
            CobolField annotation = field.getAnnotation(CobolField.class);
            if (annotation != null) {
                FieldMapping mapping = createFieldMapping(field, annotation);
                mappings.add(mapping);
            }
        }
        
        // 레벨 번호 순으로 정렬
        mappings.sort((a, b) -> Integer.compare(a.level, b.level));
        
        return mappings;
    }
    
    /**
     * 필드 매핑 정보 생성
     */
    private FieldMapping createFieldMapping(Field field, CobolField annotation) {
        String pictureClause = annotation.pic();
        CobolDataType dataType = CobolDataType.fromPictureClause(pictureClause);
        int length = CobolDataType.extractLength(pictureClause);
        
        String cobolName = annotation.name().isEmpty() ? 
            field.getName().toUpperCase().replace("_", "-") : annotation.name();
        
        return new FieldMapping(
            field,
            cobolName,
            annotation.level(),
            pictureClause,
            dataType,
            length,
            annotation.value(),
            annotation.justifiedRight(),
            annotation.blankWhenZero(),
            annotation.usage()
        );
    }
    
    /**
     * 레코드에서 특정 위치의 필드 값 추출
     */
    private String extractFieldValue(String recordLine, int startPosition, int length) {
        if (startPosition + length > recordLine.length()) {
            // 레코드가 예상보다 짧은 경우 공백으로 패딩
            String extracted = recordLine.substring(startPosition);
            return String.format("%-" + length + "s", extracted);
        }
        
        return recordLine.substring(startPosition, startPosition + length);
    }
    
    /**
     * 필드명으로 Field 객체 찾기
     */
    private Field findField(String fieldName) throws NoSuchFieldException {
        // COBOL 필드명을 Java 필드명으로 변환 (예: CUSTOMER-ID -> customerId)
        String javaFieldName = convertCobolNameToJava(fieldName);
        
        try {
            return recordClass.getDeclaredField(javaFieldName);
        } catch (NoSuchFieldException e) {
            // 직접 매치되지 않으면 어노테이션에서 찾기
            for (Field field : recordClass.getDeclaredFields()) {
                CobolField annotation = field.getAnnotation(CobolField.class);
                if (annotation != null) {
                    String annotationName = annotation.name().isEmpty() ? 
                        field.getName().toUpperCase().replace("_", "-") : annotation.name();
                    if (annotationName.equals(fieldName)) {
                        return field;
                    }
                }
            }
            throw e;
        }
    }
    
    /**
     * COBOL 필드명을 Java 필드명으로 변환
     */
    private String convertCobolNameToJava(String cobolName) {
        StringBuilder javaName = new StringBuilder();
        String[] parts = cobolName.toLowerCase().split("-");
        
        javaName.append(parts[0]); // 첫 번째 부분은 소문자 그대로
        
        for (int i = 1; i < parts.length; i++) {
            if (!parts[i].isEmpty()) {
                javaName.append(Character.toUpperCase(parts[i].charAt(0)));
                if (parts[i].length() > 1) {
                    javaName.append(parts[i].substring(1));
                }
            }
        }
        
        return javaName.toString();
    }
    
    /**
     * 필드 매핑 정보 클래스
     */
    private static class FieldMapping {
        final Field field;
        final String cobolName;
        final int level;
        final String pictureClause;
        final CobolDataType dataType;
        final int length;
        final String defaultValue;
        final boolean justifiedRight;
        final boolean blankWhenZero;
        final String usage;
        
        FieldMapping(Field field, String cobolName, int level, String pictureClause,
                    CobolDataType dataType, int length, String defaultValue,
                    boolean justifiedRight, boolean blankWhenZero, String usage) {
            this.field = field;
            this.cobolName = cobolName;
            this.level = level;
            this.pictureClause = pictureClause;
            this.dataType = dataType;
            this.length = length;
            this.defaultValue = defaultValue;
            this.justifiedRight = justifiedRight;
            this.blankWhenZero = blankWhenZero;
            this.usage = usage;
        }
    }
}