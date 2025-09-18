package com.asp.encoding.service;

import com.asp.encoding.model.EncodingRequest;
import com.asp.encoding.model.EncodingResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.io.ByteArrayOutputStream;
import java.nio.charset.Charset;
import java.nio.charset.StandardCharsets;
import java.util.Arrays;

/**
 * Core encoding conversion service
 * Handles SJIS to UTF8 conversion with buffer management
 */
@Service
public class EncodingService {
    
    private static final Logger logger = LoggerFactory.getLogger(EncodingService.class);
    
    /**
     * Main conversion function - implements the sjis_to_utf8() signature
     * 
     * @param inputBuffer   Raw input bytes (Base64 decoded)
     * @param outputBuffer  Output buffer (will be allocated)
     * @param inputLength   Input buffer length
     * @param outputLength  Maximum output buffer length
     * @param encoding      Source encoding (e.g., "SHIFT_JIS")
     * @param layout        Layout parameter (future use)
     * @return EncodingResponse with conversion result
     */
    public EncodingResponse sjisToUtf8(byte[] inputBuffer, byte[] outputBuffer, 
                                      int inputLength, int outputLength, 
                                      String encoding, String layout) {
        
        logger.info("Converting {} bytes from {} to UTF-8, max output: {}", 
                   inputLength, encoding, outputLength);
        
        try {
            // Validate input parameters
            if (inputBuffer == null || inputLength <= 0) {
                return EncodingResponse.error("Invalid input buffer or length");
            }
            
            if (outputLength <= 0) {
                return EncodingResponse.error("Invalid output buffer length");
            }
            
            // Ensure we don't exceed input buffer bounds
            int actualInputLength = Math.min(inputLength, inputBuffer.length);
            byte[] inputData = Arrays.copyOf(inputBuffer, actualInputLength);
            
            // Convert encoding name to Java charset
            Charset sourceCharset = getCharsetFromName(encoding);
            if (sourceCharset == null) {
                return EncodingResponse.error("Unsupported encoding: " + encoding);
            }
            
            // Perform the conversion
            String utf8String = new String(inputData, sourceCharset);
            byte[] utf8Bytes = utf8String.getBytes(StandardCharsets.UTF_8);
            
            // Check if output fits in buffer
            if (utf8Bytes.length > outputLength) {
                logger.warn("Output length {} exceeds buffer size {}, truncating", 
                           utf8Bytes.length, outputLength);
                utf8Bytes = Arrays.copyOf(utf8Bytes, outputLength);
                utf8String = new String(utf8Bytes, StandardCharsets.UTF_8);
            }
            
            // Create successful response
            EncodingResponse response = EncodingResponse.success(utf8Bytes);
            response.setSourceEncoding(encoding);
            
            logger.info("Conversion successful: {} -> {} bytes", actualInputLength, utf8Bytes.length);
            return response;
            
        } catch (Exception e) {
            logger.error("Encoding conversion failed", e);
            return EncodingResponse.error("Conversion failed: " + e.getMessage());
        }
    }
    
    /**
     * Convenience method using EncodingRequest
     */
    public EncodingResponse convert(EncodingRequest request) {
        try {
            byte[] inputBytes = request.getInputBytes();
            byte[] outputBuffer = new byte[request.getOutputLength()];
            
            return sjisToUtf8(
                inputBytes,
                outputBuffer,
                request.getInputLength(),
                request.getOutputLength(),
                request.getEncoding(),
                request.getLayout()
            );
        } catch (Exception e) {
            logger.error("Request conversion failed", e);
            return EncodingResponse.error("Request processing failed: " + e.getMessage());
        }
    }
    
    /**
     * Map encoding names to Java Charset objects
     */
    private Charset getCharsetFromName(String encoding) {
        if (encoding == null) {
            return null;
        }
        
        String normalizedEncoding = encoding.toUpperCase().replace("-", "_").replace(".", "_");
        
        switch (normalizedEncoding) {
            case "SHIFT_JIS":
            case "SJIS":
            case "MS932":
                return Charset.forName("Shift_JIS");
                
            case "EUC_JP":
            case "EUCJP":
                return Charset.forName("EUC-JP");
                
            case "ISO_2022_JP":
            case "ISO2022JP":
                return Charset.forName("ISO-2022-JP");
                
            case "UTF_8":
            case "UTF8":
                return StandardCharsets.UTF_8;
                
            case "ASCII":
            case "US_ASCII":
                return StandardCharsets.US_ASCII;
                
            default:
                try {
                    return Charset.forName(encoding);
                } catch (Exception e) {
                    logger.warn("Unsupported encoding: {}", encoding);
                    return null;
                }
        }
    }
    
    /**
     * Get supported encodings list
     */
    public String[] getSupportedEncodings() {
        return new String[]{
            "SHIFT_JIS",
            "EUC-JP", 
            "ISO-2022-JP",
            "UTF-8",
            "US-ASCII"
        };
    }
}