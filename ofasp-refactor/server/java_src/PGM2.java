import java.io.*;
import java.util.*;

/**
 * OpenASP Java Program: PGM2
 * User program - Data management functions
 */
public class PGM2 {
    
    public static void main(String[] args) {
        try {
            BufferedReader reader = new BufferedReader(new InputStreamReader(System.in));
            StringBuilder input = new StringBuilder();
            String line;
            
            while ((line = reader.readLine()) != null) {
                input.append(line).append("\n");
            }
            
            String inputData = input.toString().trim();
            System.err.println("PGM2 started");
            System.err.println("Input received: " + inputData);
            
            String userId = extractValue(inputData, "user_id");
            if (userId == null || userId.isEmpty()) {
                userId = "unknown";
            }
            
            System.err.println("PGM2 executed by: " + userId);
            
            // User operations
            performUserOperations(userId);
            
            StringBuilder result = new StringBuilder();
            result.append("{\n");
            result.append("  \"status\": \"success\",\n");
            result.append("  \"program\": \"PGM2\",\n");
            result.append("  \"user_id\": \"").append(userId).append("\",\n");
            result.append("  \"execution_time\": \"").append(new Date().toString()).append("\",\n");
            result.append("  \"user_data\": {\n");
            result.append("    \"message\": \"Data Management System\",\n");
            result.append("    \"access_level\": \"USER\",\n");
            result.append("    \"available_functions\": \"VIEW_DATA,EDIT_DATA,EXPORT_DATA\"\n");
            result.append("  }\n");
            result.append("}");
            
            System.out.println(result.toString());
            System.err.println("PGM2 completed successfully");
            
        } catch (Exception e) {
            System.err.println("PGM2 error: " + e.getMessage());
            e.printStackTrace();
            
            System.out.println("{");
            System.out.println("  \"status\": \"error\",");
            System.out.println("  \"message\": \"" + e.getMessage().replace("\"", "\\\"") + "\",");
            System.out.println("  \"program\": \"PGM2\"");
            System.out.println("}");
            
            System.exit(1);
        }
    }
    
    private static void performUserOperations(String userId) {
        System.err.println("Performing user operations for: " + userId);
        System.err.println("- Loading user data");
        System.err.println("- Checking permissions");
        System.err.println("- Preparing data view");
        
        try {
            Thread.sleep(50);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
        
        System.err.println("User operations completed");
    }
    
    private static String extractValue(String input, String key) {
        try {
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
        } catch (Exception e) {
            System.err.println("Error extracting value for key '" + key + "': " + e.getMessage());
        }
        return null;
    }
}
