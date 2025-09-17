# -*- coding: shift_jis -*-
"""
EDTFILE (Edit File) Command Implementation for OpenASP

Based on Fujitsu ASP EDTFILE manual specifications.
Supports full interactive file editing with multiple modes and record types.
"""

import os
import sys
import json
import re
from datetime import datetime
from typing import Dict, List, Tuple, Optional, Any

# Import from parent module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from asp_commands import VOLUME_ROOT, get_catalog_info, set_pgmec

class EDTFILESession:
    """Main EDTFILE interactive session handler"""
    
    def __init__(self, file_path: str, lib: str, filename: str, volume: str, 
                 reclen: int, rectype: str, encoding: str = 'utf-8',
                 mode: str = '@DSP', edit_format: str = '@ITEM', 
                 vs: str = '7', rs: str = '6', cp: str = '2'):
        self.file_path = file_path
        self.lib = lib
        self.filename = filename
        self.volume = volume
        self.reclen = reclen
        self.rectype = rectype
        self.encoding = encoding
        
        # Session state - use provided parameters
        self.mode = mode  # @ALL, @DSP, @EDT, @PRT
        self.edit_format = edit_format  # @ITEM, @CHAR, @HEX
        self.current_record = 1
        self.records = []
        self.raw_records = []  # Binary data for hex display
        self.modified = False
        self.search_string = ""
        self.search_mode = "CHAR"  # CHAR or HEX
        
        # Fujitsu ASP display parameters
        self.vs = int(vs) if vs.isdigit() else 7  # Vertical size
        self.rs = int(rs) if rs.isdigit() else 6  # Record size 
        self.cp = int(cp) if cp.isdigit() else 2  # Copy parameter
        
        # Display settings - use VS parameter for display lines
        self.display_lines = max(10, self.vs * 3)  # Calculate based on VS
        self.page = 1
        
        # Load file data
        self._load_file_data()
    
    def _load_file_data(self):
        """Load file data into memory based on record type"""
        try:
            with open(self.file_path, 'rb') as f:
                file_content = f.read()
            
            self.records = []
            self.raw_records = []
            pos = 0
            record_num = 1
            
            while pos < len(file_content):
                if self.rectype == 'FB':  # Fixed Block
                    record_data = file_content[pos:pos + self.reclen]
                    if len(record_data) == 0:
                        break
                    
                    # Pad to exact record length if shorter
                    if len(record_data) < self.reclen:
                        record_data += b' ' * (self.reclen - len(record_data))
                    
                    self.raw_records.append(record_data)
                    
                    # Decode for display (preserve bytes as much as possible)
                    try:
                        if self.encoding.lower() == 'shift_jis':
                            record_str = record_data.decode('shift_jis', errors='replace')
                        else:
                            record_str = record_data.decode('utf-8', errors='replace')
                    except:
                        record_str = record_data.decode('latin-1')  # Fallback
                    
                    self.records.append(record_str)
                    pos += self.reclen
                    record_num += 1
                    
                elif self.rectype == 'VB':  # Variable Block with RDW
                    if pos + 4 > len(file_content):
                        break
                    
                    # Read RDW (Record Descriptor Word)
                    rdw = file_content[pos:pos + 4]
                    rec_length = int.from_bytes(rdw[:2], 'big')
                    
                    if rec_length < 4 or pos + rec_length > len(file_content):
                        break
                    
                    record_data = file_content[pos:pos + rec_length]
                    data_part = record_data[4:]  # Skip RDW
                    
                    self.raw_records.append(record_data)
                    
                    try:
                        if self.encoding.lower() == 'shift_jis':
                            record_str = data_part.decode('shift_jis', errors='replace')
                        else:
                            record_str = data_part.decode('utf-8', errors='replace')
                    except:
                        record_str = data_part.decode('latin-1')
                    
                    self.records.append(record_str)
                    pos += rec_length
                    record_num += 1
                    
                elif self.rectype == 'LB':  # Line Block
                    # Find next newline
                    newline_pos = file_content.find(b'\n', pos)
                    if newline_pos == -1:
                        record_data = file_content[pos:]
                        pos = len(file_content)
                    else:
                        record_data = file_content[pos:newline_pos]
                        pos = newline_pos + 1
                    
                    if len(record_data) == 0:
                        break
                    
                    self.raw_records.append(record_data)
                    
                    try:
                        if self.encoding.lower() == 'shift_jis':
                            record_str = record_data.decode('shift_jis', errors='replace')
                        else:
                            record_str = record_data.decode('utf-8', errors='replace')
                    except:
                        record_str = record_data.decode('latin-1')
                    
                    self.records.append(record_str)
                    record_num += 1
                
                else:
                    print(f"[ERROR] Unsupported record type: {self.rectype}")
                    return False
            
            print(f"[INFO] Loaded {len(self.records)} records from {self.filename}")
            return True
            
        except Exception as e:
            print(f"[ERROR] Failed to load file: {e}")
            return False
    
    def show_initial_menu(self):
        """Show initial EDTFILE menu screen with Fujitsu ASP format"""
        print("=" * 80)
        print(f"EDTFILE (ファイルの編?: Edit File)")
        print()
        
        # Display current parameters in Fujitsu format
        print(f"EDTFILE │MODE={self.mode}│ [,FILE={self.filename}] [@LIB={self.lib}]")
        print(f"        │VS {self.vs:2d}│RS {self.rs:2d}│CP {self.cp:2d}│ [,EDIT={self.edit_format}]")
        print()
        
        print("機能")
        print("ディスクファイルの内容を編集、表示、印刷または修復する。")
        print("また、ディスクファイルの作成、ファイルとファイル定義体の管理、及び編集機能がある。")
        
        print("修復で実行されるコマンドは次のとおり。")
        print("? 物理ファイルの修復 (CRFRP)")
        print("修復で実行されるコマンドは次のとおり。")
        print("? 順編成ファイル、あるいは順編成ファイルの作成 (CRTFILE)")
        print("? 物理ファイルの作成 (CRTF)")
        print("? 物理ファイルの作成 (CRTLF)")
        print("? マルチボリューム物理ファイルの作成 (CRTMF)")
        
        print("各種で実行されるコマンドは次のとおり。")
        print("? 変更 (CHGFILE, CHGMBR)")
        print("? 移動 (MOVFILE, MOVMBR)")
        print("? 削除 (DLTFILE, DLTMBR)")
        print("? 変名 (RNMFILE, RNMBR)")
        print("? 印刷 (DMPFILE, DLTMBR)")
        print("? 消去 (CLRFILE)")
        
        print("編集で実行されるコマンドは次のとおり。")
        print("? ファイル定義体の生成 (PGO)")
        print("? 一括処理ファイルの処理参照 (RMFRM)")
        
        print()
        print(f"現在のパラメータ:")
        print(f"  VS: {self.vs} (画面表示行数)")
        print(f"  RS: {self.rs} (レコード表示サイズ)")
        print(f"  CP: {self.cp} (コピー パラメータ)")
        print()
        print("PF10:終了")
        print("-" * 80)
        
        while True:
            try:
                print("\n機能番号を入力してください (0:表示, 1:編集, 2:全モード X:終了): ", end="")
                choice = input().strip().upper()
                
                if choice == 'X' or choice == '':
                    return False
                elif choice == '0':
                    self.mode = '@DSP'
                    return True
                elif choice == '1':
                    self.mode = '@EDT'
                    return True
                elif choice == '2':
                    self.mode = '@ALL'
                    return True
                else:
                    print("無効な選択です。0, 1, 2, またはXを入力してください。")
                    
            except (EOFError, KeyboardInterrupt):
                return False
    
    def run_interactive_session(self):
        """Run the main interactive EDTFILE session"""
        if not self.show_initial_menu():
            print("[INFO] EDTFILE session cancelled.")
            return
        
        # Main session loop
        while True:
            if self.mode == '@DSP':
                if not self._display_mode():
                    break
            elif self.mode == '@ALL':
                if not self._all_mode():
                    break
            elif self.mode == '@EDT':
                if not self._edit_mode():
                    break
            elif self.mode == '@PRT':
                if not self._print_mode():
                    break
            else:
                print(f"[ERROR] Unsupported mode: {self.mode}")
                break
        
        # Save changes if modified
        if self.modified:
            self._save_changes()
        
        print("[INFO] EDTFILE session ended.")
    
    def _display_mode(self):
        """Display mode - view records without editing"""
        print("=" * 80)
        print(f"EDTFILE (Vuu-Laa)    ファイル名: {self.lib}.{self.filename}  ライブラリ名 {self.lib} (機番)")
        print(f"(1) 演算編成モード                            新 XXXXX")
        print()
        
        # Show records
        start_rec = (self.page - 1) * self.display_lines + 1
        end_rec = min(start_rec + self.display_lines - 1, len(self.records))
        
        print(f"REC-NO: レコード番号 {start_rec:08d} ～ {end_rec:08d} xxxxxxxxxxxxxx")
        print("nnnnnnnn cccccccccccc xxxxxxxxxx " + "." * 50)
        print()
        
        for i in range(start_rec - 1, end_rec):
            if i < len(self.records):
                rec_no = i + 1
                record_data = self.records[i]
                
                # Display record based on format
                if self.edit_format == '@HEX':
                    # Hex display
                    raw_data = self.raw_records[i] if i < len(self.raw_records) else b''
                    hex_str = ' '.join(f'{b:02X}' for b in raw_data[:40])  # First 40 bytes
                    char_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in raw_data[:40])
                    print(f"{rec_no:08d} {hex_str:<40} {char_str}")
                else:
                    # Character display
                    display_data = record_data[:70] if len(record_data) > 70 else record_data
                    print(f"{rec_no:08d} {display_data}")
        
        print("-" * 80)
        print(f"レコード範囲: {start_rec:08d}  レコード長: {self.reclen:08d} キー位置: キー長: {self.reclen:08d}/{self.reclen:08d}")
        print()
        print("D:削除  C:複写  O:複写先  S:検索  P:印刷  R:読込し  T:タブ")
        print("PF7:前画面  PF8:次画面  PF10:終了  PF14:タブ  PF19:検索  PF20:検索画面")
        
        # Command input
        print("\nコマンドを入力してください (P:次ページ, B:前ページ, S:検索, X:終了): ", end="")
        try:
            command = input().strip().upper()
            
            if command == 'X' or command == '':
                return False
            elif command == 'P':
                if (self.page * self.display_lines) < len(self.records):
                    self.page += 1
            elif command == 'B':
                if self.page > 1:
                    self.page -= 1
            elif command == 'S':
                self._search_records()
            elif command == 'E':
                self.mode = '@EDT'
            elif command.startswith('H'):
                self.edit_format = '@HEX'
            elif command.startswith('C'):
                self.edit_format = '@CHAR'
            else:
                print(f"未対応のコマンド: {command}")
            
            return True
            
        except (EOFError, KeyboardInterrupt):
            return False
    
    def _edit_mode(self):
        """Edit mode - modify records"""
        print("=" * 80)
        print(f"EDTFILE (Vuu-Laa)    ファイル名: {self.lib}.{self.filename}  ライブラリ名 {self.lib} (機番)")
        print("(1) 編集開始モード")
        print()
        
        # Show current record for editing
        if self.current_record <= len(self.records):
            current_rec = self.records[self.current_record - 1]
            print(f"REC-NO: {self.current_record:08d}")
            print(f"現在のレコード: {current_rec}")
            print()
            
            if self.edit_format == '@HEX':
                # Hex edit mode
                raw_data = self.raw_records[self.current_record - 1]
                hex_display = ' '.join(f'{b:02X}' for b in raw_data)
                print(f"HEX: {hex_display}")
        
        print("-" * 80)
        print("編集コマンド:")
        print("I: レコード挿入  D: レコード削除  C: レコード複写")
        print("S: 検索  R: 置換  M: 移動  U: 復元")
        print("PF9:取消  PF10:終了")
        
        print("\n編集コマンドを入力してください (I/D/C/S/R/M/U/N/P/X): ", end="")
        try:
            command = input().strip().upper()
            
            if command == 'X':
                return False
            elif command == 'N':  # Next record
                if self.current_record < len(self.records):
                    self.current_record += 1
            elif command == 'P':  # Previous record
                if self.current_record > 1:
                    self.current_record -= 1
            elif command == 'I':
                self._insert_record()
            elif command == 'D':
                self._delete_record()
            elif command == 'C':
                self._copy_record()
            elif command == 'S':
                self._search_records()
            elif command == 'R':
                self._replace_in_record()
            elif command == 'M':
                self._modify_record()
            else:
                print(f"未対応のコマンド: {command}")
            
            return True
            
        except (EOFError, KeyboardInterrupt):
            return False
    
    def _print_mode(self):
        """Print mode - output records to printer/file"""
        print("=" * 80)
        print(f"EDTFILE (Vuu-Laa)    ファイル名: {self.lib}.{self.filename}  ライブラリ名 {self.lib} (機番)")
        print()
        print("印刷")
        print("初期画面で '3. 印刷' を選択し、ファイル名等を入力するとデータ方法、機番手法およびファイル機器により印刷編成画面が")
        print("表示される。そして、各専用コマンドによりファイルまたはセクタアクセスの印刷に応じて印刷してよい。")
        print()
        
        print("(1) 印刷開始キー: _______")
        print("(2) 印刷終了キー: _______")
        print()
        print("(3) 不正データレコード印刷  N  (Y: 不正データレコードのみ, N:すべて)")
        print()
        print("PF9:取消  PF10:終了")
        
        # For now, just return to display mode
        return False
    
    def _all_mode(self):
        """All mode - comprehensive view of file with all record details"""
        print("=" * 80)
        print(f"EDTFILE (Vuu-Laa)    ファイル名: {self.lib}.{self.filename}  ライブラリ名 {self.lib} (機番)")
        print(f"@ALL モード - 全レコード表示")
        print()
        
        # Display file statistics
        total_records = len(self.records)
        total_size = sum(len(record.encode(self.encoding, errors='replace')) for record in self.records)
        
        print(f"ファイル統計:")
        print(f"  総レコード数: {total_records}")
        print(f"  総データサイズ: {total_size} バイト")
        print(f"  レコード長: {self.reclen} バイト")
        print(f"  レコード形式: {self.rectype}")
        print(f"  エンコーディング: {self.encoding}")
        print()
        
        # Display parameters
        print(f"表示パラメータ:")
        print(f"  VS (画面サイズ): {self.vs}")
        print(f"  RS (レコードサイズ): {self.rs}")
        print(f"  CP (コピーパラメータ): {self.cp}")
        print(f"  編集形式: {self.edit_format}")
        print()
        
        # Show all records with different formats based on edit_format
        if self.edit_format == '@HEX':
            self._display_all_hex()
        elif self.edit_format == '@CHAR':
            self._display_all_char()
        else:  # @ITEM
            self._display_all_item()
        
        print("-" * 80)
        print("コマンド: N:次ページ P:前ページ S:検索 H:HEX表示 C:文字表示 I:項目表示 X:終了")
        
        print("\nコマンドを入力してください: ", end="")
        try:
            command = input().strip().upper()
            
            if command == 'X' or command == '':
                return False
            elif command == 'H':
                self.edit_format = '@HEX'
            elif command == 'C':
                self.edit_format = '@CHAR'
            elif command == 'I':
                self.edit_format = '@ITEM'
            elif command == 'S':
                self._search_records()
            elif command == 'N':
                if (self.page * self.display_lines) < len(self.records):
                    self.page += 1
            elif command == 'P':
                if self.page > 1:
                    self.page -= 1
            else:
                print(f"未対応のコマンド: {command}")
            
            return True
            
        except (EOFError, KeyboardInterrupt):
            return False
    
    def _display_all_hex(self):
        """Display all records in hexadecimal format"""
        print("HEX表示 (16進数表示):")
        print("REC-NO   HEX DATA                                         CHARACTER")
        print("-" * 80)
        
        start_rec = (self.page - 1) * self.display_lines
        end_rec = min(start_rec + self.display_lines, len(self.records))
        
        for i in range(start_rec, end_rec):
            rec_no = i + 1
            raw_data = self.raw_records[i] if i < len(self.raw_records) else b''
            
            # Display hex data in 16-byte chunks
            for offset in range(0, len(raw_data), 16):
                chunk = raw_data[offset:offset + 16]
                hex_str = ' '.join(f'{b:02X}' for b in chunk)
                char_str = ''.join(chr(b) if 32 <= b <= 126 else '.' for b in chunk)
                
                if offset == 0:
                    print(f"{rec_no:08d} {hex_str:<48} {char_str}")
                else:
                    print(f"         {hex_str:<48} {char_str}")
    
    def _display_all_char(self):
        """Display all records in character format"""
        print("文字表示:")
        print("REC-NO   CHARACTER DATA")
        print("-" * 80)
        
        start_rec = (self.page - 1) * self.display_lines
        end_rec = min(start_rec + self.display_lines, len(self.records))
        
        for i in range(start_rec, end_rec):
            rec_no = i + 1
            record_data = self.records[i]
            
            # Split long records into multiple lines
            max_width = 70
            if len(record_data) > max_width:
                for j in range(0, len(record_data), max_width):
                    chunk = record_data[j:j + max_width]
                    if j == 0:
                        print(f"{rec_no:08d} {chunk}")
                    else:
                        print(f"         {chunk}")
            else:
                print(f"{rec_no:08d} {record_data}")
    
    def _display_all_item(self):
        """Display all records in item format (structured view)"""
        print("項目表示 (構造化表示):")
        print("REC-NO   LENGTH  TYPE  DATA")
        print("-" * 80)
        
        start_rec = (self.page - 1) * self.display_lines
        end_rec = min(start_rec + self.display_lines, len(self.records))
        
        for i in range(start_rec, end_rec):
            rec_no = i + 1
            record_data = self.records[i]
            data_length = len(record_data.encode(self.encoding, errors='replace'))
            
            # Determine data type based on content
            data_type = "TEXT"
            if record_data.strip().isdigit():
                data_type = "NUM"
            elif any(ord(c) < 32 or ord(c) > 126 for c in record_data if c):
                data_type = "BIN"
            
            # Display record info
            display_data = record_data[:60] if len(record_data) > 60 else record_data
            print(f"{rec_no:08d} {data_length:6d}  {data_type:4s}  {display_data}")
            
            if len(record_data) > 60:
                remaining = record_data[60:]
                while remaining:
                    chunk = remaining[:60]
                    remaining = remaining[60:]
                    print(f"         {' ':6s}  {' ':4s}  {chunk}")
    
    def _search_records(self):
        """Search for text in records"""
        print("\n検索文字列を入力してください: ", end="")
        try:
            search_text = input().strip()
            if not search_text:
                return
            
            self.search_string = search_text
            found = False
            
            # Search from current record forward
            for i in range(self.current_record - 1, len(self.records)):
                if search_text.upper() in self.records[i].upper():
                    self.current_record = i + 1
                    print(f"[INFO] 検索文字列が見つかりました。レコード {self.current_record}")
                    found = True
                    break
            
            if not found:
                print("[INFO] 検索文字列が見つかりませんでした。")
                
        except (EOFError, KeyboardInterrupt):
            pass
    
    def _insert_record(self):
        """Insert a new record"""
        print(f"\n新しいレコードを入力してください (最大 {self.reclen} 文字): ", end="")
        try:
            new_content = input().strip()
            
            # Pad or truncate to record length
            if len(new_content) < self.reclen:
                new_content = new_content.ljust(self.reclen)
            else:
                new_content = new_content[:self.reclen]
            
            # Insert at current position
            self.records.insert(self.current_record - 1, new_content)
            
            # Create raw data
            raw_data = new_content.encode(self.encoding, errors='replace')
            if len(raw_data) < self.reclen:
                raw_data += b' ' * (self.reclen - len(raw_data))
            else:
                raw_data = raw_data[:self.reclen]
            
            self.raw_records.insert(self.current_record - 1, raw_data)
            self.modified = True
            
            print(f"[INFO] レコード {self.current_record} に挿入されました。")
            
        except (EOFError, KeyboardInterrupt):
            pass
    
    def _delete_record(self):
        """Delete current record"""
        if self.current_record <= len(self.records):
            deleted_content = self.records.pop(self.current_record - 1)
            self.raw_records.pop(self.current_record - 1)
            self.modified = True
            
            print(f"[INFO] レコード {self.current_record} が削除されました。")
            
            # Adjust current record if needed
            if self.current_record > len(self.records):
                self.current_record = len(self.records)
        else:
            print("[ERROR] 削除するレコードがありません。")
    
    def _copy_record(self):
        """Copy current record"""
        if self.current_record <= len(self.records):
            record_content = self.records[self.current_record - 1]
            raw_content = self.raw_records[self.current_record - 1]
            
            # Insert copy after current record
            self.records.insert(self.current_record, record_content)
            self.raw_records.insert(self.current_record, raw_content)
            self.modified = True
            
            print(f"[INFO] レコード {self.current_record} が複写されました。")
        else:
            print("[ERROR] 複写するレコードがありません。")
    
    def _replace_in_record(self):
        """Replace text in current record"""
        if self.current_record > len(self.records):
            print("[ERROR] 置換するレコードがありません。")
            return
        
        print("\n検索文字列: ", end="")
        try:
            search_text = input().strip()
            if not search_text:
                return
            
            print("置換文字列: ", end="")
            replace_text = input().strip()
            
            current_content = self.records[self.current_record - 1]
            if search_text in current_content:
                new_content = current_content.replace(search_text, replace_text)
                
                # Pad or truncate to record length
                if len(new_content) < self.reclen:
                    new_content = new_content.ljust(self.reclen)
                else:
                    new_content = new_content[:self.reclen]
                
                self.records[self.current_record - 1] = new_content
                
                # Update raw data
                raw_data = new_content.encode(self.encoding, errors='replace')
                if len(raw_data) < self.reclen:
                    raw_data += b' ' * (self.reclen - len(raw_data))
                else:
                    raw_data = raw_data[:self.reclen]
                
                self.raw_records[self.current_record - 1] = raw_data
                self.modified = True
                
                print(f"[INFO] レコード {self.current_record} で置換されました。")
            else:
                print("[INFO] 検索文字列が見つかりませんでした。")
                
        except (EOFError, KeyboardInterrupt):
            pass
    
    def _modify_record(self):
        """Modify current record content"""
        if self.current_record > len(self.records):
            print("[ERROR] 修正するレコードがありません。")
            return
        
        current_content = self.records[self.current_record - 1]
        print(f"\n現在の内容: {current_content}")
        print(f"新しい内容を入力してください (最大 {self.reclen} 文字): ", end="")
        
        try:
            new_content = input().strip()
            
            # Pad or truncate to record length
            if len(new_content) < self.reclen:
                new_content = new_content.ljust(self.reclen)
            else:
                new_content = new_content[:self.reclen]
            
            self.records[self.current_record - 1] = new_content
            
            # Update raw data
            raw_data = new_content.encode(self.encoding, errors='replace')
            if len(raw_data) < self.reclen:
                raw_data += b' ' * (self.reclen - len(raw_data))
            else:
                raw_data = raw_data[:self.reclen]
            
            self.raw_records[self.current_record - 1] = raw_data
            self.modified = True
            
            print(f"[INFO] レコード {self.current_record} が修正されました。")
            
        except (EOFError, KeyboardInterrupt):
            pass
    
    def _save_changes(self):
        """Save modified records back to file"""
        try:
            print("\n変更を保存しますか？ (Y/N): ", end="")
            try:
                choice = input().strip().upper()
            except EOFError:
                choice = 'Y'  # Default to save if EOF
            
            if choice == 'Y' or choice == '':
                # Write all records back to file
                with open(self.file_path, 'wb') as f:
                    for i, raw_record in enumerate(self.raw_records):
                        if self.rectype == 'FB':
                            # For FB format, ensure exact record length
                            if len(raw_record) < self.reclen:
                                raw_record += b' ' * (self.reclen - len(raw_record))
                            elif len(raw_record) > self.reclen:
                                raw_record = raw_record[:self.reclen]
                            f.write(raw_record)
                        elif self.rectype == 'VB':
                            # VB format with RDW
                            f.write(raw_record)
                        elif self.rectype == 'LB':
                            # LB format with newlines
                            f.write(raw_record)
                            f.write(b'\n')
                
                print(f"[INFO] ファイル {self.filename} に変更が保存されました。")
                print(f"[INFO] {len(self.raw_records)} レコードが書き込まれました。")
                
                # Update catalog timestamp
                self._update_catalog_timestamp()
                return True
            else:
                print("[INFO] 変更は保存されませんでした。")
                return False
                
        except Exception as e:
            print(f"[ERROR] ファイル保存エラー: {e}")
            set_pgmec(999)
            return False
    
    def _update_catalog_timestamp(self):
        """Update file timestamp in catalog.json"""
        try:
            catalog = get_catalog_info()
            if (self.volume in catalog and 
                self.lib in catalog[self.volume] and 
                self.filename in catalog[self.volume][self.lib]):
                
                catalog[self.volume][self.lib][self.filename]["UPDATED"] = datetime.now().isoformat() + "Z"
                
                # Save updated catalog
                catalog_path = "/home/aspuser/app/config/catalog.json"
                with open(catalog_path, 'w', encoding='utf-8') as f:
                    json.dump(catalog, f, indent=2, ensure_ascii=False)
                    
        except Exception as e:
            print(f"[DEBUG] Catalog update failed: {e}")


