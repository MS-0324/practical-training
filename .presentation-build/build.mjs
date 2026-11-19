import fs from 'node:fs/promises';
import path from 'node:path';
import {FileBlob,PresentationFile} from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const source='C:/Users/maeya/Downloads/情報システム基礎演習　c班.pptx';
const p=await PresentationFile.importPptx(await FileBlob.load(source));
p.slides.delete(Array.from({length:15},(_,i)=>i+1));
const C={navy:'#163044',teal:'#007F80',muted:'#526775',bg:'#F6F8F7',pale:'#E3F1EE',line:'#CDD8DC',white:'#FFFFFF',orange:'#BD6D32'};
function text(s,t,x,y,w,h,size=22,color=C.navy,bold=false,align='left') {const z=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});z.text=t;z.text.style={fontSize:size,typeface:'Meiryo',color,bold,alignment:align,verticalAlignment:'top',insets:0,autoFit:'none'};return z;}
function box(s,t,x,y,w,h,{size=22,fill=C.pale,color=C.navy,bold=false}={}){const z=s.shapes.add({geometry:'roundRect',position:{left:x,top:y,width:w,height:h},fill,line:{fill:C.line,width:1}});z.text=t;z.text.style={fontSize:size,typeface:'Meiryo',color,bold,alignment:'center',verticalAlignment:'middle',insets:12,autoFit:'none'};return z;}
function arrow(s,x,y,w=38){text(s,'→',x,y,w,42,28,C.teal,true,'center');}
function note(s,t,refs=[]){s.speakerNotes.text=t+'\n\n根拠：現在のローカルリポジトリ（2026-11-19確認）。画面・数値例は架空データ。'+(refs.length?'\n参考資料（2026-11-19確認）\n'+refs.join('\n'):'');}
function slide(title,section='実現したこと') {const s=p.slides.add({layout:'BLANK'});s.background.fill=C.bg;const n=p.slides.items.length;text(s,'情報システム基礎演習 C班  /  '+section,42,20,830,23,12,C.teal,true);text(s,title,42,60,878,67,30,C.navy,true);text(s,'学生向け家計簿Webアプリ  |  期末発表',42,507,820,20,11,C.muted);text(s,String(n).padStart(2,'0'),874,503,45,24,13,C.muted,false,'right');return s;}
function takeaway(s,t){box(s,t,42,441,876,48,{size:21,fill:C.pale,bold:true});}
function table(s,values,widths,{x=42,y=145,h=264,size=19}={}){const z=s.tables.add({rows:values.length,columns:widths.length,left:x,top:y,width:widths.reduce((a,b)=>a+b),height:h,values,columnWidths:widths});z.borders.assign({fill:C.line,width:1});for(let r=0;r<values.length;r++){z.rows[r].height=h/values.length;for(let c=0;c<widths.length;c++){const q=z.getCell(r,c);q.fill=r===0?C.navy:r%2?C.white:C.pale;q.text.style={fontSize:size,typeface:'Meiryo',color:r===0?C.white:C.navy,bold:r===0,verticalAlignment:'middle'};}}return z;}
async function img(s,name,x,y,w,h){let b;try{b=await fs.readFile(name+'.png')}catch{return false;}s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt:'架空データによる実際のアプリ画面',fit:'contain',position:{left:x,top:y,width:w,height:h}});return true;}
// Cover: retain the supplied title layout, authors and artwork.
const cover=p.slides.items[0];for(const z of cover.shapes.items){if(z.text)z.text.replace('中間発表','期末発表');}
text(cover,'学生向け家計簿Webアプリ\n記録から可視化へ、ローカルからクラウドへ',62,294,800,60,19,C.teal,true);
note(cover,'中間発表から現在までに実現したことを説明します。前半は機能の変化、後半は動作原理とクラウド公開です。最後にレシート読み取りを見送った判断と実装方法を紹介します。');

let s=slide('目指したのは、続けやすい家計管理','開発の目的');
table(s,[['学生の課題','アプリで支える行動'],['何に使ったか分からない','カテゴリで記録し、支出の内訳を見る'],['入力が面倒で続かない','同じ画面で、アイコンを選んで追加する'],['月末までお金が持たない','月の支出目標と残りの金額を確認する']],[360,516],{h:253,size:22});
takeaway(s,'「記録する → 振り返る → 次の支出を考える」を支援');
note(s,'中間発表で挙げた金欠、無駄遣いが分からない、家計簿が続かないという課題を引き継いでいます。便利な機能を増やすだけでなく、入力から振り返りまでをつなぐことを目指しました。ただし、継続率や節約額が改善したかはまだ測定していません。');

