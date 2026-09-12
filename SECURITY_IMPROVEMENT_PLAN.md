# セキュリティ改善計画

## 概要
このドキュメントは、EU Harmonized Standards Checkerプロジェクトのセキュリティ強化とブラッシュアップのための詳細な計画です。

## フェーズ1: 緊急セキュリティ対応（1-2週間）

### 1.1 依存関係の脆弱性対応
**優先度**: 🔴 高

**現状の問題**:
- 依存関係の脆弱性チェックが実施されていない
- `cheerio`、`xlsx`などのバージョンが最新か不明

**対応策**:
```bash
# 脆弱性スキャン実施
npm audit

# 自動修正可能な脆弱性を修正
npm audit fix

# 重大な脆弱性を強制修正
npm audit fix --force

# 依存関係の更新
npm update
```

**実装タスク**:
- [ ] `npm audit`を実行して脆弱性レポート作成
- [ ] 検出された脆弱性を修正
- [ ] GitHub Dependabotを有効化
- [ ] CI/CDパイプラインに脆弱性チェックを追加

**成果物**:
- 脆弱性レポート
- 更新された`package.json`と`package-lock.json`
- `.github/dependabot.yml`設定ファイル

---

### 1.2 入力検証の強化
**優先度**: 🔴 高

**現状の問題**:
- ユーザー入力の検証が不十分
- XSS攻撃のリスク
- SQLインジェクション（該当なし、ただし将来的なDB導入時に備える）

**対応策**:

#### バックエンド（Netlify Functions）
```javascript
// netlify/functions/utils/validation.js（新規作成）
const validator = require('validator');

// 入力検証ユーティリティ
function validateDirectiveCode(code) {
  const allowedDirectives = ['EMC', 'RED', 'LVD'];
  if (!code || typeof code !== 'string') {
    throw new Error('Invalid directive code format');
  }
  const sanitized = validator.escape(code.trim().toUpperCase());
  if (!allowedDirectives.includes(sanitized)) {
    throw new Error(`Invalid directive code. Allowed: ${allowedDirectives.join(', ')}`);
  }
  return sanitized;
}

function validateCertificateType(certType) {
  const allowedTypes = ['a2la', 'jab'];
  if (!certType || typeof certType !== 'string') {
    throw new Error('Invalid certificate type format');
  }
  const sanitized = validator.escape(certType.trim().toLowerCase());
  if (!allowedTypes.includes(sanitized)) {
    throw new Error(`Invalid certificate type. Allowed: ${allowedTypes.join(', ')}`);
  }
  return sanitized;
}

function validateStandardNumber(standard) {
  if (!standard || typeof standard !== 'string') {
    throw new Error('Invalid standard number format');
  }
  // 規格番号の形式を検証（EN、IEC、ISO等）
  const standardPattern = /^(EN|IEC|ISO|ETSI|CISPR|JIS|KS)\s+[\w\s\-:\.\/\(\)]+$/i;
  const sanitized = validator.escape(standard.trim());
  if (!standardPattern.test(sanitized)) {
    throw new Error('Invalid standard number format');
  }
  return sanitized;
}

function sanitizeHtml(input) {
  if (!input || typeof input !== 'string') {
    return '';
  }
  return validator.escape(input);
}

module.exports = {
  validateDirectiveCode,
  validateCertificateType,
  validateStandardNumber,
  sanitizeHtml
};
```

#### フロントエンド（XSS対策）
```javascript
// static/utils/sanitizer.js（新規作成）
function sanitizeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    // HTTPSのみ許可
    if (parsed.protocol !== 'https:') {
      throw new Error('Only HTTPS URLs are allowed');
    }
    // 許可されたドメインのみ
    const allowedDomains = [
      'ec.europa.eu',
      'eur-lex.europa.eu',
      'etsi.org',
      'standards.cencenelec.eu'
    ];
    if (!allowedDomains.some(domain => parsed.hostname.endsWith(domain))) {
      throw new Error('Domain not allowed');
    }
    return parsed.href;
  } catch (e) {
    console.error('Invalid URL:', e);
    return null;
  }
}

export { sanitizeHtml, sanitizeUrl };
```

**実装タスク**:
- [ ] `validator`パッケージをインストール
- [ ] `utils/validation.js`を作成
- [ ] 全Netlify Functionsに入力検証を追加
- [ ] フロントエンドにサニタイゼーション関数を追加
- [ ] 動的HTML生成箇所を修正