def _parse_legacy_format(parts: List[str]) -> Tuple[str, str, str]:
    """Parse legacy EDTFILE format: FILE(LIB/FILENAME),VOL-VOLUME"""
    lib = ""
    filename = ""
    volume = ""
    
    for part in parts:
        if part.startswith('FILE(') and part.endswith(')'):
            file_spec = part[5:-1]  # Remove FILE( and )
            if '/' in file_spec:
                lib, filename = file_spec.split('/', 1)
        elif part.startswith('VOL-'):
            volume = part[4:]
        elif part.startswith('VOL='):
            volume = part[4:]
    
    return lib, filename, volume


def EDTFILE(command: str) -> bool:
    """
    Main EDTFILE command entry point
    
    Fujitsu ASP Format: EDTFILE [MODE={@ALL|@DSP|@PRT}] [,FILE=ファイル名] [@LIB=ライブラリ名] [,EDIT={@ITEM|@CHAR|@HEX}] [,VS=n] [,RS=n] [,CP=n]
    Legacy Format: EDTFILE FILE(LIB/FILENAME),VOL-VOLUME[,MODE=@DSP|@EDT|@PRT]
    
    Args:
        command: Full EDTFILE command string
        
    Returns:
        True if successful, False otherwise
    """
    try:
        # Parse command with support for both Fujitsu and legacy formats
        command_str = command.replace('EDTFILE ', '').strip()
        
        # Initialize default values
        params = {
            'MODE': '@DSP',
            'FILE': '',
            'LIB': '',
            'EDIT': '@ITEM',
            'VS': '7',
            'RS': '6', 
            'CP': '2',
            'VOL': 'DISK01'  # Default volume for backward compatibility
        }
        
        # Parse parameters - handle both = and - separators, and @ prefixes
        parts = []
        current_part = ""
        in_parentheses = False
        
        for char in command_str:
            if char == '(':
                in_parentheses = True
                current_part += char
            elif char == ')':
                in_parentheses = False
                current_part += char
            elif char == ',' and not in_parentheses:
                if current_part.strip():
                    parts.append(current_part.strip())
                current_part = ""
            else:
                current_part += char
        
        if current_part.strip():
            parts.append(current_part.strip())
        
        # Determine format based on first parameter
        is_legacy_format = False
        if parts and (parts[0].startswith('FILE(') or any('VOL-' in part or 'VOL=' in part for part in parts)):
            is_legacy_format = True
        
        if is_legacy_format:
            # Legacy format: EDTFILE FILE(LIB/FILENAME),VOL-VOLUME[,MODE=@DSP|@EDT|@PRT]
            lib, filename, volume = _parse_legacy_format(parts)
            if not lib or not filename:
                return False
            params['LIB'] = lib
            params['FILE'] = filename
            params['VOL'] = volume or 'DISK01'
            
            # Handle legacy MODE parameter
            for part in parts:
                if part.startswith('MODE=') or part.startswith('MODE-'):
                    mode_value = part.split('=', 1)[-1].split('-', 1)[-1].strip().upper()
                    if mode_value == '@EDT':
                        params['MODE'] = '@DSP'  # Convert @EDT to @DSP for compatibility
                    else:
                        params['MODE'] = mode_value
        else:
            # Fujitsu format: EDTFILE [MODE={@ALL|@DSP|@PRT}] [,FILE=ファイル名] [@LIB=ライブラリ名] [,EDIT={@ITEM|@CHAR|@HEX}] [,VS=n] [,RS=n] [,CP=n]
            for part in parts:
                if '=' in part:
                    key, value = part.split('=', 1)
                    key = key.strip().upper()
                    value = value.strip()
                    
                    # Handle @ prefixed parameters
                    if key.startswith('@'):
                        key = key[1:]  # Remove @
                    
                    if key in params:
                        params[key] = value
                elif part.startswith('@'):
                    # Handle standalone @ parameters (like @LIB=value)
                    if '=' in part:
                        key, value = part.split('=', 1)
                        key = key[1:].strip().upper()  # Remove @ and normalize
                        value = value.strip()
                        if key in params:
                            params[key] = value
        
        # Validate required parameters
        if not params['FILE']:
            print("[ERROR] FILE parameter is required.")
            print("[USAGE] EDTFILE [MODE={@ALL|@DSP|@PRT}] [,FILE=ファイル名] [@LIB=ライブラリ名] [,EDIT={@ITEM|@CHAR|@HEX}]")
            print("[LEGACY] EDTFILE FILE(LIB/FILENAME),VOL-VOLUME[,MODE=@DSP|@EDT|@PRT]")
            set_pgmec(999)
            return False
        
        if not params['LIB']:
            print("[ERROR] LIB parameter is required.")
            print("[USAGE] EDTFILE [MODE={@ALL|@DSP|@PRT}] [,FILE=ファイル名] [@LIB=ライブラリ名] [,EDIT={@ITEM|@CHAR|@HEX}]")
            print("[LEGACY] EDTFILE FILE(LIB/FILENAME),VOL-VOLUME[,MODE=@DSP|@EDT|@PRT]")
            set_pgmec(999)
            return False
        
        lib = params['LIB']
        filename = params['FILE']
        volume = params['VOL']
        mode = params['MODE']
        edit_format = params['EDIT']
        vs = params['VS']
        rs = params['RS']
        cp = params['CP']
        
        # Validate mode
        valid_modes = ['@DSP', '@EDT', '@PRT', '@ALL', '@ITEM', '@CHAR', '@HEX']
        if mode not in valid_modes:
            print(f"[ERROR] Invalid MODE. Supported: {', '.join(valid_modes)}")
            set_pgmec(999)
            return False
        
        # Construct file path
        file_path = os.path.join(VOLUME_ROOT, volume, lib, filename)
        
        if not os.path.isfile(file_path):
            print(f"[ERROR] File '{filename}' does not exist in library '{lib}' on volume '{volume}'.")
            set_pgmec(999)
            return False
        
        # Get file format info from catalog
        catalog = get_catalog_info()
        file_info = {}
        if (volume in catalog and lib in catalog[volume] and 
            filename in catalog[volume][lib]):
            file_info = catalog[volume][lib][filename]
        
        reclen = file_info.get('RECLEN', 80)
        rectype = file_info.get('RECTYPE', 'FB')
        encoding = file_info.get('ENCODING', 'utf-8')
        
        print(f"[INFO] Starting EDTFILE session")
        print(f"[INFO] File: {lib}/{filename}, Volume: {volume}")
        print(f"[INFO] Record type: {rectype}, Record length: {reclen}, Encoding: {encoding}")
        print(f"[INFO] Mode: {mode}, Edit Format: {edit_format}")
        print(f"[INFO] Display parameters - VS: {vs}, RS: {rs}, CP: {cp}")
        
        # Create and run EDTFILE session with new parameters
        session = EDTFILESession(file_path, lib, filename, volume, reclen, rectype, encoding, 
                                mode, edit_format, vs, rs, cp)
        
        # Start interactive session
        session.run_interactive_session()
        
        return True
        
    except Exception as e:
        print(f"[ERROR] EDTFILE command failed: {e}")
        set_pgmec(999)
        return False


# For backwards compatibility and testing
if __name__ == "__main__":
    import sys
    if len(sys.argv) > 1:
        EDTFILE(' '.join(sys.argv[1:]))
