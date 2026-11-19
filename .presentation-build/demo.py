import sys, pathlib, sqlite3, re
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parents[1]))
from src.app import create_app
from werkzeug.security import generate_password_hash
root=pathlib.Path(__file__).resolve().parent
db=root/'demo.sqlite3'
app=create_app({'TESTING':True,'SECRET_KEY':'presentation-demo-only','DATABASE':str(db),'WTF_CSRF_ENABLED':False})
with app.app_context():
 from src.app import get_db
 c=get_db(); c.executescript((root.parent/'src/schema.sql').read_text(encoding='utf8'))
 c.execute('INSERT OR IGNORE INTO users(id,username,password_hash) VALUES (1,?,?)',('demo@example.com',generate_password_hash('presentation-demo-password')))
 c.execute('DELETE FROM transactions'); c.execute('DELETE FROM monthly_spending_goals')
 rows=[('income',60000,'part_time','アルバイト','2026-11-01'),('expense',18000,'food','食料品','2026-11-05'),('expense',6000,'dining','友人との外食','2026-11-06'),('expense',6000,'transport','通学','2026-11-07'),('expense',5000,'books','参考書','2026-11-08'),('expense',3000,'hobbies','趣味','2026-11-09'),('expense',2000,'other_expense','その他','2026-11-10'),('income',60000,'part_time','アルバイト','2026-10-01'),('expense',25000,'food','食料品','2026-10-05'),('expense',15000,'dining','外食','2026-10-08'),('expense',10000,'transport','交通費','2026-10-10')]
 c.executemany('INSERT INTO transactions(user_id,kind,amount,category,description,date) VALUES (1,?,?,?,?,?)',rows)
 c.execute('INSERT INTO monthly_spending_goals(user_id,month,amount) VALUES (1,?,?)',('2026-11',50000)); c.commit()
client=app.test_client(); client.post('/login',data={'username':'demo@example.com','password':'presentation-demo-password'})
for name,url in [('dashboard','/dashboard?month=2026-11'),('input','/dashboard?month=2026-11&add=1'),('goal','/goals?month=2026-11')]:
 html=client.get(url).get_data(as_text=True)
 def inline(m):
  f=root.parent/'src/static'/m.group(1)
  return '<style>'+f.read_text(encoding='utf8')+'</style>'
 html=re.sub(r'<link[^>]+href="/static/([^"]+)"[^>]*>',inline,html)
 html=re.sub(r'<script[^>]*src="[^"]+"[^>]*></script>','',html)
 (root/(name+'.html')).write_text(html,encoding='utf8')
print('Demo pages prepared with fictional data')
