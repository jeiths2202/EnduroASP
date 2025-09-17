# test_aspcli.py
# 테스트 스크립트 - aspcli.py 명령어 검증용

import subprocess
import os
import time

# UTF-8 인코딩 설정
os.environ['PYTHONIOENCODING'] = 'utf-8'

ASPCLI = "python3 aspcli.py"
VOLUME = "DISK99"
LIB = "TESTLIB"
FILE = "HELLOFILE"
PGM = "hellopgm.py"

# 1. 라이브러리 생성
subprocess.run(["python3", "aspcli.py", "CRTLIB", f"LIB-{LIB},VOL-{VOLUME}"])

# 2. 파일 생성
subprocess.run(["python3", "aspcli.py", "CRTFILE", f"FILE({LIB}/{FILE}),VOL-{VOLUME}"])

# 3. 파일 정의 보기
subprocess.run(["python3", "aspcli.py", "DSPFD", f"FILE({LIB}/{FILE}),VOL-{VOLUME}"])

# 6. 볼륨 확인
subprocess.run(["python3", "aspcli.py", "WRKVOL"])


# 10. 정리 테스트 (옵션)
# subprocess.run(f"{ASPCLI} DLTLIB LIB-{LIB},VOL-{VOLUME}", shell=True)
