/**
 * Test TTL-based Cleanup
 * 
 * This test verifies that locks are cleaned up based on TTL (Time To Live)
 * even if the process is still alive but hasn't released the lock.
 */

#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>

#define TEST_DATASET "DISK01/TESTLIB/TEST_TTL.FB"

int main(void) {
    printf("=== TTL Cleanup Test ===\n");
    printf("Dataset: %s\n\n", TEST_DATASET);
    
    char errbuf[512];
    int rc;
    
    // Set a very short TTL for testing (5 seconds)
    setenv("DSLOCK_TTL_SEC", "5", 1);
    
    printf("TTL set to 5 seconds for testing\n");
    
    // Step 1: Clear any existing locks
    printf("\nStep 1: Cleaning up any existing locks...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    printf("  Sweep completed: %d stale locks removed\n", rc >= 0 ? rc : 0);
    
    // Step 2: Acquire a lock
    printf("\nStep 2: Acquiring OLD lock...\n");
    rc = dslock_acquire(TEST_DATASET, "OLD", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        fprintf(stderr, "  Failed to acquire lock: %s\n", errbuf);
        return 1;
    }
    printf("  OLD lock acquired successfully (PID: %d)\n", getpid());
    
    // Step 3: Verify lock exists
    printf("\nStep 3: Verifying lock exists...\n");
    char status[1024];
    rc = dslock_status(TEST_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("  Current lock: %s\n", status);
    }
    
    // Step 4: Wait for TTL to expire
    printf("\nStep 4: Waiting for TTL to expire (7 seconds)...\n");
    for (int i = 1; i <= 7; i++) {
        printf("  Waiting... %d seconds\n", i);
        sleep(1);
    }
    
    // Step 5: Try to acquire conflicting lock (should trigger TTL cleanup)
    printf("\nStep 5: Trying to acquire conflicting lock (should trigger TTL cleanup)...\n");
    rc = dslock_acquire(TEST_DATASET, "MOD", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("  SUCCESS: MOD lock acquired - TTL cleanup worked!\n");
        
        // Check final status
        memset(status, 0, sizeof(status));
        rc = dslock_status(TEST_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
        if (rc > 0) {
            printf("  New lock status: %s\n", status);
        }
        
        // Release the new lock
        dslock_release(TEST_DATASET, errbuf, sizeof(errbuf));
        
    } else if (rc == DSERR_CONFLICT) {
        printf("  PROBLEM: Lock conflict - TTL cleanup didn't work!\n");
        printf("  Error: %s\n", errbuf);
        
        // Manual sweep
        printf("\nStep 6: Manual sweep to force TTL cleanup...\n");
        rc = dslock_sweep(errbuf, sizeof(errbuf));
        printf("  Manual sweep removed: %d locks\n", rc >= 0 ? rc : 0);
        
    } else {
        printf("  Unexpected error: %s\n", errbuf);
    }
    
    // Final cleanup
    printf("\nFinal cleanup...\n");
    dslock_sweep(errbuf, sizeof(errbuf));
    
    // Reset TTL
    unsetenv("DSLOCK_TTL_SEC");
    
    printf("\n=== TTL Cleanup Test Completed ===\n");
    return 0;
}