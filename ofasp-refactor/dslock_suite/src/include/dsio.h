
#pragma once
#include <stddef.h>
#include <sys/types.h>
#include "error.h"

#ifdef __cplusplus
extern "C" {
#endif

typedef struct {
  int   fd;
  char  dataset[256];
  char  level[4];   // "SHR"|"OLD"|"MOD"
  int   owns_lock;
  int   atomic;     // atomic WRITE flag
  char  path[512];  // final path
  char  tmp [512];  // temp path when atomic
  // recfm context
  char  recfm[4];   // "FB" or "VB"
  int   lrecl;
  int   newline_on_write; // derived from config + recfm
} dsio_t;

// Open existing dataset
int dsio_open(dsio_t* h, const char* dataset, const char* mode, char* err, int errlen);

// Open possibly new dataset and catalog it (when creating new)
int dsio_open2(dsio_t* h, const char* dataset, const char* mode,
               const char* vol, int lrecl, const char* recfm,
               int create_if_missing, char* err, int errlen);

ssize_t dsio_read (dsio_t* h, void* buf, size_t n, char* err, int errlen);
ssize_t dsio_write(dsio_t* h, const void* buf, size_t n, char* err, int errlen);

// record-level write with optional newline based on RECFM policy
ssize_t dsio_put_record(dsio_t* h, const void* buf, size_t n, char* err, int errlen);

// close (commit if atomic)
int dsio_close(dsio_t* h, char* err, int errlen);

#ifdef __cplusplus
}
#endif
