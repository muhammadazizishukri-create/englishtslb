const bcrypt=require('bcrypt');
const {createApp}=require('./server');
(async()=>{
 if(process.env.NODE_ENV==='production')throw new Error('Demo seeding is disabled in production.');
 const password=process.env.DEMO_STUDENT_PASSWORD;
 if(!password||password.length<8||Buffer.byteLength(password,'utf8')>72)throw new Error('Set DEMO_STUDENT_PASSWORD to at least 8 characters and at most 72 UTF-8 bytes.');
 const {db}=await createApp();
 try{
  const hash=await bcrypt.hash(password,12);
  const insert=db.prepare("INSERT INTO users(login,hash,name,class,role) VALUES(?,?,?,?,'student') ON CONFLICT(login) DO NOTHING");
  insert.run('student01',hash,'Aina Farhana','5 Cemerlang');
  insert.run('student02',hash,'Adam Hakimi','5 Bestari');
  console.log('Demo accounts available: student01 and student02. Existing accounts and passwords were left unchanged.');
 }finally{db.close();}
})().catch(e=>{console.error(e.message);process.exit(1)});
