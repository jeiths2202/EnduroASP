#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
OpenASP Configuration Check Script
設定ファイルの検証とプログラム数のカウント
"""

import sys
import json
import os
from datetime import datetime

def check_config_file(config_path):
    """
    設定ファイルをチェックして情報を返す
    
    Args:
        config_path (str): 設定ファイルのパス
        
    Returns:
        dict: チェック結果
    """
    result = {
        'exists': False,
        'valid_json': False,
        'program_count': 0,
        'type_counts': {},
        'version': 'unknown',
        'error_message': None
    }
    
    try:
        # ファイル存在チェック
        if not os.path.exists(config_path):
            result['error_message'] = f"設定ファイルが見つかりません: {config_path}"
            return result
        
        result['exists'] = True
        
        # ファイル読み込み
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result['valid_json'] = True
        
        # プログラム情報の解析
        programs = data.get('programs', {})
        result['program_count'] = len(programs)
        
        # バージョン情報
        result['version'] = data.get('version', 'unknown')
        
        # タイプ別カウント
        type_counts = {}
        for program_name, program_info in programs.items():
            program_type = program_info.get('TYPE', 'UNKNOWN')
            type_counts[program_type] = type_counts.get(program_type, 0) + 1
        
        result['type_counts'] = type_counts
        
        # 追加情報
        result['description'] = data.get('description', '')
        result['last_updated'] = data.get('last_updated', '')
        
        # パッケージ構造情報
        if 'package_structure' in data:
            result['package_structure'] = data['package_structure']
        
        # タイプ設定情報
        if 'type_settings' in data:
            result['type_settings'] = list(data['type_settings'].keys())
        
    except json.JSONDecodeError as e:
        result['error_message'] = f"JSON文法エラー: {str(e)}"
    except Exception as e:
        result['error_message'] = f"設定ファイル読み込みエラー: {str(e)}"
    
    return result

def print_config_summary(result):
    """
    設定ファイルの検査結果を表示
    
    Args:
        result (dict): check_config_file()の結果
    """
    print("?? 設定ファイル検査結果")
    print("=" * 30)
    
    if not result['exists']:
        print("? ファイル不存在")
        if result['error_message']:
            print(f"   エラー: {result['error_message']}")
        return
    
    print("? ファイル存在")
    
    if not result['valid_json']:
        print("? JSON文法エラー")
        if result['error_message']:
            print(f"   エラー: {result['error_message']}")
        return
    
    print("? JSON文法正常")
    print(f"?? 総プログラム数: {result['program_count']}個")
    
    if result['version'] != 'unknown':
        print(f"?? バージョン: {result['version']}")
    
    if result['type_counts']:
        print("?? タイプ別内訳:")
        for ptype, count in result['type_counts'].items():
            print(f"   ? {ptype}: {count}個")
    
    if 'type_settings' in result:
        print(f"??  サポートタイプ: {', '.join(result['type_settings'])}")
    
    if result.get('last_updated'):
        print(f"?? 最終更新: {result['last_updated']}")

def validate_programs(config_path):
    """
    プログラム設定の詳細検証
    
    Args:
        config_path (str): 設定ファイルのパス
        
    Returns:
        list: 検証エラーのリスト
    """
    errors = []
    
    try:
        with open(config_path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        programs = data.get('programs', {})
        type_settings = data.get('type_settings', {})
        
        for program_name, program_info in programs.items():
            # 必須フィールドチェック
            required_fields = ['TYPE', 'PGM', 'DESCRIPTION']
            for field in required_fields:
                if field not in program_info:
                    errors.append(f"プログラム '{program_name}': 必須フィールド '{field}' が不足")
            
            # タイプ設定チェック
            program_type = program_info.get('TYPE')
            if program_type and program_type not in type_settings:
                errors.append(f"プログラム '{program_name}': 未定義のタイプ '{program_type}'")
            
            # Java パッケージ名チェック
            if program_type == 'JAVA':
                pgm = program_info.get('PGM', '')
                if '.' in pgm and not pgm.startswith('com.openasp.'):
                    errors.append(f"プログラム '{program_name}': 非標準Javaパッケージ '{pgm}'")
    
    except Exception as e:
        errors.append(f"検証中にエラーが発生: {str(e)}")
    
    return errors

def create_sample_config(output_path):
    """
    サンプル設定ファイルを生成
    
    Args:
        output_path (str): 出力ファイルパス
    """
    sample_config = {
        "description": "SMED MAP別 MAIN プログラム マッピング設定",
        "version": "2.0",
        "last_updated": datetime.now().strftime("%Y-%m-%d"),
        "programs": {
            "MENU": {
                "TYPE": "JAVA",
                "PGM": "com.openasp.menu.MenuProgram",
                "DESCRIPTION": "メインメニュー画面"
            },
            "LOGO": {
                "TYPE": "JAVA",
                "PGM": "com.openasp.login.LoginProgram",
                "DESCRIPTION": "ログイン画面"
            },
            "PGM1": {
                "TYPE": "JAVA",
                "PGM": "com.openasp.core.PGM1",
                "DESCRIPTION": "基本ログイン処理プログラム"
            },
            "PGM2": {
                "TYPE": "JAVA",
                "PGM": "com.openasp.core.PGM2",
                "DESCRIPTION": "基本ユーザープログラム"
            }
        },
        "type_settings": {
            "JAVA": {
                "executor": "java",
                "jar_path": "/home/aspuser/app/server/java_jars/ofasp.jar",
                "main_class": "com.openasp.launcher.OpenASPLauncher",
                "timeout": 60,
                "encoding": "UTF-8"
            },
            "COBOL": {
                "executor": "dlcall",
                "library_path": "/home/aspuser/app/server/cobol_modules",
                "timeout": 120,
                "encoding": "UTF-8"
            },
            "SHELL": {
                "executor": "bash",
                "script_path": "/home/aspuser/app/server/shell_modules",
                "timeout": 300,
                "encoding": "UTF-8"
            }
        }
    }
    
    try:
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(sample_config, f, indent=2, ensure_ascii=False)
        print(f"? サンプル設定ファイル生成: {output_path}")
    except Exception as e:
        print(f"? サンプル設定ファイル生成失敗: {e}")

def main():
    """メイン関数"""
    if len(sys.argv) < 2:
        print("使用法: python3 check_config.py <設定ファイルパス> [オプション]")
        print("オプション:")
        print("  --validate    詳細検証を実行")
        print("  --create-sample <パス>  サンプル設定ファイルを生成")
        print("  --count-only  プログラム数のみ出力")
        sys.exit(1)
    
    config_path = sys.argv[1]
    
    # オプション処理
    if '--create-sample' in sys.argv:
        sample_path_idx = sys.argv.index('--create-sample') + 1
        if sample_path_idx < len(sys.argv):
            create_sample_config(sys.argv[sample_path_idx])
        else:
            create_sample_config('smed_pgm_sample.json')
        return
    
    # 設定ファイルチェック
    result = check_config_file(config_path)
    
    if '--count-only' in sys.argv:
        # プログラム数のみ出力（ビルドスクリプト用）
        print(result['program_count'])
        return
    
    # 詳細情報表示
    print_config_summary(result)
    
    # 詳細検証
    if '--validate' in sys.argv and result['valid_json']:
        print("\n?? 詳細検証中...")
        errors = validate_programs(config_path)
        
        if errors:
            print("??  検証エラー:")
            for error in errors:
                print(f"   ? {error}")
        else:
            print("? 検証完了: エラーなし")

if __name__ == "__main__":
    main()
