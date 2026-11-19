CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY,
    username TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS transactions (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK(kind IN ('income', 'expense')),
    amount INTEGER NOT NULL CHECK(amount > 0 AND amount <= 1000000000),
    description TEXT NOT NULL CHECK(length(description) BETWEEN 1 AND 200),
    category TEXT NOT NULL DEFAULT 'uncategorized',
    date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_owner_date ON transactions(user_id, date);
CREATE TABLE IF NOT EXISTS custom_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id),
    kind TEXT NOT NULL CHECK(kind IN ('income', 'expense')),
    name TEXT NOT NULL CHECK(length(name) BETWEEN 1 AND 30),
    normalized_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1 CHECK(is_active IN (0, 1)),
    UNIQUE(user_id, kind, normalized_name)
);
<<<<<<< HEAD
CREATE TABLE IF NOT EXISTS receipt_imports (
    token TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
=======
>>>>>>> 849e15a8137cda9bd9bd59063b804bbdd1f7fb57
CREATE TABLE IF NOT EXISTS monthly_spending_goals (
    id INTEGER PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    month TEXT NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0 AND amount <= 1000000000),
    UNIQUE(user_id, month)
);