s=slide('中間発表から、何が変わったか','中間発表との比較');
table(s,[['観点','中間発表時点','現在'],['基本機能','登録・ログイン、収支の追加／編集／削除','継続して利用'],['分類・分析','カテゴリ・グラフは未実装','30カテゴリ、月別円グラフ、前月比'],['予算管理','今後の機能として検討','月別の支出目標・残額・使用率'],['利用環境','自分のPCで起動、クラウド未確認','無料版PythonAnywhereで動作']],[143,349,384],{h:288,size:19});
takeaway(s,'収支を保存する段階から、支出を判断できる段階へ');
note(s,'比較元は添付された中間発表の進捗・課題スライドです。中間発表時の基本機能を土台に、分類、可視化、目標管理、クラウド公開を追加しました。クラウド動作は開発者による実施報告に基づき、この資料作成時に本番URLへの再接続を検証したものではありません。');

s=slide('計画した機能の到達点を整理する','中間発表との比較');
table(s,[['当初の案','到達点'],['収支管理・保存／カテゴリ分類','実装済み'],['月別の支出グラフ／前月比較／支出目標','実装済み'],['月別の収入・支出・差額を一括表示','一部実現：月別支出＋全期間の収支差額'],['レシート読み取り','試作コードあり／有料APIでの運用は見送り'],['割り勘・支出予測・学生平均との比較など','今回は対象外']],[456,420],{h:286,size:19});
takeaway(s,'手入力での家計管理を完成範囲とした');
note(s,'全期間の収入から支出を引いた差額は表示しますが、月別の収入・支出・差額をまとめた画面は未完成です。画面上の残高は入力済みデータの差額であり、銀行口座残高ではありません。中間発表で列挙した候補すべてを実装したという説明は避け、完成範囲を明確にします。');

s=slide('収支一覧を見ながら、その場で追加');
if(!await img(s,'input-category',42,173,550,242)){
 box(s,'収支一覧',42,145,250,58,{bold:true});box(s,'＋ 収支を追加',320,145,290,58,{fill:C.teal,color:C.white,bold:true});
 table(s,[['選択する','入力する'],['支出 または 収入','金額・日付'],['カテゴリのアイコン','メモ（任意）']],[280,288],{x:42,y:222,h:174,size:20});
}
await img(s,'input-fields',638,173,280,242);
text(s,'カテゴリを選ぶ（画面の一部）',42,137,560,31,20,C.teal,true);
text(s,'金額・日付を入れて保存',638,137,280,31,20,C.teal,true);
takeaway(s,'入力後は一覧・集計を更新し、振り返りに戻れる');
note(s,'ダッシュボードの収支追加パネルは同じ画面内で開きます。支出か収入を選び、カテゴリ、金額、日付、任意のメモを登録します。JavaScriptが有効な場合はfetchで送信し、サーバーから返ったHTMLのmain部分を差し替えます。画面遷移が少なくてもサーバーとの通信は発生します。画面がない場合の図は実装に沿った操作の模式図です。');

s=slide('カテゴリを選ぶだけで、支出を分類');
box(s,'支出 22種類',42,140,260,67,{size:28,bold:true});box(s,'収入 8種類',42,231,260,67,{size:28,bold:true});
text(s,'食費・外食・カフェ・日用品・家賃\n水道光熱・通信・交通・学費・書籍\n衣服・医療・趣味・交際・その他 など',342,141,560,105,23);
text(s,'アルバイト・給与・仕送り・奨学金\n副業・売却・返金・その他',342,277,560,78,23);
text(s,'カテゴリ名・アイコン・色を共通の定義で管理',42,385,870,36,23,C.teal,true);
takeaway(s,'入力時の分類が、そのまま月別集計の軸になる');
note(s,'categories.pyには支出22種類、収入8種類の固定カテゴリがあります。スライドの支出欄は代表例です。選択肢は収入と支出で切り替えます。カテゴリ定義を共通化することで、入力、一覧、集計の表示に一貫性を持たせています。現在はユーザー独自のカテゴリ追加機能はありません。');

