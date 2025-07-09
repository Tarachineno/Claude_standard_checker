"""
Standards Comparator Module - Compare OJ and ISO17025 Standards
"""

import re
import logging
from typing import List, Dict, Tuple, Optional
from datetime import datetime

from data_models import Standard, TestStandard, ComparisonResult, ProcessingResult
from utils import (
    setup_logging, normalize_standard_number, calculate_similarity,
    extract_version_from_standard
)


class StandardComparator:
    """Standards Comparison Engine"""
    
    def __init__(self, similarity_threshold: float = 0.8):
        self.logger = setup_logging()
        self.similarity_threshold = similarity_threshold
        
    def compare_standards(self, oj_standards: List[Standard], 
                         iso_standards: List[TestStandard]) -> ComparisonResult:
        """規格を比較してマッチング結果を返す"""
        try:
            self.logger.info(f"Comparing {len(oj_standards)} OJ standards with {len(iso_standards)} ISO standards")
            
            matched_standards = []
            oj_unmatched = oj_standards.copy()
            iso_unmatched = iso_standards.copy()
            
            # マッチング処理
            for oj_std in oj_standards:
                best_match = None
                best_score = 0
                
                for iso_std in iso_standards:
                    score = self._calculate_match_score(oj_std, iso_std)
                    if score > best_score and score >= self.similarity_threshold:
                        best_score = score
                        best_match = iso_std
                
                if best_match:
                    matched_standards.append((oj_std, best_match))
                    if oj_std in oj_unmatched:
                        oj_unmatched.remove(oj_std)
                    if best_match in iso_unmatched:
                        iso_unmatched.remove(best_match)
            
            # カバレッジ計算
            coverage_percentage = self._calculate_coverage(
                len(matched_standards), len(oj_standards)
            )
            
            result = ComparisonResult(
                matched_standards=matched_standards,
                oj_only_standards=oj_unmatched,
                iso_only_standards=iso_unmatched,
                coverage_percentage=coverage_percentage,
                comparison_date=datetime.now().isoformat()
            )
            
            self.logger.info(f"Comparison completed: {len(matched_standards)} matches, {coverage_percentage:.1f}% coverage")
            
            return result
            
        except Exception as e:
            self.logger.error(f"Error in standards comparison: {str(e)}")
            raise
    
    def _calculate_match_score(self, oj_std: Standard, iso_std: TestStandard) -> float:
        """2つの規格の一致度を計算"""
        # 規格番号の正規化
        oj_number = self.normalize_standard_number(oj_std.number)
        iso_number = self.normalize_standard_number(iso_std.standard_number)
        
        # 完全一致
        if oj_number == iso_number:
            return 1.0
        
        # 部分一致スコア
        similarity_score = calculate_similarity(oj_number, iso_number)
        
        # 追加の一致要素
        bonus_score = 0
        
        # バージョン情報の一致
        if oj_std.version and iso_std.version:
            if oj_std.version == iso_std.version:
                bonus_score += 0.1
        
        # タイトル/説明の一致
        if oj_std.title and iso_std.description:
            title_similarity = calculate_similarity(oj_std.title, iso_std.description)
            bonus_score += title_similarity * 0.2
        
        # 最終スコア
        final_score = min(1.0, similarity_score + bonus_score)
        
        return final_score
    
    def normalize_standard_number(self, standard: str) -> str:
        """規格番号を正規化してマッチングしやすくする"""
        if not standard:
            return ""
        
        # 基本的な正規化
        normalized = normalize_standard_number(standard)
        
        # 追加の正規化
        normalized = normalized.upper()
        
        # 組織名プレフィックスの統一
        normalized = re.sub(r'^ETSI\\s+EN\\s+', 'EN ', normalized)
        normalized = re.sub(r'^ETSI\\s+', '', normalized)
        
        # スペースとハイフンの統一
        normalized = re.sub(r'\\s+', ' ', normalized)
        normalized = re.sub(r'\\s*-\\s*', '-', normalized)
        
        return normalized.strip()
    
    def _calculate_coverage(self, matched_count: int, total_count: int) -> float:
        """カバレッジ率を計算"""
        if total_count == 0:
            return 0.0
        return (matched_count / total_count) * 100
    
    def generate_comparison_report(self, comparison: ComparisonResult) -> str:
        """比較結果のレポートを生成"""
        report = []
        
        # ヘッダー
        report.append("=" * 60)
        report.append("STANDARDS COMPARISON REPORT")
        report.append("=" * 60)
        report.append(f"Comparison Date: {comparison.comparison_date}")
        report.append("")
        
        # サマリー
        summary = comparison.get_summary()
        report.append("SUMMARY:")
        report.append(f"  Total OJ Standards: {summary['total_oj_standards']}")
        report.append(f"  Total ISO17025 Standards: {summary['total_iso_standards']}")
        report.append(f"  Matched Standards: {summary['matched_count']}")
        report.append(f"  Coverage: {summary['coverage_percentage']:.1f}%")
        report.append(f"  OJ Only: {summary['oj_only_count']}")
        report.append(f"  ISO Only: {summary['iso_only_count']}")
        report.append("")
        
        # マッチした規格
        if comparison.matched_standards:
            report.append("MATCHED STANDARDS:")
            report.append("-" * 40)
            for oj_std, iso_std in comparison.matched_standards:
                oj_version = f" {oj_std.version}" if oj_std.version else ""
                iso_version = f" {iso_std.version}" if iso_std.version else ""
                report.append(f"✓ {oj_std.number}{oj_version}")
                report.append(f"  ISO17025: {iso_std.standard_number}{iso_version}")
                report.append(f"  Category: {iso_std.category}")
                if iso_std.description:
                    report.append(f"  Description: {iso_std.description}")
                report.append("")
        
        # OJのみの規格
        if comparison.oj_only_standards:
            report.append("OJ ONLY STANDARDS:")
            report.append("-" * 40)
            for std in comparison.oj_only_standards:
                version = f" {std.version}" if std.version else ""
                title = f" - {std.title}" if std.title else ""
                report.append(f"• {std.number}{version}{title}")
            report.append("")
        
        # ISO17025のみの規格
        if comparison.iso_only_standards:
            report.append("ISO17025 ONLY STANDARDS:")
            report.append("-" * 40)
            for std in comparison.iso_only_standards:
                version = f" {std.version}" if std.version else ""
                desc = f" - {std.description}" if std.description else ""
                report.append(f"• {std.standard_number}{version}{desc}")
                report.append(f"  Category: {std.category}")
            report.append("")
        
        return "\\n".join(report)
    
    def find_potential_matches(self, oj_standards: List[Standard], 
                              iso_standards: List[TestStandard],
                              threshold: float = 0.5) -> List[Tuple[Standard, TestStandard, float]]:
        """潜在的なマッチを検出（低い閾値で）"""
        potential_matches = []
        
        for oj_std in oj_standards:
            for iso_std in iso_standards:
                score = self._calculate_match_score(oj_std, iso_std)
                if score >= threshold:
                    potential_matches.append((oj_std, iso_std, score))
        
        # スコア順にソート
        potential_matches.sort(key=lambda x: x[2], reverse=True)
        
        return potential_matches
    
    def analyze_coverage_gaps(self, comparison: ComparisonResult) -> Dict[str, List[str]]:
        """カバレッジのギャップを分析"""
        gaps = {
            'missing_in_iso': [],
            'missing_in_oj': [],
            'suggestions': []
        }
        
        # ISO17025でカバーされていない規格
        for std in comparison.oj_only_standards:
            gaps['missing_in_iso'].append(std.number)
        
        # OJでカバーされていない規格
        for std in comparison.iso_only_standards:
            gaps['missing_in_oj'].append(std.standard_number)
        
        # 改善提案
        if len(gaps['missing_in_iso']) > 0:
            gaps['suggestions'].append(
                f"Consider adding {len(gaps['missing_in_iso'])} OJ standards to ISO17025 scope"
            )
        
        if len(gaps['missing_in_oj']) > 0:
            gaps['suggestions'].append(
                f"Review {len(gaps['missing_in_oj'])} ISO17025 standards not in OJ list"
            )
        
        return gaps
    
    def get_category_analysis(self, comparison: ComparisonResult) -> Dict[str, Dict[str, int]]:
        """カテゴリ別の分析"""
        analysis = {}
        
        # ISO17025規格のカテゴリ分析
        for std in comparison.iso_only_standards:
            category = std.category
            if category not in analysis:
                analysis[category] = {'iso_only': 0, 'matched': 0}
            analysis[category]['iso_only'] += 1
        
        # マッチした規格のカテゴリ分析
        for _, iso_std in comparison.matched_standards:
            category = iso_std.category
            if category not in analysis:
                analysis[category] = {'iso_only': 0, 'matched': 0}
            analysis[category]['matched'] += 1
        
        return analysis
    
    def export_comparison_csv(self, comparison: ComparisonResult, filename: str = None) -> str:
        """比較結果をCSVファイルに出力"""
        if filename is None:
            filename = f"comparison_result_{datetime.now().strftime('%Y%m%d_%H%M%S')}.csv"
        
        import csv
        
        with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.writer(csvfile)
            
            # ヘッダー
            writer.writerow([
                'Match Status', 'OJ Standard', 'OJ Version', 'OJ Title',
                'ISO Standard', 'ISO Version', 'ISO Category', 'ISO Description'
            ])
            
            # マッチした規格
            for oj_std, iso_std in comparison.matched_standards:
                writer.writerow([
                    'Matched', oj_std.number, oj_std.version, oj_std.title,
                    iso_std.standard_number, iso_std.version, iso_std.category, iso_std.description
                ])
            
            # OJのみの規格
            for oj_std in comparison.oj_only_standards:
                writer.writerow([
                    'OJ Only', oj_std.number, oj_std.version, oj_std.title,
                    '', '', '', ''
                ])
            
            # ISO17025のみの規格
            for iso_std in comparison.iso_only_standards:
                writer.writerow([
                    'ISO Only', '', '', '',
                    iso_std.standard_number, iso_std.version, iso_std.category, iso_std.description
                ])
        
        return filename
    
    def batch_compare(self, oj_standards_dict: Dict[str, List[Standard]], 
                     iso_standards: List[TestStandard]) -> Dict[str, ComparisonResult]:
        """複数のDirectiveと一括比較"""
        results = {}
        
        for directive, oj_standards in oj_standards_dict.items():
            try:
                self.logger.info(f"Comparing {directive} directive")
                result = self.compare_standards(oj_standards, iso_standards)
                results[directive] = result
            except Exception as e:
                self.logger.error(f"Error comparing {directive}: {str(e)}")
                # 空の結果を作成
                results[directive] = ComparisonResult(
                    matched_standards=[],
                    oj_only_standards=oj_standards,
                    iso_only_standards=[],
                    coverage_percentage=0.0,
                    comparison_date=datetime.now().isoformat()
                )
        
        return results
    
    def get_best_directive_match(self, iso_standards: List[TestStandard],
                                oj_standards_dict: Dict[str, List[Standard]]) -> str:
        """ISO17025規格に最もマッチするDirectiveを特定"""
        best_directive = None
        best_coverage = 0
        
        for directive, oj_standards in oj_standards_dict.items():
            comparison = self.compare_standards(oj_standards, iso_standards)
            if comparison.coverage_percentage > best_coverage:
                best_coverage = comparison.coverage_percentage
                best_directive = directive
        
        return best_directive or "Unknown"