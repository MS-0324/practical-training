"""Monthly expense reports built from the signed-in user's records."""

from .categories import CATEGORIES, CATEGORY_LABELS


# A category keeps the same color even when its rank changes between months.
EXPENSE_COLORS = dict(zip(
    [key for key, kind, icon, label in CATEGORIES if kind == 'expense'],
    ['#60a5fa', '#fb923c', '#c084fc', '#34d399', '#f87171', '#facc15',
     '#22d3ee', '#f472b6', '#a3e635', '#818cf8', '#fdba74', '#2dd4bf',
     '#e879f9', '#fda4af', '#a78bfa', '#38bdf8', '#fbbf24', '#4ade80',
     '#fb7185', '#bef264', '#67e8f9', '#cbd5e1'],
))


def monthly_expense_reports(db, user_id):
    """Return newest-first reports for every month with this user's records.

    Income creates a month entry but is excluded from expense totals and pies.
    Comparisons always refer to the preceding calendar month, even across years.
    """
    rows = db.execute(
        '''SELECT substr(date, 1, 7) AS month, kind, category,
                  SUM(amount) AS amount, COUNT(*) AS count
           FROM transactions
           WHERE user_id = ?
           GROUP BY substr(date, 1, 7), kind, category
           ORDER BY month DESC''',
        (user_id,),
    ).fetchall()

    reports = {}
    for row in rows:
        month = row['month']
        report = reports.setdefault(month, {
            'month': month,
            'label': f'{int(month[:4])}年{int(month[5:])}月',
            'total': 0, 'count': 0, 'categories': [],
        })
        if row['kind'] != 'expense':
            continue
        report['total'] += row['amount']
        report['count'] += row['count']
        report['categories'].append({
            'key': row['category'],
            'label': CATEGORY_LABELS.get(row['category'], '未分類'),
            'amount': row['amount'],
            'color': EXPENSE_COLORS.get(row['category'], '#94a3b8'),
        })

    for month, report in reports.items():
        categories = sorted(report['categories'], key=lambda item: (-item['amount'], item['key']))
        report['categories'] = categories
        stops = []
        separators = []
        cumulative = 0
        for category in categories:
            percentage = category['amount'] / report['total'] * 100
            category['percentage'] = percentage
            category['percentage_label'] = '<0.1' if percentage < 0.1 else f'{percentage:.1f}'
            start = cumulative / report['total'] * 100
            cumulative += category['amount']
            end = cumulative / report['total'] * 100
            stops.append(f"{category['color']} {start:.6f}% {end:.6f}%")
            # Thin white boundaries; shrink them for tiny slices so the color
            # remains visible. The underlying category angles stay unchanged.
            gap = min(0.2, percentage * 0.1)
            separators.extend([
                f'#f8fafc {start:.9f}% {start + gap:.9f}%',
                f'transparent {start + gap:.9f}% {end - gap:.9f}%',
                f'#f8fafc {end - gap:.9f}% {end:.9f}%',
            ])
        report['gradient'] = f"conic-gradient({', '.join(stops)})" if stops else None
        report['separator_gradient'] = (
            f"conic-gradient({', '.join(separators)})" if len(categories) > 1 else 'none'
        )
        report['average'] = round(report['total'] / report['count']) if report['count'] else 0
        report['top_categories'] = [item for item in categories if item['amount'] == categories[0]['amount']] if categories else []

        year, month_number = map(int, month.split('-'))
        previous_month = f'{year - 1:04d}-12' if month_number == 1 else f'{year:04d}-{month_number - 1:02d}'
        previous = reports.get(previous_month)
        previous_total = previous['total'] if previous else None
        report['previous_month'] = previous_month
        report['previous_total'] = previous_total
        # A recorded zero allows a yen comparison, but not a percentage change.
        # An unrecorded month is unknown, not evidence of zero spending.
        report['change'] = report['total'] - previous_total if previous_total is not None else None
        report['change_percent'] = abs(report['change']) / previous_total * 100 if previous_total else None

    return list(reports.values())