**成果物**:
- 入力検証ユーティリティモジュール
- 更新されたNetlify Functions
- XSS対策が施されたフロントエンドコード

---

### 1.3 エラーハンドリングの改善
**優先度**: 🔴 高

**現状の問題**:
- エラーメッセージに内部情報が含まれる
- スタックトレースが外部に露出

**対応策**:

```javascript
// netlify/functions/utils/error-handler.js（新規作成）
const { logError } = require('./config');

class AppError extends Error {
  constructor(message, statusCode = 500, isOperational = true) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    Error.captureStackTrace(this, this.constructor);
  }
}

function handleError(error, event) {
  // 本番環境では詳細を隠す
  const isProduction = process.env.NODE_ENV === 'production';
  
  logError('Error occurred:', {
    message: error.message,
    stack: error.stack,
    path: event.path,
    method: event.httpMethod
  });

  // ユーザーに返すエラーメッセージ
  const userMessage = isProduction && !error.isOperational
    ? 'An unexpected error occurred. Please try again later.'
    : error.message;

  return {
    statusCode: error.statusCode || 500,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      success: false,
      error: userMessage,
      ...(isProduction ? {} : { stack: error.stack })
    })
  };
}

module.exports = { AppError, handleError };
```

**実装タスク**:
- [ ] エラーハンドリングユーティリティを作成
- [ ] 全Netlify Functionsにエラーハンドラーを適用
- [ ] 環境変数で本番/開発モードを切り替え
- [ ] ログレベルを環境に応じて調整

**成果物**:
- エラーハンドリングモジュール
- 更新されたNetlify Functions
- 環境変数設定ドキュメント

---

### 1.4 CORS設定の厳格化
**優先度**: 🔴 高

**現状の問題**:
- `Access-Control-Allow-Origin: *`で全ドメインを許可
- CSRF攻撃のリスク

**対応策**:

```javascript
// netlify/functions/utils/cors.js（新規作成）
function getCorsHeaders(event) {
  const allowedOrigins = [
    'https://eu-harmonized-standards.netlify.app',
    'https://your-custom-domain.com',
    ...(process.env.NODE_ENV === 'development' ? ['http://localhost:8888', 'http://localhost:3000'] : [])
  ];

  const origin = event.headers.origin || event.headers.Origin;
  const allowOrigin = allowedOrigins.includes(origin) ? origin : allowedOrigins[0];

  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24時間
    'Vary': 'Origin'
  };
}

module.exports = { getCorsHeaders };
```

**netlify.toml更新**:
```toml
[[headers]]
  for = "/.netlify/functions/*"
  [headers.values]
    Access-Control-Allow-Origin = "https://eu-harmonized-standards.netlify.app"
    Access-Control-Allow-Methods = "GET, POST, OPTIONS"
    Access-Control-Allow-Headers = "Content-Type"
    X-Content-Type-Options = "nosniff"
    X-Frame-Options = "DENY"
    X-XSS-Protection = "1; mode=block"
    Referrer-Policy = "strict-origin-when-cross-origin"
    Content-Security-Policy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://ec.europa.eu https://eur-lex.europa.eu https://etsi.org https://standards.cencenelec.eu"
```

**実装タスク**:
- [ ] CORS設定ユーティリティを作成
- [ ] 全Netlify FunctionsでCORS設定を更新
- [ ] `netlify.toml`にセキュリティヘッダーを追加
- [ ] 本番ドメインを環境変数で管理

**成果物**:
- CORS設定モジュール
- 更新された`netlify.toml`
- セキュリティヘッダー設定

---

### 1.5 レート制限の実装
**優先度**: 🔴 高

**現状の問題**:
- API呼び出しにレート制限がない
- DoS攻撃のリスク

**対応策**:

```javascript
// netlify/functions/utils/rate-limiter.js（新規作成）
const rateLimit = new Map();

function checkRateLimit(identifier, maxRequests = 100, windowMs = 60000) {
  const now = Date.now();
  const userRequests = rateLimit.get(identifier) || [];
  
  // 古いリクエストを削除
  const recentRequests = userRequests.filter(time => now - time < windowMs);
  
  if (recentRequests.length >= maxRequests) {
    return {
      allowed: false,
      retryAfter: Math.ceil((recentRequests[0] + windowMs - now) / 1000)
    };
  }
  
  recentRequests.push(now);
  rateLimit.set(identifier, recentRequests);
  
  return {
    allowed: true,
    remaining: maxRequests - recentRequests.length
  };
}

function getRateLimitHeaders(result) {
  return {
    'X-RateLimit-Limit': '100',
    'X-RateLimit-Remaining': result.remaining?.toString() || '0',
    ...(result.retryAfter ? { 'Retry-After': result.retryAfter.toString() } : {})
  };
}

module.exports = { checkRateLimit, getRateLimitHeaders };
```

