package com.asp.encoding;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * ASP Encoding API Application
 * Java-based SJIS to UTF8 conversion service
 */
@SpringBootApplication
public class EncodingApiApplication {
    
    public static void main(String[] args) {
        SpringApplication.run(EncodingApiApplication.class, args);
    }
}