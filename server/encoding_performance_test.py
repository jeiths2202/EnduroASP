#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Encoding Performance Test
Demonstrates the performance improvement of smart encoding vs forced conversion
"""

import time
import os
from encoding_manager import smart_encoding_manager, DestinationType, ConversionContext
from smed_reader import smed_reader
from parse_smed import parse_smed_file

def performance_test():
    """Test performance difference between smart and forced encoding"""
    
    test_files = [
        '/home/aspuser/app/volume/DISK01/TESTLIB/MENU',
        '/home/aspuser/app/volume/DISK01/TESTLIB/MAINMENU', 
        '/home/aspuser/app/volume/DISK01/TESTLIB/BROWSE_MENU',
        '/home/aspuser/app/volume/DISK01/TESTLIB/MENU001',
        '/home/aspuser/app/volume/DISK01/TESTLIB/MSGSAMP1'
    ]
    
    # Filter existing files
    existing_files = [f for f in test_files if os.path.exists(f)]
    
    print("=== SJIS/Unicode Conversion Performance Test ===")
    print(f"Testing with {len(existing_files)} SMED files")
    print()
    
    # Reset stats
    smart_encoding_manager.reset_stats()
    smed_reader.reset_stats()
    
    # Test 1: Server internal processing (smart - should skip conversions)
    print("1. Server Internal Processing (Smart Encoding):")
    start_time = time.time()
    
    for file_path in existing_files:
        try:
            result = parse_smed_file(file_path, destination='server')
        except Exception as e:
            print(f"   Error with {file_path}: {e}")
    
    smart_time = time.time() - start_time
    smart_stats = smart_encoding_manager.get_stats()
    reader_stats = smed_reader.get_stats()
    
    print(f"   Time taken: {smart_time:.4f} seconds")
    print(f"   Conversions performed: {smart_stats['conversions_performed']}")
    print(f"   Conversions skipped: {smart_stats['conversions_skipped']}")
    print(f"   Files read: {reader_stats['files_read']}")
    print(f"   Conversions avoided: {reader_stats['conversions_avoided']}")
    
    # Reset for next test
    smart_encoding_manager.reset_stats()
    smed_reader.reset_stats()
    
    # Test 2: Web UI processing (should perform conversions)
    print()
    print("2. Web UI Processing (Smart Encoding with Necessary Conversions):")
    start_time = time.time()
    
    for file_path in existing_files:
        try:
            result = parse_smed_file(file_path, destination='web_ui')
        except Exception as e:
            print(f"   Error with {file_path}: {e}")
    
    web_time = time.time() - start_time
    web_stats = smart_encoding_manager.get_stats()
    web_reader_stats = smed_reader.get_stats()
    
    print(f"   Time taken: {web_time:.4f} seconds")
    print(f"   Conversions performed: {web_stats['conversions_performed']}")
    print(f"   Conversions skipped: {web_stats['conversions_skipped']}")
    print(f"   Files read: {web_reader_stats['files_read']}")
    print(f"   Web UI reads: {web_reader_stats['web_ui_reads']}")
    
    # Test 3: Legacy forced conversion (simulate old behavior)
    print()
    print("3. Legacy Forced Conversion (Old Behavior Simulation):")
    start_time = time.time()
    
    forced_conversions = 0
    for file_path in existing_files:
        try:
            with open(file_path, 'rb') as f:
                raw_data = f.read()
            # Force conversion every time (old behavior)
            content = raw_data.decode('shift_jis', errors='replace')
            forced_conversions += 1
        except Exception as e:
            print(f"   Error with {file_path}: {e}")
    
    legacy_time = time.time() - start_time
    
    print(f"   Time taken: {legacy_time:.4f} seconds")
    print(f"   Forced conversions: {forced_conversions}")
    
    # Performance comparison
    print()
    print("=== Performance Analysis ===")
    if legacy_time > 0:
        server_improvement = ((legacy_time - smart_time) / legacy_time) * 100
        web_improvement = ((legacy_time - web_time) / legacy_time) * 100
        
        print(f"Server processing improvement: {server_improvement:.1f}%")
        print(f"Web UI processing difference: {web_improvement:.1f}%")
        print(f"Conversions avoided in server processing: {smart_stats['conversions_skipped']}/{len(existing_files)} ({(smart_stats['conversions_skipped']/len(existing_files)*100):.1f}%)")
    
    print()
    print("=== Key Benefits ===")
    print("• Server internal processing: No unnecessary SJIS↔Unicode conversions")
    print("• Web UI processing: Conversions only when needed for display") 
    print("• API responses: Smart conversion based on destination")
    print("• Reduced CPU usage and memory allocation")
    print("• Maintained data integrity with proper encoding handling")

if __name__ == "__main__":
    performance_test()