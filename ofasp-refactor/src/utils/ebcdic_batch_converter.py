#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
EBCDIC バッチ変換システム (Batch Converter)
プロジェクト内のコードページテーブルをロードして変換を実行
"""

import os
import sys
from typing import Dict, List, Optional, Tuple, Union
from pathlib import Path

# プロジェクトルートディレクトリ追加
project_root = Path(__file__).parent.parent.parent
sys.path.insert(0, str(project_root))

class EbcdicBatchConverter:
    """EBCDIC バッチ変換クラス"""
    
    def __init__(self, codepage_base_path: str = None):
        """
        初期化
        
        Args:
            codepage_base_path: コードページテーブルファイルのベースパス
        """
        if codepage_base_path is None:
            # プロジェクトデフォルトパス設定
            self.codepage_base_path = project_root / "public" / "codepages"
        else:
            self.codepage_base_path = Path(codepage_base_path)
        
        # コードページファイルマッピング
        self.codepage_files = {
            'EBCDIC_TO_ASCII': {
                'US': 'EBCASCUS.txt',
                'JP': 'EBCASCJP.txt',
                'JAK': 'JEFASCK.txt',
                'KEIS': 'KEISASCK.txt',
                'KR': 'EBCASCUS.txt'  # KRはUSと同じ
            },
            'ASCII_TO_EBCDIC': {
                'US': 'ASCEBCUS.txt',
                'JP': 'ASCEBCJP.txt',
                'JAK': 'ASCJEFK.txt',
                'KEIS': 'ASCJEISK.txt',
                'KR': 'ASCEBCUS.txt'  # KRはUSと同じ
            }
        }
        
        # マッピングテーブルキャッシュ
        self.mapping_cache = {}
        
        # SOSIコード定数 (デフォルト値)
        self.default_SOSI_SO = 0x0E  # Shift Out
        self.default_SOSI_SI = 0x0F  # Shift In
        
        print(f"EbcdicBatchConverter コードページパス: {self.codepage_base_path}で初期化されました")
    
    def load_codepage_table(self, encoding: str, direction: str) -> Tuple[Dict[int, int], Dict[int, int]]:
        """
        コードページテーブルをロード
        
        Args:
            encoding: エンコーディングタイプ (US, JP, JAK, KEIS, KR)
            direction: 変換方向 (EBCDIC_TO_ASCII, ASCII_TO_EBCDIC)
            
        Returns:
            tuple: (single_byte_table, double_byte_table)
        """
        cache_key = f"{encoding}_{direction}"
        
        # キャッシュ確認
        if cache_key in self.mapping_cache:
            return self.mapping_cache[cache_key]
        
        # ファイルパス構成
        filename = self.codepage_files[direction][encoding]
        file_path = self.codepage_base_path / filename
        
        if not file_path.exists():
            raise FileNotFoundError(f"コードページファイルが見つかりません: {file_path}")
        
        print(f"コードページテーブルをロード中: {file_path}")
        
        single_byte_table = {}
        double_byte_table = {}
        
        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                lines = f.readlines()
            
            current_section = None
            single_byte_count = 0
            double_byte_count = 0
            
            for line_num, line in enumerate(lines, 1):
                line = line.strip()
                
                # セクションヘッダー確認
                if line == '[Single byte mapping table]':
                    current_section = 'single'
                    print(f"シングルバイトマッピングセクション 行{line_num}で発見")
                    continue
                elif line == '[Double byte mapping table]':
                    current_section = 'double'
                    print(f"ダブルバイトマッピングセクション 行{line_num}で発見")
                    continue
                
                # 空行をスキップ
                if not line:
                    continue
                
                # マッピング行の解析 (例: "00 - 00" または "4040 - 8140")
                if ' - ' in line:
                    try:
                        from_hex, to_hex = line.split(' - ')
                        from_value = int(from_hex, 16)
                        to_value = int(to_hex, 16)
                        
                        if current_section == 'single':
                            single_byte_table[from_value] = to_value
                            single_byte_count += 1
                        elif current_section == 'double':
                            # 0000値はマッピングされていないことを意味
                            if to_value != 0:
                                double_byte_table[from_value] = to_value
                                double_byte_count += 1
                    except ValueError as e:
                        print(f"警告: 無効なマッピング行 {line_num}: {line} - {e}")
                        continue
            
            print(f"ロード完了: シングルバイト{single_byte_count}個、ダブルバイト{double_byte_count}個のマッピング")
            
            # キャッシュに保存
            self.mapping_cache[cache_key] = (single_byte_table, double_byte_table)
            
            return single_byte_table, double_byte_table
            
        except Exception as e:
            raise RuntimeError(f"コードページテーブルのロードに失敗: {file_path}: {e}")
    
    def EBCDIC_TO_ASCII(self, 
                       input_data: Union[str, bytes],
                       output_buffer: Optional[str],
                       encoding: str,
                       sosi_flag: bool,
                       out_sosi_flag: bool,
                       rlen: int,
                       layout: Optional[str] = None,
                       sosi_so: int = None,
                       sosi_si: int = None) -> str:
        """
        EBCDICをASCIIに変換
        
        Args:
            input_data: 入力データ (16進文字列またはバイト)
            output_buffer: 出力バッファ (参照用、実際は戻り値を使用)
            encoding: エンコーディングタイプ
            sosi_flag: SOSI処理の有無
            out_sosi_flag: 出力にSOSIコードを保持するか
            rlen: 入力バッファ長
            layout: レイアウト情報
            sosi_so: Shift-Out コード (デフォルト: 0x0E)
            sosi_si: Shift-In コード (デフォルト: 0x0F)
            
        Returns:
            変換されたASCII文字列
        """
        # SOSIコード設定 (カスタムまたはデフォルト)
        SOSI_SO = sosi_so if sosi_so is not None else self.default_SOSI_SO
        SOSI_SI = sosi_si if sosi_si is not None else self.default_SOSI_SI
        
        print(f"=== EBCDIC_TO_ASCII 変換開始 ===")
        print(f"入力: {input_data if isinstance(input_data, str) else input_data.hex()}")
        print(f"エンコーディング: {encoding}")
        print(f"SOSIフラグ: {sosi_flag}")
        print(f"出力SOSIフラグ: {out_sosi_flag}")
        print(f"レコード長: {rlen}")
        print(f"レイアウト: {layout}")
        if sosi_flag:
            print(f"SOSIコード: SO=0x{SOSI_SO:02X}, SI=0x{SOSI_SI:02X}")
        
        # コードページテーブルロード
        single_byte_table, double_byte_table = self.load_codepage_table(encoding, 'EBCDIC_TO_ASCII')
        
        # 入力データをバイトに変換
        if isinstance(input_data, str):
            # 16進文字列をバイトに変換
            clean_input = input_data.replace(' ', '').replace('\n', '')
            if len(clean_input) % 2 != 0:
                clean_input += '0'  # 奇数長補正
            bytes_data = bytes.fromhex(clean_input)
        else:
            bytes_data = input_data
        
        # rlenに従って入力データ処理
        if rlen > 0 and len(bytes_data) > rlen:
            bytes_data = bytes_data[:rlen]
            print(f"rlenに切り詰め: {rlen}")
        
        print(f"{len(bytes_data)}バイト処理中")
        
        result = []
        i = 0
        is_double_byte_mode = False
        
        while i < len(bytes_data):
            byte = bytes_data[i]
            
            if sosi_flag:
                # SOSIコード処理 (JAK規則: SO=2バイトモード開始, SI=1バイトモード復帰)
                if byte == SOSI_SO:
                    print(f"[{i:02d}] SOSI: Shift-Out発見 - ダブルバイトモード開始")
                    is_double_byte_mode = True
                    
                    if out_sosi_flag:
                        result.append(chr(byte))
                    else:
                        result.append(' ')  # SOSIコードを空白に置換
                    
                    i += 1
                    continue
                    
                elif byte == SOSI_SI:
                    print(f"[{i:02d}] SOSI: Shift-In発見 - シングルバイトモード復帰")
                    is_double_byte_mode = False
                    
                    if out_sosi_flag:
                        result.append(chr(byte))
                    else:
                        result.append(' ')  # SOSIコードを空白に置換
                    
                    i += 1
                    continue
                
                # ダブルバイトモード処理
                if is_double_byte_mode:
                    if i + 1 < len(bytes_data):
                        next_byte = bytes_data[i + 1]
                        
                        # 現在のバイトがSIかどうか確認（ダブルバイト処理前に）
                        if byte == SOSI_SI:
                            print(f"[{i:02d}] SOSI: ダブルバイトモードでShift-In発見 - シングルバイトモード復帰")
                            is_double_byte_mode = False
                            
                            if out_sosi_flag:
                                result.append(chr(byte))
                            else:
                                result.append(' ')  # SOSIコードを空白に置換
                            
                            i += 1
                            continue
                        
                        # 次のバイトがSIかどうか確認
                        if next_byte == SOSI_SI:
                            # 奇数バイト - シングルバイトとして処理
                            ascii_value = single_byte_table.get(byte, 0x20)
                            result.append(chr(ascii_value))
                            print(f"[{i:02d}] ダブルバイトモードで奇数バイト: 0x{byte:02X} -> 0x{ascii_value:02X}")
                            i += 1
                            continue
                        
                        # 正常なダブルバイト処理
                        double_byte_value = (byte << 8) | next_byte
                        print(f"[{i:02d}] ダブルバイト処理: 0x{double_byte_value:04X}")
                        
                        if double_byte_value in double_byte_table:
                            mapped_value = double_byte_table[double_byte_value]
                            
                            # ダブルバイトマッピング結果処理
                            if mapped_value == 0x8140:  # 日本語全角スペース
                                if encoding == 'JP':
                                    result.append('　')  # 全角スペース (U+3000)
                                    print(f"  -> 日本語全角スペース -> 全角スペース")
                                else:
                                    result.append(' ')
                                    print(f"  -> 日本語全角スペース -> ASCIIスペース")
                            elif mapped_value <= 0xFF:  # 単一バイト結果
                                result.append(chr(mapped_value))
                                print(f"  -> シングルバイト結果: 0x{mapped_value:02X}")
                            else:  # ダブルバイト結果 - SJIS処理
                                if encoding in ['JP', 'JAK'] and mapped_value >= 0x8140:
                                    # SJIS環境では安全な範囲内でのみ文字変換
                                    high_byte = (mapped_value >> 8) & 0xFF
                                    low_byte = mapped_value & 0xFF
                                    
                                    # 0x81-0x9F, 0xE0-0xFC 범위의 SJIS 1바이트 문자는 안전하지 않음
                                    if (0x81 <= high_byte <= 0x9F) or (0xE0 <= high_byte <= 0xFC):
                                        try:
                                            sjis_bytes = bytes([high_byte, low_byte])
                                            sjis_char = sjis_bytes.decode('shift_jis', errors='replace')
                                            if sjis_char != '\ufffd':
                                                result.append(sjis_char)
                                                print(f"  -> SJIS文字: 0x{mapped_value:04X} -> '{sjis_char}'")
                                            else:
                                                result.append('?')
                                                print(f"  -> SJIS文字: 0x{mapped_value:04X} -> '?' (デコード失敗)")
                                        except UnicodeDecodeError:
                                            result.append('?')
                                            print(f"  -> SJIS文字: 0x{mapped_value:04X} -> '?' (デコードエラー)")
                                    else:
                                        # 안전하지 않은 바이트는 물음표로 대체
                                        result.append('?')
                                        print(f"  -> SJIS文字: 0x{mapped_value:04X} -> '?' (安全でないバイト)")
                                else:
                                    result.append(' ')  # 安全な代替
                                    print(f"  -> ダブルバイト結果: 0x{mapped_value:04X} -> スペース")
                        else:
                            result.append(' ')  # マッピングなし
                            print(f"  -> 0x{double_byte_value:04X}のマッピングなし -> スペース")
                        
                        i += 2
                        continue
                    else:
                        # ダブルバイトモードで最後のバイト
                        # 最後のバイトがSIかどうか確認
                        if byte == SOSI_SI:
                            print(f"[{i:02d}] SOSI: Shift-In発見 (最後のバイト) - シングルバイトモード復帰")
                            is_double_byte_mode = False
                            
                            if out_sosi_flag:
                                result.append(chr(byte))
                            else:
                                result.append(' ')  # SOSIコードを空白に置換
                            
                            i += 1
                            continue
                        
                        ascii_value = single_byte_table.get(byte, 0x20)
                        result.append(chr(ascii_value))
                        print(f"[{i:02d}] ダブルバイトモードで最後のバイト: 0x{byte:02X} -> 0x{ascii_value:02X}")
                        i += 1
                        continue
            
            # シングルバイトモードまたはSOSI未使用
            ascii_value = single_byte_table.get(byte, 0x20)  # デフォルト値: スペース
            
            # 安全な文字変換
            try:
                if ascii_value <= 0x7F:  # ASCII範囲
                    char = chr(ascii_value)
                elif encoding in ['JP', 'JAK'] and ascii_value >= 0x80:
                    # SJIS環境では直接バイト値を文字として使用
                    char = chr(ascii_value)
                else:
                    char = chr(ascii_value) if ascii_value <= 0xFF else '?'
                
                result.append(char)
                print(f"[{i:02d}] シングルバイト: 0x{byte:02X} -> 0x{ascii_value:02X} ('{char}')")
            except (ValueError, UnicodeDecodeError):
                result.append('?')
                print(f"[{i:02d}] シングルバイト: 0x{byte:02X} -> 0x{ascii_value:02X} -> '?' (変換エラー)")
            
            i += 1
        
        ascii_result = ''.join(result)
        print(f"最終結果: \"{ascii_result}\"")
        print("=== 変換完了 ===\n")
        
        return ascii_result
    
    def ASCII_TO_EBCDIC(self,
                       input_data: Union[str, bytes],
                       output_buffer: Optional[str],
                       encoding: str,
                       sosi_flag: bool,
                       out_sosi_flag: bool,
                       rlen: int,
                       layout: Optional[str] = None,
                       sosi_so: int = None,
                       sosi_si: int = None) -> str:
        """
        ASCIIをEBCDICに変換
        
        Args:
            input_data: 入力データ (ASCII文字列)
            output_buffer: 出力バッファ (参照用、実際は戻り値を使用)
            encoding: エンコーディングタイプ
            sosi_flag: SOSI処理の有無
            out_sosi_flag: 出力にSOSIコードを保持するか
            rlen: 入力バッファ長
            layout: レイアウト情報
            
        Returns:
            変換されたEBCDIC 16進文字列
        """
        print(f"=== ASCII_TO_EBCDIC 変換開始 ===")
        print(f"入力: \"{input_data}\"")
        print(f"エンコーディング: {encoding}")
        print(f"SOSIフラグ: {sosi_flag}")
        print(f"出力SOSIフラグ: {out_sosi_flag}")
        print(f"レコード長: {rlen}")
        print(f"レイアウト: {layout}")
        
        # コードページテーブルロード
        single_byte_table, double_byte_table = self.load_codepage_table(encoding, 'ASCII_TO_EBCDIC')
        
        # 入力データを文字列に変換
        if isinstance(input_data, bytes):
            input_data = input_data.decode('utf-8', errors='replace')
        
        # rlenに従って入力データ処理
        if rlen > 0 and len(input_data) > rlen:
            input_data = input_data[:rlen]
            print(f"rlenに切り詰め: {rlen}")
        
        result = []
        
        for i, char in enumerate(input_data):
            ascii_value = ord(char)
            
            if ascii_value in single_byte_table:
                ebcdic_value = single_byte_table[ascii_value]
                result.append(f'{ebcdic_value:02X}')
                print(f"[{i:02d}] '{char}' (0x{ascii_value:02X}) -> 0x{ebcdic_value:02X}")
            else:
                # マッピングがない場合EBCDICスペース(0x40)で処理
                result.append('40')
                print(f"[{i:02d}] '{char}' (0x{ascii_value:02X}) -> 0x40 (マッピングなし)")
        
        ebcdic_result = ''.join(result)
        print(f"最終結果: {ebcdic_result}")
        print("=== 変換完了 ===\n")
        
        return ebcdic_result

    def save_converted_file(self, content: str, output_path: str, encoding: str = 'US'):
        """
        変換された内容をファイルに保存
        
        Args:
            content: 変換されたASCII/日本語テキスト
            output_path: 出力ファイルパス
            encoding: 元のエンコーディングタイプ ('US', 'JP', 'KR', 'JAK', 'KEIS')
        """
        if encoding == 'JP':
            # 日本語エンコーディングの場合、まずcp932で試行
            try:
                with open(output_path, 'w', encoding='cp932', errors='replace') as f:
                    f.write(content)
                print(f"CP932でファイル保存: {output_path}")
            except UnicodeEncodeError as e:
                print(f"警告: 一部の文字をCP932でエンコードできませんでした: {e}")
                try:
                    # Shift-JISで再試行
                    with open(output_path, 'w', encoding='shift_jis', errors='replace') as f:
                        f.write(content)
                    print(f"Shift-JISでファイル保存: {output_path}")
                except UnicodeEncodeError as e2:
                    print(f"警告: Shift-JISでもエンコードエラー: {e2}")
                    # UTF-8でフォールバック
                    with open(output_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"UTF-8でファイル保存 (フォールバック): {output_path}")
        else:
            # その他のエンコーディングはUTF-8で保存
            with open(output_path, 'w', encoding='utf-8') as f:
                f.write(content)
            print(f"UTF-8でファイル保存: {output_path}")

    def convert_ebcdic_file(self, input_path: str, output_path: str, encoding: str = 'US', 
                          sosi_flag: bool = True, out_sosi_flag: bool = False, rlen: int = 80):
        """
        EBCDICファイルをASCII/日本語に変換して保存
        
        Args:
            input_path: 入力EBCDICファイルパス
            output_path: 出力ファイルパス
            encoding: エンコーディングタイプ ('US', 'JP', 'KR', 'JAK', 'KEIS')
            sosi_flag: SOSI処理の有無
            out_sosi_flag: SOSIコード保持の有無
            rlen: レコード長
        """
        print(f"EBCDICファイルを変換中: {input_path}")
        print(f"エンコーディング: {encoding}")
        print(f"出力: {output_path}")
        print("-" * 50)
        
        # EBCDICファイル読み込み
        with open(input_path, 'rb') as f:
            ebcdic_data = f.read()
        
        # バイトを16進文字列に変換
        hex_data = ebcdic_data.hex().upper()
        
        # rlenバイトずつ処理
        converted_lines = []
        line_count = 0
        hex_line_length = rlen * 2  # rlenバイト = rlen*2 16進文字
        
        for i in range(0, len(hex_data), hex_line_length):
            line_hex = hex_data[i:i+hex_line_length]
            if line_hex:
                line_count += 1
                print(f"\n=== 行 {line_count} ===")
                
                ascii_line = self.EBCDIC_TO_ASCII(
                    input_data=line_hex,
                    output_buffer=None,
                    encoding=encoding,
                    sosi_flag=sosi_flag,
                    out_sosi_flag=out_sosi_flag,
                    rlen=rlen,
                    layout=None
                )
                converted_lines.append(ascii_line)
                print(f"行 {line_count} 結果: \"{ascii_line}\"")
        
        # 全ての行を結合
        full_content = '\n'.join(converted_lines)
        
        # ファイルに保存
        self.save_converted_file(full_content, output_path, encoding)
        
        print(f"\n変換完了!")
        print(f"処理した行数: {line_count}")
        print(f"出力保存先: {output_path}")
        
        return full_content


def main():
    """テスト関数"""
    print("=" * 60)
    print("EBCDIC バッチコンバーター テスト")
    print("=" * 60)
    
    # コンバーター初期化
    converter = EbcdicBatchConverter()
    
    # テストケース1: 基本変換
    print("\n[テスト1: 基本変換]")
    test_ebcdic = "C4C9E2D7D3C1E8"  # "DISPLAY"
    result1 = converter.EBCDIC_TO_ASCII(
        input_data=test_ebcdic,
        output_buffer=None,
        encoding='US',
        sosi_flag=False,
        out_sosi_flag=False,
        rlen=80,
        layout=None
    )
    print(f"結果: \"{result1}\"")
    
    # テストケース2: SOSI変換
    print("\n[テスト2: SOSI変換]")
    test_ebcdic_sosi = "C4C9E2D7D3C1E8400E40400F4040"  # "DISPLAY " + SO + double-byte + SI + "  "
    result2 = converter.EBCDIC_TO_ASCII(
        input_data=test_ebcdic_sosi,
        output_buffer=None,
        encoding='JP',  # 日本語コードページ使用
        sosi_flag=True,
        out_sosi_flag=False,
        rlen=80,
        layout=None
    )
    print(f"結果: \"{result2}\"")
    
    # テストケース3: 逆変換
    print("\n[テスト3: 逆変換]")
    result3 = converter.ASCII_TO_EBCDIC(
        input_data=result1,
        output_buffer=None,
        encoding='US',
        sosi_flag=False,
        out_sosi_flag=False,
        rlen=80,
        layout=None
    )
    print(f"結果: {result3}")
    
    # テストケース4: ユーザーデータ（日本語含む）
    print("\n[テスト4: 日本語を含むユーザーデータ]")
    user_data = "4040404040404040404040C4C9E2D7D3C1E8407D0E43AA435843C543584A7E49BA404040400F7D4B40404040404040404040404040404040404040404040404040404040404040404040404040404040"
    result4 = converter.EBCDIC_TO_ASCII(
        input_data=user_data,
        output_buffer=None,
        encoding='JP',
        sosi_flag=True,
        out_sosi_flag=False,
        rlen=80,
        layout=None
    )
    print(f"結果: \"{result4}\"")
    
    # テストケース5: 実際のEBCDICファイル変換
    print("\n[テスト5: 実際のEBCDICファイル変換]")
    try:
        # 実際のEBCDICファイル変換
        ebcdic_files = [
            "/data/assets/DEMO/ebcdic/CBACC484",
            "/data/assets/DEMO/ebcdic/CBACC591"
        ]
        
        for ebcdic_file in ebcdic_files:
            import os
            if os.path.exists(ebcdic_file):
                output_file = f"/tmp/converted_{os.path.basename(ebcdic_file)}.txt"
                print(f"\n変換中: {ebcdic_file}")
                
                result = converter.convert_ebcdic_file(
                    input_path=ebcdic_file,
                    output_path=output_file,
                    encoding='JP',  # 日本語エンコーディング使用
                    sosi_flag=True,
                    out_sosi_flag=False,
                    rlen=80
                )
                
                print(f"変換完了: {output_file}")
                
                # ファイルエンコーディング確認
                print(f"ファイルエンコーディング確認:")
                with open(output_file, 'rb') as f:
                    file_bytes = f.read(100)  # 最初の100バイトのみ確認
                    print(f"最初の100バイト: {file_bytes}")
            else:
                print(f"ファイルが見つかりません: {ebcdic_file}")
                
    except Exception as e:
        print(f"ファイル変換テストでエラー: {e}")


if __name__ == "__main__":
    main()