s=slide('月ごとの円グラフで、使い道を見える化');
if(!await img(s,'donut',42,157,280,267)){
 s.charts.add('doughnut',{position:{left:43,top:133,width:340,height:280},categories:['食費','外食','交通','書籍','趣味','その他'],series:[{name:'支出額',values:[18000,6000,6000,5000,3000,2000],points:['#007F80','#489C83','#6B8FB4','#E3B05B','#AD85A4','#A8B4BA'].map((fill,idx)=>({idx,fill}))}],hasLegend:false,doughnutOptions:{holeSize:62},dataLabels:{showPercent:true,textStyle:{typeface:'Meiryo',fontSize:17,fill:C.navy}}});
 table(s,[['カテゴリ','金額'],['食費','18,000円'],['外食','6,000円'],['交通','6,000円'],['その他3分類','10,000円']],[149,145],{x:381,y:147,h:246,size:18});
}
table(s,[['11月の内訳','金額','割合'],['食費','18,000円','45％'],['外食','6,000円','15％'],['交通費','6,000円','15％'],['書籍・趣味・その他','10,000円','25％']],[265,175,130],{x:348,y:172,h:247,size:20});
text(s,'記録がある全ての月を表示  ／  架空データの例',42,129,876,30,19,C.teal,true);
takeaway(s,'例：11月の支出4万円のうち、食費が45％');
note(s,'ここでは架空の2026年11月データを使っています。18,000÷40,000×100＝45％です。アプリは記録のある全ての月を新しい順に表示します。アプリ側のドーナツグラフはCSSのconic-gradientで描画しており、Chart.jsは使っていません。資料には実際のアプリで表示したグラフの画像を使い、金額と割合の表を編集可能な表で添えています。');

s=slide('月の支出目標から、あと使える額を確認');
if(!await img(s,'overview',42,131,876,245)){
box(s,'支出目標\n50,000円',42,145,274,120,{size:25,bold:true});box(s,'今月の支出\n40,000円',343,145,274,120,{size:25,bold:true});box(s,'目標まで残り\n10,000円',644,145,274,120,{size:25,fill:C.teal,color:C.white,bold:true});}
text(s,'残りの金額 ＝ 支出目標 − その月の支出',57,391,847,38,26,C.teal,true);
text(s,'架空データの画面例',738,108,180,21,12,C.muted,false,'right');
takeaway(s,'月別に目標を保存し、超えたときは超過も表示');
note(s,'月の支出目標はユーザーごと・月ごとに設定できます。例は目標5万円、支出4万円で残額1万円、使用率80％です。超過すると残額は負になり警告します。残額は目標に対する余裕であり、銀行口座や手元の残高ではありません。グラフのバーは100％で止めても、数値は実際の使用率を扱います。');

s=slide('分析は「何が増えたか」を考える入口');
box(s,'10月\n50,000円',42,149,260,132,{size:28,bold:true});arrow(s,316,194,65);box(s,'11月\n40,000円',397,149,260,132,{size:28,bold:true});box(s,'前月比\n−20％',689,149,229,132,{size:30,fill:C.teal,color:C.white,bold:true});
text(s,'差額：40,000 − 50,000 ＝ −10,000円',42,318,875,39,25);
text(s,'最大カテゴリ・件数・1件あたりの平均額も表示',42,378,875,34,23);
takeaway(s,'前月の記録がないときは、0円と決めつけない');
note(s,'前月比は直前の暦月の支出と比較します。前月支出が正の場合に増減率を計算し、前月の記録がない場合や0円の場合は率を無理に算出しません。平均は1日あたりではなく1件あたりです。数値は手入力した記録の範囲の分析なので、記録漏れや月途中の比較には注意して読み取ります。');