**実装タスク**:
- [ ] レート制限ユーティリティを作成
- [ ] 全Netlify Functionsにレート制限を追加
- [ ] IPアドレスベースの識別を実装
- [ ] レート制限超過時の適切なレスポンスを返す

**成果物**:
- レート制限モジュール
- 更新されたNetlify Functions
- レート制限ドキュメント

---

## フェーズ2: コード品質向上（2-3週間）

### 2.1 ファイルシステムアクセスの安全化
**優先度**: 🟡 中

**対応策**:
- パストラバーサル攻撃対策
- ファイルパスの検証
- 許可されたディレクトリのみアクセス

### 2.2 外部API呼び出しの改善
**優先度**: 🟡 中

**対応策**:
- タイムアウト設定の統一
- リトライロジックの実装
- サーキットブレーカーパターンの導入

### 2.3 キャッシュ戦略の最適化
**優先度**: 🟡 中

**対応策**:
- キャッシュの有効期限管理
- キャッシュ無効化メカニズム
- メモリ使用量の最適化

### 2.4 環境変数管理の改善
**優先度**: 🟡 中

**対応策**:
- `.env.example`ファイルの作成
- 環境変数のドキュメント化
- Netlify環境変数の設定ガイド

---

## フェーズ3: パフォーマンス最適化（1-2週間）

### 3.1 ログ出力の最適化
**優先度**: 🟢 低

**対応策**:
- 環境別ログレベル設定
- 構造化ログの導入
- ログローテーション

### 3.2 フロントエンド最適化
**優先度**: 🟢 低

**対応策**:
- コード分割
- 遅延読み込み
- キャッシュ戦略

### 3.3 バンドルサイズの削減
**優先度**: 🟢 低

**対応策**:
- 未使用コードの削除
- Tree shakingの最適化
- 依存関係の見直し

---

## フェーズ4: テストとドキュメント（2-3週間）

### 4.1 テストの追加
**優先度**: 🟡 中

**対応策**:
- ユニットテスト（Jest）
- 統合テスト
- E2Eテスト（Playwright/Cypress）
- セキュリティテスト

### 4.2 ドキュメントの充実
**優先度**: 🟡 中

**対応策**:
- セキュリティポリシーの作成
- API仕様書の更新
- デプロイメントガイド
- トラブルシューティングガイド

---

## 実装優先順位

### 即座に対応（今週中）
1. ✅ 依存関係の脆弱性スキャンと修正
2. ✅ CORS設定の厳格化
3. ✅ エラーメッセージの情報漏洩対策

### 短期対応（2週間以内）
4. ✅ 入力検証の強化
5. ✅ レート制限の実装
6. ✅ ファイルシステムアクセスの安全化

### 中期対応（1ヶ月以内）
7. ✅ 外部API呼び出しの改善
8. ✅ キャッシュ戦略の最適化
9. ✅ テストの追加

### 長期対応（2ヶ月以内）
10. ✅ パフォーマンス最適化
11. ✅ ドキュメントの充実
12. ✅ CI/CDパイプラインの強化

---

## 成功指標

### セキュリティ
- [ ] 脆弱性スキャンで重大な問題ゼロ
- [ ] OWASP Top 10対策完了
- [ ] セキュリティヘッダースコア A+

### パフォーマンス
- [ ] Lighthouse スコア 90+
- [ ] API レスポンスタイム < 500ms
- [ ] バンドルサイズ < 200KB

### コード品質
- [ ] テストカバレッジ > 80%
- [ ] ESLint エラーゼロ
- [ ] TypeScript移行（オプション）

---

## 次のステップ

1. このドキュメントをレビュー
2. 優先順位を確認
3. フェーズ1のタスクから着手
4. 週次で進捗確認
5. 必要に応じて計画を調整

---

## 参考資料

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Netlify Security Best Practices](https://docs.netlify.com/security/secure-access-to-sites/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
