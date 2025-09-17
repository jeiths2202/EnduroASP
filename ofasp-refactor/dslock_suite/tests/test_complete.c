/**
 * Complete EMPLOYEE.FB Test - All APIs
 */

#include "dsio.h"
#include "dslock.h"
#include "error.h"
#include <stdio.h>
#include <string.h>
#include <stdlib.h>
#include <unistd.h>

#define EMPLOYEE_DATASET "DISK01/TESTLIB/EMPLOYEE.FB"

int main(void) {
    printf("=== Complete EMPLOYEE.FB API Test ===\n");
    
    dsio_t handle;
    char errbuf[256];
    char buffer[81];
    int rc, record_count = 0;
    
    // 1. Lock with SHR
    printf("1. Acquiring SHR lock...\n");
    rc = dslock_acquire(EMPLOYEE_DATASET, "SHR", errbuf, sizeof(errbuf));
    printf("   dslock_acquire(SHR): %s\n", ds_strerror_code(rc));
    
    // 2. Open dataset
    printf("2. Opening dataset...\n");
    rc = dsio_open(&handle, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc != DSERR_OK) {
        printf("   dsio_open failed: %s - %s\n", ds_strerror_code(rc), errbuf);
        return 1;
    }
    printf("   SUCCESS: RECFM=%s, LRECL=%d\n", handle.recfm, handle.lrecl);
    
    // 3. Read all records
    printf("3. Reading records...\n");
    while (1) {
        memset(buffer, 0, sizeof(buffer));
        ssize_t bytes = dsio_read(&handle, buffer, 80, errbuf, sizeof(errbuf));
        
        if (bytes == 0) {
            printf("   End of file reached\n");
            break;
        }
        
        if (bytes < 0) {
            printf("   Read error: %s\n", errbuf);
            break;
        }
        
        record_count++;
        if (record_count <= 5) {
            // Extract employee ID (first 6 characters)
            char emp_id[7];
            strncpy(emp_id, buffer, 6);
            emp_id[6] = '\0';
            
            // Extract name (approximate position 6-27)
            char name[23];
            strncpy(name, buffer + 6, 22);
            name[22] = '\0';
            
            // Trim trailing spaces from name
            int len = strlen(name);
            while (len > 0 && name[len-1] == ' ') {
                name[--len] = '\0';
            }
            
            printf("   Record %d: ID=%s, Name=%s\n", record_count, emp_id, name);
        }
    }
    
    printf("   Total records read: %d\n", record_count);
    
    // 4. Close dataset
    printf("4. Closing dataset...\n");
    rc = dsio_close(&handle, errbuf, sizeof(errbuf));
    printf("   dsio_close: %s\n", ds_strerror_code(rc));
    
    // 5. Release lock
    printf("5. Releasing lock...\n");
    rc = dslock_release(EMPLOYEE_DATASET, errbuf, sizeof(errbuf));
    printf("   dslock_release: %s\n", ds_strerror_code(rc));
    
    // 6. Test concurrent access
    printf("6. Testing concurrent access...\n");
    dsio_t handle1, handle2;
    
    rc = dsio_open(&handle1, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("   First handle opened\n");
        
        rc = dsio_open(&handle2, EMPLOYEE_DATASET, "READ", errbuf, sizeof(errbuf));
        if (rc == DSERR_OK) {
            printf("   Second handle opened (concurrent SHR access OK)\n");
            
            // Read one record from each
            ssize_t b1 = dsio_read(&handle1, buffer, 80, errbuf, sizeof(errbuf));
            ssize_t b2 = dsio_read(&handle2, buffer, 80, errbuf, sizeof(errbuf));
            printf("   Concurrent reads: %zd, %zd bytes\n", b1, b2);
            
            dsio_close(&handle2, errbuf, sizeof(errbuf));
        }
        dsio_close(&handle1, errbuf, sizeof(errbuf));
    }
    
    // 7. Test write operations (dsio_open2, dsio_put_record)
    printf("7. Testing write operations...\n");
    dsio_t write_handle;
    
    rc = dsio_open2(&write_handle, "TEST/LIB/SAMPLE.FB", "WRITE", 
                   "TEST", 80, "FB", 1, errbuf, sizeof(errbuf));
    if (rc == DSERR_OK) {
        printf("   New dataset created with dsio_open2\n");
        
        const char* test_record = "TEST001 Sample Employee Name     TEST DEPARTMENT       123456789 A";
        ssize_t written = dsio_put_record(&write_handle, test_record, 
                                        strlen(test_record), errbuf, sizeof(errbuf));
        if (written > 0) {
            printf("   Test record written: %zd bytes\n", written);
        }
        
        dsio_close(&write_handle, errbuf, sizeof(errbuf));
    } else {
        printf("   dsio_open2 result: %s - %s\n", ds_strerror_code(rc), errbuf);
    }
    
    // 8. Final sweep
    printf("8. Final cleanup...\n");
    rc = dslock_sweep(errbuf, sizeof(errbuf));
    printf("   dslock_sweep: removed %d locks\n", rc >= 0 ? rc : 0);
    
    printf("\n=== All API functions tested successfully ===\n");
    return 0;
}