s=slide('アプリは、画面・処理・保存の3層で動く','動作原理と仕組み');
const a=box(s,'ブラウザ\nHTML / CSS\nJavaScript',42,174,250,161,{size:25,bold:true});arrow(s,300,226,54);const b=box(s,'Flask（Python）\n認証・入力確認\n集計・画面生成',355,174,250,161,{size:24,fill:C.teal,color:C.white,bold:true});arrow(s,614,226,54);const c=box(s,'SQLite\nユーザー・収支\n月別の支出目標',668,174,250,161,{size:24,bold:true});
text(s,'表示と操作',81,365,180,35,23,C.muted,false,'center');text(s,'リクエストの処理',369,365,225,35,23,C.muted,false,'center');text(s,'データを保存',705,365,180,35,23,C.muted,false,'center');
takeaway(s,'Jinjaが、データを埋め込んだHTMLを作る');
note(s,'ブラウザは画面を表示し、入力をサーバーへ送ります。FlaskはURLに対応する処理を実行し、必要に応じSQLiteを読み書きします。Jinjaはテンプレートに値を埋め込んでHTMLを作る仕組みです。SQLiteはサーバー上のファイルにデータを保存するデータベースです。画面を閉じても保存データは残ります。');

s=slide('「登録」ボタンを押すと何が起こるか','動作原理と仕組み');
table(s,[['順番','担当','実際の処理'],['1','ブラウザ','金額・カテゴリなどをHTTP POSTで送信'],['2','Flask','ログイン、CSRF、金額・日付・カテゴリを確認'],['3','SQLite','ログイン中のuser_idを付けて保存・確定'],['4','Flask ＋ Jinja','一覧・月別集計を読み直し、HTMLを作る'],['5','JavaScript','返ってきたHTMLで画面のmain部分を更新']],[80,208,588],{h:282,size:19});
takeaway(s,'画面に表示された値は、保存したデータから再計算');
note(s,'POSTはデータを送るHTTPの方法です。サーバーはブラウザから受け取った値をそのまま信用せず、フォームの検証を行います。ユーザーIDはフォームの任意入力ではなくログイン状態から取得します。SQLのINSERTとcommitで保存し、その後集計とHTMLを作り直します。JavaScript無効時には通常のフォーム送信も動作します。');

s=slide('データはuser_idで利用者ごとにつながる','動作原理と仕組み');
box(s,'users\n利用者\nid / メールアドレス\nパスワードのハッシュ',42,190,270,177,{size:22,bold:true});
box(s,'transactions：収支\nuser_id / 種類 / 金額\nカテゴリ / 日付 / メモ',403,140,515,118,{size:22});
box(s,'monthly_spending_goals：支出目標\nuser_id / 年月 / 目標額\n同じ利用者・年月は1件',403,295,515,118,{size:21});
text(s,'1 → 多',319,179,83,30,18,C.teal,true);text(s,'1 → 多',319,335,83,30,18,C.teal,true);
takeaway(s,'取得・変更・削除のときも、本人のuser_idで絞る');
note(s,'usersを親として収支と支出目標をひも付けます。SQLiteのファイルはサーバー内のinstance/app.sqlite3です。取引のIDだけで編集や削除をせず、user_idも条件に含めることで、他人の取引を操作できないようにします。支出目標は利用者と年月の組を一意にして、同じ月なら更新します。');

s=slide('ログイン状態とデータを守る仕組み','動作原理と仕組み');
table(s,[['場面','使っている仕組み','役割'],['パスワード保存','Werkzeugのハッシュ化','元のパスワードをそのまま保存しない'],['ログイン継続','Flask-Login ＋ セッション','利用者を識別し、ログインを要求'],['Cookieの改ざん対策','SECRET_KEYによる署名','サーバーで内容の改ざんを検出'],['フォーム送信','Flask-WTFのCSRF対策','第三者サイトからの不正な送信を防ぐ']],[178,285,413],{h:277,size:18});
takeaway(s,'秘密鍵はサーバーだけが保持。署名と暗号化は別');
note(s,'パスワードのハッシュ化とCookieの署名は役割が異なります。Flaskの標準セッションCookieは署名で改ざんを検出しますが、内容自体を暗号化するわけではありません。ブラウザにSECRET_KEYを渡すことはありません。SQLには値をパラメータとして渡します。これで全ての安全対策が完了したわけではなく、パスワード再設定やログイン試行制限などは今後の課題です。');

