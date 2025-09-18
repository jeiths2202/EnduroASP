package com.openasp.core;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

public class PGM1 {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "");
            String password = parser.getString("password", "");
            
            JSONResponse response = new JSONResponse();
            response.setSuccess(true);
            response.set("status", "success");
            response.set("program", "PGM1");
            response.set("user_id", userId);
            response.set("message", "??? ?? ??");
            response.set("next_map", "MENU");
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "PGM1");
            error.set("message", "PGM1 ?? ??: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
}
