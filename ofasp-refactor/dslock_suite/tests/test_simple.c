/**
 * Simple dslock and dsio test
 */

#include "dsio.h"
#include "dslock.h" 
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>

#define EMPLOYEE_DATASET "DISK01/TESTLIB/EMPLOYEE.FB"

int main(void) {
    printf("=== Simple dslock/dsio Test ===\n");
    
    char errbuf[256];
    dsio_t handle;
    char buffer[81];
    int rc;
    
    // Test 1: Basic dsio_open
    printf("1. Testing dsio_open()...\n");
    memset(errbuf, 0, sizeof(errbuf));
    rc = dsio_open(&handle, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        printf("   dsio_open failed: %s - %s\n", ds_strerror_code(rc), errbuf);
        printf("   This is expected if dataset not cataloged yet\n");
    } else {
        printf("   dsio_open: SUCCESS\n");
        printf("   Dataset: %s\n", handle.dataset);
        printf("   Level: %s\n", handle.level);
        printf("   RECFM: %s\n", handle.recfm);
        printf("   LRECL: %d\n", handle.lrecl);
        
        // Test 2: Read first record
        printf("2. Testing dsio_read()...\n");
        memset(buffer, 0, sizeof(buffer));
        ssize_t bytes = dsio_read(&handle, buffer, 80, errbuf, sizeof(errbuf));
        if (bytes > 0) {
            printf("   Read %zd bytes successfully\n", bytes);
            printf("   First 20 chars: %.20s\n", buffer);
        } else {
            printf("   Read failed: %s\n", errbuf);
        }
        
        dsio_close(&handle, errbuf, sizeof(errbuf));
    }
    
    // Test 3: Basic dslock operations (without status)
    printf("3. Testing basic dslock...\n");
    
    memset(errbuf, 0, sizeof(errbuf));
    rc = dslock_acquire("TEST_DATASET", "SHR", errbuf, sizeof(errbuf));
    printf("   dslock_acquire(SHR): %s - %s\n", ds_strerror_code(rc), errbuf);
    
    if (rc == DSERR_OK) {
        memset(errbuf, 0, sizeof(errbuf));
        rc = dslock_release("TEST_DATASET", errbuf, sizeof(errbuf));
        printf("   dslock_release: %s - %s\n", ds_strerror_code(rc), errbuf);
    }
    
    // Test 4: Sweep
    printf("4. Testing dslock_sweep...\n");
    memset(errbuf, 0, sizeof(errbuf));
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    if (rc >= 0) {
        printf("   dslock_sweep: SUCCESS, cleaned %d locks\n", rc);
    } else {
        printf("   dslock_sweep: %s - %s\n", ds_strerror_code(rc), errbuf);
    }
    
    printf("\n=== Test completed ===\n");
    return 0;
}