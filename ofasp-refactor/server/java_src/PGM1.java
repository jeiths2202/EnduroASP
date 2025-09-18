import java.io.*;
import java.util.*;

/**
 * OpenASP Java Program: PGM1
 * Enhanced Menu Program with F7 Logoff Support
 * Handles menu selections (1-5) and function keys (F3, F7)
 * 
 * No package declaration - uses default package for easier JAR execution
 */
public class PGM1 {
    
    public static void main(String[] args) {
        try {
            // Read input from stdin
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            StringBuilder input = new StringBuilder();
            String line;
            
            while ((line = reader.readLine()) != null) {
                input.append(line).append("\n");
            }
            
            String inputData = input.toString().trim();
            
            // Log to stderr (doesn't interfere with JSON output)
            System.err.println("PGM1 started - Enhanced Menu Program v0.5.1");
            System.err.println("Input received: " + inputData);
            
            // Extract input fields
            String userId = extractValue(inputData, "user_id");
            String command = extractValue(inputData, "CMD");        // ?? ??
            String functionKey = extractValue(inputData, "function_key"); // Function ?
            
            if (userId == null || userId.isEmpty()) {
                userId = "unknown";
            }
            
            System.err.println("PGM1 executed by: " + userId);
            System.err.println("Command received: " + command);
            System.err.println("Function key: " + functionKey);
            
            // Process input and determine action
            MenuResult result = processMenuInput(userId, command, functionKey);
            
            // Output result as JSON
            System.out.println(result.toJson());
            System.err.println("PGM1 completed: " + result.getAction());
            
        } catch (Exception e) {
            System.err.println("PGM1 error: " + e.getMessage());
            e.printStackTrace();
            
            // Output error as JSON
            System.out.println("{");
            System.out.println("  \"status\": \"error\",");
            System.out.println("  \"message\": \"" + e.getMessage().replace("\"", "\\\"") + "\",");
            System.out.println("  \"program\": \"PGM1\"");
            System.out.println("}");
            
            System.exit(1);
        }
    }
    
    /**
     * ?? ?? ?? ? ?? ??
     */
    private static MenuResult processMenuInput(String userId, String command, String functionKey) {
        MenuResult result = new MenuResult();
        result.setUserId(userId);
        result.setProgram("PGM1");
        result.setTimestamp(new Date().toString());
        
        // F7 ? ?? - ????
        if ("F7".equalsIgnoreCase(functionKey) || "f7".equalsIgnoreCase(command)) {
            System.err.println("F7 key detected - Processing logoff");
            return processLogoff(result);
        }
        
        // F3 ? ?? - ?? ??
        if ("F3".equalsIgnoreCase(functionKey) || "f3".equalsIgnoreCase(command)) {
            System.err.println("F3 key detected - Going to previous screen");
            return processPreviousScreen(result);
        }
        
        // ?? ?? ?? (1-5)
        if (command != null && !command.isEmpty()) {
            return processMenuSelection(result, command);
        }
        
        // ?? ?? ??
        return showMainMenu(result);
    }
    
    /**
     * F7 - ???? ??
     */
    private static MenuResult processLogoff(MenuResult result) {
        System.err.println("Processing logoff for user: " + result.getUserId());
        
        result.setStatus("success");
        result.setAction("LOGOFF");
        result.setNextMap("LOGO");
        result.setMessage("?????????. ??? ???.");
        
        // ???? ?? ???
        Map<String, Object> logoffData = new HashMap<>();
        logoffData.put("logoff_time", new Date().toString());
        logoffData.put("user_id", result.getUserId());
        logoffData.put("session_duration", "???...");
        logoffData.put("logoff_reason", "F7_KEY_PRESSED");
        
        result.addData("logoff_info", logoffData);
        
        System.err.println("Logoff processed successfully");
        return result;
    }
    
    /**
     * F3 - ?? ?? ??
     */
    private static MenuResult processPreviousScreen(MenuResult result) {
        System.err.println("Processing F3 - Previous screen");
        
        result.setStatus("success");
        result.setAction("PREVIOUS_SCREEN");
        result.setNextMap("LOGO");  // ?? ?? ?? ??? ??
        result.setMessage("?? ???? ?????.");
        
        return result;
    }
    
