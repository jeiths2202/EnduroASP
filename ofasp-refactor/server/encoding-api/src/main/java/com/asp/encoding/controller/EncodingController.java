package com.asp.encoding.controller;

import com.asp.encoding.model.EncodingRequest;
import com.asp.encoding.model.EncodingResponse;
import com.asp.encoding.service.EncodingService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import javax.validation.Valid;
import java.util.HashMap;
import java.util.Map;

/**
 * REST API Controller for encoding conversions
 */
@RestController
@RequestMapping("/api/encoding")
@CrossOrigin(origins = "*")
public class EncodingController {
    
    private static final Logger logger = LoggerFactory.getLogger(EncodingController.class);
    
    @Autowired
    private EncodingService encodingService;
    
    /**
     * Main SJIS to UTF8 conversion endpoint
     * POST /api/encoding/sjis-to-utf8
     */
    @PostMapping("/sjis-to-utf8")
    public ResponseEntity<EncodingResponse> sjisToUtf8(@Valid @RequestBody EncodingRequest request) {
        logger.info("Received SJIS to UTF8 conversion request: {}", request);
        
        try {
            EncodingResponse response = encodingService.convert(request);
            
            if (response.isSuccess()) {
                logger.info("Conversion successful, output length: {}", response.getActualOutputLength());
                return ResponseEntity.ok(response);
            } else {
                logger.warn("Conversion failed: {}", response.getErrorMessage());
                return ResponseEntity.badRequest().body(response);
            }
            
        } catch (Exception e) {
            logger.error("API error during conversion", e);
            EncodingResponse errorResponse = EncodingResponse.error("API error: " + e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(errorResponse);
        }
    }
    
    /**
     * Simple text conversion endpoint (for testing)
     * POST /api/encoding/convert-text
     */
    @PostMapping("/convert-text")
    public ResponseEntity<Map<String, Object>> convertText(@RequestBody Map<String, String> request) {
        logger.info("Received text conversion request");
        
        Map<String, Object> response = new HashMap<>();
        
        try {
            String text = request.get("text");
            String encoding = request.getOrDefault("encoding", "SHIFT_JIS");
            
            if (text == null || text.isEmpty()) {
                response.put("success", false);
                response.put("error", "Text parameter is required");
                return ResponseEntity.badRequest().body(response);
            }
            
            // Convert text to bytes using specified encoding, then to UTF-8
            byte[] sourceBytes = text.getBytes(encoding);
            String utf8Result = new String(sourceBytes, "UTF-8");
            
            response.put("success", true);
            response.put("originalText", text);
            response.put("sourceEncoding", encoding);
            response.put("targetEncoding", "UTF-8");
            response.put("result", utf8Result);
            response.put("inputLength", sourceBytes.length);
            response.put("outputLength", utf8Result.getBytes("UTF-8").length);
            
            return ResponseEntity.ok(response);
            
        } catch (Exception e) {
            logger.error("Text conversion error", e);
            response.put("success", false);
            response.put("error", e.getMessage());
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(response);
        }
    }
    
    /**
     * Get supported encodings
     * GET /api/encoding/supported
     */
    @GetMapping("/supported")
    public ResponseEntity<Map<String, Object>> getSupportedEncodings() {
        Map<String, Object> response = new HashMap<>();
        response.put("encodings", encodingService.getSupportedEncodings());
        response.put("description", "Supported source encodings for conversion to UTF-8");
        return ResponseEntity.ok(response);
    }
    
    /**
     * Health check endpoint
     * GET /api/encoding/health
     */
    @GetMapping("/health")
    public ResponseEntity<Map<String, Object>> healthCheck() {
        Map<String, Object> response = new HashMap<>();
        response.put("status", "UP");
        response.put("service", "ASP Encoding API");
        response.put("version", "1.0.0");
        response.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.ok(response);
    }
    
    /**
     * API information endpoint
     * GET /api/encoding/info
     */
    @GetMapping("/info")
    public ResponseEntity<Map<String, Object>> getApiInfo() {
        Map<String, Object> response = new HashMap<>();
        response.put("name", "ASP Encoding API");
        response.put("version", "1.0.0");
        response.put("description", "Java-based SJIS to UTF8 encoding conversion service");
        
        Map<String, String> endpoints = new HashMap<>();
        endpoints.put("POST /api/encoding/sjis-to-utf8", "Main conversion endpoint using buffer-based parameters");
        endpoints.put("POST /api/encoding/convert-text", "Simple text conversion for testing");
        endpoints.put("GET /api/encoding/supported", "Get list of supported encodings");
        endpoints.put("GET /api/encoding/health", "Health check");
        endpoints.put("GET /api/encoding/info", "API information");
        
        response.put("endpoints", endpoints);
        response.put("supported_encodings", encodingService.getSupportedEncodings());
        
        return ResponseEntity.ok(response);
    }
}