
# dslock/dsio (config + catalog + error.h)

- **error.h**: unified error codes/messages (includes requested `ALREADY_CATALOGED` and `DPFJSK_NOT_EXIST`).
- **config**: `DSIO_CONFIG` JSON with `DSIO_ROOT`, `DSIO_FSYNC`, `DSIO_ATOMIC`, `RECFM_FB_NEWLINE`, `RECFM_VB_NEWLINE`, `DSIO_CATALOG`.
- **catalog**: NDJSON `catalog.jsonl` storing `dataset, vol, lrecl, recfm` with create-or-open via `dsio_open2()`.
- **newline policy**: `dsio_put_record()` appends newline based on `RECFM_*_NEWLINE` and dataset RECFM.
- **atomic WRITE**: `DSIO_ATOMIC=1` uses temp file + rename commit for `WRITE`.

## Build
```bash
make clean && make all
```

## Config
```
export DSIO_CONFIG=$PWD/config/config.json    # optional; fields override env defaults
export DSIO_CATALOG=$PWD/config/catalog.json  # optional; default ./config/catalog.jsonl
export DSIO_ROOT=/dev/shm
export DSIO_ATOMIC=1
export RECFM_FB_NEWLINE=1
export RECFM_VB_NEWLINE=0
```