    /**
     * ?? ?? ?? (1-5)
     */
    private static MenuResult processMenuSelection(MenuResult result, String command) {
        System.err.println("Processing menu selection: " + command);
        
        result.setStatus("success");
        result.setAction("MENU_SELECTION");
        
        switch (command.trim()) {
            case "1":
                result.setNextMap("EIGYO001");
                result.setMessage("???? ???? ?????.");
                result.addData("selected_menu", "????");
                break;
                
            case "2":
                result.setNextMap("NOHINO001");
                result.setMessage("???? ???? ?????.");
                result.addData("selected_menu", "????");
                break;
                
            case "3":
                result.setNextMap("ZAIKO001");
                result.setMessage("???? ???? ?????.");
                result.addData("selected_menu", "????");
                break;
                
            case "4":
                result.setNextMap("URIAGE001");
                result.setMessage("???? ???? ?????.");
                result.addData("selected_menu", "????");
                break;
                
            case "5":
                result.setNextMap("REPORT001");
                result.setMessage("????? ???? ?????.");
                result.addData("selected_menu", "?????");
                break;
                
            default:
                result.setStatus("warning");
                result.setAction("STAY_CURRENT");
                result.setNextMap("MENU");
                result.setMessage("??? ?? ?????. 1~5 ?? F3, F7? ??????.");
                result.addData("error_type", "INVALID_MENU_SELECTION");
        }
        
        return result;
    }
    
    /**
     * ?? ?? ??
     */
    private static MenuResult showMainMenu(MenuResult result) {
        System.err.println("Showing main menu");
        
        result.setStatus("success");
        result.setAction("SHOW_MENU");
        result.setNextMap("MENU");
        result.setMessage("??? ??????.");
        
        // ?? ?? ??
        Map<String, Object> menuData = new HashMap<>();
        menuData.put("title", "==== M E N U  S C R E E N ====");
        
        List<Map<String, String>> menuItems = new ArrayList<>();
        menuItems.add(createMenuItem("1", "????", "EIGYO001"));
        menuItems.add(createMenuItem("2", "????", "NOHINO001"));
        menuItems.add(createMenuItem("3", "????", "ZAIKO001"));
        menuItems.add(createMenuItem("4", "????", "URIAGE001"));
        menuItems.add(createMenuItem("5", "?????", "REPORT001"));
        
        menuData.put("menu_items", menuItems);
        
        List<Map<String, String>> functionKeys = new ArrayList<>();
        functionKeys.add(createFunctionKey("F3", "????", "PREVIOUS"));
        functionKeys.add(createFunctionKey("F7", "????", "LOGOFF"));
        
        menuData.put("function_keys", functionKeys);
        
        result.addData("menu_data", menuData);
        
        return result;
    }
    
    private static Map<String, String> createMenuItem(String code, String name, String target) {
        Map<String, String> item = new HashMap<>();
        item.put("code", code);
        item.put("name", name);
        item.put("target", target);
        return item;
    }
    
    private static Map<String, String> createFunctionKey(String key, String description, String action) {
        Map<String, String> fkey = new HashMap<>();
        fkey.put("key", key);
        fkey.put("description", description);
        fkey.put("action", action);
        return fkey;
    }
    
    /**
     * ?? ????? ? ??
     */
    private static String extractValue(String input, String key) {
        if (input == null || key == null) {
            return null;
        }
        
        try {
            // JSON-like extraction
            String searchPattern = "\"" + key + "\"";
            int keyIndex = input.indexOf(searchPattern);
            if (keyIndex != -1) {
                int colonIndex = input.indexOf(":", keyIndex);
                if (colonIndex != -1) {
                    int startQuote = input.indexOf("\"", colonIndex);
                    if (startQuote != -1) {
                        int endQuote = input.indexOf("\"", startQuote + 1);
                        if (endQuote != -1) {
                            return input.substring(startQuote + 1, endQuote);
                        }
                    }
                }
            }
            
            // Simple key=value extraction
            String simplePattern = key + "=";
            int simpleIndex = input.indexOf(simplePattern);
            if (simpleIndex != -1) {
                int valueStart = simpleIndex + simplePattern.length();
                int valueEnd = input.indexOf("\n", valueStart);
                if (valueEnd == -1) {
                    valueEnd = input.indexOf(",", valueStart);
                    if (valueEnd == -1) {
                        valueEnd = input.indexOf("}", valueStart);
                        if (valueEnd == -1) {
                            valueEnd = input.length();
                        }
                    }
                }
                String value = input.substring(valueStart, valueEnd).trim();
                return value.replace("\"", "").replace(",", "");
            }
            
        } catch (Exception e) {
            System.err.println("Error extracting value for key '" + key + "': " + e.getMessage());
        }
        
        return null;
    }
    
