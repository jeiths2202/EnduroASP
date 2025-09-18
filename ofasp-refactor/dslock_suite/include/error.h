#ifndef ERROR_H
#define ERROR_H

#define DSERR_OK 0
#define DSERR_ALREADY_LOCKED -1
#define DSERR_ALREADY_CATALOGED -2
#define DSERR_DATASET_NOT_EXIST -3
#define DSERR_DPFJSK_NOT_EXIST -4
#define DSERR_IO_ERROR -5
#define DSERR_INVALID_PARAM -6
#define DSERR_LOCK_CONFLICT -7

static inline const char* ds_error_msg(int code) {
    switch(code) {
        case DSERR_OK: return "Success";
        case DSERR_ALREADY_LOCKED: return "Dataset already locked";
        case DSERR_ALREADY_CATALOGED: return "Dataset already cataloged";
        case DSERR_DATASET_NOT_EXIST: return "Dataset does not exist";
        case DSERR_DPFJSK_NOT_EXIST: return "DPFJSK does not exist";
        case DSERR_IO_ERROR: return "I/O error";
        case DSERR_INVALID_PARAM: return "Invalid parameter";
        case DSERR_LOCK_CONFLICT: return "Lock conflict";
        default: return "Unknown error";
    }
}

#endif
