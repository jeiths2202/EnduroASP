package com.openasp.cobolg.data;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.nio.charset.StandardCharsets;
import java.util.regex.Pattern;

/**
 * COBOL G 데이터 타입 정의 및 Java 변환 지원
 * PICTURE 절을 기반으로 한 데이터 타입 매핑
 */
public enum CobolDataType {
    
    // 숫자 타입
    NUMERIC_INTEGER("9+", "정수형 숫자"),
    NUMERIC_DECIMAL("9+V9+", "소수점 있는 숫자"),
    NUMERIC_SIGNED("S9+", "부호 있는 숫자"),
    NUMERIC_SIGNED_DECIMAL("S9+V9+", "부호 있는 소수점 숫자"),
    
    // 문자 타입
    ALPHANUMERIC("X+", "영숫자 문자"),
    ALPHABETIC("A+", "영문자만"),
    NATIONAL("N+", "일본어/유니코드 문자"),
    
    // 편집 타입
    NUMERIC_EDITED("Z+|\\*+|\\$+", "편집된 숫자"),
    ALPHANUMERIC_EDITED("X+/+", "편집된 문자"),
    
    // 특수 타입
    POINTER("POINTER", "포인터"),
    INDEX("INDEX", "인덱스");
    
    private final String pattern;
    private final String description;
    private final Pattern compiledPattern;
    
    CobolDataType(String pattern, String description) {
        this.pattern = pattern;
        this.description = description;
        this.compiledPattern = Pattern.compile(pattern);
    }
    
    /**
     * PICTURE 절을 분석하여 해당하는 COBOL 데이터 타입 반환
     */
    public static CobolDataType fromPictureClause(String pictureClause) {
        if (pictureClause == null || pictureClause.trim().isEmpty()) {
            throw new IllegalArgumentException("PICTURE 절이 비어있습니다");
        }
        
        String normalized = normalizePictureClause(pictureClause);
        
        for (CobolDataType type : values()) {
            if (type.compiledPattern.matcher(normalized).matches()) {
                return type;
            }
        }
        
        // 기본적으로 ALPHANUMERIC으로 처리
        return ALPHANUMERIC;
    }
    
    /**
     * PICTURE 절 정규화 (괄호 표기를 반복 표기로 변환)
     * 예: X(10) -> XXXXXXXXXX, 9(3)V9(2) -> 999V99
     */
    private static String normalizePictureClause(String pictureClause) {
        StringBuilder normalized = new StringBuilder();
        String clean = pictureClause.toUpperCase().trim();
        
        int i = 0;
        while (i < clean.length()) {
            char c = clean.charAt(i);
            
            if (i + 1 < clean.length() && clean.charAt(i + 1) == '(') {
                // 괄호 표기 처리 (예: X(10))
                int closeParenIndex = clean.indexOf(')', i + 2);
                if (closeParenIndex > 0) {
                    int count = Integer.parseInt(clean.substring(i + 2, closeParenIndex));
                    for (int j = 0; j < count; j++) {
                        normalized.append(c);
                    }
                    i = closeParenIndex + 1;
                } else {
                    normalized.append(c);
                    i++;
                }
            } else {
                normalized.append(c);
                i++;
            }
        }
        
        return normalized.toString();
    }
    
    /**
     * COBOL 데이터 타입을 Java 클래스로 변환
     */
    public Class<?> toJavaType() {
        switch (this) {
            case NUMERIC_INTEGER:
            case NUMERIC_SIGNED:
                return BigInteger.class;
            case NUMERIC_DECIMAL:
            case NUMERIC_SIGNED_DECIMAL:
            case NUMERIC_EDITED:
                return BigDecimal.class;
            case ALPHANUMERIC:
            case ALPHABETIC:
            case NATIONAL:
            case ALPHANUMERIC_EDITED:
                return String.class;
            case POINTER:
                return Long.class;
            case INDEX:
                return Integer.class;
            default:
                return String.class;
        }
    }
    
    /**
     * PICTURE 절에서 필드 길이 추출
     */
    public static int extractLength(String pictureClause) {
        String normalized = normalizePictureClause(pictureClause);
        
        // V(소수점)는 길이에 포함하지 않음
        return normalized.replace("V", "")
                        .replace("S", "") // 부호도 길이에 포함하지 않음
                        .length();
    }
    
    /**
     * PICTURE 절에서 소수점 자릿수 추출
     */
    public static int extractDecimalPlaces(String pictureClause) {
        String normalized = normalizePictureClause(pictureClause);
        int vIndex = normalized.indexOf('V');
        
        if (vIndex < 0) {
            return 0; // 소수점 없음
        }
        
        return normalized.length() - vIndex - 1;
    }
    
    /**
     * PICTURE 절에서 정수 자릿수 추출
     */
    public static int extractIntegerPlaces(String pictureClause) {
        String normalized = normalizePictureClause(pictureClause);
        int vIndex = normalized.indexOf('V');
        
        String integerPart = vIndex < 0 ? normalized : normalized.substring(0, vIndex);
        return integerPart.replace("S", "").length();
    }
    
