
import os, ctypes, json
from pathlib import Path

os.environ.setdefault("DSIO_ROOT","/dev/shm")
os.environ.setdefault("DSIO_ATOMIC","1")
Path("config").mkdir(exist_ok=True)
open("config/catalog.jsonl","a").close()

libio = ctypes.cdll.LoadLibrary("./build/libdsio.so")
class DsioT(ctypes.Structure):
    _fields_ = [("fd", ctypes.c_int),
                ("dataset", ctypes.c_char*256),
                ("level", ctypes.c_char*4),
                ("owns_lock", ctypes.c_int),
                ("atomic", ctypes.c_int),
                ("path", ctypes.c_char*512),
                ("tmp", ctypes.c_char*512),
                ("recfm", ctypes.c_char*4),
                ("lrecl", ctypes.c_int),
                ("newline_on_write", ctypes.c_int)]
libio.dsio_open2.argtypes=[ctypes.POINTER(DsioT), ctypes.c_char_p, ctypes.c_char_p,
                           ctypes.c_char_p, ctypes.c_int, ctypes.c_char_p,
                           ctypes.c_int, ctypes.c_char_p, ctypes.c_int]
libio.dsio_put_record.argtypes=[ctypes.POINTER(DsioT), ctypes.c_void_p, ctypes.c_size_t, ctypes.c_char_p, ctypes.c_int]
libio.dsio_close.argtypes=[ctypes.POINTER(DsioT), ctypes.c_char_p, ctypes.c_int]

h=DsioT(); err=(ctypes.c_char*256)()
rc=libio.dsio_open2(ctypes.byref(h), b"VOL/APP/TEST", b"WRITE", b"VOL1", 80, b"FB", 1, err, 256)
assert rc==0, err.value.decode()
libio.dsio_put_record(ctypes.byref(h), ctypes.c_char_p(b"line1"), 5, err, 256)
libio.dsio_put_record(ctypes.byref(h), ctypes.c_char_p(b"line2"), 5, err, 256)
libio.dsio_close(ctypes.byref(h), err, 256)
print("integrated ok")
