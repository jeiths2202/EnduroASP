/**
 * Test Case: Acquire lock and read records
 * 
 * 1. Acquire exclusive lock on dataset
 * 2. If lock acquired successfully, open dataset
 * 3. Read records by exact record length
 * 4. Print each record content
 * 5. Release lock when done
 */

#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <ctype.h>

#define EMPLOYEE_DATASET "DISK01/TESTLIB/EMPLOYEE.FB"
#define MAX_RECORDS_TO_DISPLAY 10

// Print buffer in hex and ASCII format
void print_hex_dump(const unsigned char* buffer, size_t len, int record_num) {
    printf("Record %d (%zu bytes):\n", record_num, len);
    printf("Offset  Hex                                              ASCII\n");
    printf("------  -----------------------------------------------  ----------------\n");
    
    for (size_t i = 0; i < len; i += 16) {
        // Print offset
        printf("%06zx  ", i);
        
        // Print hex bytes
        for (size_t j = 0; j < 16; j++) {
            if (i + j < len) {
                printf("%02x ", buffer[i + j]);
            } else {
                printf("   ");
            }
            if (j == 7) printf(" ");
        }
        
        printf(" ");
        
        // Print ASCII
        for (size_t j = 0; j < 16 && i + j < len; j++) {
            unsigned char c = buffer[i + j];
            printf("%c", isprint(c) ? c : '.');
        }
        printf("\n");
    }
    printf("\n");
}

// Extract and print readable fields from employee record
void print_employee_fields(const unsigned char* buffer, size_t len, int record_num) {
    if (len < 80) return;
    
    // Extract fields based on known structure
    char emp_id[7] = {0};
    char name[41] = {0};
    char dept[41] = {0};
    
    // Employee ID (positions 0-5)
    memcpy(emp_id, buffer, 6);
    
    // Name field (positions 6-27, may contain SJIS)
    memcpy(name, buffer + 6, 22);
    
    // Department (approximate position 42-63)
    if (len > 42) {
        memcpy(dept, buffer + 42, 22);
    }
    
    printf("Record %d parsed fields:\n", record_num);
    printf("  Employee ID: %s\n", emp_id);
    printf("  Name (raw): ");
    for (int i = 0; i < 22 && name[i]; i++) {
        printf("%02x ", (unsigned char)name[i]);
    }
    printf("\n");
    printf("  Dept (raw): ");
    for (int i = 0; i < 22 && dept[i]; i++) {
        printf("%02x ", (unsigned char)dept[i]);
    }
    printf("\n\n");
}

int main(void) {
    printf("=== Dataset Lock and Read Test ===\n");
    printf("Dataset: %s\n\n", EMPLOYEE_DATASET);
    
    char errbuf[512];
    int rc;
    
    // Step 1: Acquire exclusive lock (OLD level for exclusive read)
    printf("Step 1: Acquiring exclusive lock (OLD)...\n");
    rc = dslock_acquire(EMPLOYEE_DATASET, "OLD", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        if (rc == DSERR_CONFLICT) {
            printf("  Lock conflict detected. Dataset is locked by another process.\n");
            printf("  Error: %s\n", errbuf);
            
            // Try to get lock status
            char status[1024];
            if (dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf)) == DSERR_OK) {
                printf("  Current lock status: %s\n", status);
            }
            
            // Try with shared lock instead
            printf("\n  Trying shared lock (SHR) instead...\n");
            rc = dslock_acquire(EMPLOYEE_DATASET, "SHR", errbuf, sizeof(errbuf));
        }
    }
    
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Failed to acquire lock: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return 1;
    }
    
    printf("  Lock acquired successfully!\n");
    
    // Step 2: Check lock status
    printf("\nStep 2: Checking lock status...\n");
    char status[1024];
    memset(status, 0, sizeof(status));
    rc = dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
    if (rc == DSERR_OK && strlen(status) > 0) {
        printf("  Status: %.*s\n", 100, status);
    }
    
    // Step 3: Open dataset
    printf("\nStep 3: Opening dataset...\n");
    dsio_t handle;
    rc = dsio_open(&handle, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Failed to open dataset: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
        return 1;
    }
    
    printf("  Dataset opened successfully\n");
    printf("  RECFM: %s\n", handle.recfm);
    printf("  LRECL: %d\n", handle.lrecl);
    printf("  Level: %s\n", handle.level);
    
    // Step 4: Read records by exact record length
    printf("\nStep 4: Reading records (LRECL=%d)...\n", handle.lrecl);
    
    unsigned char* buffer = malloc(handle.lrecl + 1);
    if (!buffer) {
        fprintf(stderr, "Memory allocation failed\n");
        dsio_close(&handle, errbuf, sizeof(errbuf));
        dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
        return 1;
    }
    
    int record_count = 0;
    ssize_t bytes_read;
    
    while (record_count < MAX_RECORDS_TO_DISPLAY) {
        memset(buffer, 0, handle.lrecl + 1);
        
        // Read exactly LRECL bytes
        bytes_read = dsio_read(&handle, buffer, handle.lrecl, errbuf, sizeof(errbuf));
        
        if (bytes_read == 0) {
            printf("\nEnd of file reached after %d records\n", record_count);
            break;
        }
        
        if (bytes_read < 0) {
            fprintf(stderr, "\nRead error: %s\n", errbuf);
            break;
        }
        
        if (bytes_read != handle.lrecl) {
            fprintf(stderr, "\nWarning: Read %zd bytes, expected %d\n", 
                    bytes_read, handle.lrecl);
        }
        
        record_count++;
        
        printf("\n--- Record %d ---\n", record_count);
        
        // Print hex dump
        print_hex_dump(buffer, bytes_read, record_count);
        
        // Print parsed fields
        print_employee_fields(buffer, bytes_read, record_count);
    }
    
    free(buffer);
    
    // Step 5: Close dataset
    printf("\nStep 5: Closing dataset...\n");
    rc = dsio_close(&handle, errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Warning: Close failed: %s\n", errbuf);
    } else {
        printf("  Dataset closed successfully\n");
    }
    
    // Step 6: Release lock
    printf("\nStep 6: Releasing lock...\n");
    rc = dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Warning: Release failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
    } else {
        printf("  Lock released successfully\n");
    }
    
    // Step 7: Run sweep to clean up any stale locks
    printf("\nStep 7: Running lock sweep...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("  Sweep completed: %d stale locks removed\n", rc);
    } else {
        fprintf(stderr, "  Sweep failed: %s\n", errbuf);
    }
    
    printf("\n=== Test completed ===\n");
    printf("Total records read: %d\n", record_count);
    
    return 0;
}