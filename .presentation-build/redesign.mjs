import fs from 'node:fs/promises';
import {FileBlob,PresentationFile} from 'file:///C:/Program Files/WindowsApps/OpenAI.CodexPrimaryRuntime.v26-1112-737-0_26.1112.737.0_x64__3k8sg7r9htsxt/dependencies/node/node_modules/@oai/artifact-tool/dist/artifact_tool.mjs';
const p=await PresentationFile.importPptx(await FileBlob.load('output/家計簿Webアプリ_期末発表_完成版.pptx'));
p.slides.delete(Array.from({length:20},(_,i)=>i));
const C={ink:'#183744',teal:'#147D81',muted:'#62727A',bg:'#FAFBF9',soft:'#EAF3F0',rule:'#CDDBDA',orange:'#BB6F3E',white:'#FFFFFF'};
function tx(s,t,x,y,w,h,size=19,color=C.ink,bold=false,align='left'){const z=s.shapes.add({geometry:'textbox',position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});z.text=t;z.text.style={typeface:'Meiryo',fontSize:size,color,bold,alignment:align,verticalAlignment:'top',autoFit:'none',insets:0};return z;}
function node(s,title,body,x,y,w,h,accent=false,titleSize=21,bodySize=17){const z=s.shapes.add({geometry:'rect',position:{left:x,top:y,width:w,height:h},fill:accent?C.soft:C.white,line:{fill:C.rule,width:1}});tx(s,title,x+16,y+14,w-32,35,titleSize,C.teal,true);tx(s,body,x+16,y+55,w-32,h-61,bodySize,C.ink);return z;}
function rule(s,x,y,w,color=C.rule){s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:0},line:{fill:color,width:1}});}
function line(s,x,y,w,h=0,color=C.rule){s.shapes.add({geometry:'line',position:{left:x,top:y,width:w,height:h},line:{fill:color,width:1.2}});}
function arr(s,x1,y,x2,color=C.teal){line(s,Math.min(x1,x2),y,Math.abs(x2-x1),0,color);tx(s,x2>x1?'›':'‹',x2-10,y-19,22,35,28,color,true,'center');}
function sub(s,label,body,x,y,w,size=18){tx(s,label,x,y,w,32,21,C.teal,true);tx(s,body,x,y+43,w,Math.min(505-y-43,Math.max(88,body.split('\n').length*size*1.4+8)),size,C.ink);}
function slide(title,section,dark=false){const s=p.slides.add({layout:'BLANK'});s.background.fill=dark?C.ink:C.bg;const n=p.slides.items.length;tx(s,section,44,23,800,21,12,dark?'#B8D7D4':C.teal);tx(s,title,44,65,875,54,29,dark?C.white:C.ink,true);tx(s,String(n).padStart(2,'0'),873,509,44,19,11,dark?'#B8D7D4':C.muted,false,'right');return s;}
function foot(s,t){tx(s,t,44,477,838,28,13,C.muted);}
function notes(s,t,refs=[]){s.speakerNotes.text=t+(refs.length?'\n\n参考資料（2026-11-19確認）\n'+refs.join('\n'):'');}
async function image(s,file,x,y,w,h){const b=await fs.readFile(file);s.images.add({blob:b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),contentType:'image/png',alt:file.startsWith('assets')?'中間発表で使用したイラスト':'架空の収支データによるアプリ画面',fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function table(s,values,widths,x,y,h){const t=s.tables.add({rows:values.length,columns:widths.length,left:x,top:y,width:widths.reduce((a,b)=>a+b),height:h,columnWidths:widths,values});t.borders.assign({fill:C.rule,width:0.7});for(let r=0;r<values.length;r++){t.rows[r].height=h/values.length;for(let c=0;c<widths.length;c++){let q=t.getCell(r,c);q.fill=r===0?C.ink:r%2?C.white:C.soft;q.text.style={typeface:'Meiryo',fontSize:17,color:r===0?C.white:C.ink,bold:r===0,verticalAlignment:'middle'};}}return t;}

let s=slide('学生向け家計簿Webアプリ','情報システム基礎演習 C班　期末発表');
tx(s,'日々の収支を記録し、\n月ごとの使い道を確かめる',48,158,530,100,34,C.ink,true);
tx(s,'中間発表後の開発成果と、アプリが動く仕組み',48,283,510,56,18,C.muted);
await image(s,'assets/image1.png',615,146,286,250);
tx(s,'T25B366H　町永拓冬　　 T25B329C　前山周弥\nT25B319F　蕗谷京佑　　 T25B352H　綿谷麻比侶',48,414,820,62,16,C.muted);
notes(s,'学生向け家計簿Webアプリの期末発表です。中間発表時の基本機能を土台に、カテゴリ分類、分析、月別の支出目標、クラウド公開を実現しました。イラストは中間発表資料のものを使用しています。');

s=slide('本日の発表構成','目次');
for(const [i,title,desc,pages] of [[1,'開発の目的と成果','学生の課題、中間発表からの変化、機能紹介','03–09'],[2,'アプリが動く仕組み','画面・Flask・データベースの連携','10–15'],[3,'クラウドでの公開','PythonAnywhereへの配置と運用','16–17'],[4,'レシート機能とまとめ','見送った理由、実装方法、今後の課題','18–20']]){const y=143+(i-1)*81;tx(s,String(i).padStart(2,'0'),47,y,65,41,29,C.teal,true);tx(s,title,128,y,466,34,22,C.ink,true);tx(s,desc,128,y+35,492,30,16,C.muted);tx(s,pages,630,y+5,100,27,15,C.muted,false,'right');}
await image(s,'assets/image2.png',764,229,139,123);
notes(s,'まず何を目指して何を実現したかを説明します。次にデータを登録して画面へ戻るまでの内部の仕組みを説明します。その後クラウドで使えるようにした方法を紹介し、最後に今回見送ったレシート読み取りと今後の課題を説明します。財布のイラストは中間発表資料から引き継ぎました。');

s=slide('家計管理で困ること','01　開発の目的と成果');
tx(s,'何に使ったのか分からない',48,155,535,39,25,C.ink,true);
tx(s,'入力が面倒で、記録が続かない',48,223,535,39,25,C.ink,true);
tx(s,'月末まで使える金額を把握したい',48,291,535,39,25,C.ink,true);
await image(s,'assets/image3.png',629,133,277,291);
rule(s,48,386,515);tx(s,'開発の目的',48,409,140,28,16,C.teal,true);tx(s,'入力の負担を減らし、支出を振り返れるようにする',48,442,825,31,22,C.ink);
notes(s,'中間発表で挙げた課題は、金欠、何に使ったか分からない、家計簿を継続しにくいことです。この課題に対して、入力の手間を減らす画面と、記録した支出を振り返る機能を作りました。節約額や継続率の改善はまだ測定していません。人物のイラストは中間発表資料から引き継いでいます。');

s=slide('中間発表から実現したこと','01　開発の目的と成果');
table(s,[['項目','中間発表','現在'],['基本の収支管理','登録・ログイン、追加・編集・削除','基本機能を継続'],['分類・分析','今後の課題','自作カテゴリ、月別グラフ、前月比'],['予算管理','機能案として検討','月別の支出目標・残額・使用率'],['利用環境','自分のPCで起動','無料版PythonAnywhereで動作']],[151,320,405],44,146,269);
tx(s,'主な追加点は、支出の可視化と目標管理、クラウド公開。',44,445,876,36,21,C.teal,true);
notes(s,'中間発表の進捗と現在のコードを比較しています。基本の認証と収支管理は中間発表時点であり、今回はカテゴリ、月別グラフ、前月比較、目標管理を追加しました。クラウド公開は開発者が実施して動作したと報告した内容に基づきます。');

s=slide('同じ画面で収支を追加','01　開発の目的と成果');
tx(s,'1　種類・カテゴリを選ぶ',44,139,540,32,20,C.teal,true);tx(s,'2　金額・日付を入力して保存',623,139,294,52,18,C.teal,true);
await image(s,'input-category.png',44,187,544,251);await image(s,'input-fields.png',623,189,294,247);
tx(s,'標準30種類に加え、自分のカテゴリを追加・削除',44,449,558,27,17,C.ink);tx(s,'作った名前は次回も選べる。過去の記録は削除後も残る。',44,480,862,24,15,C.muted);tx(s,'登録後に一覧と集計を更新',623,449,294,28,17,C.ink);
notes(s,'追加パネルは一覧と同じダッシュボード内で開きます。収入か支出を選ぶと対応するカテゴリを表示し、金額、日付、任意のメモを登録します。標準カテゴリは支出22種類、収入8種類です。さらに「その他」や「自分のカテゴリを追加」から名前を入力すると、本人専用の選択肢として保存します。削除は選択肢から外す処理で、過去の収支・グラフの名前は保持します。画像は基本入力部分の拡大です。');

s=slide('月別の支出内訳','01　開発の目的と成果');
s.charts.add('doughnut',{position:{left:45,top:152,width:370,height:294},categories:['食費','外食','交通費','書籍・教材','趣味','その他'],series:[{name:'11月の支出額',values:[18000,6000,6000,5000,3000,2000],points:['#147D81','#D69252','#688DA5','#8E87B1','#B2C6A3','#BBC3C5'].map((fill,idx)=>({idx,fill}))}],hasLegend:false,doughnutOptions:{holeSize:63},dataLabels:{showValue:false,showPercent:false,textStyle:{typeface:'Meiryo',fontSize:16}}});
tx(s,'11月の支出',142,260,170,27,16,C.muted,false,'center');tx(s,'40,000円',106,295,242,45,31,C.ink,true,'center');
tx(s,'食費が支出の45％',478,155,417,41,29,C.teal,true);tx(s,'18,000円',478,205,420,35,23,C.ink);
for(const [i,name,amount] of [[0,'外食','6,000円'],[1,'交通費','6,000円'],[2,'書籍・教材','5,000円'],[3,'趣味','3,000円'],[4,'その他','2,000円']]){s.shapes.add({geometry:'rect',position:{left:456,top:273+i*32,width:11,height:11},fill:['#D69252','#688DA5','#8E87B1','#B2C6A3','#BBC3C5'][i],line:{width:0,fill:'none'}});tx(s,name,480,267+i*32,220,27,17,C.ink);tx(s,amount,750,267+i*32,145,27,17,C.ink,false,'right');}
foot(s,'架空データの例。アプリは記録のある全ての月を、新しい順に表示する。');
notes(s,'保存した支出から月ごとにカテゴリ別の合計を求め、割合と金額を表示します。例は架空のデータで、食費18,000円を月支出40,000円で割ると45％です。スライドのグラフは説明用の編集可能なグラフです。アプリではCSSのconic-gradientでドーナツグラフを描画し、Chart.jsは使用していません。');

s=slide('支出目標と残りの予算','01　開発の目的と成果');
tx(s,'架空データの画面例',729,111,187,20,11,C.muted,false,'right');
await image(s,'overview.png',44,137,872,244);
sub(s,'収支合計', '入力済みの全期間の差額。\n銀行口座の残高ではない。',44,409,264,15);
sub(s,'支出合計','選択した月に記録した\n支出の合計。',352,409,249,15);
sub(s,'残りの予算','月の支出目標 − 月の支出。\n超過した場合はマイナスになる。',646,409,272,15);
notes(s,'画像は架空の収支を入れた実際の画面です。支出目標5万円に対し支出4万円なので、残り1万円、使用率80％です。目標は利用者ごと・月ごとに保存できます。全期間の収支差額と当月の支出は対象期間が異なり、銀行口座との連携はありません。');

s=slide('前月との比較と簡単な分析','01　開発の目的と成果');
s.charts.add('bar',{position:{left:40,top:150,width:440,height:290},categories:['10月','11月'],series:[{name:'支出額',values:[50000,40000],points:[{idx:0,fill:'#B7C9C8'},{idx:1,fill:C.teal}]}],hasLegend:false,barOptions:{direction:'column',gapWidth:110},xAxis:{textStyle:{typeface:'Meiryo',fontSize:18,fill:C.ink},line:{fill:C.rule,width:1}},yAxis:{min:0,max:60000,majorUnit:20000,numberFormatCode:'#,##0"円"',textStyle:{typeface:'Meiryo',fontSize:13,fill:C.muted},majorGridlines:{fill:C.rule,width:0.6}},dataLabels:{showValue:true,position:'outEnd',numberFormatCode:'#,##0',textStyle:{typeface:'Meiryo',fontSize:17,fill:C.ink}}});
tx(s,'前月より10,000円減少',535,166,380,38,24,C.ink,true);tx(s,'−20％',535,219,360,69,45,C.teal,true);tx(s,'（40,000 − 50,000）÷ 50,000',535,301,380,31,17,C.muted);
tx(s,'ほかに表示する指標',535,367,376,29,18,C.teal,true);tx(s,'最大カテゴリ、支出件数、1件あたりの平均額',535,402,376,58,17,C.ink);
foot(s,'架空データの例。前月の記録がない場合は、0円として増減率を計算しない。');
notes(s,'比較対象は直前の暦月です。前月が5万円、今月が4万円なら差額はマイナス1万円、増減率はマイナス20％です。前月の記録がない場合や前月支出が0円の場合は率を無理に出しません。平均は1日あたりではなく支出1件あたりです。入力漏れや月途中の比較には注意が必要です。');

s=slide('今回の完成範囲','01　開発の目的と成果');
sub(s,'完成した機能','ユーザー別の収支管理、自作カテゴリの追加・削除\n月別の支出グラフ、前月比、支出目標\n無料版PythonAnywhereでの公開',44,149,875,20);
rule(s,44,306,872);
sub(s,'一部実現','月別支出は表示できる。\n月別の収入・支出・差額の\n一括表示は今後の課題。',44,339,385,17);
sub(s,'今回の対象外','レシートAPIの有料運用、割り勘、\n支出予測、学生平均との比較など。\n手入力での家計管理を完成範囲とした。',501,339,415,17);
notes(s,'中間発表の候補すべてを実装したわけではありません。今回は手入力で記録し振り返る機能を完成範囲としました。月別の収入・支出・差額をまとめて見る機能は部分的な実現です。レシート読み取りは試作コードが残っていますが、有料APIでの運用は採用しません。');

s=slide('Webアプリの全体構成','02　アプリが動く仕組み');
node(s,'ブラウザ','HTML：画面の内容\nCSS：色・配置\nJavaScript：入力と更新',44,167,255,179);
node(s,'Flask（Python）','URLに対応する処理\nログイン・入力確認\nSQLの実行・集計',352,167,255,179,true);
node(s,'SQLite','サーバー内のDBファイル\nユーザー、収支、\n月別の支出目標を保存',660,167,256,179);
arr(s,304,221,346);arr(s,655,289,614);arr(s,611,221,655);arr(s,346,289,304);
tx(s,'HTTP',302,180,48,25,11,C.muted,false,'center');tx(s,'SQL',613,180,41,25,11,C.muted,false,'center');
tx(s,'Jinjaで画面を作る',352,384,550,33,22,C.teal,true);tx(s,'テンプレートに一覧や集計値を埋め込み、HTMLをブラウザへ返す。',352,426,558,51,18,C.ink);
notes(s,'画面、サーバー処理、データ保存を分担しています。ブラウザはHTTPでリクエストし、Flaskが必要なSQLiteの読み書きを行います。JinjaはHTMLのひな型にデータを埋め込む仕組みです。SQLiteのDBはブラウザではなくサーバーにあります。');

s=slide('収支を保存して画面へ戻るまで','02　アプリが動く仕組み');
const xs=[153,479,805];['ブラウザ','Flask','SQLite'].forEach((t,i)=>{tx(s,t,xs[i]-95,139,190,32,22,C.teal,true,'center');line(s,xs[i],184,0,269,C.rule)});
arr(s,153,211,479);tx(s,'① POST：金額・日付・カテゴリ',176,181,287,25,15,C.ink);
tx(s,'② ログイン・入力値・CSRFを確認',494,237,380,25,15,C.ink);
arr(s,479,295,805);tx(s,'③ user_idを付けて保存・commit',498,266,292,25,15,C.ink);
arr(s,805,354,479);tx(s,'④ 一覧・集計に必要な値を取得',499,324,300,25,15,C.ink);
arr(s,479,416,153);tx(s,'⑤ Jinjaで作ったHTMLを返す',176,384,290,25,15,C.ink);
foot(s,'JavaScriptが受け取ったHTMLのmain部分を差し替える。画面遷移が少なくても通信は発生する。');
notes(s,'登録ボタンを押すとfetchがフォームをPOSTで送ります。Flaskはログイン、CSRFトークン、金額やカテゴリなどを検証します。user_idはログイン情報から決めて保存します。保存後は一覧と集計を取り直してJinjaでHTMLを作り、JavaScriptがmain部分を差し替えます。JavaScriptを無効にした場合も通常のフォーム送信で処理できます。');

s=slide('利用者とデータの関係','02　アプリが動く仕組み');
node(s,'users：利用者','id\nメールアドレス\nパスワードのハッシュ',44,223,254,166,true);
node(s,'transactions：収支','user_id、種類、金額、カテゴリ、日付、メモ',451,137,465,94,false,19,16);
node(s,'monthly_spending_goals：目標','user_id、年月、目標額（同じ利用者・年月で1件）',451,252,465,94,false,18,16);
node(s,'custom_categories：自作カテゴリ','user_id、名前、収入・支出、利用中かどうか',451,367,465,94,false,19,16);
line(s,298,306,75);line(s,373,184,0,230);arr(s,373,184,451);arr(s,373,299,451);arr(s,373,414,451);
tx(s,'1人に複数件',315,147,130,25,14,C.muted);
foot(s,'閲覧・編集・削除でもuser_idを条件に入れ、本人のデータだけを扱う。');
notes(s,'usersのidで収支、月別目標、自作カテゴリをひも付けます。月別支出目標はuser_idと年月の組を一意にし、同じ月なら更新します。自作カテゴリはcustom_にIDを付けたキーで収支から参照します。カテゴリを削除しても行そのものは消さず、is_activeを0にして新規入力の選択肢から外すため、履歴の名前を保持できます。取引IDだけで編集削除を行わず、ログイン中のuser_idも条件にして本人のデータだけを操作します。');

s=slide('ログインとセッションの役割','02　アプリが動く仕組み');
sub(s,'登録・ログイン時','パスワードはハッシュ化して保存。\nログイン時に入力値を検証する。',44,143,412,18);
sub(s,'ログイン後','Flask-Loginが利用者を識別。\nログインが必要なページを制御する。',508,143,408,18);
rule(s,44,284,872);
node(s,'ブラウザ','署名付きのセッションCookie',44,326,332,97);
node(s,'サーバー','SECRET_KEYで署名を検証',584,326,332,97,true);
arr(s,380,374,579);tx(s,'リクエストにCookieを添付',384,337,194,29,13,C.muted,false,'center');
foot(s,'秘密鍵はサーバーだけが保持。署名は暗号化ではない。フォームにはCSRF対策を使用。');
notes(s,'Werkzeugによるパスワードのハッシュ化と、Cookieの署名は別の処理です。ハッシュは元のパスワードをそのまま保存しないために使います。Flaskの標準セッションは署名で改ざんを検出しますが、内容を暗号化するものではありません。SECRET_KEYをブラウザに配ることはありません。Flask-WTFでCSRF対策も行っています。パスワード再設定やログイン試行制限などは今後の課題です。');

s=slide('月別集計の作り方','02　アプリが動く仕組み');
tx(s,'SQLで合計を求める',44,145,405,33,23,C.teal,true);
tx(s,'本人の支出だけを対象に、\n年月とカテゴリでグループ化する。',44,192,405,64,18,C.ink);
node(s,'集計するSQLの例','SELECT substr(date, 1, 7) AS month,\n       category, SUM(amount) AS total\nFROM transactions\nWHERE user_id = ? AND kind = \'expense\'\nGROUP BY month, category;',44,270,405,180,false,19,14);
tx(s,'Pythonで指標を計算',505,145,411,33,23,C.teal,true);
tx(s,'カテゴリの割合',505,203,411,28,17,C.muted);tx(s,'18,000 ÷ 40,000 × 100 = 45％',505,241,411,35,21,C.ink);
tx(s,'前月比',505,309,411,27,17,C.muted);tx(s,'(40,000 − 50,000) ÷ 50,000\n× 100 = −20％',505,347,411,63,20,C.ink);
foot(s,'計算例は架空データ。JinjaとCSSが集計結果をグラフ・金額一覧として表示する。');
notes(s,'左は実行用SQLの全文ではなく、集計の考え方を簡略化したものです。実際は日付の年月部分、収支種別、カテゴリでまとめます。analysis.pyで月別レポートを組み立て、Jinjaへ渡します。外部の分析APIを呼ばず、SQLiteとPythonで実現しています。');

s=slide('コードの役割とつながり','02　アプリが動く仕組み');
node(s,'templates/*.html','Jinjaで画面を生成',44,147,285,108,false,18);
node(s,'static/transactions.js・css','入力・送信・表示の更新\n画面の配色と配置',44,325,285,129,false,16);
node(s,'app.py','URLの受付・認証\n入力の検証\nDB接続・収支操作',376,226,220,173,true);
node(s,'カテゴリ・分析の処理','categories.py：標準カテゴリ\ncustom_categories.py：自作\nanalysis.py：月別の分析',643,137,273,148,false,18,15);
node(s,'schema.sql / migration.py','テーブル定義と既存DBの更新\n自作カテゴリ用のSQLも追加',643,325,273,129,false,16,16);
line(s,329,201,22);line(s,351,201,0,186);line(s,351,309,25);line(s,329,387,22);
line(s,596,309,25);line(s,621,212,0,177);line(s,621,212,22);line(s,621,389,22);
foot(s,'app.pyが必要な処理を呼び出し、結果をテンプレートへ渡す。');
notes(s,'現在の実行経路ではapp.py内のget_dbがSQLite接続をgに保持し、close_dbが終了時に閉じます。別にdb.pyというファイルもありますが、この経路では使いません。gは処理中の一時的な置き場であり、永続データはSQLiteに保存します。ファイルを分けることで処理と画面の役割を整理しています。');

s=slide('無料版PythonAnywhereで動作','03　クラウドでの公開');
tx(s,'中間発表時',44,143,255,32,20,C.muted,true);tx(s,'現在',44,305,255,32,20,C.teal,true);
node(s,'利用者のブラウザ','PCからアクセス',44,185,260,91);node(s,'自分のPC','FlaskとSQLiteを実行',531,185,385,91);arr(s,313,230,522);
node(s,'利用者のブラウザ','PC・スマートフォン',44,347,260,91);node(s,'PythonAnywhere','クラウド上でFlaskとSQLiteを実行',531,347,385,91,true);arr(s,313,392,522);tx(s,'インターネット',330,356,181,25,15,C.muted,false,'center');
foot(s,'公開URLから利用でき、自分のPCを起動し続ける必要がなくなった。');
notes(s,'無料版PythonAnywhereへ配置し、クラウド上での動作を確認しました。これは開発者が実施した結果の報告です。自分のPCでサーバーを起動し続ける必要がなくなりました。同時利用人数や性能は別途検証が必要です。',['https://help.pythonanywhere.com/pages/Flask/']);

s=slide('公開時の構成と運用','03　クラウドでの公開');
node(s,'Webサーバー','ブラウザからHTTPSで受信',44,145,261,106);node(s,'WSGI','Pythonアプリを呼び出す接点',350,145,260,106);node(s,'Flask','DBを読み書きして応答',655,145,261,106);arr(s,310,198,345);arr(s,615,198,650);
sub(s,'配置したもの','アプリのコードと必要なライブラリ\n仮想環境、WSGI設定\n環境変数SECRET_KEYとDBファイル',44,298,438,17);
sub(s,'無料枠で続けるために','Webアプリの有効期限を延長\n処理資源・外向き通信の制限を確認\nデータのバックアップを継続',520,298,396,17);
foot(s,'開発用のapp.runではなく、公開環境のWSGI設定からアプリを読み込む。');
notes(s,'WSGIはWebサーバーからPythonアプリを呼ぶための取り決めです。無料枠にはWebアプリの期限、処理資源、外向き通信の許可先などの制限があります。無期限無操作での稼働や20人同時利用の性能を保証するものではありません。',['https://help.pythonanywhere.com/pages/Flask/','https://help.pythonanywhere.com/pages/FreeAccountsFeatures/','https://help.pythonanywhere.com/pages/403ForbiddenError']);

s=slide('レシート読み取りを見送った理由','04　レシート機能とまとめ');
tx(s,'試作は行ったが、有料APIでの運用は採用しない。',44,142,872,40,25,C.teal,true);
sub(s,'画像対応AI API','画像から品目・金額を抽出し、\nカテゴリ候補を構造化できる。\n\n利用量に応じて料金が発生する。\nChatGPTの契約とは別料金。',44,224,414,18);
sub(s,'無料のOCRという選択肢','Tesseractなどで文字を抽出する。\n\nAPI利用料は不要でも、品目の解析、\nカテゴリ分類、画像の補正、\nクラウドへの導入は別途必要。',510,224,406,18);
foot(s,'今回は費用と開発期間を考え、手入力での家計管理を完成範囲とした。');
notes(s,'ローカルの作業環境には画像対応AI APIを呼び出す試作がありますが、今回の完成範囲では有料運用を行いません。公開ブランチには今回の自作カテゴリ変更だけを反映しています。全ての文字読み取りが有料という意味ではありません。TesseractはオープンソースのOCRで、文字抽出後の品目や金額の解析、分類、精度調整は別途実装します。',['https://help.openai.com/en/articles/9039756-managing-billing-for-chatgpt-and-the-api-platform','https://tesseract-ocr.github.io/tessdoc/']);

s=slide('レシートから収支を登録する設計','04　レシート機能とまとめ');
node(s,'1　画像を選ぶ','カメラ撮影・アップロード',44,146,260,106);node(s,'2　Flaskで受け取る','形式・サイズを確認',350,146,260,106);node(s,'3　AI APIで解析','品目・金額をJSONで返す',656,146,260,106);arr(s,310,198,345);arr(s,616,198,651);
node(s,'6　SQLiteへ保存','修正後の収支を一括登録',44,308,260,106,true);node(s,'5　確認・修正','利用者が誤読を直す',350,308,260,106,true);node(s,'4　候補を表示','品目・金額・カテゴリ',656,308,260,106);
line(s,786,252,0,52,C.teal);tx(s,'⌄',775,282,23,28,24,C.teal,true);arr(s,345,360,310);arr(s,651,360,616);
foot(s,'例：パン／180円／食費。読み取り結果は自動確定せず、人が確認してから保存する。');
notes(s,'試作のreceipt_ocr.pyで画像をResponses APIへ送信し、構造化した候補を受け取ります。receipts.pyと確認画面で利用者が修正してから一括保存します。APIキーはサーバー側の環境変数で管理します。実運用にはAPI費用、PythonAnywhereの外向き通信可否、レシート画像の扱いも確認する必要があります。');

s=slide('開発の成果と今後の課題','04　レシート機能とまとめ');
tx(s,'手入力で記録し、月ごとの支出を振り返れる\n家計簿をクラウド上で利用できるようにした。',44,149,872,90,28,C.ink,true);
rule(s,44,268,872);
sub(s,'開発を通して理解したこと','画面、Flask、DBの役割分担\nデータ保存から画面更新までの流れ\nアプリをクラウドに配置する方法',44,308,420,18);
sub(s,'今後確かめること','実際の入力しやすさ・続けやすさ\n月別の収入・支出・差額の表示\nバックアップと同時利用時の動作',508,308,408,18);
foot(s,'機能を実装した成果に加え、利用者の評価と継続運用を次の課題とする。');
notes(s,'中間発表で課題としていた分類、グラフ、予算管理、クラウド公開を進めました。レシート読み取りは試作した上で有料運用を見送り、手入力での家計管理を完成範囲としました。今後は機能追加だけでなく、利用者の継続しやすさや実運用の安定性を確認していきます。ご清聴ありがとうございました。');

await fs.mkdir('redesign-render',{recursive:true});
await (await PresentationFile.exportPptx(p)).save('redesign-candidate.pptx');
await fs.writeFile('redesign-proto.json',JSON.stringify(p.toProto()));
console.log('Exported '+p.slides.items.length+' slides');
for(let i=0;i<p.slides.items.length;i++){const b=await p.export({slide:p.slides.items[i],format:'png',scale:1});await fs.writeFile(`redesign-render/${String(i+1).padStart(2,'0')}.png`,new Uint8Array(await b.arrayBuffer()));console.log('Rendered '+(i+1));}
