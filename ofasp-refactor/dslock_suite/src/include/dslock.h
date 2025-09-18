
#pragma once
#include "error.h"
#include <sys/types.h>  // for pid_t
#ifdef __cplusplus
extern "C" {
#endif

// level: "SHR" | "OLD" | "MOD"
// return: DSERR_OK(0), DSERR_CONFLICT(1), or <0 (DSERR_*)
int dslock_acquire(const char* dataset, const char* level, char* errbuf, int errlen);

// return: DSERR_OK(0), DSERR_NOT_FOUND(2) if no lock by caller, or <0
int dslock_release(const char* dataset, char* errbuf, int errlen);

// dataset==NULL → dumps all entries JSON into buf
int dslock_status(const char* dataset, char* buf, int bufsize, char* errbuf, int errlen);

// sweep zombie/TTL-expired locks. return: removed count (>=0) or <0
int dslock_sweep(char* errbuf, int errlen);

// ============= Administrative APIs =============

// Query locks with optional filters (NULL = no filter, 0 = no filter for pid)
// Returns detailed lock information including user and process name
// Filters: filter_user, filter_pid, filter_dataset
int dslock_query_locks(const char* filter_user, pid_t filter_pid, const char* filter_dataset, 
                       char* out, int outn, char* err, int errn);

// Force cleanup locks by PID and/or dataset (admin operation)
// Returns number of removed locks (>=0) or <0 on error
// At least one of target_pid or target_dataset must be specified
int dslock_force_cleanup(pid_t target_pid, const char* target_dataset, char* err, int errn);

// Initialize database (create directory and empty database file)
// Returns 0 on success or <0 on error
int dslock_init_database(char* err, int errn);

#ifdef __cplusplus
}
#endif
