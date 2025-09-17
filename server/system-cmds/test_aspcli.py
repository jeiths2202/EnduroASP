# test_aspcli.py
# 테스트 스크립트 - aspcli.py 명령어 검증용

import subprocess
import os
import time

ASPCLI = "python3 aspcli.py"
VOLUME = "DISK99"
LIB = "TESTLIB"
FILE = "HELLOFILE"
PGM = "hellopgm.py"

# 1. 라이브러리 생성
subprocess.run(f"{ASPCLI} CRTLIB LIB-{LIB},VOL-{VOLUME}", shell=True)

# 2. 파일 생성
subprocess.run(f"{ASPCLI} CRTFILE FILE({LIB}/{FILE}),VOL-{VOLUME}", shell=True)

# 3. 파일 정의 보기
subprocess.run(f"{ASPCLI} DSPFD FILE({LIB}/{FILE}),VOL-{VOLUME}", shell=True)

# 4. 프로그램 생성 및 CALL 테스트
lib_dir = f"/volume/{VOLUME}/{LIB}"
os.makedirs(lib_dir, exist_ok=True)
pgm_path = os.path.join(lib_dir, PGM)
with open(pgm_path, "w") as f:
    f.write("print('Hello from ASPCLI test program!')\n")
subprocess.run(f"{ASPCLI} CALL PGM-{LIB}/{PGM},VOL-{VOLUME}", shell=True)

# 5. WRKOBJ
subprocess.run(f"{ASPCLI} WRKOBJ LIB-{LIB},VOL-{VOLUME}", shell=True)

# 6. 볼륨 확인
subprocess.run(f"{ASPCLI} WRKVOL", shell=True)

# 7. 백업/복원
subprocess.run(f"{ASPCLI} SAVLIB LIB-{LIB},VOL-{VOLUME}", shell=True)

# 가장 최근 백업 파일 추적
backup_dir = f"/volume/BACKUP"
backup_files = sorted(os.listdir(backup_dir))
backup_file = backup_files[-1] if backup_files else None
if backup_file:
    subprocess.run(f"{ASPCLI} RSTLIB FILE-{backup_file}", shell=True)

# 8. 메시지 전송/수신
subprocess.run(f"{ASPCLI} SNDMSG TO-admin,MSG-테스트 메시지입니다", shell=True)
subprocess.run(f"{ASPCLI} RCVMSG USER-admin", shell=True)

# 9. WRKSPLF, WRKMSG, DSPJOB
subprocess.run(f"{ASPCLI} WRKSPLF", shell=True)
subprocess.run(f"{ASPCLI} WRKMSG", shell=True)
subprocess.run(f"{ASPCLI} DSPJOB", shell=True)

# 10. 정리 테스트 (옵션)
# subprocess.run(f"{ASPCLI} DLTLIB LIB-{LIB},VOL-{VOLUME}", shell=True)
