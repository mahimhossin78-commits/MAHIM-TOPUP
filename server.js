const express = require('express');
const cookieSession = require('cookie-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();
app.set('trust proxy', 1);
const PORT = Number(process.env.PORT || 3000);
const SESSION_SECRET = process.env.SESSION_SECRET || 'CHANGE_THIS_SESSION_SECRET';
const DATA_DIR = path.join(__dirname, 'data');
const DB_FILE = path.join(DATA_DIR, 'db.json');
fs.mkdirSync(DATA_DIR, { recursive: true });

const defaultSettings = {
  siteName: 'MAHIM TOPUP',
  notice: 'অর্ডার করার আগে সঠিক UID ও Transaction ID দিন।',
  heroTitle: 'ফিডওয়ে ৩ সকল অফার',
  heroText: 'দ্রুত ও নিরাপদ Free Fire Top-Up',
  supportTelegram: 'https://t.me/',
  supportWhatsApp: 'https://wa.me/',
  supportGroup: '#',
  bkash: '01346261152',
  nagad: '01890884185',
  offerEditOnceDaily: true,
  offers: [
    ['Weekly', 165], ['Monthly', 850], ['25 Diamond', 23], ['50 Diamond', 45],
    ['115 Diamond', 85], ['240 Diamond', 175], ['355 Diamond', 245], ['480 Diamond', 340],
    ['505 Diamond', 360], ['610 Diamond', 430], ['850 Diamond', 600], ['1090 Diamond', 735],
    ['1240 Diamond', 855], ['2530 Diamond', 1690], ['5060 Diamond', 3240], ['10120 Diamond', 5500]
  ].map(([name, price]) => ({ name, price })),
  specialOffers: [
    { title: 'FREE SPAIN', subtitle: 'Special Offer', image: '' },
    { title: 'PREMIUM USER', subtitle: 'Special Offer', image: '' },
    { title: 'FRIDAY OFFER', subtitle: 'Special Offer', image: '' }
  ]
};

function loadDb() {
  if (!fs.existsSync(DB_FILE)) {
    const adminPassword = process.env.ADMIN_PASSWORD || 'ChangeMe123!';
    const db = { users: [], orders: [], settings: structuredClone(defaultSettings), admin: { email: process.env.ADMIN_EMAIL || 'admin@mahimtopup.local', passwordHash: bcrypt.hashSync(adminPassword, 10) } };
    fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    return db;
  }
  const db = JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
  db.settings = { ...structuredClone(defaultSettings), ...(db.settings || {}) };
  db.users ||= []; db.orders ||= []; db.admin ||= { email: process.env.ADMIN_EMAIL || 'admin@mahimtopup.local', passwordHash: bcrypt.hashSync(process.env.ADMIN_PASSWORD || 'ChangeMe123!', 10) };
  return db;
}
function saveDb(db) { fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2)); }
let db = loadDb();
function reload() { db = loadDb(); return db; }
function id(prefix) { return prefix + crypto.randomBytes(5).toString('hex').toUpperCase(); }
function today() { return new Date().toISOString().slice(0,10); }
function currentUser(req) { return req.session?.userId ? db.users.find(u => u.id === req.session.userId) : null; }
function requireUser(req, res, next) { const u = currentUser(req); if (!u) return res.status(401).json({error:'LOGIN_REQUIRED'}); req.user = u; next(); }
function requireAdmin(req, res, next) { if (req.session?.role !== 'admin') return res.status(401).json({error:'ADMIN_REQUIRED'}); next(); }
function sanitizeUser(u) { const { passwordHash, ...safe } = u; return safe; }
function publicSettings() { const s = db.settings; return { ...s, adminEditDate: s.adminEditDate || null }; }

app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieSession({ name:'mahim_session', keys:[SESSION_SECRET], httpOnly:true, sameSite:'lax', secure: process.env.NODE_ENV === 'production', maxAge: 7*24*60*60*1000 }));
app.use(express.static(path.join(__dirname, 'public')));

