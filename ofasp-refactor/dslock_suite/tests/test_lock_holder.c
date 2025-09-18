/**
 * Test Module 1: Lock Holder
 * 
 * This test module acquires an OLD (exclusive read) lock on EMPLOYEE.FB
 * dataset and holds it for 180 seconds. During this time, no other process
 * should be able to acquire any lock on the same dataset.
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
#define HOLD_TIME_SECONDS 180

int main(void) {
    printf("=== Dataset Lock Holder Test ===\n");
    printf("Dataset: %s\n", EMPLOYEE_DATASET);
    printf("Lock Level: OLD (exclusive read)\n");
    printf("Hold Time: %d seconds\n\n", HOLD_TIME_SECONDS);
    
    char errbuf[512];
    int rc;
    time_t start_time, current_time;
    
    // Get start time
    time(&start_time);
    
    // Step 1: Acquire OLD lock (exclusive read)
    printf("Step 1: Acquiring OLD lock...\n");
    rc = dslock_acquire(EMPLOYEE_DATASET, "OLD", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        if (rc == DSERR_CONFLICT) {
            printf("  Lock conflict detected. Dataset is already locked by another process.\n");
            printf("  Error: %s\n", errbuf);
            
            // Show current lock status
            char status[1024];
            if (dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf)) == DSERR_OK) {
                printf("  Current lock status: %s\n", status);
            }
        } else {
            fprintf(stderr, "  Failed to acquire lock: %s (%s)\n", 
                    ds_strerror_code(rc), errbuf);
        }
        return 1;
    }
    
    printf("  OLD lock acquired successfully! PID: %d\n", getpid());
    
    // Step 2: Show lock status
    printf("\nStep 2: Checking lock status...\n");
    char status[1024];
    memset(status, 0, sizeof(status));
    rc = dslock_status(EMPLOYEE_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
    if (rc == DSERR_OK && strlen(status) > 0) {
        printf("  Status: %.*s\n", 100, status);
    }
    
    // Step 3: Verify lock is working (don't open dataset - we already have the lock)
    printf("\nStep 3: Lock acquired and holding...\n");
    printf("  We now hold an OLD (exclusive read) lock on the dataset.\n");
    printf("  Any other process trying to acquire SHR, OLD, or MOD locks should fail with CONFLICT.\n");
    
    // Step 4: Hold the lock for specified time
    printf("\nStep 4: Holding lock for %d seconds...\n", HOLD_TIME_SECONDS);
    printf("  Start time: %s", ctime(&start_time));
    printf("  During this time, other processes should not be able to acquire any lock.\n");
    printf("  You can run test_lock_requester in another terminal to test this.\n\n");
    
    int countdown = HOLD_TIME_SECONDS;
    while (countdown > 0) {
        time(&current_time);
        int elapsed = (int)(current_time - start_time);
        int remaining = HOLD_TIME_SECONDS - elapsed;
        
        if (remaining <= 0) break;
        
        // Print progress every 10 seconds
        if (countdown % 10 == 0 || countdown <= 10) {
            printf("  Lock held for %d seconds, %d remaining...\n", elapsed, remaining);
        }
        
        sleep(1);
        countdown--;
    }
    
    time(&current_time);
    printf("\n  Lock held for %d seconds total\n", (int)(current_time - start_time));
    printf("  End time: %s", ctime(&current_time));
    
    // Step 5: Release lock
    printf("\nStep 5: Releasing lock...\n");
    rc = dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Warning: Release failed: %s (%s)\n", 
                ds_strerror_code(rc), errbuf);
    } else {
        printf("  Lock released successfully\n");
    }
    
    // Step 6: Run sweep
    printf("\nStep 6: Running lock sweep...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("  Sweep completed: %d stale locks removed\n", rc);
    } else {
        fprintf(stderr, "  Sweep failed: %s\n", errbuf);
    }
    
    printf("\n=== Lock Holder Test Completed ===\n");
    printf("The OLD lock has been released. Other processes can now acquire locks.\n");
    
    return 0;
}