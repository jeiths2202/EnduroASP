/**
 * Test Signal Cleanup
 * 
 * This test simulates a process that acquires a lock and then gets killed
 * by a signal to verify that the lock cleanup mechanism works properly.
 */

#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <signal.h>
#include <sys/wait.h>
#include <errno.h>

#define TEST_DATASET "DISK01/TESTLIB/TEST_SIGNAL.FB"

int main(void) {
    printf("=== Signal Cleanup Test ===\n");
    printf("Dataset: %s\n\n", TEST_DATASET);
    
    char errbuf[512];
    int rc;
    
    // Step 1: Clear any existing locks
    printf("Step 1: Cleaning up any existing locks...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("  Sweep completed: %d stale locks removed\n", rc);
    }
    
    // Step 2: Fork a child process to acquire lock and get killed
    printf("\nStep 2: Forking child process to acquire lock...\n");
    pid_t child = fork();
    
    if (child == 0) {
        // Child process - acquire lock and wait to be killed
        printf("  Child PID %d: Acquiring OLD lock...\n", getpid());
        rc = dslock_acquire(TEST_DATASET, "OLD", errbuf, sizeof(errbuf));
        if (rc != DSERR_OK) {
            fprintf(stderr, "  Child: Failed to acquire lock: %s\n", errbuf);
            return 1;
        }
        printf("  Child PID %d: OLD lock acquired, waiting...\n", getpid());
        
        // Wait indefinitely - will be killed by parent
        while (1) {
            sleep(1);
        }
    } else if (child > 0) {
        // Parent process
        sleep(2); // Give child time to acquire lock
        
        // Step 3: Verify lock exists
        printf("\nStep 3: Verifying child's lock exists...\n");
        char status[1024];
        rc = dslock_status(TEST_DATASET, status, sizeof(status), errbuf, sizeof(errbuf));
        if (rc > 0) {
            printf("  Lock status before kill: %s\n", status);
        } else {
            printf("  No locks found or error: %s\n", errbuf);
        }
        
        // Step 4: Kill child with SIGKILL (simulates abnormal termination)
        printf("\nStep 4: Killing child process %d with SIGKILL...\n", child);
        kill(child, SIGKILL);
        
        // Wait for child to die
        int status_code;
        waitpid(child, &status_code, 0);
        printf("  Child process terminated (signal: %d)\n", WTERMSIG(status_code));
        
        // Step 5: Check if lock still exists (should be cleaned up automatically)
        printf("\nStep 5: Checking if lock is automatically cleaned up...\n");
        
        // Try to acquire the same lock - this should trigger sweep
        rc = dslock_acquire(TEST_DATASET, "SHR", errbuf, sizeof(errbuf));
        if (rc == DSERR_OK) {
            printf("  SUCCESS: SHR lock acquired - dead process lock was cleaned up!\n");
            
            // Release our test lock
            dslock_release(TEST_DATASET, errbuf, sizeof(errbuf));
        } else if (rc == DSERR_CONFLICT) {
            printf("  PROBLEM: Lock conflict - dead process lock still exists!\n");
            printf("  Error: %s\n", errbuf);
            
            // Manual sweep to verify
            printf("\nStep 6: Manual sweep to force cleanup...\n");
            rc = dslock_sweep(errbuf, sizeof(errbuf));
            printf("  Manual sweep removed: %d locks\n", rc);
            
            // Try again after manual sweep
            rc = dslock_acquire(TEST_DATASET, "SHR", errbuf, sizeof(errbuf));
            if (rc == DSERR_OK) {
                printf("  After manual sweep: SHR lock acquired successfully\n");
                dslock_release(TEST_DATASET, errbuf, sizeof(errbuf));
            } else {
                printf("  Still failed after manual sweep: %s\n", errbuf);
            }
        } else {
            printf("  Unexpected error: %s\n", errbuf);
        }
        
        // Final status check
        printf("\nFinal Status: Checking remaining locks...\n");
        memset(status, 0, sizeof(status));
        rc = dslock_status(NULL, status, sizeof(status), errbuf, sizeof(errbuf));
        if (rc > 0) {
            printf("  Remaining locks: %s\n", status);
        } else {
            printf("  No locks remaining\n");
        }
        
    } else {
        fprintf(stderr, "Fork failed: %s\n", strerror(errno));
        return 1;
    }
    
    printf("\n=== Signal Cleanup Test Completed ===\n");
    return 0;
}