# Files Launcher

Nextcloudのファイル画面に、コンパクトな作成・アップロード用ランチャーを追加します。

9点アイコンから、そのフォルダーで使える標準機能を選べます。小さなアイコン表示とリスト表示を切り替えられ、作成をキャンセルしてもランチャーが残るため、そのまま選び直せます。

独立版0.2.0の公開候補です。App Storeへは未公開で、対応宣言はNextcloud 33のみです。一時的に作ったNextcloud 33.0.10で配布物の設置・有効化・配信・無効化を確認しました。独立版の実際のNextcloud画面での操作は別途確認が必要です。34・35への対応はまだ確認していません。

標準の作成処理・権限・アップロード入力を利用します。表示形式の好みをブラウザに保存し、公開共有では標準の入口を維持します。

開発環境で `npm ci --ignore-scripts`、`npm test`、`npm run build`、`npm run package` の順に実行します。生成される `build/` のtar.gzとSHA256を確認し、Nextcloudに登録されたcustom_appsへ展開します。フォルダー名は `files_launcher`、所有者はWebサーバーの実行ユーザー、ディレクトリ755・ファイル644に揃えます。

Nextcloud設置ディレクトリで `sudo -u www-data php occ app:enable files_launcher` を実行し、画面を再読込します。無効化は `sudo -u www-data php occ app:disable files_launcher` の後に画面を再読込します。署名済み版をApp Storeへ登録するまでは自動更新されません。

構成・開発・更新確認は[英語README](README.md)と[保守手順](docs/maintenance.md)に記載しています。AGPL-3.0-or-laterで配布し、LICENSE・NOTICE・依存ライセンス通知を同梱します。
