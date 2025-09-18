package com.openasp.system;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

/**
 * ??? ?? ?? ????
 */
public class SystemInfo {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            // ?? ??
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "");
            
            // ?? ??
            JSONResponse response = new JSONResponse();
            response.setSuccess(true);
            response.set("program", "SystemInfo");
            response.set("title", "??? ??");
            response.set("user_id", userId);
            
            // ??? ?? ??
            Runtime runtime = Runtime.getRuntime();
            long totalMemory = runtime.totalMemory();
            long freeMemory = runtime.freeMemory();
            long usedMemory = totalMemory - freeMemory;
            
            response.set("java_version", System.getProperty("java.version"));
            response.set("os_name", System.getProperty("os.name"));
            response.set("os_version", System.getProperty("os.version"));
            response.set("user_home", System.getProperty("user.home"));
            response.set("total_memory", totalMemory);
            response.set("used_memory", usedMemory);
            response.set("free_memory", freeMemory);
            response.set("processors", runtime.availableProcessors());
            response.set("current_time", System.currentTimeMillis());
            response.set("uptime", getUptime());
            
            response.set("message", "??? ?? ?? ??");
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "SystemInfo");
            error.set("message", "??? ?? ?? ??: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
    
    private static String getUptime() {
        long uptime = java.lang.management.ManagementFactory.getRuntimeMXBean().getUptime();
        long seconds = uptime / 1000;
        long minutes = seconds / 60;
        long hours = minutes / 60;
        return String.format("%d?? %d? %d?", hours, minutes % 60, seconds % 60);
    }
}

