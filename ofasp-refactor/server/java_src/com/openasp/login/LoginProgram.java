package com.openasp.login;

import java.util.Scanner;
import java.io.File;
import java.io.FileReader;
import java.io.BufferedReader;
import java.util.HashMap;
import java.util.Map;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

public class LoginProgram {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "");
            String password = parser.getString("password", "");
            String functionKey = parser.getString("function_key", "");
            String action = parser.getString("action", "");
            
            JSONResponse response = new JSONResponse();
            response.set("program", "LoginProgram");
            response.set("title", "OpenASP ログイン");
            
            // F3キー（ログアウト/終了）の処理
            if ("F3".equals(functionKey) || "function_key_pressed".equals(action)) {
                System.err.println("F3キーが押されました - ログアウト処理");
                response.setSuccess(true);
                response.set("status", "logout_requested");
                response.set("message", "ログアウトします");
                response.set("next_map", "LOGOUT");
                response.set("function_key", functionKey);
            }
            // 通常のログイン処理
            else if (userId != null && !userId.trim().isEmpty() && password != null && !password.trim().isEmpty()) {
                Map<String, String> accounts = loadAccountData();
                boolean loginSuccess = validateLogin(userId, password, accounts);
                
                if (loginSuccess) {
                    response.setSuccess(true);
                    response.set("status", "authenticated");
                    response.set("user_id", userId);
                    response.set("message", "ログイン成功");
                    response.set("next_map", "MENU");
                } else {
                    response.setSuccess(false);
                    response.set("status", "authentication_failed");
                    response.set("message", "ログイン失敗");
                }
            }
            // 入力データが不十分な場合
            else {
                response.setSuccess(false);
                response.set("status", "insufficient_data");
                response.set("message", "ユーザーIDとパスワードを入力してください");
            }
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "LoginProgram");
            error.set("message", "ログイン処理エラー: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
    
    /**
     * account.jsonファイルからアカウント情報を読み込む
     */
    private static Map<String, String> loadAccountData() {
        Map<String, String> accounts = new HashMap<>();
        
        try {
            // account.jsonファイルの場所を特定
            String accountFilePath = "/home/aspuser/app/src/account.json";
            File accountFile = new File(accountFilePath);
            
            if (!accountFile.exists()) {
                System.err.println("アカウントファイルが見つかりません: " + accountFilePath);
                return accounts;
            }
            
            // JSONファイルを簡単にパース（基本的なJSON読み込み）
            BufferedReader reader = new BufferedReader(new FileReader(accountFile));
            StringBuilder jsonContent = new StringBuilder();
            String line;
            
            while ((line = reader.readLine()) != null) {
                jsonContent.append(line);
            }
            reader.close();
            
            String json = jsonContent.toString();
            
            // 簡易JSONパース（admin, user01, test, demo を抽出）
            String[] userIds = {"admin", "user01", "test", "demo"};
            
            for (String userId : userIds) {
                String userPattern = "\"" + userId + "\"";
                int userIndex = json.indexOf(userPattern);
                
                if (userIndex != -1) {
                    // ユーザーセクションを見つける
                    int sectionStart = json.indexOf("{", userIndex);
                    int sectionEnd = json.indexOf("}", sectionStart);
                    
                    if (sectionStart != -1 && sectionEnd != -1) {
                        String userSection = json.substring(sectionStart, sectionEnd + 1);
                        
                        // パスワードを抽出
                        String passPattern = "\"password\"";
                        int passIndex = userSection.indexOf(passPattern);
                        
                        if (passIndex != -1) {
                            int passStart = userSection.indexOf("\"", passIndex + passPattern.length() + 1);
                            int passEnd = userSection.indexOf("\"", passStart + 1);
                            
                            if (passStart != -1 && passEnd != -1) {
                                String password = userSection.substring(passStart + 1, passEnd);
                                accounts.put(userId, password);
                                System.err.println("アカウント読み込み: " + userId);
                            }
                        }
                    }
                }
            }
            
        } catch (Exception e) {
            System.err.println("アカウントデータ読み込みエラー: " + e.getMessage());
        }
        
        return accounts;
    }
    
    /**
     * ユーザーIDとパスワードを検証する
     */
    private static boolean validateLogin(String userId, String password, Map<String, String> accounts) {
        if (userId == null || password == null || userId.trim().isEmpty() || password.trim().isEmpty()) {
            return false;
        }
        
        String storedPassword = accounts.get(userId.trim());
        return storedPassword != null && storedPassword.equals(password.trim());
    }
}
