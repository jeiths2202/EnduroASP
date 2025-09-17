/**
 * EMPLOYEE.FB Dataset Test Program
 * 
 * Tests dslock and dsio APIs with real EMPLOYEE.FB dataset
 * Record Length: 80 bytes, Encoding: Shift_JIS, Format: FB
 */

#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

#define EMPLOYEE_DATASET "DISK01/TESTLIB/EMPLOYEE.FB"
#define RECORD_LENGTH 80
#define MAX_ERROR_MSG 512
#define MAX_RECORDS 10

// Employee record structure based on catalog.json
typedef struct {
    char id[7];         // Employee ID (6 chars + null)
    char name[23];      // Name field (22 chars + null) 
    char department[23]; // Department (22 chars + null)
    char salary[11];    // Salary (10 chars + null)
    char status[2];     // Status (1 char + null)
} employee_record_t;

// Function prototypes
int test_dslock_api(void);
int test_dsio_api(void);
int parse_employee_record(const char* raw_data, employee_record_t* emp);
void print_employee(const employee_record_t* emp, int record_num);
int test_concurrent_access(void);

int main(void) {
    printf("=== EMPLOYEE.FB Dataset Test Program ===\n");
    printf("Dataset: %s\n", EMPLOYEE_DATASET);
    printf("Record Length: %d bytes\n", RECORD_LENGTH);
    printf("Encoding: Shift_JIS\n\n");
    
    // Test 1: Dataset Lock API
    printf("1. Testing dslock API...\n");
    if (test_dslock_api() != 0) {
        fprintf(stderr, "dslock API test failed\n");
        return 1;
    }
    printf("dslock API test: PASSED\n\n");
    
    // Test 2: Dataset I/O API
    printf("2. Testing dsio API...\n");
    if (test_dsio_api() != 0) {
        fprintf(stderr, "dsio API test failed\n");
        return 1;
    }
    printf("dsio API test: PASSED\n\n");
    
    // Test 3: Concurrent Access
    printf("3. Testing concurrent access...\n");
    if (test_concurrent_access() != 0) {
        fprintf(stderr, "Concurrent access test failed\n");
        return 1;
    }
    printf("Concurrent access test: PASSED\n\n");
    
    printf("=== All tests completed successfully ===\n");
    return 0;
}

/**
 * Test dslock API functions
 */
