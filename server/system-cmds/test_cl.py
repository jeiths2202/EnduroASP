#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test script for CL Parser and Executor
"""

import os
import sys

# Add current directory to path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from cl_parser import parse_cl_script
from cl_executor import execute_cl_script

# Test CL script based on the provided sample
test_script = """
* ASP Control Language Example
CHGLIBL LIBL=TESTLIB
CRTFILE FILE=CUSTOMERS,RECSIZE=128
CALL PGM=CUINP001,PARA='001,ABC'
DLTFILE FILE=CUSTOMERS
"""

print("=" * 70)
print("CL Parser and Executor Test")
print("=" * 70)
print()

# Test 1: Parse the script
print("TEST 1: Parsing CL Script")
print("-" * 50)
print("Script content:")
print(test_script)
print()

instructions = parse_cl_script(test_script)
print(f"Parsed {len(instructions)} instructions:")
for i, instr in enumerate(instructions):
    print(f"{i+1}. {instr['command']} - {instr['params']}")
print()

# Test 2: More complex parsing tests
print("TEST 2: Complex Parameter Parsing")
print("-" * 50)

complex_tests = [
    "CHGLIBL LIBL=LIB1,LIB2,LIB3 MODE=@ADD POSITION=@TOP",
    "CALL PGM=MYPROG,PARA='A,B,C',MODE=BATCH",
    "CRTFILE FILE=MYFILE,VOL=DISK01,LIB=TESTLIB,RECSIZE=256",
    "CHGLIBL OBJL=OBJLIB1,OBJLIB2 MODE=@DLT ERRMODE=@YES",
]

for test_line in complex_tests:
    parsed = parse_cl_script(test_line)[0]
    print(f"Input:  {test_line}")
    print(f"Command: {parsed['command']}")
    print(f"Params:  {parsed['params']}")
    print()

# Test 3: Execute a simple script
print("TEST 3: Execute Simple CL Script")
print("-" * 50)

# First create a test environment
setup_script = """
* Setup test environment
CRTLIB LIB=TESTLIB,VOL=DISK01
CRTFILE FILE=TESTFILE,VOL=DISK01,LIB=TESTLIB,RECSIZE=80
"""

print("Setting up test environment...")
execute_cl_script(setup_script)
print()

# Now test CHGLIBL
chglibl_script = """
* Test CHGLIBL command
CHGLIBL LIBL=TESTLIB MODE=@ADD POSITION=@TOP
CHGLIBL OBJL=TESTLIB MODE=@ADD
CHGLIBL FILEL=TESTLIB MODE=@ADD ERRMODE=@YES
"""

print("Testing CHGLIBL commands...")
failed = execute_cl_script(chglibl_script)
print(f"Execution result: {failed} failures")
print()

# Test 4: Error handling
print("TEST 4: Error Handling")
print("-" * 50)

error_script = """
* This should cause errors
CHGLIBL LIBL=NONEXISTENT MODE=@ADD ERRMODE=@YES
CALL PGM=NONEXISTENT
"""

print("Testing error conditions...")
failed = execute_cl_script(error_script, stop_on_error=False)
print(f"Execution result: {failed} failures (expected)")
print()

print("=" * 70)
print("Test completed!")
print("=" * 70)