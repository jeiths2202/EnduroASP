package com.openasp.common;

public class InputParser {
    private String input;
    
    public InputParser(String input) {
        this.input = input != null ? input : "{}";
    }
    
    public String getString(String key, String defaultValue) {
        try {
            String pattern = "\"" + key + "\"\\s*:\\s*\"([^\"]*?)\"";
            java.util.regex.Pattern p = java.util.regex.Pattern.compile(pattern);
            java.util.regex.Matcher m = p.matcher(input);
            
            if (m.find()) {
                return m.group(1);
            }
        } catch (Exception e) {
            // ?? ?? ? ??? ??
        }
        return defaultValue;
    }
}
