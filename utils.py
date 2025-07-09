"""
Utility functions for EU Harmonized Standards Checker System
"""

import re
import os
import json
import logging
import hashlib
from datetime import datetime, timedelta
from typing import List, Dict, Optional, Any
from urllib.parse import urlencode, urlparse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from config import HTTP_CONFIG, CACHE_CONFIG, LOGGING_CONFIG


def setup_logging() -> logging.Logger:
    """ロギングの設定"""
    logging.basicConfig(
        level=getattr(logging, LOGGING_CONFIG['level']),
        format=LOGGING_CONFIG['format'],
        handlers=[
            logging.FileHandler(LOGGING_CONFIG['file']),
            logging.StreamHandler()
        ]
    )
    return logging.getLogger(__name__)


def create_http_session() -> requests.Session:
    """HTTPセッションの作成（リトライ機能付き）"""
    session = requests.Session()
    session.headers.update(HTTP_CONFIG['headers'])
    
    # リトライ戦略の設定
    retry_strategy = Retry(
        total=HTTP_CONFIG['retry_attempts'],
        backoff_factor=HTTP_CONFIG['retry_delay'],
        status_forcelist=[429, 500, 502, 503, 504]
    )
    
    adapter = HTTPAdapter(max_retries=retry_strategy)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    
    return session


def normalize_standard_number(standard_number: str) -> str:
    """規格番号を正規化"""
    if not standard_number:
        return ""
    
    # 基本的な正規化
    normalized = standard_number.strip()
    normalized = re.sub(r'\s+', ' ', normalized)  # 複数のスペースを1つに
    normalized = re.sub(r'[^\w\s\-.:/()\[\]]', '', normalized)  # 不要文字除去
    
    return normalized


def extract_version_from_standard(standard_text: str) -> tuple:
    """規格テキストから番号とバージョンを分離"""
    # バージョンパターン（V1.2.3, v1.2.3, (2020), :2020など）
    version_patterns = [
        r'V(\d+\.\d+\.\d+)',
        r'v(\d+\.\d+\.\d+)',
        r'\((\d{4})\)',
        r':(\d{4})',
        r'-(\d{4})'
    ]
    
    for pattern in version_patterns:
        match = re.search(pattern, standard_text)
        if match:
            version = match.group(1)
            number = re.sub(pattern, '', standard_text).strip()
            return normalize_standard_number(number), f"V{version}"
    
    return normalize_standard_number(standard_text), ""


def create_etsi_search_url(standard_number: str, base_url: str, params: Dict[str, str]) -> str:
    """ETSIポータル検索URLを生成"""
    # "EN 301 489-17" → "301 489-17"
    etsi_number = standard_number.replace("EN ", "").replace("ETSI ", "")
    etsi_number = etsi_number.replace("ETSI EN ", "")
    
    # パラメータを設定
    search_params = params.copy()
    search_params['qETSI_NUMBER'] = etsi_number
    
    return f"{base_url}?{urlencode(search_params)}"


def parse_date_string(date_str: str) -> Optional[datetime]:
    """日付文字列を解析"""
    if not date_str:
        return None
    
    # 一般的な日付形式のパターン
    date_patterns = [
        r'(\d{4})-(\d{2})-(\d{2})',  # 2025-01-28
        r'(\d{2})/(\d{2})/(\d{4})',  # 01/28/2025
        r'(\d{1,2})\s+(\w+)\s+(\d{4})',  # 28 January 2025
        r'(\w+)\s+(\d{1,2}),?\s+(\d{4})'  # January 28, 2025
    ]
    
    for pattern in date_patterns:
        match = re.search(pattern, date_str)
        if match:
            try:
                # 簡単な実装（実際の実装時により詳細化）
                return datetime.now()
            except Exception:
                continue
    
    return None


def calculate_similarity(str1: str, str2: str) -> float:
    """2つの文字列の類似度を計算（簡易版）"""
    str1 = normalize_standard_number(str1).lower()
    str2 = normalize_standard_number(str2).lower()
    
    if str1 == str2:
        return 1.0
    
    # 単純な文字の一致率
    common_chars = set(str1) & set(str2)
    total_chars = set(str1) | set(str2)
    
    if not total_chars:
        return 0.0
    
    return len(common_chars) / len(total_chars)


def create_cache_key(prefix: str, *args) -> str:
    """キャッシュキーを生成"""
    key_string = f"{prefix}:{':'.join(str(arg) for arg in args)}"
    return hashlib.md5(key_string.encode()).hexdigest()


def ensure_cache_dir():
    """キャッシュディレクトリの確保"""
    if CACHE_CONFIG['enabled']:
        os.makedirs(CACHE_CONFIG['cache_dir'], exist_ok=True)


def save_to_cache(key: str, data: Any, duration: int = None):
    """データをキャッシュに保存"""
    if not CACHE_CONFIG['enabled']:
        return
    
    ensure_cache_dir()
    
    duration = duration or CACHE_CONFIG['cache_duration']
    expires_at = datetime.now() + timedelta(seconds=duration)
    
    # データをシリアライズ可能な形式に変換
    try:
        serializable_data = _make_serializable(data)
        
        cache_data = {
            'data': serializable_data,
            'timestamp': datetime.now().isoformat(),
            'expires_at': expires_at.isoformat()
        }
        
        cache_file = os.path.join(CACHE_CONFIG['cache_dir'], f"{key}.json")
        
        with open(cache_file, 'w', encoding='utf-8') as f:
            json.dump(cache_data, f, ensure_ascii=False, indent=2)
            
    except Exception as e:
        logging.warning(f"Failed to save cache: {e}")


