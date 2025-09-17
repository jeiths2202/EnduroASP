package com.openasp.user;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

/**
 * ??? ?? ????
 */
public class UserManagement {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            // ?? ??
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "");
            String action = parser.getString("action", "list");
            
            // ?? ??
            JSONResponse response = new JSONResponse();
            response.setSuccess(true);
            response.set("program", "UserManagement");
            response.set("title", "??? ??");
            response.set("user_id", userId);
            response.set("action", action);
            
            // ??? ??
            switch (action) {
                case "list":
                    response.set("users", getUserList());
                    response.set("message", "??? ?? ?? ??");
                    break;
                case "add":
                    response.set("message", "??? ?? ??");
                    response.set("required_fields", new String[]{"user_id", "password", "name", "role"});
                    break;
                case "edit":
                    response.set("message", "??? ?? ??");
                    response.set("edit_user_id", parser.getString("target_user", ""));
                    break;
                case "delete":
                    response.set("message", "??? ?? ??");
                    response.set("delete_user_id", parser.getString("target_user", ""));
                    break;
                default:
                    response.set("message", "??? ?? ?? ??");
                    response.set("available_actions", new String[]{"list", "add", "edit", "delete"});
            }
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "UserManagement");
            error.set("message", "??? ?? ??: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
    
    private static String[][] getUserList() {
        return new String[][] {
            {"admin", "???", "2025-01-01", "??"},
            {"user01", "???1", "2025-01-02", "??"},
            {"eigyo", "????", "2025-01-03", "??"},
            {"uriage", "????", "2025-01-04", "??"}
        };
    }
}

