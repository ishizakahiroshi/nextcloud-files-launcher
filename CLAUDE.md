<!-- このファイルにはプロジェクト固有ルールだけを置く。個人・グローバルルールは
各AIツールのグローバル設定へ置き、fresh public cloneでも有効な内容に保つ。 -->
# Files Launcher 開発ガイド

> このファイルは索引であって本文ではない。仕様・検証方法の詳細はREADMEとテストを参照する。

## プロジェクト概要

Nextcloud Filesの作成・アップロード操作を、小さなランチャーにまとめる独立アプリ。
アプリIDは `files_launcher`。既存アクションとアップロード処理を呼び、権限判定を再実装しない。
利用者向け仕様・導入・対応範囲は [README.md](README.md) を正本とする。

## やらないこと（スコープ外）

- Nextcloud本体の改変、WebDAVや認証・権限判定の置き換え。
- 本番環境の接続情報・実データ・私有ファイルへの参照の同梱。
- 未検証のNextcloudメジャーバージョンへの対応宣言。

## 技術スタック

JavaScript / CSS、Nextcloud PHP bootstrap、webpack、Node.js標準テストとjsdom。
依存関係は `package.json` と `package-lock.json`、対応Nextcloudは `appinfo/info.xml` を参照する。

## ディレクトリ構成

- `appinfo/` / `lib/`: アプリ情報とNextcloudへの読み込み登録。
- `js/src/` / `css/`: ランチャーとホストアプリとの接続。
- `js/main.js`: 配布用bundle。対応するライセンスファイルも保持する。
- `tests/`: 合成DOMによる動作検証。
- `scripts/`: パッケージ作成・公開前検査。利用方法はREADMEを参照する。

## 主要コマンド

- 動作テスト: `npm test`
- 配布bundle生成: `npm run build`
- ガイド構造検査: `node scripts/check-claude-md.mjs`
- 公開前スキャン: `node scripts/secrets-scan.mjs --all-tracked --block`

## 設計原則の索引

| 対象 | 正本・検査 |
|---|---|
| 権限・宛先・標準アクションへの委譲 | `js/src/` と `tests/` |
| キャンセルからの選び直し・表示保持 | `tests/` |
| 対応範囲・インストール | `README.md` / `appinfo/info.xml` |
| 公開物の情報漏えい検査 | `scripts/secrets-scan.mjs` / `.github/workflows/secrets-scan.yml` |

## AI 作業共通ルール

ビルド・コミット、secrets-scan責務、作業MD作成などの共通ルールは各利用者のグローバルAI設定に従う
（作者環境の例: `~/.claude/CLAUDE.md` / `~/.claude/guides/`）。
公開する説明・fixtureには、ローカル環境の絶対パスや本番の識別子を埋め込まない。

## secrets-scan（このリポジトリの配線）

- scanner: `scripts/secrets-scan.mjs`。全trackedは `--all-tracked --block`、commit対象は `--staged --block`。
- 公開依存の原本にある12件の連絡先のみ `THIRD_PARTY_LICENSES.txt` 内に限定して許可する。ほかのファイルと未登録アドレスは引き続き検出し、`tests/secrets-scan.test.cjs` で確認する。
- CI: `.github/workflows/secrets-scan.yml`。構造パターンによる検査を実行する。
- ローカルgate: `.githooks/pre-commit`。clone後は `scripts/install-hooks.ps1` または `scripts/install-hooks.sh` で有効化する。
- ローカル監視語の任意設定: `KB_ROOT` / `FAMILY_ROOT`。未設定時は構造パターンだけで検査する。
- 私有設定や監視語はコミットしない。ローカルhookは利用者環境ごとに管理する。
- リリース前には実際の配布ファイルも検査し、tracked検査を配布物検査の代わりにしない。

## Obsidian artifacts

If `docs/obsidian/README.md` exists, use it as an index for related knowledge artifacts.
Use the repository-relative `docs/obsidian` entry; do not silently fall back to `docs/local` when it is missing.

## 関連ドキュメント

仕様・導入は `README.md`、ライセンスは `LICENSE`、エージェント入口は `AGENTS.md`。
非公開の作業ノートは `docs/local/`（存在する場合・Gitの追跡対象外）を使う。