    /**
     * COBOL 값을 Java 객체로 변환
     */
    public Object convertToJava(String cobolValue, String pictureClause) {
        if (cobolValue == null) {
            return getDefaultValue();
        }
        
        try {
            switch (this) {
                case NUMERIC_INTEGER:
                case NUMERIC_SIGNED:
                    return new BigInteger(cobolValue.trim());
                    
                case NUMERIC_DECIMAL:
                case NUMERIC_SIGNED_DECIMAL:
                    int decimalPlaces = extractDecimalPlaces(pictureClause);
                    if (decimalPlaces > 0) {
                        // 암시적 소수점 처리
                        String intPart = cobolValue.substring(0, cobolValue.length() - decimalPlaces);
                        String decPart = cobolValue.substring(cobolValue.length() - decimalPlaces);
                        return new BigDecimal(intPart + "." + decPart);
                    } else {
                        return new BigDecimal(cobolValue.trim());
                    }
                    
                case ALPHANUMERIC:
                case ALPHABETIC:
                    int length = extractLength(pictureClause);
                    return padOrTruncateString(cobolValue, length);
                    
                case NATIONAL:
                    // 일본어 처리를 위한 UTF-8 변환
                    byte[] bytes = cobolValue.getBytes(StandardCharsets.UTF_8);
                    return new String(bytes, StandardCharsets.UTF_8);
                    
                default:
                    return cobolValue;
            }
        } catch (Exception e) {
            throw new CobolDataConversionException(
                "COBOL 값 변환 실패: " + cobolValue + " (PICTURE: " + pictureClause + ")", e);
        }
    }
    
    /**
     * Java 객체를 COBOL 형식으로 변환
     */
    public String convertFromJava(Object javaValue, String pictureClause) {
        if (javaValue == null) {
            return getDefaultCobolValue(pictureClause);
        }
        
        try {
            switch (this) {
                case NUMERIC_INTEGER:
                case NUMERIC_SIGNED:
                    int intLength = extractIntegerPlaces(pictureClause);
                    String intStr = javaValue.toString();
                    return String.format("%0" + intLength + "d", 
                        Integer.parseInt(intStr.replaceAll("[^0-9-]", "")));
                    
                case NUMERIC_DECIMAL:
                case NUMERIC_SIGNED_DECIMAL:
                    BigDecimal decimal = (BigDecimal) javaValue;
                    int totalLength = extractLength(pictureClause);
                    int decimalPlaces = extractDecimalPlaces(pictureClause);
                    
                    // 소수점 없는 형태로 변환 (암시적 소수점)
                    BigDecimal scaled = decimal.setScale(decimalPlaces, BigDecimal.ROUND_HALF_UP);
                    String scaledStr = scaled.toPlainString().replace(".", "");
                    return String.format("%0" + totalLength + "s", scaledStr);
                    
                case ALPHANUMERIC:
                case ALPHABETIC:
                    int length = extractLength(pictureClause);
                    return padOrTruncateString(javaValue.toString(), length);
                    
                case NATIONAL:
                    // UTF-8을 Shift-JIS로 변환
                    return convertToShiftJIS(javaValue.toString());
                    
                default:
                    return javaValue.toString();
            }
        } catch (Exception e) {
            throw new CobolDataConversionException(
                "Java 값 변환 실패: " + javaValue + " (PICTURE: " + pictureClause + ")", e);
        }
    }
    
    /**
     * 기본값 반환
     */
    private Object getDefaultValue() {
        switch (this) {
            case NUMERIC_INTEGER:
            case NUMERIC_SIGNED:
                return BigInteger.ZERO;
            case NUMERIC_DECIMAL:
            case NUMERIC_SIGNED_DECIMAL:
                return BigDecimal.ZERO;
            default:
                return "";
        }
    }
    
    /**
     * COBOL 기본값 반환 (PICTURE 절 기반)
     */
    private String getDefaultCobolValue(String pictureClause) {
        int length = extractLength(pictureClause);
        
        switch (this) {
            case NUMERIC_INTEGER:
            case NUMERIC_SIGNED:
            case NUMERIC_DECIMAL:
            case NUMERIC_SIGNED_DECIMAL:
                return String.format("%0" + length + "d", 0);
            default:
                return String.format("%-" + length + "s", "");
        }
    }
    
    /**
     * 문자열 패딩 또는 자르기
     */
    private String padOrTruncateString(String value, int length) {
        if (value.length() > length) {
            return value.substring(0, length);
        } else {
            return String.format("%-" + length + "s", value);
        }
    }
    
    /**
     * UTF-8을 Shift-JIS로 변환
     */
    private String convertToShiftJIS(String utf8String) {
        try {
            byte[] utf8Bytes = utf8String.getBytes(StandardCharsets.UTF_8);
            return new String(utf8Bytes, "Shift_JIS");
        } catch (Exception e) {
            return utf8String; // 변환 실패 시 원본 반환
        }
    }
    
    public String getPattern() { return pattern; }
    public String getDescription() { return description; }
}