s=slide('月別集計は、保存した収支をまとめ直す','動作原理と仕組み');
box(s,'① 本人の収支\nuser_idで絞り込み',42,153,266,108,{size:23,bold:true});arrow(s,312,183,37);box(s,'② 年月・カテゴリ別\n支出額を合計',352,153,266,108,{size:23,bold:true});arrow(s,623,183,30);box(s,'③ 割合・前月比\nPythonで計算',656,153,262,108,{size:23,bold:true});
table(s,[['算出する値','計算例'],['カテゴリの割合','食費18,000円 ÷ 月支出40,000円 ＝ 45％'],['前月比','（40,000 − 50,000）÷ 50,000 ＝ −20％']],[250,626],{y:294,h:120,size:19});
takeaway(s,'集計結果 → Jinja → CSSの円グラフ・金額一覧');
note(s,'SQLで利用者を絞り、日付の年月部分、収支の種類、カテゴリを使って合計します。analysis.pyなどで月ごとのレポートを組み立てます。CSSのconic-gradientは割合に合わせて円周を色分けします。外部の分析APIは不要で、保存済みのデータとPython・SQLの計算で実現しています。');

s=slide('ファイルごとに役割を分けている','動作原理と仕組み');
table(s,[['主なファイル','役割'],['app.py','URLの受付、認証、収支操作、DB接続'],['schema.sql / migration.py','テーブル定義、既存DBへのカテゴリ列追加'],['categories.py / analysis.py','カテゴリの共通定義、月別レポートの組み立て'],['templates/*.html','Jinjaで一覧・フォーム・グラフのHTMLを生成'],['static/transactions.js・css','入力の切替・送信・画面更新、レイアウトと配色']],[400,476],{h:281,size:18});
takeaway(s,'URLの処理、データ、画面を分け、機能をつなぐ');
note(s,'app.pyは全ての見た目を直接描くわけではありません。必要な値を用意してテンプレートへ渡します。現在の実行経路ではapp.pyのget_dbがSQLite接続をgに保持し、終了時にclose_dbで閉じます。db.pyという別ファイルもありますが、この実行経路では利用しません。gは全員共通の永続保存場所ではなく、そのリクエストの処理で使う一時的な置き場です。永続データはSQLiteへ保存します。');

s=slide('無料版PythonAnywhereでクラウド上に公開','クラウドでの動作');
text(s,'中間発表：自分のPCで起動',42,143,858,38,24,C.muted,true);
box(s,'利用者のブラウザ',42,200,274,78,{size:23});arrow(s,327,217,58);box(s,'自分のPC\nFlask ＋ SQLite',397,190,521,98,{size:24});
text(s,'現在：クラウド上で動作',42,313,858,38,24,C.teal,true);
box(s,'PC・スマホのブラウザ',42,369,274,68,{size:21});arrow(s,327,383,58);box(s,'PythonAnywhere\nFlask ＋ SQLite',397,358,521,93,{size:24,fill:C.teal,color:C.white,bold:true});
text(s,'自分のPCを起動し続けなくても、公開URLから利用できる',42,469,876,30,20,C.teal,true);
note(s,'無料版PythonAnywhereへの配置とクラウドでの動作は、開発者が実施・確認した結果です。アプリの処理とデータ保存を自分のPCからクラウドへ移しました。ブラウザがインターネット経由で公開URLへアクセスすると、クラウド側のアプリが応答します。この資料では本番URLや同時接続人数の再検証は行っていません。',['https://help.pythonanywhere.com/pages/Flask/']);

s=slide('公開先ではWSGIがFlaskを呼び出す','クラウドでの動作');
box(s,'ブラウザ\nHTTPS',42,145,220,91,{size:23,bold:true});arrow(s,271,166,55);box(s,'PythonAnywhere\nWebサーバー／WSGI',336,145,292,91,{size:22,bold:true});arrow(s,634,166,50);box(s,'Flask\nSQLiteを読み書き',694,145,224,91,{size:22,bold:true});
table(s,[['設定・運用','確認すること'],['実行環境','コード配置、仮想環境、必要なライブラリ、WSGI設定'],['データと秘密鍵','環境変数のSECRET_KEY、DB初期化、ファイルの保存先'],['無料枠の制約','Webアプリの期限延長、処理資源、外向き通信の制限']],[207,669],{y:274,h:154,size:18});
takeaway(s,'クラウド化は達成。期限管理・バックアップは継続する');
note(s,'WSGIはWebサーバーからPythonアプリを呼び出すための取り決めです。公開環境ではFlaskの開発用app.runで常駐させる構成ではなく、WSGI設定からアプリを読み込みます。無料アカウントにはWebアプリの有効期限や処理資源の制限、外向き通信の許可先制限があります。無期限無操作で動作することや20人の同時利用性能は保証していません。',['https://help.pythonanywhere.com/pages/Flask/','https://help.pythonanywhere.com/pages/FreeAccountsFeatures/','https://help.pythonanywhere.com/pages/403ForbiddenError']);

