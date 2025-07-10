"""
Data models for EU Harmonized Standards Checker System
"""

from dataclasses import dataclass
from typing import List, Optional, Dict, Any
from datetime import datetime


@dataclass
class Standard:
    """Harmonized Standard from Official Journal"""
    number: str          # 例: "EN 301 489-17"
    version: str         # 例: "V3.3.1"
    directive: str       # 例: "RE"
    title: str           # 規格タイトル
    status: str          # Active/Withdrawn/Superseded
    publication_date: str # 最初の公開日
    amendment_date: str  # 最新Amendment日付
    withdrawal_date: str = ""  # 失効日付（該当する場合）
    superseded_by: str = ""    # 後継規格番号（該当する場合）
    oj_reference: str = ""     # OJ参照番号（例: "OJ L 289, 10.11.2022"）
    
    def __post_init__(self):
        # 規格番号の正規化
        self.number = self.normalize_standard_number(self.number)
    
    @staticmethod
    def normalize_standard_number(number: str) -> str:
        """規格番号を正規化"""
        # スペースを統一し、余分な文字を除去
        normalized = number.strip().replace('  ', ' ')
        return normalized


@dataclass
class TestStandard:
    """Test Standard from ISO17025 Certificate"""
    standard_number: str     # 例: "EN 301 489-17"
    version: str            # 例: "V3.3.1" (抽出可能な場合)
    category: str           # 例: "European Radio", "Immunity"
    description: str        # 規格の説明
    source: str            # 認証書のソース
    
    def __post_init__(self):
        # 規格番号の正規化
        self.standard_number = Standard.normalize_standard_number(self.standard_number)


@dataclass
class CertificateInfo:
    """ISO17025 Certificate Information"""
    certificate_number: str
    valid_until: str
    organization: str
    accreditation_body: str  # A2LA、JAB等
    revision_date: str
    contact_info: Optional[Dict[str, str]] = None
    
    def is_valid(self) -> bool:
        """証明書が有効かどうかを確認"""
        try:
            # 簡易的な有効期限チェック
            if self.valid_until:
                # 日付形式の解析は実装時に詳細化
                return True
            return False
        except Exception:
            return False


@dataclass
class AccreditationScope:
    """Complete Accreditation Scope from ISO17025 Certificate"""
    certificate_info: CertificateInfo
    test_standards: List[TestStandard]
    extraction_date: str
    pdf_source: str
    
    def get_standards_by_category(self, category: str) -> List[TestStandard]:
        """カテゴリ別の規格を取得"""
        return [std for std in self.test_standards if std.category == category]
    
    def get_unique_standard_numbers(self) -> List[str]:
        """重複を除いた規格番号リストを取得"""
        return list(set(std.standard_number for std in self.test_standards))


@dataclass
class ComparisonResult:
    """Standards Comparison Result"""
    matched_standards: List[tuple]  # (Standard, TestStandard)のペア
    oj_only_standards: List[Standard]
    iso_only_standards: List[TestStandard]
    coverage_percentage: float
    comparison_date: str
    
    def get_summary(self) -> Dict[str, Any]:
        """比較結果のサマリーを取得"""
        return {
            'total_oj_standards': len(self.oj_only_standards) + len(self.matched_standards),
            'total_iso_standards': len(self.iso_only_standards) + len(self.matched_standards),
            'matched_count': len(self.matched_standards),
            'coverage_percentage': self.coverage_percentage,
            'oj_only_count': len(self.oj_only_standards),
            'iso_only_count': len(self.iso_only_standards)
        }


@dataclass
class SearchResult:
    """ETSI Portal Search Result"""
    standard_number: str
    search_url: str
    timestamp: str
    success: bool
    error_message: Optional[str] = None


@dataclass
class CacheEntry:
    """Cache Entry for Standards Data"""
    key: str
    data: Any
    timestamp: datetime
    expires_at: datetime
    
    def is_expired(self) -> bool:
        """キャッシュが期限切れかどうかを確認"""
        return datetime.now() > self.expires_at


@dataclass
class ProcessingResult:
    """Processing Result with Error Handling"""
    success: bool
    data: Optional[Any] = None
    error_message: Optional[str] = None
    warnings: List[str] = None
    
    def __post_init__(self):
        if self.warnings is None:
            self.warnings = []
    
    def add_warning(self, warning: str):
        """警告を追加"""
        self.warnings.append(warning)
    
    def has_warnings(self) -> bool:
        """警告があるかどうかを確認"""
        return len(self.warnings) > 0