app.get('/api/settings', (req,res)=>res.json(publicSettings()));
app.get('/api/me', (req,res)=>{ const u=currentUser(req); res.json({ loggedIn:!!u, user:u?sanitizeUser(u):null, admin:req.session?.role==='admin' }); });

app.post('/api/register', (req,res)=>{
  reload(); const { name, email, password } = req.body;
  if (!name || !email || !password || password.length < 6) return res.status(400).json({error:'নাম, ইমেইল এবং কমপক্ষে ৬ অক্ষরের পাসওয়ার্ড দিন।'});
  if (db.users.some(u=>u.email.toLowerCase()===email.toLowerCase())) return res.status(409).json({error:'এই ইমেইল দিয়ে অ্যাকাউন্ট আছে।'});
  const user={id:id('CUS-'), name:name.trim(), email:email.trim().toLowerCase(), passwordHash:bcrypt.hashSync(password,10), createdAt:new Date().toISOString()};
  db.users.push(user); saveDb(db); req.session.userId=user.id; req.session.role='customer'; res.json({ok:true,user:sanitizeUser(user)});
});
app.post('/api/login', (req,res)=>{
  reload(); const { email,password }=req.body; const user=db.users.find(u=>u.email.toLowerCase()===String(email||'').toLowerCase());
  if (!user || !bcrypt.compareSync(password||'',user.passwordHash)) return res.status(401).json({error:'ইমেইল বা পাসওয়ার্ড সঠিক নয়।'});
  req.session.userId=user.id; req.session.role='customer'; res.json({ok:true,user:sanitizeUser(user)});
});
app.post('/api/admin/login',(req,res)=>{
  reload(); const {email,password}=req.body;
  if(email!==db.admin.email || !bcrypt.compareSync(password||'',db.admin.passwordHash)) return res.status(401).json({error:'Admin login তথ্য সঠিক নয়।'});
  req.session.role='admin'; req.session.userId=null; res.json({ok:true});
});
app.post('/api/logout',(req,res)=>{req.session=null;res.json({ok:true});});

