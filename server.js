const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const helmet = require('helmet');
const { rateLimit } = require('express-rate-limit');
const { DatabaseSync } = require('node:sqlite');
const { randomBytes } = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

async function createApp(options = {}) {
  const filename = options.database || process.env.DATABASE_PATH || path.join(__dirname, 'data/app.sqlite');
  if (filename !== ':memory:') fs.mkdirSync(path.dirname(filename), { recursive: true });
  const db = new DatabaseSync(filename);
  db.exec(`PRAGMA foreign_keys=ON; PRAGMA journal_mode=WAL;
    CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY, login TEXT UNIQUE NOT NULL, hash TEXT NOT NULL, name TEXT NOT NULL, class TEXT NOT NULL DEFAULT '', role TEXT NOT NULL CHECK(role IN ('student','teacher')));
    CREATE TABLE IF NOT EXISTS submissions(student_id INTEGER PRIMARY KEY REFERENCES users(id), answers TEXT NOT NULL, status TEXT NOT NULL, submitted_at TEXT, marks TEXT, feedback TEXT NOT NULL DEFAULT '');
    CREATE TABLE IF NOT EXISTS sessions(sid TEXT PRIMARY KEY, data TEXT NOT NULL, expires INTEGER NOT NULL);`);
  const teacherExists = db.prepare("SELECT id FROM users WHERE role='teacher'").get();
  if (!teacherExists) {
    const login = options.teacherId || process.env.TEACHER_LOGIN_ID;
    const password = options.teacherPassword || process.env.TEACHER_PASSWORD;
    if (typeof login !== 'string' || !/^[A-Za-z0-9._-]{1,80}$/.test(login) || typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72) throw new Error('First run requires a valid TEACHER_LOGIN_ID and TEACHER_PASSWORD (at least 12 characters, at most 72 UTF-8 bytes).');
    db.prepare('INSERT INTO users(login,hash,name,role) VALUES(?,?,?,?)').run(login, await bcrypt.hash(password, 12), 'Teacher', 'teacher');
  }
  class SQLiteStore extends session.Store {
    get(sid, cb) { try { const row = db.prepare('SELECT data FROM sessions WHERE sid=? AND expires>?').get(sid, Date.now()); cb(null, row ? JSON.parse(row.data) : null); } catch(e) { cb(e); } }
    set(sid, value, cb = () => {}) { try { db.prepare('DELETE FROM sessions WHERE expires<?').run(Date.now()); db.prepare('INSERT OR REPLACE INTO sessions VALUES(?,?,?)').run(sid, JSON.stringify(value), Date.now()+8*3600000); cb(); } catch(e) { cb(e); } }
    destroy(sid, cb = () => {}) { try { db.prepare('DELETE FROM sessions WHERE sid=?').run(sid); cb(); } catch(e) { cb(e); } }
    touch(sid, value, cb) { this.set(sid, value, cb); }
  }
  const app = express();
  const production = process.env.NODE_ENV === 'production';
  if (production && (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32)) throw new Error('SESSION_SECRET of at least 32 characters is required in production.');
  if (process.env.TRUST_PROXY === '1') app.set('trust proxy', 1);
  app.use(helmet()); app.use(express.json({ limit: '32kb' }));
  app.use(session({ secret: process.env.SESSION_SECRET || randomBytes(48).toString('hex'), store: new SQLiteStore(), resave: false, saveUninitialized: false, cookie: { httpOnly: true, sameSite: 'strict', secure: production, maxAge: 8*3600000 } }));
  app.use('/api', (req,res,next) => {
    if (!req.session.csrf) req.session.csrf = randomBytes(24).toString('hex');
    res.set('Cache-Control','no-store');
    if (!['GET','HEAD','OPTIONS'].includes(req.method) && req.get('X-CSRF-Token') !== req.session.csrf) return res.status(403).json({error:'Please refresh the page and try again.'});
    next();
  });
  const guard = role => (req,res,next) => { if (!req.session.user) return res.status(401).json({error:'Please log in.'}); if (role && req.session.user.role !== role) return res.status(403).json({error:'Access denied.'}); next(); };
  const safe = fn => (req,res,next) => Promise.resolve(fn(req,res,next)).catch(next);
  const fail = message => { const e = new Error(message); e.status = 400; throw e; };
  const text = (v,max=1000) => typeof v === 'string' && v.trim().length > 0 && v.trim().length <= max;
  app.get('/api/session', (req,res) => res.json({user:req.session.user || null, csrf:req.session.csrf}));
  app.post('/api/login', rateLimit({windowMs:15*60*1000,limit:30, standardHeaders:'draft-8',legacyHeaders:false}), safe(async(req,res) => {
    const {login,password,role} = req.body;
    if (!text(login,80) || !text(password,128) || !['teacher','student'].includes(role)) return res.status(400).json({error:'Enter your login ID, password, and role.'});
    const u = db.prepare('SELECT * FROM users WHERE login=? AND role=?').get(login.trim(),role);
    if (!u || !await bcrypt.compare(password,u.hash)) return res.status(401).json({error:'Incorrect login ID or password.'});
    await new Promise((resolve,reject)=>req.session.regenerate(e=>e?reject(e):resolve()));
    req.session.user = {id:u.id,login:u.login,name:u.name,class:u.class,role:u.role}; req.session.csrf=randomBytes(24).toString('hex');
    res.json({user:req.session.user,csrf:req.session.csrf});
  }));
  app.post('/api/logout',guard(),(req,res,next)=>req.session.destroy(e=>e?next(e):res.json({ok:true})));
  app.get('/api/student',guard('student'),(req,res)=> { const row=db.prepare('SELECT * FROM submissions WHERE student_id=?').get(req.session.user.id); res.json(row?{...row,answers:JSON.parse(row.answers),marks:row.marks?JSON.parse(row.marks):null}:null); });
  const animals=['Dog','Cat','Bird','Fish'];
  function validateAnswers(a,complete) {
    if (!a || !animals.includes(a.favourite) || (a.disliked && (!animals.includes(a.disliked)||a.disliked===a.favourite))) fail('Choose two different animals.');
    for (const [key,count] of [['likes',4],['dislikes',2]]) {
      if (!Array.isArray(a[key]) || a[key].length!==count || a[key].some(v=>typeof v!=='string'||v.length>1000)) fail('Check your reasons (maximum 1,000 characters each).');
      a[key]=a[key].map(v=>v.trim());
      if (complete && (a[key].some(v=>!v) || new Set(a[key].map(v=>v.toLowerCase())).size!==count)) fail('Please provide all reasons, using different reasons in each box.');
    }
    if(complete&&!a.disliked) fail('Choose an animal you dislike.');
    return {favourite:a.favourite,disliked:a.disliked||'',likes:a.likes,dislikes:a.dislikes};
  }
  app.post('/api/student/answers',guard('student'),safe(async(req,res)=> {
    const id=req.session.user.id, previous=db.prepare('SELECT status FROM submissions WHERE student_id=?').get(id);
    if(previous && !['Draft','Reopened'].includes(previous.status)) return res.status(409).json({error:'Your answers are locked. Ask your teacher to reopen them.'});
    const complete=req.body.submit===true, answers=validateAnswers(req.body.answers,complete);
    const status=complete?'Submitted':previous?.status==='Reopened'?'Reopened':'Draft';
    db.prepare(`INSERT INTO submissions(student_id,answers,status,submitted_at) VALUES(?,?,?,?) ON CONFLICT(student_id) DO UPDATE SET answers=excluded.answers,status=excluded.status,submitted_at=CASE WHEN excluded.status='Submitted' THEN excluded.submitted_at ELSE submissions.submitted_at END, marks=NULL,feedback=''`).run(id,JSON.stringify(answers),status,complete?new Date().toISOString():null);
    res.json({ok:true,status});
  }));
  app.get('/api/teacher/students',guard('teacher'),(req,res)=> {
    const rows=db.prepare(`SELECT u.id,u.login,u.name,u.class,s.answers,s.status,s.submitted_at,s.marks,s.feedback FROM users u LEFT JOIN submissions s ON s.student_id=u.id WHERE u.role='student' ORDER BY u.name`).all();
    res.json(rows.map(r=>({...r,status:r.status||'Not started',answers:r.answers?JSON.parse(r.answers):null,marks:r.marks?JSON.parse(r.marks):null})));
  });
  app.post('/api/teacher/students',guard('teacher'),safe(async(req,res)=> {
    const {login,password,name,class:group}=req.body;
    if(!text(login,80)||! /^[A-Za-z0-9._-]+$/.test(login)||!text(name,100)||!text(group,60)||typeof password!=='string'||password.length<8||Buffer.byteLength(password,'utf8')>72) fail('Use a valid ID, name, class, and password of at least 8 characters and at most 72 UTF-8 bytes.');
    if(db.prepare('SELECT id FROM users WHERE login=?').get(login)) fail('That login ID is already in use.');
    const result=db.prepare("INSERT INTO users(login,hash,name,class,role) VALUES(?,?,?,?,'student')").run(login,await bcrypt.hash(password,12),name.trim(),group.trim()); res.status(201).json({id:Number(result.lastInsertRowid)});
  }));
  app.post('/api/teacher/students/:id/password',guard('teacher'),safe(async(req,res)=> {
    if(typeof req.body.password!=='string'||req.body.password.length<8||Buffer.byteLength(req.body.password,'utf8')>72) fail('Password must contain at least 8 characters and at most 72 UTF-8 bytes.');
    const result=db.prepare("UPDATE users SET hash=? WHERE id=? AND role='student'").run(await bcrypt.hash(req.body.password,12),req.params.id);
    if(!result.changes) return res.status(404).json({error:'Student not found.'});
    for(const s of db.prepare('SELECT sid,data FROM sessions').all()) if(JSON.parse(s.data).user?.id===Number(req.params.id)) db.prepare('DELETE FROM sessions WHERE sid=?').run(s.sid);
    res.json({ok:true});
  }));
  app.post('/api/teacher/submissions/:id',guard('teacher'),safe(async(req,res)=> {
    const row=db.prepare('SELECT * FROM submissions WHERE student_id=?').get(req.params.id);
    if(!row||!['Submitted','Reviewed'].includes(row.status)) fail('Only submitted answers can be assessed or reopened.');
    if(req.body.reopen===true) db.prepare("UPDATE submissions SET status='Reopened',marks=NULL,feedback='' WHERE student_id=?").run(req.params.id);
    else {
      const {marks,feedback}=req.body;
      if(!Array.isArray(marks)||marks.length!==4||marks.some((v,i)=>!Number.isInteger(v)||v<0||v>[4,2,2,2][i])||typeof feedback!=='string'||feedback.length>4000) fail('Check all four marks and feedback.');
      db.prepare("UPDATE submissions SET status='Reviewed',marks=?,feedback=? WHERE student_id=?").run(JSON.stringify(marks),feedback.trim(),req.params.id);
    } res.json({ok:true});
  }));
  app.get('/api/teacher/export',guard('teacher'),(req,res)=> {
    const rows=db.prepare("SELECT u.login,u.name,u.class,s.* FROM users u LEFT JOIN submissions s ON s.student_id=u.id WHERE u.role='student'").all();
    const cell=v=>'"'+String(v??'').replace(/^[=+@\-\t\r]/,"'$&").replaceAll('"','""')+'"';
    const output=[['Student ID','Name','Class','Favourite','Disliked','Like 1','Like 2','Like 3','Like 4','Dislike 1','Dislike 2','Submitted at','Status','Like marks','Dislike marks','Vocabulary','Structure','Total','Feedback']];
    for(const r of rows){const a=r.answers?JSON.parse(r.answers):{},m=r.marks?JSON.parse(r.marks):[];output.push([r.login,r.name,r.class,a.favourite,a.disliked,...(a.likes||Array(4).fill('')),...(a.dislikes||Array(2).fill('')),r.submitted_at,r.status||'Not started',...Array.from({length:4},(_,i)=>m[i]??''),m.length?m.reduce((a,b)=>a+b,0):'',r.feedback]);}
    res.set({'Content-Type':'text/csv; charset=utf-8','Content-Disposition':'attachment; filename="paws-and-poems.csv"'}).send('\ufeff'+output.map(r=>r.map(cell).join(',')).join('\r\n'));
  });
  for(const [page,role] of [['student-dashboard.html','student'],['activity.html','student'],['teacher-dashboard.html','teacher'],['submission-review.html','teacher']]) app.get('/'+page,(req,res,next)=> { if(!req.session.user) return res.redirect('/'); if(req.session.user.role!==role) return res.status(403).send('Access denied'); next(); });
  app.use(express.static(path.join(__dirname,'public')));
  app.use((err,req,res,next)=> { if(!err.status) console.error(err); res.status(err.status||500).json({error:err.status?err.message:'Something went wrong. Please try again.'}); });
  return {app,db};
}
if(require.main===module) createApp().then(({app})=>app.listen(process.env.PORT||3000,'0.0.0.0',()=>console.log('Paws & Poems is running on port '+(process.env.PORT||3000)))).catch(e=>{console.error(e.message);process.exit(1)});
module.exports={createApp};
