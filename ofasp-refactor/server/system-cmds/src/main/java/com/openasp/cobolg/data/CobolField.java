package com.openasp.cobolg.data;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * COBOL 필드 정의를 위한 어노테이션
 * Java 클래스 필드에 COBOL PICTURE 절 정보를 매핑
 */
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface CobolField {
    
    /**
     * COBOL PICTURE 절
     * 예: "X(10)", "9(5)V9(2)", "S9(8) COMP-3"
     */
    String pic();
    
    /**
     * COBOL 레벨 번호 (기본값: 05)
     */
    int level() default 05;
    
    /**
     * COBOL 필드명 (기본값: Java 필드명을 대문자로 변환)
     */
    String name() default "";
    
    /**
     * 초기값 (VALUE 절)
     */
    String value() default "";
    
    /**
     * JUSTIFIED RIGHT 여부
     */
    boolean justifiedRight() default false;
    
    /**
     * BLANK WHEN ZERO 여부
     */
    boolean blankWhenZero() default false;
    
    /**
     * SIGN 절 (LEADING/TRAILING SEPARATE)
     */
    String sign() default "";
    
    /**
     * USAGE 절 (DISPLAY, COMP, COMP-3 등)
     */
    String usage() default "DISPLAY";
    
    /**
     * SYNCHRONIZED 여부
     */
    boolean sync() default false;
    
    /**
     * OCCURS 절 (배열 크기)
     */
    int occurs() default 0;
    
    /**
     * DEPENDING ON 절 (가변 배열)
     */
    String dependingOn() default "";
    
    /**
     * REDEFINES 절
     */
    String redefines() default "";
}