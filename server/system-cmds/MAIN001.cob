       IDENTIFICATION DIVISION.
       PROGRAM-ID. MAIN001.

       ENVIRONMENT DIVISION.
       INPUT-OUTPUT SECTION.
       FILE-CONTROL.
           SELECT DISPFILE ASSIGN TO GS-DISPFILE
               SYMBOLIC DESTINATION IS "DSP"
               SELECTED FUNCTION IS EMP-FUNC.

       DATA DIVISION.
       FILE SECTION.
       FD  DISPFILE.
           COPY MITDSP OF XMLLIB.

       WORKING-STORAGE SECTION.
       01 WS-END-FLAG     PIC X(1) VALUE "N".
       01 GS-DISPFILE     PIC X(8) VALUE "MAIN001".

       PROCEDURE DIVISION.
       BEGIN.
           OPEN I-O DISPFILE

           PERFORM MAIN-LOOP

           CLOSE DISPFILE
           STOP RUN.

       MAIN-LOOP.
           WRITE DISPFILE FROM DISP-RECORD
           READ  DISPFILE INTO DISP-RECORD

           EVALUATE EMP-FUNC
               WHEN "1"
                   CALL "SUB001"
               WHEN "2"
                   CALL "SUB002"
               WHEN "3"
                   CALL "SUB003"
               WHEN "4"
                   CALL "SUB004"
               WHEN OTHER
                   MOVE "Y" TO WS-END-FLAG
           END-EVALUATE

           IF WS-END-FLAG = "N"
               GO TO MAIN-LOOP.
           .