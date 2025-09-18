package com.openasp.system;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

public class LogoutProgram {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "");
            String action = parser.getString("action", "");
            
            JSONResponse response = new JSONResponse();
            response.set("program", "LogoutProgram");
            response.set("title", "OpenASP ログアウト");
            
            // ログアウト処理
            if ("logout".equals(action) || userId != null) {
                System.err.println("ユーザー " + userId + " がログアウトしました");
                
                response.setSuccess(true);
                response.set("status", "logged_out");
                response.set("user_id", userId);
                response.set("message", "ログアウトしました");
                response.set("next_map", "LOGO");
                response.set("clear_session", true);
            } else {
                response.setSuccess(false);
                response.set("status", "logout_failed");
                response.set("message", "ログアウトに失敗しました");
            }
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "LogoutProgram");
            error.set("message", "ログアウト処理エラー: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
}