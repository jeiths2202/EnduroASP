package com.asp.encoding.model;

import java.util.Base64;

/**
 * Response model for encoding conversion
 */
public class EncodingResponse {
    
    private boolean success;
    private String outputBuffer;     // Base64 encoded UTF-8 output
    private Integer actualOutputLength;
    private String errorMessage;
    private String sourceEncoding;
    private String targetEncoding;
    
    // Constructors
    public EncodingResponse() {}
    
    public EncodingResponse(boolean success, String outputBuffer, Integer actualOutputLength, String errorMessage) {
        this.success = success;
        this.outputBuffer = outputBuffer;
        this.actualOutputLength = actualOutputLength;
        this.errorMessage = errorMessage;
        this.sourceEncoding = "SHIFT_JIS";  // Default source
        this.targetEncoding = "UTF-8";      // Default target
    }
    
    // Static factory methods
    public static EncodingResponse success(byte[] outputBytes) {
        String base64Output = Base64.getEncoder().encodeToString(outputBytes);
        EncodingResponse response = new EncodingResponse(true, base64Output, outputBytes.length, null);
        return response;
    }
    
    public static EncodingResponse success(String utf8String) {
        byte[] utf8Bytes = utf8String.getBytes(java.nio.charset.StandardCharsets.UTF_8);
        return success(utf8Bytes);
    }
    
    public static EncodingResponse error(String errorMessage) {
        return new EncodingResponse(false, null, 0, errorMessage);
    }
    
    // Getters and Setters
    public boolean isSuccess() {
        return success;
    }
    
    public void setSuccess(boolean success) {
        this.success = success;
    }
    
    public String getOutputBuffer() {
        return outputBuffer;
    }
    
    public void setOutputBuffer(String outputBuffer) {
        this.outputBuffer = outputBuffer;
    }
    
    public Integer getActualOutputLength() {
        return actualOutputLength;
    }
    
    public void setActualOutputLength(Integer actualOutputLength) {
        this.actualOutputLength = actualOutputLength;
    }
    
    public String getErrorMessage() {
        return errorMessage;
    }
    
    public void setErrorMessage(String errorMessage) {
        this.errorMessage = errorMessage;
    }
    
    public String getSourceEncoding() {
        return sourceEncoding;
    }
    
    public void setSourceEncoding(String sourceEncoding) {
        this.sourceEncoding = sourceEncoding;
    }
    
    public String getTargetEncoding() {
        return targetEncoding;
    }
    
    public void setTargetEncoding(String targetEncoding) {
        this.targetEncoding = targetEncoding;
    }
    
    /**
     * Get the UTF-8 string from the output buffer
     */
    public String getUtf8String() {
        if (outputBuffer == null) {
            return null;
        }
        try {
            byte[] bytes = Base64.getDecoder().decode(outputBuffer);
            return new String(bytes, java.nio.charset.StandardCharsets.UTF_8);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
    
    @Override
    public String toString() {
        return "EncodingResponse{" +
                "success=" + success +
                ", actualOutputLength=" + actualOutputLength +
                ", sourceEncoding='" + sourceEncoding + '\'' +
                ", targetEncoding='" + targetEncoding + '\'' +
                ", errorMessage='" + errorMessage + '\'' +
                '}';
    }
}