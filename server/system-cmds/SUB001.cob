      * SUB001.cob - Employee Information Display Program
      * Fujitsu ASP COBOLG Program
      * Reads EMP.INFO dataset and sends MENU001 map to display employee records
       
       IDENTIFICATION DIVISION.
       PROGRAM-ID. SUB001.
       AUTHOR. OpenASP System.
       DATE-WRITTEN. 2025-08-02.
       
       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT EMP-FILE ASSIGN TO "EMP.INFO"
                  ORGANIZATION IS SEQUENTIAL
                  ACCESS MODE IS SEQUENTIAL
                  FILE STATUS IS WS-FILE-STATUS.
           SELECT DISPFILE ASSIGN TO GS-DISPFILE
                  SYMBOLIC DESTINATION IS "DSP"
                  SELECTED FUNCTION IS EMP-FUNC.
       
       DATA DIVISION.
       FILE SECTION.
       FD  EMP-FILE
           RECORD CONTAINS 80 CHARACTERS
           RECORDING MODE F
           LABEL RECORDS ARE STANDARD.
       01  EMP-RECORD.
           05  EMP-ID          PIC X(5).
           05  EMP-NAME        PIC X(20).
           05  EMP-EMAIL       PIC X(20).
           05  EMP-FILLER      PIC X(35).
       
       FD  DISPFILE.
           COPY MENU001 OF XMLLIB.
       
       WORKING-STORAGE SECTION.
       01  WS-FILE-STATUS      PIC XX.
       01  WS-EOF-FLAG         PIC X VALUE 'N'.
       01  WS-RECORD-COUNT     PIC 9(3) VALUE ZERO.
       01  WS-ROW-INDEX        PIC 9(1) VALUE 1.
       01  GS-DISPFILE         PIC X(8) VALUE "MENU001".
       
       PROCEDURE DIVISION.
       MAIN-PROCEDURE.
           PERFORM INITIALIZE-PROGRAM.
           PERFORM READ-EMP-RECORDS.
           PERFORM SEND-MAP-TO-DISPLAY.
           PERFORM TERMINATE-PROGRAM.
           STOP RUN.
       
       INITIALIZE-PROGRAM.
           OPEN INPUT EMP-FILE.
           OPEN I-O DISPFILE.
           IF WS-FILE-STATUS NOT = "00"
               DISPLAY "ERROR: Cannot open EMP.INFO file"
               STOP RUN
           END-IF.
           
           MOVE "ŽÐˆõî•ñÆ‰ï" TO TITLE.
           MOVE "ŽÐˆõ”Ô†" TO HEADER1.
           MOVE "ŽÐˆõ–¼" TO HEADER2.
           MOVE "e-mail" TO HEADER3.
           MOVE "F7(ŽŸ‰æ–Ê) F8(‘O‰æ–Ê) F1(‰Šú‰æ–Ê)" TO HELP.
       
       READ-EMP-RECORDS.
           PERFORM UNTIL WS-EOF-FLAG = 'Y' OR WS-ROW-INDEX > 5
               READ EMP-FILE
                   AT END
                       MOVE 'Y' TO WS-EOF-FLAG
                   NOT AT END
                       PERFORM POPULATE-MAP-ROW
               END-READ
           END-PERFORM.
       
       POPULATE-MAP-ROW.
           ADD 1 TO WS-RECORD-COUNT.
           
           EVALUATE WS-ROW-INDEX
               WHEN 1
                   MOVE EMP-ID TO ROW1-1
                   MOVE EMP-NAME TO ROW1-2
                   MOVE EMP-EMAIL TO ROW1-3
               WHEN 2
                   MOVE EMP-ID TO ROW2-1
                   MOVE EMP-NAME TO ROW2-2
                   MOVE EMP-EMAIL TO ROW2-3
               WHEN 3
                   MOVE EMP-ID TO ROW3-1
                   MOVE EMP-NAME TO ROW3-2
                   MOVE EMP-EMAIL TO ROW3-3
               WHEN 4
                   MOVE EMP-ID TO ROW4-1
                   MOVE EMP-NAME TO ROW4-2
                   MOVE EMP-EMAIL TO ROW4-3
               WHEN 5
                   MOVE EMP-ID TO ROW5-1
                   MOVE EMP-NAME TO ROW5-2
                   MOVE EMP-EMAIL TO ROW5-3
           END-EVALUATE.
           
           ADD 1 TO WS-ROW-INDEX.
       
       SEND-MAP-TO-DISPLAY.
           WRITE DISPFILE FROM DISP-RECORD.
           
           DISPLAY "Employee inquiry completed successfully. "
                   WS-RECORD-COUNT " records found.".
       
       TERMINATE-PROGRAM.
           CLOSE EMP-FILE.
           CLOSE DISPFILE.
