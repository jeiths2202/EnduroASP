
#pragma once
#ifdef __cplusplus
extern "C" {
#endif

// Standard error codes (>=0 non-fatal states, <0 errors)
typedef enum {
  DSERR_OK                     = 0,
  DSERR_CONFLICT               = 1,   // already locked / expected contention
  DSERR_NOT_FOUND              = 2,   // not found (non-fatal in some contexts)

  // negatives = errors
  DSERR_SYS                    = -1,  // generic system error (check errno)
  DSERR_BAD_ARGS               = -2,
  DSERR_PARSE                  = -3,
  DSERR_CFG_MISSING            = -4,
  DSERR_CATALOG_MISSING        = -5,
  DSERR_ALREADY_CATALOGED      = -6,
  DSERR_DATASET_NOT_EXIST      = -7,
  DSERR_DPFJSK_NOT_EXIST       = -8,  // requested: specific alias error
  DSERR_IO                     = -9,
  DSERR_BUFFER_SMALL           = -10
} ds_err_t;

// Convert code to constant string
static inline const char* ds_strerror_code(ds_err_t c){
  switch(c){
    case DSERR_OK: return "OK";
    case DSERR_CONFLICT: return "CONFLICT";
    case DSERR_NOT_FOUND: return "NOT_FOUND";
    case DSERR_SYS: return "SYS";
    case DSERR_BAD_ARGS: return "BAD_ARGS";
    case DSERR_PARSE: return "PARSE";
    case DSERR_CFG_MISSING: return "CFG_MISSING";
    case DSERR_CATALOG_MISSING: return "CATALOG_MISSING";
    case DSERR_ALREADY_CATALOGED: return "ALREADY_CATALOGED";
    case DSERR_DATASET_NOT_EXIST: return "DATASET_NOT_EXIST";
    case DSERR_DPFJSK_NOT_EXIST: return "DPFJSK_NOT_EXIST";
    case DSERR_IO: return "IO";
    case DSERR_BUFFER_SMALL: return "BUFFER_SMALL";
    default: return "UNKNOWN";
  }
}

// Human-readable explanation (short)
static inline const char* ds_strerror_msg(ds_err_t c){
  switch(c){
    case DSERR_OK: return "success";
    case DSERR_CONFLICT: return "already locked / conflict";
    case DSERR_NOT_FOUND: return "not found";
    case DSERR_SYS: return "system error";
    case DSERR_BAD_ARGS: return "bad arguments";
    case DSERR_PARSE: return "parse error";
    case DSERR_CFG_MISSING: return "config not found";
    case DSERR_CATALOG_MISSING: return "catalog not found";
    case DSERR_ALREADY_CATALOGED: return "already cataloged";
    case DSERR_DATASET_NOT_EXIST: return "dataset does not exist";
    case DSERR_DPFJSK_NOT_EXIST: return "dpfjsk not exist";
    case DSERR_IO: return "I/O error";
    case DSERR_BUFFER_SMALL: return "buffer too small";
    default: return "unknown error";
  }
}

#ifdef __cplusplus
}
#endif
