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
    date TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS transactions_owner_date ON transactions(user_id, date);
