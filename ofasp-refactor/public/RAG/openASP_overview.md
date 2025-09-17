# OpenASP AX プロジェクト概要

## プロジェクトの目的
OpenASP AXは、レガシーASPシステムをオープンソース環境に移行するためのAIトランスフォーメーションツールです。

## 主要機能

### 1. COBOL AX
- COBOLプログラムをJava、C、Shell Script、Pythonに変換
- データ構造変換
- ビジネスロジック移行
- ファイル処理ロジック変換

### 2. CL AX
- CL(Control Language)スクリプトをShell、JavaScript、Pythonに変換
- ファイル操作コマンド変換
- プログラム呼び出しロジック変換
- バッチ作業スクリプト変換

### 3. AI Transform
- ASP System Command（ASPシステム命令語ターミナル）
- ASP MapEditor（SMEDファイル管理）
- MapLink（マップ連結視覚化）

### 4. チャットサービス
- Gemmaモデルを使用したAIアシスタント
- マルチモーダル対応（画像、文書ファイル）
- RAG（Retrieval-Augmented Generation）機能
- リアルタイム対話システム

## システム構成
- フロントエンド: React 19 + TypeScript
- バックエンド: Python Flask, Java Spring
- AI モデル: Ollama + Gemma
- ポート構成:
  - 3005: OpenASP Refactor メイン
  - 3006: チャットAPI
  - 3014: Ollama サーバー

## 移行プロセス
1. ソース分析: 既存ASPソースコード構造分析
2. 変換実行: 対象言語への自動変換
3. 検証デプロイ: 変換コードの検証とデプロイ