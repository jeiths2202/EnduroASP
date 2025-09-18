# aspcli.py
# Fujitsu ASP command reimplementation (CLI version)

import argparse
import os
from datetime import datetime

# UTF-8 encode
os.environ['PYTHONIOENCODING'] = 'utf-8'
import locale
locale.setlocale(locale.LC_ALL, 'C.UTF-8')

from asp_commands import (
    CRTLIB, DLTLIB, WRKLIB, CRTFILE, DLTFILE, DSPFD,
    WRKOBJ, CALL, WRKVOL, WRKSPLF, WRKMSG,
    DSPJOB, SAVLIB, RSTLIB, SNDMSG, RCVMSG, EDTFILE, HELP,
    CRTPGM, CRTMAP, CHGLIBL
)

# Import SBMJOB and REFJOB functions
from functions.sbmjob import SBMJOB
from functions.refjob import REFJOB

VOLUME_ROOT = "/home/aspuser/app/volume"
BACKUP_DIR = os.path.join(VOLUME_ROOT, "/home/aspuser/app/volume/BACKUP")
os.makedirs(BACKUP_DIR, exist_ok=True)

# CLI entry
if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="aspcli - Fujitsu ASP command interpreter")
    parser.add_argument("command", help="ASP command (e.g., CRTLIB, CALL, WRKLIB, etc.)")
    parser.add_argument("params", nargs="*", help="Command parameters")
    args = parser.parse_args()

    full_command = args.command + ' ' + ','.join(args.params)

    command_map = {
        "HELP": HELP,
        "CRTLIB": CRTLIB,
        "DLTLIB": DLTLIB,
        "WRKLIB": WRKLIB,
        "CRTFILE": CRTFILE,
        "DLTFILE": DLTFILE,
        "DSPFD": DSPFD,
        "WRKOBJ": WRKOBJ,
        "CALL": CALL,
        "WRKVOL": WRKVOL,
        "WRKSPLF": WRKSPLF,
        "WRKMSG": WRKMSG,
        "DSPJOB": DSPJOB,
        "SAVLIB": SAVLIB,
        "RSTLIB": RSTLIB,
        "SNDMSG": SNDMSG,
        "RCVMSG": RCVMSG,
        "EDTFILE": EDTFILE,
        "CRTPGM": CRTPGM,
        "CRTMAP": CRTMAP,
        "CHGLIBL": CHGLIBL,
        "SBMJOB": SBMJOB,
        "REFJOB": REFJOB,
    }

    if args.command in command_map:
        try:
            command_map[args.command](full_command)
        except Exception as e:
            import traceback
            import sys
            print(f"[ERROR] Command execution failed: {e}")
            print(f"[DEBUG] Exception type: {type(e).__name__}")
            print(f"[DEBUG] Command: {full_command}")
            print(f"[DEBUG] Full traceback:")
            traceback.print_exc(file=sys.stdout, limit=None, chain=True)
    else:
        print(f"[ERROR] It's an unknown command: {args.command}")
