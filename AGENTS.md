# Agent Entry Point (Files Launcher)

このリポジトリの運用ガイダンスは `CLAUDE.md` を正本とする。

- プロジェクト概要・ルール: `./CLAUDE.md`
- ユーザー向けドキュメント: `./README.md`
- ローカル追記（存在する場合・コミットしない）: `./CLAUDE.local.md` / `./AGENTS.local.md` / `./docs/local/`

個人・グローバル AI ルールはリポジトリの外に置き、各 AI ツールのグローバル設定を使う。
fresh public clone でも有効な内容に保つ。

## Non-negotiables (full detail in CLAUDE.md)

- Nextcloud本体を変更せず、既存の作成アクション・権限・アップロード処理を使う。
- 入力のキャンセルでランチャーまで閉じないことを検証する。
- 公開fixtureには合成データだけを使用する。
- ビルド・コミット、secrets-scan責務、作業MD作成などの共通ルールは各利用者のグローバル AI 設定に従う（作者環境の例: `~/.claude/CLAUDE.md` / `~/.claude/guides/`）。
- スキャンの実行方法は `CLAUDE.md` の「secrets-scan（このリポジトリの配線）」を参照する。
- `docs/obsidian/README.md` があれば索引として読み、知識記録はrepo相対の `docs/obsidian` を使う。入口の欠損時に `docs/local` へ黙ってfallbackしない。

ガイダンス間で矛盾が出たら `CLAUDE.md` を優先する。

<!-- many-ai-cli の承認マーカーブロックは実行環境が管理する。本ファイルでは持たない。 -->
