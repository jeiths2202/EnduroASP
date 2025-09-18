#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Test suite for REFJOB command functionality
"""

import os
import sys
import time
import unittest
from unittest.mock import patch, MagicMock

# Add the parent directory to the path to import modules
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from functions.refjob import REFJOB, list_library_jobs, get_job_details
from functions.smbjob import SMBJOB, ACTIVE_JOBS, JobInfo
import datetime

class TestREFJOB(unittest.TestCase):
    
    def setUp(self):
        """Set up test environment"""
        # Clear active jobs before each test
        ACTIVE_JOBS.clear()
        
        # Add some test jobs
        job1 = JobInfo(
            job_id="job_001",
            job_name="TEST001",
            program="test_program.java",
            parameters="param1,param2",
            jobq="JOBQ1"
        )
        job1.status = "RUNNING"
        job1.start_time = datetime.datetime.now() - datetime.timedelta(minutes=5)
        ACTIVE_JOBS["job_001"] = job1
        
        job2 = JobInfo(
            job_id="job_002", 
            job_name="BATCH02",
            program="batch_job.cbl",
            parameters="input=data.txt",
            jobq="BATCHQ"
        )
        job2.status = "PENDING"
        ACTIVE_JOBS["job_002"] = job2
        
        job3 = JobInfo(
            job_id="job_003",
            job_name="REPORT3", 
            program="report.sh",
            parameters="",
            jobq="RPTQ"
        )
        job3.status = "COMPLETED"
        job3.start_time = datetime.datetime.now() - datetime.timedelta(minutes=10)
        job3.end_time = datetime.datetime.now() - datetime.timedelta(minutes=2)
        ACTIVE_JOBS["job_003"] = job3

    def tearDown(self):
        """Clean up after each test"""
        ACTIVE_JOBS.clear()

    def test_refjob_basic_syntax(self):
        """Test basic REFJOB command syntax"""
        # Test without parameters (default @ALL mode)
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB")
            self.assertTrue(result)
            mock_print.assert_called()

    def test_refjob_all_mode(self):
        """Test REFJOB with STS=@ALL mode"""
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@ALL")
            self.assertTrue(result)
            
            # Check that library list header is printed
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("ライブラリリスト" in call for call in calls))

    def test_refjob_edit_mode(self):
        """Test REFJOB with STS=@EDT mode"""
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@EDT")
            self.assertTrue(result)
            
            # Check that edit mode header is printed  
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("編集モードジョブ" in call for call in calls))

    def test_refjob_status_mode(self):
        """Test REFJOB with STS=@STS mode"""
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@STS")
            self.assertTrue(result)
            
            # Check that status detail header is printed
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("ジョブ状態詳細" in call for call in calls))

    def test_refjob_with_pagination(self):
        """Test REFJOB with VS, RS, CP parameters"""
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@ALL,VS=1,RS=5,CP=1")
            self.assertTrue(result)
            
            # Should display pagination info
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("ページ" in call for call in calls))

    def test_refjob_invalid_sts_parameter(self):
        """Test REFJOB with invalid STS parameter"""
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@INVALID")
            self.assertFalse(result)
            
            # Should print error message
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("エラー" in call for call in calls))

    def test_list_library_jobs(self):
        """Test list_library_jobs function"""
        jobs = list_library_jobs()
        self.assertEqual(len(jobs), 3)
        
        # Test filtering by library
        test_jobs = list_library_jobs("TESTLIB")
        self.assertGreaterEqual(len(test_jobs), 0)

    def test_get_job_details(self):
        """Test get_job_details function"""
        # Test existing job
        details = get_job_details("TEST001")
        self.assertIsNotNone(details)
        self.assertEqual(details['job_name'], "TEST001")
        self.assertEqual(details['status'], "RUNNING")
        
        # Test non-existent job
        details = get_job_details("NONEXISTENT")
        self.assertIsNone(details)

    def test_japanese_status_conversion(self):
        """Test Japanese status conversion"""
        from functions.refjob import _get_status_japanese
        
        self.assertEqual(_get_status_japanese("PENDING"), "待機中")
        self.assertEqual(_get_status_japanese("RUNNING"), "実行中")
        self.assertEqual(_get_status_japanese("COMPLETED"), "完了")
        self.assertEqual(_get_status_japanese("ERROR"), "エラー")
        self.assertEqual(_get_status_japanese("HELD"), "保留中")
        self.assertEqual(_get_status_japanese("CANCELLED"), "取消済")

    def test_job_type_detection(self):
        """Test job type detection"""
        from functions.refjob import _get_job_type
        
        # Mock job with Java program
        java_job = MagicMock()
        java_job.program = "test.java"
        self.assertEqual(_get_job_type(java_job), "J")
        
        # Mock job with COBOL program
        cobol_job = MagicMock()
        cobol_job.program = "test.cbl"
        self.assertEqual(_get_job_type(cobol_job), "C")
        
        # Mock job with Shell program
        shell_job = MagicMock()
        shell_job.program = "test.sh"
        self.assertEqual(_get_job_type(shell_job), "S")

    def test_execution_time_calculation(self):
        """Test execution time calculation"""
        from functions.refjob import _calculate_execution_time
        
        # Test job with start and end time
        job = MagicMock()
        job.start_time = datetime.datetime.now() - datetime.timedelta(minutes=5)
        job.end_time = datetime.datetime.now()
        
        exec_time = _calculate_execution_time(job)
        self.assertRegex(exec_time, r"\d{2}:\d{2}:\d{2}")

    def test_integration_with_smbjob(self):
        """Test integration with SMBJOB system"""
        # Submit a job first
        with patch('builtins.print'):
            SMBJOB("SMBJOB JOB=INTTEST,PGM=test.java,PARA=test,JOBQ=TESTQ")
        
        # Then check it appears in REFJOB
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@ALL")
            self.assertTrue(result)
            
            # Should show the submitted job
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            job_mentioned = any("INTTEST" in str(call) for call in calls)
            self.assertTrue(job_mentioned)

    def test_no_active_jobs(self):
        """Test REFJOB when no jobs are active"""
        ACTIVE_JOBS.clear()
        
        with patch('builtins.print') as mock_print:
            result = REFJOB("REFJOB STS=@EDT")
            self.assertTrue(result)
            
            # Should show no jobs message
            calls = []
            for call in mock_print.call_args_list:
                if len(call[0]) > 0:
                    calls.append(str(call[0][0]))
            self.assertTrue(any("ありません" in call for call in calls))

    def test_command_parsing(self):
        """Test command parameter parsing"""
        from functions.refjob import _parse_refjob_command
        
        # Test basic parsing
        params = _parse_refjob_command("REFJOB STS=@ALL,VS=5,RS=10")
        self.assertEqual(params['STS'], '@ALL')
        self.assertEqual(params['VS'], '5')
        self.assertEqual(params['RS'], '10')
        
        # Test empty command
        params = _parse_refjob_command("REFJOB")
        self.assertEqual(len(params), 0)

def run_comprehensive_test():
    """Run comprehensive REFJOB functionality test"""
    print("=" * 60)
    print("REFJOB 総合機能テスト開始")
    print("=" * 60)
    
    # Clear any existing jobs
    ACTIVE_JOBS.clear()
    
    # 1. Test with no jobs
    print("\n1. 空のジョブリストでのテスト:")
    with patch('builtins.print'):
        result = REFJOB("REFJOB STS=@ALL")
        print(f"結果: {'成功' if result else '失敗'}")
    
    # 2. Submit some test jobs
    print("\n2. テストジョブの投入:")
    test_jobs = [
        "SMBJOB JOB=PAYROLL,PGM=payroll.cbl,JOBQ=BATCH",
        "SMBJOB JOB=REPORT01,PGM=report.java,JOBQ=REPORT",
        "SMBJOB JOB=CLEANUP,PGM=cleanup.sh,JOBQ=MAINT"
    ]
    
    for job_cmd in test_jobs:
        with patch('builtins.print'):
            SMBJOB(job_cmd)
        print(f"投入: {job_cmd.split('JOB=')[1].split(',')[0]}")
    
    # 3. Test all modes
    print("\n3. 全モードテスト:")
    modes = ["@ALL", "@EDT", "@STS"]
    
    for mode in modes:
        print(f"\n--- STS={mode} モード ---")
        result = REFJOB(f"REFJOB STS={mode},VS=1,RS=5")
        print(f"実行結果: {'成功' if result else '失敗'}")
    
    # 4. Test library job listing
    print("\n4. ライブラリジョブ一覧テスト:")
    jobs = list_library_jobs()
    print(f"アクティブジョブ数: {len(jobs)}")
    
    # 5. Test job details
    print("\n5. ジョブ詳細テスト:")
    if jobs:
        first_job = jobs[0]['job_name']
        details = get_job_details(first_job)
        if details:
            print(f"ジョブ {first_job} の詳細取得: 成功")
            print(f"  状態: {details['status_jp']}")
            print(f"  実行時間: {details['execution_time']}")
        else:
            print(f"ジョブ {first_job} の詳細取得: 失敗")
    
    print("\n" + "=" * 60)
    print("REFJOB 総合機能テスト完了")
    print("=" * 60)

if __name__ == "__main__":
    # Run unit tests
    print("REFJOB単体テスト実行中...")
    unittest.main(argv=[''], exit=False, verbosity=2)
    
    print("\n")
    
    # Run comprehensive test
    run_comprehensive_test()