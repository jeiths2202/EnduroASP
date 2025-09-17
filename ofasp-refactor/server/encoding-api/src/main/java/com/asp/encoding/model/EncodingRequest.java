package com.asp.encoding.model;

import javax.validation.constraints.NotNull;
import java.util.Base64;

/**
 * Request model for encoding conversion
 */
public class EncodingRequest {
    
    @NotNull
    private String inputBuffer;  // Base64 encoded input data
    
    @NotNull
    private Integer inputLength;
    
    @NotNull
    private Integer outputLength;
    
    @NotNull
    private String encoding;     // Source encoding (e.g., "SHIFT_JIS")
    
    private String layout;       // Future parameter - currently unused
    
    // Constructors
    public EncodingRequest() {}
    
    public EncodingRequest(String inputBuffer, Integer inputLength, Integer outputLength, String encoding, String layout) {
        this.inputBuffer = inputBuffer;
        this.inputLength = inputLength;
        this.outputLength = outputLength;
        this.encoding = encoding;
        this.layout = layout;
    }
    
    // Getters and Setters
    public String getInputBuffer() {
        return inputBuffer;
    }
    
    public void setInputBuffer(String inputBuffer) {
        this.inputBuffer = inputBuffer;
    }
    
    public Integer getInputLength() {
        return inputLength;
    }
    
    public void setInputLength(Integer inputLength) {
        this.inputLength = inputLength;
    }
    
    public Integer getOutputLength() {
        return outputLength;
    }
    
    public void setOutputLength(Integer outputLength) {
        this.outputLength = outputLength;
    }
    
    public String getEncoding() {
        return encoding;
    }
    
    public void setEncoding(String encoding) {
        this.encoding = encoding;
    }
    
    public String getLayout() {
        return layout;
    }
    
    public void setLayout(String layout) {
        this.layout = layout;
    }
    
    /**
     * Decode the Base64 input buffer to raw bytes
     */
    public byte[] getInputBytes() {
        try {
            return Base64.getDecoder().decode(inputBuffer);
        } catch (IllegalArgumentException e) {
            throw new RuntimeException("Invalid Base64 input buffer", e);
        }
    }
    
    @Override
    public String toString() {
        return "EncodingRequest{" +
                "inputLength=" + inputLength +
                ", outputLength=" + outputLength +
                ", encoding='" + encoding + '\'' +
                ", layout='" + layout + '\'' +
                '}';
    }
}