    /**
     * ?? ?? ??? ?? ???
     */
    static class MenuResult {
        private String status = "success";
        private String program = "PGM1";
        private String userId;
        private String timestamp;
        private String action;
        private String nextMap;
        private String message;
        private Map<String, Object> additionalData = new HashMap<>();
        
        // Getters and Setters
        public String getStatus() { return status; }
        public void setStatus(String status) { this.status = status; }
        
        public String getProgram() { return program; }
        public void setProgram(String program) { this.program = program; }
        
        public String getUserId() { return userId; }
        public void setUserId(String userId) { this.userId = userId; }
        
        public String getTimestamp() { return timestamp; }
        public void setTimestamp(String timestamp) { this.timestamp = timestamp; }
        
        public String getAction() { return action; }
        public void setAction(String action) { this.action = action; }
        
        public String getNextMap() { return nextMap; }
        public void setNextMap(String nextMap) { this.nextMap = nextMap; }
        
        public String getMessage() { return message; }
        public void setMessage(String message) { this.message = message; }
        
        public void addData(String key, Object value) {
            this.additionalData.put(key, value);
        }
        
        /**
         * JSON ???? ??
         */
        public String toJson() {
            StringBuilder json = new StringBuilder();
            json.append("{\n");
            json.append("  \"status\": \"").append(escapeJson(status)).append("\",\n");
            json.append("  \"program\": \"").append(escapeJson(program)).append("\",\n");
            json.append("  \"user_id\": \"").append(escapeJson(userId)).append("\",\n");
            json.append("  \"timestamp\": \"").append(escapeJson(timestamp)).append("\",\n");
            json.append("  \"action\": \"").append(escapeJson(action)).append("\",\n");
            json.append("  \"next_map\": \"").append(escapeJson(nextMap)).append("\",\n");
            json.append("  \"message\": \"").append(escapeJson(message)).append("\"");
            
            // Additional data ??
            if (!additionalData.isEmpty()) {
                for (Map.Entry<String, Object> entry : additionalData.entrySet()) {
                    json.append(",\n");
                    json.append("  \"").append(escapeJson(entry.getKey())).append("\": ");
                    json.append(objectToJson(entry.getValue()));
                }
            }
            
            json.append("\n}");
            return json.toString();
        }
        
        private String escapeJson(String str) {
            if (str == null) return "";
            return str.replace("\"", "\\\"").replace("\n", "\\n").replace("\r", "\\r");
        }
        
        private String objectToJson(Object obj) {
            if (obj == null) {
                return "null";
            } else if (obj instanceof String) {
                return "\"" + escapeJson((String) obj) + "\"";
            } else if (obj instanceof Map) {
                @SuppressWarnings("unchecked")
                Map<String, Object> map = (Map<String, Object>) obj;
                StringBuilder mapJson = new StringBuilder("{\n");
                boolean first = true;
                for (Map.Entry<String, Object> entry : map.entrySet()) {
                    if (!first) mapJson.append(",\n");
                    mapJson.append("    \"").append(escapeJson(entry.getKey())).append("\": ");
                    mapJson.append(objectToJson(entry.getValue()));
                    first = false;
                }
                mapJson.append("\n  }");
                return mapJson.toString();
            } else if (obj instanceof List) {
                @SuppressWarnings("unchecked")
                List<Object> list = (List<Object>) obj;
                StringBuilder listJson = new StringBuilder("[\n");
                for (int i = 0; i < list.size(); i++) {
                    if (i > 0) listJson.append(",\n");
                    listJson.append("    ").append(objectToJson(list.get(i)));
                }
                listJson.append("\n  ]");
                return listJson.toString();
            } else {
                return "\"" + escapeJson(obj.toString()) + "\"";
            }
        }
    }
}
