/**
 * Test dslockctl administrative commands
 * 
 * This test demonstrates the enhanced dslockctl with admin features
 */

#include "dslock.h" 
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <unistd.h>
#include <sys/wait.h>
#include <signal.h>
#include <stdlib.h>

#define TEST_DATASET1 "TEST/ADMIN/DSLOCKCTL1.FB"
#define TEST_DATASET2 "TEST/ADMIN/DSLOCKCTL2.FB"

int main(void) {
    printf("=== dslockctl Administrative Commands Test ===\n\n");
    
    char errbuf[512];
    int rc;
    
    // Step 1: Create some locks programmatically
    printf("Step 1: Creating test locks...\n");
    
    rc = dslock_acquire(TEST_DATASET1, "OLD", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("✓ OLD lock created on %s (PID: %d)\n", TEST_DATASET1, getpid());
    } else {
        printf("✗ Failed to create OLD lock: %s\n", errbuf);
    }
    
    rc = dslock_acquire(TEST_DATASET2, "MOD", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("✓ MOD lock created on %s (PID: %d)\n", TEST_DATASET2, getpid());
    } else {
        printf("✗ Failed to create MOD lock: %s\n", errbuf);
    }
    
    // Fork a child to create another lock
    pid_t child = fork();
    if (child == 0) {
        // Child process
        sleep(1); // Let parent print status first
        dslock_acquire("TEST/ADMIN/CHILD_LOCK.FB", "SHR", errbuf, sizeof(errbuf));
        printf("Child (PID %d): SHR lock created\n", getpid());
        sleep(5); // Keep lock alive
        exit(0);
    }
    
    sleep(2); // Let child create its lock
    
    // Step 2: Demonstrate dslockctl query commands
    printf("\nStep 2: Testing dslockctl query commands...\n");
    
    // Query all locks
    printf("\n--- Query all locks ---\n");
    system("export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query");
    
    // Query by current PID
    char cmd[256];
    printf("\n--- Query by PID %d ---\n", getpid());
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query --pid %d", getpid());
    system(cmd);
    
    // Query by child PID
    printf("\n--- Query by child PID %d ---\n", child);
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query --pid %d", child);
    system(cmd);
    
    // Query by user
    printf("\n--- Query by user aspuser ---\n");
    system("export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query --user aspuser");
    
    // Query by dataset
    printf("\n--- Query by dataset %s ---\n", TEST_DATASET1);
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query --dataset '%s'", TEST_DATASET1);
    system(cmd);
    
    // Step 3: Demonstrate cleanup commands
    printf("\nStep 3: Testing dslockctl cleanup commands...\n");
    
    // Cleanup by child PID
    printf("\n--- Cleanup by child PID %d ---\n", child);
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl cleanup --pid %d", child);
    system(cmd);
    
    // Verify child lock was removed
    printf("\n--- Verify child lock removed ---\n");
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query --pid %d", child);
    system(cmd);
    
    // Cleanup by dataset
    printf("\n--- Cleanup by dataset %s ---\n", TEST_DATASET2);
    snprintf(cmd, sizeof(cmd), "export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl cleanup --dataset '%s'", TEST_DATASET2);
    system(cmd);
    
    // Show final locks
    printf("\n--- Final locks status ---\n");
    system("export LD_LIBRARY_PATH=./build:$LD_LIBRARY_PATH && ./build/dslockctl query");
    
    // Step 4: Clean up
    printf("\nStep 4: Final cleanup...\n");
    
    // Kill child if still running
    kill(child, SIGTERM);
    waitpid(child, NULL, WNOHANG);
    
    // Release our remaining lock
    dslock_release(TEST_DATASET1, errbuf, sizeof(errbuf));
    dslock_sweep(errbuf, sizeof(errbuf));
    
    printf("\n=== dslockctl Admin Test Completed ===\n");
    return 0;
}