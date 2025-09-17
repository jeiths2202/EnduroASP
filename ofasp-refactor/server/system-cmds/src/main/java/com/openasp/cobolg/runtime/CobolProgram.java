package com.openasp.cobolg.runtime;

import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * COBOL 프로그램을 나타내는 어노테이션
 */
@Target(ElementType.TYPE)
@Retention(RetentionPolicy.RUNTIME)
public @interface CobolProgram {
    
    /**
     * COBOL 프로그램 ID (PROGRAM-ID)
     */
    String value();
    
    /**
     * 프로그램 설명
     */
    String description() default "";
    
    /**
     * 연관된 화면 ID들
     */
    String[] screens() default {};
    
    /**
     * 사용하는 파일들
     */
    String[] files() default {};
}