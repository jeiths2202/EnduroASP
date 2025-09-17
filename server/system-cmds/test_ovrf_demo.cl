/* OVRF/DLTOVR Demo Script */
/* Test file override with dslock integration */
/* 
   EMPLOYEE.FB.TESTLIB parsing:
   - library: TESTLIB 
   - dataset: EMPLOYEE.FB
   - catalog: DISK01.TESTLIB.EMPLOYEE.FB
   - physical: /volume/DISK01/TESTLIB/EMPLOYEE.FB
*/

OVRF FILE(EMP-FILE) TOFILE(EMPLOYEE.FB.TESTLIB) TYPE(*DATA)

/* The Java program would now have access to the override mapping */
/* CALL PGM-TestProgram.TESTLIB */

DLTOVR FILE(EMP-FILE)