package com.openasp.core;

import java.util.Scanner;
import com.openasp.common.JSONResponse;
import com.openasp.common.InputParser;

public class PGM2 {
    public static void main(String[] args) {
        try {
            Scanner scanner = new Scanner(System.in);
            String input = scanner.nextLine();
            scanner.close();
            
            InputParser parser = new InputParser(input);
            String userId = parser.getString("user_id", "guest");
            
            JSONResponse response = new JSONResponse();
            response.setSuccess(true);
            response.set("status", "success");
            response.set("program", "PGM2");
            response.set("user_id", userId);
            response.set("message", "??? ???? ?? ??");
            
            System.out.println(response.toString());
            
        } catch (Exception e) {
            JSONResponse error = new JSONResponse();
            error.setSuccess(false);
            error.set("program", "PGM2");
            error.set("message", "PGM2 ?? ??: " + e.getMessage());
            System.out.println(error.toString());
        }
    }
}
