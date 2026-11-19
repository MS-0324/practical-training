import sqlite3
import unittest
from datetime import date
from pathlib import Path

from src.analysis import monthly_expense_reports
from src.categories import CATEGORIES


class MonthlyExpenseReportsTest(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:')
        self.addCleanup(self.db.close)
        self.db.row_factory = sqlite3.Row
        schema = Path(__file__).resolve().parents[1] / 'src' / 'schema.sql'
        self.db.executescript(schema.read_text(encoding='utf-8'))
        self.db.executemany('INSERT INTO users VALUES (?, ?, ?)',
                            [(1, 'alice', 'unused'), (2, 'bob', 'unused')])

    def add(self, day, category, amount, kind='expense', user_id=1):
        self.db.execute(
            'INSERT INTO transactions (user_id, kind, category, amount, date, description) '
            'VALUES (?, ?, ?, ?, ?, ?)',
            (user_id, kind, category, amount, day, 'test record'),
        )

    def test_months_totals_percentages_and_owner_isolation(self):
        self.add('2025-11-10', 'food', 100)
        self.add('2026-11-01', 'food', 300)
        self.add('2026-11-18', 'food', 450)
        self.add('2026-11-20', 'transport', 250)
        self.add('2026-11-20', 'salary', 100000, kind='income')
        self.add('2026-11-20', 'rent', 999999, user_id=2)
        self.add('2027-01-01', 'rent', 50000, user_id=2)
        reports = monthly_expense_reports(self.db, 1)
        self.assertEqual([r['month'] for r in reports], ['2026-11', '2025-11'])
        report = reports[0]
        self.assertEqual((report['total'], report['count']), (1000, 3))
        self.assertEqual([(c['key'], c['amount'], c['percentage']) for c in report['categories']],
                         [('food', 750, 75), ('transport', 250, 25)])
        self.assertEqual(report['top_categories'][0]['key'], 'food')
        self.assertIsNone(report['change'])  # Previous year is not the preceding month.
        self.assertIn('75.000000% 100.000000%', report['gradient'])

    def test_previous_calendar_month_across_year_and_missing_month(self):
        self.add('2025-12-01', 'food', 400)
        self.add('2026-01-01', 'food', 600)
        self.add('2026-02-01', 'food', 300)
        self.add('2026-04-01', 'food', 100)
        reports = {r['month']: r for r in monthly_expense_reports(self.db, 1)}
        self.assertEqual(reports['2026-01']['previous_month'], '2025-12')
        self.assertEqual(reports['2026-01']['change'], 200)
        self.assertEqual(reports['2026-01']['change_percent'], 50)
        self.assertEqual(reports['2026-02']['change'], -300)
        self.assertEqual(reports['2026-02']['change_percent'], 50)
        self.assertIsNone(reports['2026-04']['change'])

    def test_empty_and_income_only_months_and_zero_previous_total(self):
        self.assertEqual(monthly_expense_reports(self.db, 1), [])
        self.add('2026-09-01', 'food', 500)
        self.add('2026-10-01', 'salary', 100000, kind='income')
        self.add('2026-11-01', 'food', 1900)
        november, october, _ = monthly_expense_reports(self.db, 1, today=date(2026, 11, 19))
        self.assertEqual((november['elapsed_days'], november['daily_average']), (19, 100))
        self.assertEqual((october['total'], october['count'], october['daily_average']), (0, 0, 0))
        self.assertEqual(october['elapsed_days'], 31)
        self.assertEqual(october['categories'], [])
        self.assertEqual(october['top_categories'], [])
        self.assertIsNone(october['gradient'])
        self.assertEqual((october['change'], october['change_percent']), (-500, 100))
        self.assertEqual(november['previous_total'], 0)
        self.assertEqual(november['change'], 1900)
        self.assertIsNone(november['change_percent'])

    def test_legacy_single_category_and_very_small_share(self):
        self.add('2026-10-01', 'uncategorized', 1)
        self.add('2026-11-01', 'uncategorized', 1)
        self.add('2026-11-01', 'rent', 1000000000)
        november, october = monthly_expense_reports(self.db, 1)
        self.assertEqual(october['categories'][0]['label'], '未分類')
        self.assertEqual(october['categories'][0]['percentage_label'], '100.0')
        self.assertIn('0.000000% 100.000000%', october['gradient'])
        self.assertEqual(november['categories'][1]['percentage_label'], '<0.1')
        self.assertEqual(november['total'], 1000000001)

    def test_all_categories_tied_and_colors_stable_between_months(self):
        expense_keys = [key for key, kind, _, _ in CATEGORIES if kind == 'expense']
        for key in expense_keys:
            self.add('2026-11-01', key, 100)
        self.add('2026-10-01', 'food', 1000)
        self.add('2026-10-01', 'transport', 5000)
        november, october = monthly_expense_reports(self.db, 1)
        self.assertEqual(len(november['categories']), 22)
        self.assertEqual(len(november['top_categories']), 22)
        self.assertEqual(november['total'], 2200)
        self.assertAlmostEqual(sum(c['percentage'] for c in november['categories']), 100)
        colors = {c['key']: c['color'] for c in november['categories']}
        self.assertEqual(len(set(colors.values())), 22)
        for category in october['categories']:
            self.assertEqual(category['color'], colors[category['key']])


if __name__ == '__main__':
    unittest.main()
