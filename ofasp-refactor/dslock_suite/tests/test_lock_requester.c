/**
 * Test Module 2: Lock Requester
 * 
 * This test module attempts to acquire a SHR (shared read) lock on EMPLOYEE.FB
 * dataset. If another process holds an OLD lock, this should fail with CONFLICT.
 * This module will retry several times to demonstrate lock conflict handling.
 */

#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>
#include <time.h>

#define EMPLOYEE_DATASET "DISK01/TESTLIB/EMPLOYEE.FB"
#define MAX_RETRY_ATTEMPTS 100
#define RETRY_INTERVAL_SECONDS 5

int main(void) {
    printf("=== Dataset Lock Requester Test ===\n");
    printf("Dataset: %s\n", EMPLOYEE_DATASET);
    printf("Lock Level: SHR (shared read)\n");
    printf("Max Retry Attempts: %d\n", MAX_RETRY_ATTEMPTS);
    printf("Retry Interval: %d seconds\n\n", RETRY_INTERVAL_SECONDS);
    
    char errbuf[512];
    int rc;
    int attempt = 0;
    time_t start_time, attempt_time;
    
    time(&start_time);
    printf("Start time: %s\n", ctime(&start_time));
    
    while (attempt < MAX_RETRY_ATTEMPTS) {
        attempt++;
        time(&attempt_time);
        
        printf("--- Attempt %d/%d ---\n", attempt, MAX_RETRY_ATTEMPTS);
        printf("Time: %s", ctime(&attempt_time));
        
        // Step 1: Check current lock status
        printf("Step 1: Checking current lock status...\n");
        char status[1024];
        memset(status, 0, sizeof(status));
        rc = dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
        if (rc == DSERR_OK && strlen(status) > 0) {
            printf("  Current status: %.*s\n", 200, status);
        } else {
            printf("  No active locks found or status check failed\n");
        }
        
        // Step 2: Attempt to acquire SHR lock
        printf("Step 2: Attempting to acquire SHR lock...\n");
        rc = dslock_acquire(EMPLOYEE_DATASET, "SHR", errbuf, sizeof(errbuf));
        
        if (rc == DSERR_OK) {
            printf("  SUCCESS! SHR lock acquired on attempt %d\n", attempt);
            
            // Successfully acquired lock, now test reading
            printf("\nStep 3: Opening dataset in READ mode...\n");
            dsio_t handle;
            rc = dsio_open(&handle, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
            if (rc == DSERR_OK) {
                printf("  Dataset opened successfully\n");
                printf("  RECFM: %s\n", handle.recfm);
                printf("  LRECL: %d\n", handle.lrecl);
                printf("  Level: %s\n", handle.level);
                
                // Read first record to verify access
                printf("\nStep 4: Testing read access...\n");
                unsigned char buffer[256];
                memset(buffer, 0, sizeof(buffer));
                
                ssize_t bytes_read = dsio_read(&handle, buffer, handle.lrecl, errbuf, sizeof(errbuf));
                if (bytes_read > 0) {
                    printf("  Successfully read %zd bytes from dataset\n", bytes_read);
                    printf("  First 32 bytes: ");
                    for (int i = 0; i < 32 && i < bytes_read; i++) {
                        printf("%02x ", buffer[i]);
                    }
                    printf("\n");
                } else if (bytes_read == 0) {
                    printf("  Dataset appears to be empty\n");
                } else {
                    printf("  Read failed: %s\n", errbuf);
                }
                
                // Close dataset
                printf("\nStep 5: Closing dataset...\n");
                dsio_close(&handle, errbuf, sizeof(errbuf));
                printf("  Dataset closed\n");
            } else {
                fprintf(stderr, "  Warning: Failed to open dataset: %s\n", errbuf);
            }
            
            // Release lock
            printf("\nStep 6: Releasing SHR lock...\n");
            rc = dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
            if (rc == DSERR_OK) {
                printf("  SHR lock released successfully\n");
            } else {
                fprintf(stderr, "  Warning: Failed to release lock: %s\n", errbuf);
            }
            
            printf("\n=== Lock Requester Test Completed Successfully ===\n");
            time_t end_time;
            time(&end_time);
            printf("Total time: %d seconds\n", (int)(end_time - start_time));
            return 0;
            
        } else if (rc == DSERR_CONFLICT) {
            printf("  CONFLICT: Dataset is locked by another process\n");
            printf("  Error details: %s\n", errbuf);
            
            // Show detailed lock status
            memset(status, 0, sizeof(status));
            if (dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf)) == DSERR_OK) {
                printf("  Lock holder details: %.*s\n", 200, status);
            }
            
            if (attempt < MAX_RETRY_ATTEMPTS) {
                printf("  Will retry in %d seconds...\n\n", RETRY_INTERVAL_SECONDS);
                sleep(RETRY_INTERVAL_SECONDS);
            } else {
                printf("  Maximum retry attempts reached.\n");
            }
            
        } else {
            fprintf(stderr, "  FAILED: %s (%s)\n", ds_strerror_code(rc), errbuf);
            if (attempt < MAX_RETRY_ATTEMPTS) {
                printf("  Will retry in %d seconds...\n\n", RETRY_INTERVAL_SECONDS);
                sleep(RETRY_INTERVAL_SECONDS);
            } else {
                printf("  Maximum retry attempts reached.\n");
            }
        }
    }
    
    printf("\n=== Lock Requester Test Completed (All Attempts Failed) ===\n");
    printf("The SHR lock could not be acquired after %d attempts.\n", MAX_RETRY_ATTEMPTS);
    printf("This indicates that another process is holding an incompatible lock (likely OLD or MOD).\n");
    
    time_t end_time;
    time(&end_time);
    printf("Total time: %d seconds\n", (int)(end_time - start_time));
    
    return 1;
}
