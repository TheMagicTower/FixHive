# FixHive

<p align="center">
  <a href="README.md">English</a> |
  <a href="README.ko.md">한국어</a> |
  <a href="README.zh.md">中文</a> |
  <a href="README.ja.md">日本語</a> |
  <a href="README.es.md">Español</a> |
  <a href="README.de.md">Deutsch</a> |
  <a href="README.fr.md">Français</a> |
  <a href="README.nl.md">Nederlands</a>
</p>

> OpenCode向けコミュニティベースのエラー知識共有システム

FixHiveは、開発セッション中にエラーを自動的にキャプチャし、コミュニティナレッジベースからソリューションを検索し、解決したエラーを他の開発者と共有するOpenCodeプラグインです。

## 機能

- **自動エラー検出**：ツール出力（bash、editなど）からエラーを自動検出
- **クラウドナレッジベース**：セマンティック類似性（pgvector）を使用したコミュニティソリューション検索
- **ローカルキャッシュ**：オフラインアクセス用のSQLiteベースのローカルストレージ
- **プライバシーフィルタリング**：機密データ（APIキー、パス、メールアドレス）の自動除去
- **リアルタイム同期**：エラー/解決時の即時クラウド通信

## インストール

```bash
npm install @the-magic-tower/fixhive-opencode-plugin
```

## クイックスタート

OpenCode設定ファイル（`opencode.config.ts`）に追加：

```typescript
import FixHivePlugin from '@the-magic-tower/fixhive-opencode-plugin';

export default {
  plugins: [FixHivePlugin],
};
```

**以上！** FixHiveはデフォルトでコミュニティナレッジベースに接続します。環境変数の設定は不要です。

## 設定（オプション）

動作をカスタマイズするための環境変数：

```bash
# コミュニティの代わりに自分のSupabaseインスタンスを使用
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key

# セマンティック検索を有効化（推奨）
OPENAI_API_KEY=sk-...

# カスタム貢献者ID（未設定の場合は自動生成）
FIXHIVE_CONTRIBUTOR_ID=your-contributor-id
```

| 変数 | デフォルト | 説明 |
|------|------------|------|
| `FIXHIVE_SUPABASE_URL` | コミュニティDB | SupabaseプロジェクトURL |
| `FIXHIVE_SUPABASE_KEY` | コミュニティKey | Supabase anonキー |
| `OPENAI_API_KEY` | なし | セマンティック類似性検索を有効化 |
| `FIXHIVE_CONTRIBUTOR_ID` | 自動生成 | 一意の貢献者ID |

## 利用可能なコマンド

| コマンド | 説明 |
|----------|------|
| `fixhive_search` | エラーソリューションのナレッジベースを検索 |
| `fixhive_resolve` | エラーを解決済みとしてマークし、ソリューションを共有 |
| `fixhive_list` | 現在のセッションのエラー一覧を表示 |
| `fixhive_vote` | ソリューションに投票（賛成/反対） |
| `fixhive_stats` | 使用統計を表示 |
| `fixhive_helpful` | ソリューションが役立ったことを報告 |
| `fixhive_report` | 不適切なコンテンツを報告 |

### ワークフロー例

1. **エラー発生** → FixHiveが自動的に検出して記録
2. **ソリューション検索** → `fixhive_search "Module not found: react"`
3. **修正を適用** → コミュニティソリューションに従う
4. **解決を共有** → `fixhive_resolve <error-id> "不足している依存関係をインストール"`

## セルフホストセットアップ（オプション）

デフォルトのコミュニティナレッジベースを使用する場合は、このセクションをスキップしてください。

独自のFixHiveバックエンドを運用するには：

1. 新しいSupabaseプロジェクトを作成（無料プランで可）
2. SQLエディタでセットアップスクリプトを実行：

```bash
cat scripts/setup-supabase.sql | pbcopy
# Supabase SQLエディタに貼り付け
```

3. Settings > APIからプロジェクトURLとanon keyを取得
4. 環境変数を設定：

```bash
FIXHIVE_SUPABASE_URL=https://your-project.supabase.co
FIXHIVE_SUPABASE_KEY=your-anon-key
```

## アーキテクチャ

```
FixHive Plugin
├── Error Detection（tool.execute.afterフック）
├── Privacy Filter（機密データを除去）
├── Local Storage（SQLite）
│   ├── error_records
│   └── query_cache
└── Cloud Client（Supabase + pgvector）
    ├── knowledge_entries
    └── usage_logs
```

## プライバシー

FixHiveは機密情報を自動的にフィルタリングします：

- APIキー（OpenAI、GitHub、AWS、Stripeなど）
- JWTトークンとBearerトークン
- メールアドレス
- ファイルパス（`~`または`<PROJECT>`に置換）
- 機密名を含む環境変数
- データベース接続文字列
- IPアドレス（localhost除く）

## 開発

```bash
# 依存関係をインストール
npm install

# ビルド
npm run build

# ウォッチモード
npm run dev

# 型チェック
npm run typecheck

# テスト実行
npm test
```

## ライセンス

MIT

## コントリビュート

1. リポジトリをフォーク
2. 機能ブランチを作成
3. 変更をコミット
4. ブランチにプッシュ
5. Pull Requestを作成