s=slide('レシート読み取りは、費用を考えて見送った','見送った機能と実現方法');
text(s,'試作コードはあるが、有料APIを使う運用は採用しない',42,137,876,54,24,C.teal,true);
table(s,[['方法','できること','今回の判断'],['画像対応AI API','画像から品目・金額を抽出し\nカテゴリ候補も構造化','従量課金が発生するため\n運用を見送った'],['Tesseract等のOCR','画像の文字を抽出\n品目の解析・分類は別途実装','API利用料なしでも可能\n精度調整と開発時間が必要']],[208,334,334],{y:204,h:197,size:19});
takeaway(s,'「読み取りは全て有料」ではなく、費用と工数の選択');
note(s,'現リポジトリには画像対応AI APIへ問い合わせる試作があります。しかし、今回の完成範囲は手入力とし、有料APIでの実運用は見送ります。ChatGPTの契約料金とAPI料金は別です。無料のオープンソースOCRもありますが、レシートのレイアウト、金額、税、品目を解釈する処理や、クラウド環境への導入が必要です。無料で同じ精度が直ちに得られるとは限りません。',['https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform','https://tesseract-ocr.github.io/tessdoc/']);

s=slide('実装するなら「読み取り → 確認 → 登録」','見送った機能と実現方法');
box(s,'① カメラ／画像選択',42,143,265,77,{size:23,bold:true});arrow(s,308,160,42);box(s,'② Flaskで画像を確認',352,143,265,77,{size:22,bold:true});arrow(s,619,160,34);box(s,'③ AI APIへ送信',657,143,261,77,{size:23,bold:true});
text(s,'↓',763,225,46,42,28,C.teal,true,'center');
box(s,'⑥ SQLiteへ保存',42,279,265,87,{size:23,fill:C.teal,color:C.white,bold:true});text(s,'←',308,298,42,42,28,C.teal,true,'center');box(s,'⑤ 人が確認・修正',352,279,265,87,{size:23,bold:true});text(s,'←',619,298,34,42,28,C.teal,true,'center');box(s,'④ 品目・金額をJSON化',657,279,261,87,{size:21,bold:true});
text(s,'例：品目「パン」／金額180円／カテゴリ「食費」',42,390,876,35,22);
takeaway(s,'誤読がある前提で、保存前の確認を必須にする');
note(s,'試作のreceipt_ocr.pyは画像と指示をResponses APIへ送り、構造化した候補を受け取ります。receipts.pyと確認画面で人が修正してから一括登録する設計です。APIキーはサーバー環境変数で保持します。運用にはAPI費用、PythonAnywhere無料枠の外向き通信可否、レシート画像の取り扱いを確認する必要があります。これは実現方法の説明で、今回の有料運用実績ではありません。');

s=slide('記録・可視化・目標管理を、クラウドで使える形へ','まとめ');
table(s,[['今回実現したこと','次に確かめること'],['同じ画面での収支入力、30カテゴリ','実際に続けやすいかを利用者に確認'],['月別の内訳・前月比・支出目標','月別の収入・支出・差額の表示を充実'],['無料版PythonAnywhereでの動作','バックアップ、継続運用、同時利用の検証'],['レシート機能の試作と採否の判断','必要性と費用・精度を見て再検討']],[438,438],{h:260,size:21});
takeaway(s,'学んだこと：画面・サーバー・DBをつなぎ、公開まで進めた');
note(s,'中間発表から、カテゴリ、グラフ、支出目標、クラウド公開まで進めました。今回は手入力の家計管理を完成範囲とし、レシート読み取りは有料運用を行わない判断としました。今後は機能を増やすだけでなく、利用者の継続率、入力しやすさ、運用の安定性を確認したいと考えています。ご清聴ありがとうございました。');

await fs.mkdir('render',{recursive:true});
await (await PresentationFile.exportPptx(p)).save('candidate.pptx');
await fs.writeFile('deck-proto.json',JSON.stringify(p.toProto()));
console.log('Exported '+p.slides.items.length+' slides');
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(`render/${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await b.arrayBuffer()));console.log('Rendered '+(i+1));}