def _make_serializable(obj):
    """オブジェクトをJSON serializable形式に変換"""
    if hasattr(obj, '__dict__'):
        # dataclassやカスタムオブジェクトの場合
        if isinstance(obj, list):
            return [_make_serializable(item) for item in obj]
        else:
            result = {}
            for key, value in obj.__dict__.items():
                result[key] = _make_serializable(value)
            result['_class_name'] = obj.__class__.__name__
            return result
    elif isinstance(obj, list):
        return [_make_serializable(item) for item in obj]
    elif isinstance(obj, dict):
        return {key: _make_serializable(value) for key, value in obj.items()}
    else:
        return obj


def load_from_cache(key: str) -> Optional[Any]:
    """キャッシュからデータを読み込み"""
    if not CACHE_CONFIG['enabled']:
        return None
    
    cache_file = os.path.join(CACHE_CONFIG['cache_dir'], f"{key}.json")
    
    if not os.path.exists(cache_file):
        return None
    
    try:
        with open(cache_file, 'r', encoding='utf-8') as f:
            cache_data = json.load(f)
        
        expires_at = datetime.fromisoformat(cache_data['expires_at'])
        if datetime.now() > expires_at:
            # 期限切れのキャッシュを削除
            os.remove(cache_file)
            return None
        
        # シリアライズされたデータを元のオブジェクトに復元
        return _deserialize_from_cache(cache_data['data'])
    
    except Exception as e:
        logging.warning(f"Failed to load cache: {e}")
        return None


def _deserialize_from_cache(data):
    """キャッシュからデータを復元"""
    if isinstance(data, dict) and '_class_name' in data:
        # カスタムオブジェクトの復元
        class_name = data.pop('_class_name')
        
        # Standard, TestStandard, AccreditationScopeなど対応
        if class_name == 'Standard':
            from data_models import Standard
            return Standard(**data)
        elif class_name == 'TestStandard':
            from data_models import TestStandard  
            return TestStandard(**data)
        elif class_name == 'AccreditationScope':
            from data_models import AccreditationScope, CertificateInfo
            # ネストしたオブジェクトも復元
            cert_info = CertificateInfo(**data['certificate_info'])
            test_standards = [TestStandard(**std) for std in data['test_standards']]
            return AccreditationScope(
                certificate_info=cert_info,
                test_standards=test_standards,
                extraction_date=data['extraction_date'],
                pdf_source=data['pdf_source']
            )
        else:
            # 不明なクラスの場合は辞書として返す
            return data
    elif isinstance(data, list):
        return [_deserialize_from_cache(item) for item in data]
    elif isinstance(data, dict):
        return {key: _deserialize_from_cache(value) for key, value in data.items()}
    else:
        return data


def clean_html_text(html_text: str) -> str:
    """HTMLテキストをクリーンアップ"""
    if not html_text:
        return ""
    
    # HTMLタグを除去
    clean_text = re.sub(r'<[^>]+>', '', html_text)
    
    # 特殊文字を正規化
    clean_text = clean_text.replace('&nbsp;', ' ')
    clean_text = clean_text.replace('&amp;', '&')
    clean_text = clean_text.replace('&lt;', '<')
    clean_text = clean_text.replace('&gt;', '>')
    clean_text = clean_text.replace('&quot;', '"')
    
    # 余分なスペースを除去
    clean_text = re.sub(r'\s+', ' ', clean_text)
    
    return clean_text.strip()


def format_standards_list(standards: List[Any], format_type: str = 'simple') -> str:
    """規格リストをフォーマット"""
    if not standards:
        return "No standards found."
    
    if format_type == 'simple':
        return '\n'.join(f"- {std.number} {std.version}" for std in standards)
    
    elif format_type == 'detailed':
        result = []
        for std in standards:
            result.append(f"- {std.number} {std.version}")
            if hasattr(std, 'title') and std.title:
                result.append(f"  Title: {std.title}")
            if hasattr(std, 'status') and std.status:
                result.append(f"  Status: {std.status}")
            result.append("")
        return '\n'.join(result)
    
    return str(standards)


def validate_url(url: str) -> bool:
    """URLの有効性を確認"""
    try:
        parsed = urlparse(url)
        return all([parsed.scheme, parsed.netloc])
    except Exception:
        return False


def safe_filename(filename: str) -> str:
    """ファイル名として安全な文字列に変換"""
    # 危険な文字を除去
    safe_chars = re.sub(r'[<>:"/\\|?*]', '_', filename)
    
    # 長すぎる場合は切り詰め
    if len(safe_chars) > 200:
        safe_chars = safe_chars[:200]
    
    return safe_chars


def get_file_hash(file_path: str) -> str:
    """ファイルのハッシュ値を取得"""
    try:
        with open(file_path, 'rb') as f:
            return hashlib.md5(f.read()).hexdigest()
    except Exception:
        return ""


def retry_on_failure(max_attempts: int = 3, delay: int = 1):
    """失敗時リトライデコレータ"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(max_attempts):
                try:
                    return func(*args, **kwargs)
                except Exception as e:
                    last_exception = e
                    if attempt < max_attempts - 1:
                        import time
                        time.sleep(delay)
                    continue
            raise last_exception
        return wrapper
    return decorator