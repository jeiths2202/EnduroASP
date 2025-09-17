package com.openasp.launcher;

import java.lang.reflect.Method;

public class OpenASPLauncher {
    public static void main(String[] args) {
        if (args.length == 0) {
            System.err.println("???: java -jar ofasp.jar <???.????>");
            System.err.println("??: java -jar ofasp.jar com.openasp.core.PGM1");
            System.exit(1);
        }
        
        String className = args[0];
        
        try {
            Class<?> clazz = Class.forName(className);
            Method mainMethod = clazz.getMethod("main", String[].class);
            String[] programArgs = new String[0];
            mainMethod.invoke(null, (Object) programArgs);
            
        } catch (ClassNotFoundException e) {
            System.err.println("???? ?? ? ????: " + className);
            System.exit(1);
        } catch (Exception e) {
            System.err.println("???? ?? ??: " + e.getMessage());
            System.exit(1);
        }
    }
}
