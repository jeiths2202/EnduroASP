/**
 * Administrative API Test
 * 
 * This program demonstrates the new administrative APIs:
 * 1. dslock_query_locks() - Query locks with filtering
 * 2. dslock_force_cleanup() - Force cleanup locks by PID/dataset
 */

#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <stdlib.h>
#include <signal.h>
#include <sys/wait.h>

#define TEST_DATASET1 "DISK01/TESTLIB/ADMIN_TEST1.FB"
#define TEST_DATASET2 "DISK01/TESTLIB/ADMIN_TEST2.FB"

void print_separator(const char* title) {
    printf("\n========== %s ==========\n", title);
}

int main(void) {
    printf("=== Administrative API Test ===\n");
    
    char errbuf[512];
    char output[4096];
    int rc;
    
    // Enable logging for better visibility
    setenv("DSLOCK_LOG", "1", 1);
    
    print_separator("Step 1: Initial Cleanup");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    printf("Initial sweep: %d locks removed\n", rc >= 0 ? rc : 0);
    
    print_separator("Step 2: Create Multiple Locks");
    
    // Create locks with current process
    printf("Creating locks with current process (PID: %d)...\n", getpid());
    
    rc = dslock_acquire(TEST_DATASET1, "OLD", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("✓ OLD lock acquired on %s\n", TEST_DATASET1);
    } else {
        printf("✗ Failed to acquire OLD lock: %s\n", errbuf);
    }
    
    rc = dslock_acquire(TEST_DATASET2, "MOD", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("✓ MOD lock acquired on %s\n", TEST_DATASET2);
    } else {
        printf("✗ Failed to acquire MOD lock: %s\n", errbuf);
    }
    
    // Fork child processes to create more locks
    printf("\nForking child processes to create additional locks...\n");
    
    pid_t child1 = fork();
    if (child1 == 0) {
        // Child 1: Create SHR lock on different dataset
        sleep(1); // Let parent print message
        char child_dataset[256];
        snprintf(child_dataset, sizeof(child_dataset), "DISK01/TESTLIB/CHILD1_%d.FB", getpid());
        dslock_acquire(child_dataset, "SHR", errbuf, sizeof(errbuf));
        printf("Child 1 (PID %d): SHR lock acquired on %s\n", getpid(), child_dataset);
        sleep(10); // Keep lock for testing
        exit(0);
    }
    
    pid_t child2 = fork();
    if (child2 == 0) {
        // Child 2: Create OLD lock on different dataset
        sleep(1);
        char child_dataset[256];
        snprintf(child_dataset, sizeof(child_dataset), "DISK01/TESTLIB/CHILD2_%d.FB", getpid());
        dslock_acquire(child_dataset, "OLD", errbuf, sizeof(errbuf));
        printf("Child 2 (PID %d): OLD lock acquired on %s\n", getpid(), child_dataset);
        sleep(10);
        exit(0);
    }
    
    sleep(2); // Let children create their locks
    
    print_separator("Step 3: Query All Locks");
    
    // Query all locks
    memset(output, 0, sizeof(output));
    rc = dslock_query_locks(NULL, 0, NULL, output, sizeof(output), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("All locks:\n%s\n", output);
    } else {
        printf("Failed to query locks: %s\n", errbuf);
    }
    
    print_separator("Step 4: Query by User Filter");
    
    // Query locks by current user
    char* username = getenv("USER");
    if (!username) username = "aspuser";  // fallback
    
    memset(output, 0, sizeof(output));
    rc = dslock_query_locks(username, 0, NULL, output, sizeof(output), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("Locks by user '%s':\n%s\n", username, output);
    } else {
        printf("Failed to query locks by user: %s\n", errbuf);
    }
    
    print_separator("Step 5: Query by PID Filter");
    
    // Query locks by current process PID
    memset(output, 0, sizeof(output));
    rc = dslock_query_locks(NULL, getpid(), NULL, output, sizeof(output), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("Locks by PID %d:\n%s\n", getpid(), output);
    } else {
        printf("Failed to query locks by PID: %s\n", errbuf);
    }
    
    print_separator("Step 6: Query by Dataset Filter");
    
    // Query locks by specific dataset
    memset(output, 0, sizeof(output));
    rc = dslock_query_locks(NULL, 0, TEST_DATASET1, output, sizeof(output), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("Locks on dataset '%s':\n%s\n", TEST_DATASET1, output);
    } else {
        printf("Failed to query locks by dataset: %s\n", errbuf);
    }
    
    print_separator("Step 7: Force Cleanup by PID");
    
    // Force cleanup child1's locks
    printf("Force cleanup child 1 (PID %d) locks...\n", child1);
    rc = dslock_force_cleanup(child1, NULL, errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("✓ Force cleanup by PID successful: %d locks removed\n", rc);
    } else {
        printf("✗ Force cleanup by PID failed: %s\n", errbuf);
    }
    
    print_separator("Step 8: Force Cleanup by Dataset");
    
    // Force cleanup locks on specific dataset
    printf("Force cleanup locks on dataset '%s'...\n", TEST_DATASET2);
    rc = dslock_force_cleanup(0, TEST_DATASET2, errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("✓ Force cleanup by dataset successful: %d locks removed\n", rc);
    } else {
        printf("✗ Force cleanup by dataset failed: %s\n", errbuf);
    }
    
    print_separator("Step 9: Verify Cleanup Results");
    
    // Check remaining locks
    memset(output, 0, sizeof(output));
    rc = dslock_query_locks(NULL, 0, NULL, output, sizeof(output), errbuf, sizeof(errbuf));
    if (rc > 0) {
        printf("Remaining locks after cleanup:\n%s\n", output);
    } else {
        printf("No remaining locks or query failed: %s\n", errbuf);
    }
    
    print_separator("Step 10: Final Cleanup");
    
    // Kill child processes
    kill(child1, SIGTERM);
    kill(child2, SIGTERM);
    
    // Wait for children
    int status;
    waitpid(child1, &status, WNOHANG);
    waitpid(child2, &status, WNOHANG);
    
    // Release remaining locks
    dslock_release(TEST_DATASET1, errbuf, sizeof(errbuf));
    dslock_release(TEST_DATASET2, errbuf, sizeof(errbuf));
    
    // Final sweep
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    printf("Final sweep: %d locks removed\n", rc >= 0 ? rc : 0);
    
    printf("\n=== Administrative API Test Completed ===\n");
    return 0;
}