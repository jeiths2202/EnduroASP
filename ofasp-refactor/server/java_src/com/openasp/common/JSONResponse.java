package com.openasp.common;

import java.util.HashMap;
import java.util.Map;

public class JSONResponse {
    private Map<String, Object> data = new HashMap<>();
    
    public JSONResponse() {
        data.put("timestamp", System.currentTimeMillis());
    }
    
    public void setSuccess(boolean success) {
        data.put("success", success);
    }
    
    public void set(String key, Object value) {
        data.put(key, value);
    }
    
    @Override
    public String toString() {
        StringBuilder json = new StringBuilder();
        json.append("{");
        
        boolean first = true;
        for (Map.Entry<String, Object> entry : data.entrySet()) {
            if (!first) json.append(",");
            first = false;
            
            json.append("\"").append(entry.getKey()).append("\":");
            
            Object value = entry.getValue();
            if (value instanceof String) {
                json.append("\"").append(escape((String)value)).append("\"");
            } else if (value instanceof String[]) {
                json.append("[");
                String[] arr = (String[])value;
                for (int i = 0; i < arr.length; i++) {
                    if (i > 0) json.append(",");
                    json.append("\"").append(escape(arr[i])).append("\"");
                }
                json.append("]");
            } else {
                json.append(value);
            }
        }
        
        json.append("}");
        return json.toString();
    }
    
    private String escape(String str) {
        if (str == null) return "";
        return str.replace("\\", "\\\\")
                  .replace("\"", "\\\"")
                  .replace("\n", "\\n");
    }
}