app.post('/api/orders', requireUser, (req,res)=>{
  reload();
  const { packageName, price, uid, trxId, paymentMethod } = req.body;
  if(!packageName || !uid || !trxId || !paymentMethod) return res.status(400).json({error:'প্যাকেজ, UID, পেমেন্ট মাধ্যম ও Transaction ID দিন।'});
  const amount=Number(price); const valid=db.settings.offers.find(o=>o.name===packageName && Number(o.price)===amount);
  if(!valid) return res.status(400).json({error:'অবৈধ প্যাকেজ বা মূল্য।'});
  if(!/^\d{6,15}$/.test(String(uid).trim())) return res.status(400).json({error:'সঠিক Player UID দিন।'});
  const order={id:id('ORD-'), serial:db.orders.length+1, userId:req.user.id, customerId:req.user.id, customerName:req.user.name, packageName, price:amount, uid:String(uid).trim(), trxId:String(trxId).trim(), paymentMethod, status:'PENDING', createdAt:new Date().toISOString(), adminNote:''};
  db.orders.unshift(order); saveDb(db); res.json({ok:true,order});
});
app.get('/api/orders', requireUser, (req,res)=>{reload();res.json(db.orders.filter(o=>o.userId===req.user.id));});
app.get('/api/public/stats', (req,res)=>{
  reload();
  const counts={confirmed:0,pending:0,rejected:0,completed:0};
  for(const o of db.orders){ if(o.status==='CONFIRMED') counts.confirmed++; else if(o.status==='PENDING') counts.pending++; else if(o.status==='REJECTED'||o.status==='CANCELLED') counts.rejected++; else if(o.status==='COMPLETED') counts.completed++; }
  const recent=db.orders.slice(0,10).map(o=>({serial:o.serial,customerId:o.customerId,uid:o.uid,packageName:o.packageName,price:o.price,paymentMethod:o.paymentMethod,status:o.status,time:new Date(o.createdAt).toLocaleTimeString('en-BD',{hour:'2-digit',minute:'2-digit'})}));
  res.json({...counts,recent});
});
app.get('/api/admin/orders', requireAdmin, (req,res)=>{reload();res.json(db.orders);});
app.get('/api/admin/users', requireAdmin, (req,res)=>{reload();res.json(db.users.map(sanitizeUser));});
app.patch('/api/admin/orders/:id', requireAdmin, (req,res)=>{
  reload(); const o=db.orders.find(x=>x.id===req.params.id); if(!o)return res.status(404).json({error:'Order not found'});
  const allowed=['CONFIRMED','REJECTED','CANCELLED','PENDING','COMPLETED']; if(!allowed.includes(req.body.status))return res.status(400).json({error:'Invalid status'});
  o.status=req.body.status; o.adminNote=String(req.body.adminNote||''); o.updatedAt=new Date().toISOString(); saveDb(db); res.json({ok:true,order:o});
});
app.patch('/api/admin/settings', requireAdmin, (req,res)=>{
  reload(); const s=db.settings;
  if(s.offerEditOnceDaily && s.adminEditDate===today()) return res.status(429).json({error:'আজকের কাস্টমাইজ সীমা শেষ। Offer/মূল্য/পেমেন্ট সেটিং দিনে একবার পরিবর্তন করা যাবে।'});
  const b=req.body;
  if(typeof b.siteName==='string')s.siteName=b.siteName.trim().slice(0,80);
  if(typeof b.notice==='string')s.notice=b.notice.slice(0,250);
  if(typeof b.heroTitle==='string')s.heroTitle=b.heroTitle.slice(0,100);
  if(typeof b.heroText==='string')s.heroText=b.heroText.slice(0,150);
  if(typeof b.bkash==='string')s.bkash=b.bkash.trim(); if(typeof b.nagad==='string')s.nagad=b.nagad.trim();
  if(typeof b.supportTelegram==='string')s.supportTelegram=b.supportTelegram; if(typeof b.supportWhatsApp==='string')s.supportWhatsApp=b.supportWhatsApp; if(typeof b.supportGroup==='string')s.supportGroup=b.supportGroup;
  if(Array.isArray(b.offers) && b.offers.length){
    if(b.offers.some(o=>!o.name || !Number.isFinite(Number(o.price)) || Number(o.price)<0))return res.status(400).json({error:'Offer data ভুল।'});
    s.offers=b.offers.map(o=>({name:String(o.name).trim().slice(0,60),price:Number(o.price)}));
  }
  if(Array.isArray(b.specialOffers))s.specialOffers=b.specialOffers.slice(0,6).map(x=>({title:String(x.title||'').slice(0,50),subtitle:String(x.subtitle||'').slice(0,50),image:String(x.image||'')}));
  s.adminEditDate=today(); saveDb(db); res.json({ok:true,settings:publicSettings()});
});
app.post('/api/admin/password', requireAdmin, (req,res)=>{
  reload(); const {oldPassword,newPassword}=req.body; if(!bcrypt.compareSync(oldPassword||'',db.admin.passwordHash))return res.status(400).json({error:'পুরোনো পাসওয়ার্ড সঠিক নয়।'}); if(!newPassword||newPassword.length<8)return res.status(400).json({error:'নতুন পাসওয়ার্ড কমপক্ষে ৮ অক্ষরের করুন।'}); db.admin.passwordHash=bcrypt.hashSync(newPassword,10); saveDb(db); res.json({ok:true});
});

app.get('*',(req,res)=>res.sendFile(path.join(__dirname,'public','index.html')));
app.listen(PORT,()=>console.log(`MAHIM TOPUP running on port ${PORT}`));