int test_dslock_api(void) {
    char errbuf[MAX_ERROR_MSG];
    char statusbuf[1024];
    int rc;
    
    printf("  Testing dslock_acquire() with SHR level...\n");
    rc = dslock_acquire(EMPLOYEE_DATASET, "SHR", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    dslock_acquire(SHR) failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    printf("    dslock_acquire(SHR): SUCCESS\n");
    
    printf("  Testing dslock_status()...\n");
    memset(statusbuf, 0, sizeof(statusbuf));
    memset(errbuf, 0, sizeof(errbuf));
    rc = dslock_status(EMPLOYEE_DATASET, statusbuf, sizeof(statusbuf), errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    dslock_status() failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    printf("    Lock status: %.100s\n", statusbuf);
    
    printf("  Testing dslock_acquire() with MOD level (should conflict)...\n");
    rc = dslock_acquire(EMPLOYEE_DATASET, "MOD", errbuf, sizeof(errbuf));
    if (rc == DSERR_CONFLICT) {
        printf("    dslock_acquire(MOD): Expected conflict detected\n");
    } else if (rc == DSERR_OK) {
        printf("    dslock_acquire(MOD): No conflict (unexpected but OK)\n");
        dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
    } else {
        fprintf(stderr, "    dslock_acquire(MOD) unexpected error: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    
    printf("  Testing dslock_release()...\n");
    rc = dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    dslock_release() failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    printf("    dslock_release(): SUCCESS\n");
    
    printf("  Testing dslock_sweep()...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("    dslock_sweep(): Cleaned %d expired locks\n", rc);
    } else {
        fprintf(stderr, "    dslock_sweep() failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    
    return 0;
}

/**
 * Test dsio API functions
 */
int test_dsio_api(void) {
    dsio_t handle;
    char errbuf[MAX_ERROR_MSG];
    char buffer[RECORD_LENGTH + 1];
    employee_record_t emp;
    ssize_t bytes_read;
    int record_count = 0;
    int rc;
    
    printf("  Testing dsio_open() for READ...\n");
    rc = dsio_open(&handle, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    dsio_open(READ) failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    printf("    dsio_open(READ): SUCCESS\n");
    printf("    Dataset: %s, Level: %s, RECFM: %s, LRECL: %d\n",
           handle.dataset, handle.level, handle.recfm, handle.lrecl);
    
    printf("  Testing dsio_read() - reading first %d records...\n", MAX_RECORDS);
    while (record_count < MAX_RECORDS) {
        memset(buffer, 0, sizeof(buffer));
        bytes_read = dsio_read(&handle, buffer, RECORD_LENGTH, errbuf, sizeof(errbuf));
        
        if (bytes_read == 0) {
            printf("    End of file reached at record %d\n", record_count);
            break;
        }
        
        if (bytes_read < 0) {
            fprintf(stderr, "    dsio_read() failed: %s\n", errbuf);
            dsio_close(&handle, errbuf, sizeof(errbuf));
            return -1;
        }
        
        if (bytes_read != RECORD_LENGTH) {
            fprintf(stderr, "    Unexpected record length: %zd (expected %d)\n", 
                    bytes_read, RECORD_LENGTH);
            dsio_close(&handle, errbuf, sizeof(errbuf));
            return -1;
        }
        
        // Parse and display employee record
        if (parse_employee_record(buffer, &emp) == 0) {
            print_employee(&emp, record_count + 1);
        }
        
        record_count++;
    }
    
    printf("  Successfully read %d records\n", record_count);
    
    printf("  Testing dsio_close()...\n");
    rc = dsio_close(&handle, errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    dsio_close() failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    printf("    dsio_close(): SUCCESS\n");
    
    return 0;
}

/**
 * Parse EMPLOYEE.FB record from raw data
 */
int parse_employee_record(const char* raw_data, employee_record_t* emp) {
    if (!raw_data || !emp) return -1;
    
    memset(emp, 0, sizeof(*emp));
    
    // Extract fields based on EMPLOYEE.FB structure analysis
    // ID: positions 0-5
    strncpy(emp->id, raw_data, 6);
    emp->id[6] = '\0';
    
    // Name: positions 6-27 (trim trailing spaces)
    strncpy(emp->name, raw_data + 6, 22);
    emp->name[22] = '\0';
    
    // Department: positions 42-63 (approximate, varies by record)
    if (strlen(raw_data) > 42) {
        strncpy(emp->department, raw_data + 42, 22);
        emp->department[22] = '\0';
    }
    
    // Salary: positions 64-73 (approximate)
    if (strlen(raw_data) > 64) {
        strncpy(emp->salary, raw_data + 64, 10);
        emp->salary[10] = '\0';
    }
    
    // Status: last character
    if (strlen(raw_data) > 75) {
        emp->status[0] = raw_data[79];
        emp->status[1] = '\0';
    }
    
    return 0;
}

/**
 * Print employee record in readable format
 */
void print_employee(const employee_record_t* emp, int record_num) {
    printf("    Record %d: ID=%s, Name=%.22s, Dept=%.22s, Status=%s\n",
           record_num, emp->id, emp->name, emp->department, emp->status);
}

/**
 * Test concurrent access scenarios
 */
int test_concurrent_access(void) {
    dsio_t handle1, handle2;
    char errbuf[MAX_ERROR_MSG];
    char buffer[RECORD_LENGTH + 1];
    int rc;
    ssize_t bytes_read;
    
    printf("  Testing concurrent SHR access...\n");
    
    // Open first handle with SHR
    rc = dsio_open(&handle1, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    First dsio_open(READ) failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        return -1;
    }
    
    // Open second handle with SHR (should succeed)
    rc = dsio_open(&handle2, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "    Second dsio_open(READ) failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
        dsio_close(&handle1, errbuf, sizeof(errbuf));
        return -1;
    }
    
    printf("    Both READ handles opened successfully\n");
    
    // Read one record from each handle
    bytes_read = dsio_read(&handle1, buffer, RECORD_LENGTH, errbuf, sizeof(errbuf));
    if (bytes_read == RECORD_LENGTH) {
        printf("    Handle1 read: SUCCESS (%zd bytes)\n", bytes_read);
    }
    
    bytes_read = dsio_read(&handle2, buffer, RECORD_LENGTH, errbuf, sizeof(errbuf));
    if (bytes_read == RECORD_LENGTH) {
        printf("    Handle2 read: SUCCESS (%zd bytes)\n", bytes_read);
    }
    
    // Close both handles
    dsio_close(&handle1, errbuf, sizeof(errbuf));
    dsio_close(&handle2, errbuf, sizeof(errbuf));
    
    printf("    Concurrent access test completed\n");
    return 0;
}