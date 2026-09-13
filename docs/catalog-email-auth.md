# 確認・補完のメール認証

## 方針

公開の閲覧・規格検索はログイン不要。編集はCloudflare AccessのOne-time PINで`@sgs.com`の受信を確認した人に許可する。事前の担当者リストや初回承認は不要。メールごとの識別はAccessの署名付き利用者IDを使い、固定の個人キーを発行・メール配布しない。

コードはCloudflareから送られ、一度限り・10分で失効する。これはWorkersの任意メール送信機能ではない。Zero Trust Freeの50ユーザー枠を利用する。既存のZero Trust利用者も含むため、管理画面で残り枠を確認する。有料プランへの自動変更は本手順に含めない。Zero Trust初回登録で支払い情報や契約確認を求められた場合はアカウント所有者が行う。

- [Cloudflare公式のOne-time PIN設定](https://developers.cloudflare.com/cloudflare-one/integrations/identity-providers/one-time-pin/)
- [公式料金](https://www.cloudflare.com/plans/)
- [署名付き認証情報の検証](https://developers.cloudflare.com/cloudflare-one/access-controls/applications/http-apps/authorization-cookie/validating-json/)

## 切替前の準備

アプリ側の対応がDeployされても、`CATALOG_AUTH_MODE`が未設定なら既存の管理キー方式のまま。設定不備で自動的に公開書込みへ切り替わることはない。

1. D1バックアップ後、`0005_publisher_admin_audit.sql`まで適用し、認証対応WorkerをDeployする。スコープを再seedしない。
2. Cloudflare Zero Trustで既存の組織・契約・使用席数を確認する。組織未作成なら所有者がFreeを選択して登録する。
3. One-time PINのログイン方法を追加する。既存の認証設定や他アプリのポリシーは変更しない。
4. Self-hostedのAccess applicationを作成する。対象は **`lab-scope-checker.seidaku.com/api/catalog/login`** のみ。ホスト全体や`/api/catalog/*`全体を保護しない。公開の閲覧・検索・履歴を維持する。
5. このアプリはOne-time PINのみを有効にする。AllowポリシーのIncludeを **Emails ending in → `@sgs.com`** とする。Everyone、Bypass、Service Authは追加しない。セッション期限は1時間とする。ほかのログイン方法を併用するならRequireでOne-time PINを限定する。Includeを増やしてOR条件でドメイン制限を緩めない。
6. このAccess applicationのAudience（AUD）と、組織の`https://実際の組織名.cloudflareaccess.com`を確認する。これらは設定識別子でありパスワードではない。アプリのWorker設定に次を追加してDeployする。

| Worker変数 | 値 |
|---|---|
| `CATALOG_AUTH_MODE` | `access` |
| `CATALOG_ACCESS_TEAM_DOMAIN` | 実際の`https://組織名.cloudflareaccess.com`。末尾スラッシュなし |
| `CATALOG_ACCESS_AUD` | このログイン用Access applicationのAUD |

Wranglerの設定ファイルと管理画面の変数を食い違わせない。Deployで消える一時的な管理画面設定だけに依存しない。上の値を推測して本番を有効にしない。

## 切替時の確認

- ログイン前でも、トップ画面、規格検索、認定書・スコープの閲覧、Published一覧を利用できる。
- 「確認・補完」で管理キー欄が消え、`@sgs.comでログイン`が表示される。
- 実際の利用者がメールを受信し、自分でコードを入力する。コードやパスワードを調査担当へ送らない。
- 戻ってきた画面に本人のメールが表示される。期限切れ、偽造JWT、違うAUD・発行者、別ドメインのメール、偽のメールヘッダーは拒否される。
- 管理キーが残っていても、Accessモードでは管理キーによる書込みは許可されない。切替確認が終わるまで秘密の値そのものは消去しない。
- `workers.dev`側は閲覧専用。編集は正規ホストの同一オリジンからのみ許可する。旧APIパスでも署名検証を省略しない。クロスサイトの保存・補完解除も拒否する。
- 本番への架空規格やテスト値の保存は禁止。保存の端から端までの試験は、実際に根拠を確認した必要な補正だけを対象にする。
- 週次巡回は既存CLIのD1権限を使用し、人のメール認証や公開書込みAPIには依存しない。

メールが届かない場合は迷惑メール隔離を確認する。送信元は`noreply@notify.cloudflare.com`。会社側でブロックされる場合、社内の手続きに従って許可を依頼する。送信元ドメイン全体の許可などを独断で変更しない。`seidaku.com`のMX変更や独自メール送信サーバーの導入は不要。

## 編集者の記録と復旧

Accessで認証された保存・補完解除は、台帳更新と同じD1トランザクションで`publisher_admin_audit`に規格キー、操作、利用者ID、メール、日時を記録する。記録できない場合は更新自体を失敗させる。この表のメールは公開API・公開版履歴・お知らせには出さない。利用目的は編集の追跡に限定し、顧客情報を追記しない。

過去の共有管理キーでの編集者は個人特定できないため、遡って本人確認済みにしない。スケジュールの実行者情報とも別管理にする。

認証障害時は公開の閲覧を維持し、設定不足や署名検証失敗では編集を停止する。復旧目的の管理キー方式への戻しは、所有者が明示的に`CATALOG_AUTH_MODE=token`へ変更してDeployする場合だけ。JWT検証やドメイン制限を削除して回避しない。
