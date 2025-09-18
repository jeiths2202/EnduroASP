package com.openasp.menu;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

public class MenuProgram {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "guest");
            String command = parser.getString("command", "");
            String functionKey = parser.getString("function_key", "");
            String action = parser.getString("action", "");
            String selection = parser.getString("SELECTION", "");
            
            JSONResponse response = new JSONResponse();
            response.setSuccess(true);
            response.set("program", "MenuProgram");
            response.set("title", "OpenASP メインメニュー");
            response.set("user_id", userId);
            
            // F3キー（ログアウト）の処理
            if ("F3".equals(functionKey)) {
                System.err.println("F3キーが押されました - ログアウト処理");
                response.set("status", "logout_requested");
                response.set("message", "ログアウトします");
                response.set("next_map", "LOGOUT");
                response.set("function_key", functionKey);
            }
            // F1キー（ヘルプ）の処理
            else if ("F1".equals(functionKey)) {
                System.err.println("F1キーが押されました - ヘルプ表示");
                response.set("status", "help_requested");
                response.set("message", "ヘルプを表示します");
                response.set("help_text", "F1=ヘルプ F3=終了 F12=キャンセル Enter=実行");
            }
            // F12キー（キャンセル）の処理
            else if ("F12".equals(functionKey)) {
                System.err.println("F12キーが押されました - キャンセル処理");
                response.set("status", "cancelled");
                response.set("message", "操作をキャンセルしました");
            }
            // メニュー選択の処理
            else if (!selection.isEmpty()) {
                String selectedProgram = "";
                String nextMap = "";
                
                switch (selection) {
                    case "1":
                        selectedProgram = "EIGYO001";
                        nextMap = "EIGYO001";
                        break;
                    case "2":
                        selectedProgram = "URIAGE001";
                        nextMap = "URIAGE001";
                        break;
                    case "3":
                        selectedProgram = "ZAIKO001";
                        nextMap = "ZAIKO001";
                        break;
                    case "4":
                        selectedProgram = "USER001";
                        nextMap = "USER001";
                        break;
                    case "5":
                        selectedProgram = "SYSTEM001";
                        nextMap = "SYSTEM001";
                        break;
                    case "6":
                        selectedProgram = "REPORT001";
                        nextMap = "REPORT001";
                        break;
                    default:
                        response.setSuccess(false);
                        response.set("message", "無効な選択です (1-6を入力してください)");
                        break;
                }
                
                if (!selectedProgram.isEmpty()) {
                    response.set("selected_program", selectedProgram);
                    response.set("next_map", nextMap);
                    response.set("message", "プログラム " + selectedProgram + " を実行します");
                }
            }
            // コマンド処理（旧形式サポート）
            else if (!command.isEmpty()) {
                response.set("selected_command", command);
                response.set("message", "コマンド実行: " + command);
            }
            // デフォルト状態
            else {
                String[] menuItems = {
                    "1. 営業管理システム (EIGYO001)",
                    "2. 売上管理システム (URIAGE001)", 
                    "3. 在庫管理システム (ZAIKO001)",
                    "4. ユーザー管理 (USER001)",
                    "5. システム情報 (SYSTEM001)",
                    "6. レポート出力 (REPORT001)"
                };
                response.set("menu_items", menuItems);
                response.set("message", "メニューを選択してください (1-6)");
            }
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "MenuProgram");
            error.set("message", "?? ???? ??: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
}
