const {test}=require('node:test');
const assert=require('node:assert/strict');
const {createApp}=require('../server');

test('complete classroom workflow, isolation, validation, assessment and reopening',async(t)=>{
 const {app,db}=await createApp({database:':memory:',teacherId:'teacher',teacherPassword:'a-secure-teacher-password'});
 const server=app.listen(0,'127.0.0.1'); await new Promise(r=>server.once('listening',r));
 t.after(async()=>{await new Promise(r=>server.close(r));db.close();});
 const origin='http://127.0.0.1:'+server.address().port;
 function client(){let cookie='',csrf='';return async(url,body,expected=200)=>{const r=await fetch(origin+'/api/'+url,{method:body?'POST':'GET',headers:{cookie,...(body?{'Content-Type':'application/json','X-CSRF-Token':csrf}:{})},body:body?JSON.stringify(body):undefined});if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=r.headers.get('content-type')?.includes('application/json')?await r.json():await r.text();if(data?.csrf)csrf=data.csrf;assert.equal(r.status,expected,JSON.stringify(data));return data;};}
 const teacher=client(),alice=client(),bob=client();
 await teacher('session');await teacher('login',{login:'teacher',password:'a-secure-teacher-password',role:'teacher'});
 const {id}=await teacher('teacher/students',{login:'alice',password:'student-pass',name:'Alice',class:'5 Cemerlang'},201);
 await teacher('teacher/students',{login:'bob',password:'student-pass',name:'Bob',class:'5 Cemerlang'},201);
 await teacher('teacher/students',{login:'alice',password:'student-pass',name:'Duplicate',class:'5 Cemerlang'},400);
 await alice('session');await alice('login',{login:'alice',password:'student-pass',role:'student'});
 await bob('session');await bob('login',{login:'bob',password:'student-pass',role:'student'});
 await alice('teacher/students',undefined,403);
 let response=await fetch(origin+'/teacher-dashboard.html');assert.equal(response.url,origin+'/');
 response=await fetch(origin+'/api/student/answers',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});assert.equal(response.status,403);
 const answers={favourite:'Dog',disliked:'Cat',likes:['Dogs are loyal.','Dogs play with me.','They guard our home.','They are friendly.'],dislikes:['Cats scratch furniture.','I am allergic to their fur.']};
 await alice('student/answers',{answers:{...answers,disliked:'Dog'},submit:true},400);
 await alice('student/answers',{answers:{...answers,likes:['same','same','same','same']},submit:true},400);
 await alice('student/answers',{answers});assert.equal((await alice('student')).status,'Draft');
 await alice('student/answers',{answers,submit:true});
 assert.equal((await alice('student')).status,'Submitted');assert.equal(await bob('student'),null);
 await alice('student/answers',{answers,submit:true},409);
 const list=await teacher('teacher/students');assert.deepEqual(list.find(s=>s.id===id).answers,answers);
 await teacher('teacher/submissions/'+id,{marks:[5,2,2,2],feedback:'Invalid'},400);
 await teacher('teacher/submissions/'+id,{marks:[4,2,1,2],feedback:'Lovely ideas. Try more descriptive words.'});
 const assessed=await alice('student');assert.equal(assessed.status,'Reviewed');assert.deepEqual(assessed.marks,[4,2,1,2]);assert.match(assessed.feedback,/Lovely/);
 await bob('teacher/submissions/'+id,{marks:[4,2,2,2],feedback:'Cheat'},403);
 const csv=await teacher('teacher/export');assert.match(csv,/Alice/);assert.match(csv,/Dogs are loyal/);assert.match(csv,/Lovely ideas/);
 await teacher('teacher/submissions/'+id,{reopen:true});assert.equal((await alice('student')).status,'Reopened');
 await alice('student/answers',{answers:{...answers,likes:['Dogs are very loyal.',...answers.likes.slice(1)]},submit:true});assert.equal((await alice('student')).marks,null);
 await teacher('teacher/students/'+id+'/password',{password:'x'.repeat(73)},400);
 await teacher('teacher/students/'+id+'/password',{password:'updated-pass'});await alice('student',undefined,401);
 await alice('session');await alice('login',{login:'alice',password:'updated-pass',role:'student'});
 assert.equal(db.prepare('SELECT hash FROM users WHERE id=?').get(id).hash.startsWith('$2'),true);
 await teacher('logout',{});await teacher('teacher/students',undefined,401);
});

test('first-time teacher credentials are required',async()=>{await assert.rejects(createApp({database:':memory:'}),/First run requires/);});
