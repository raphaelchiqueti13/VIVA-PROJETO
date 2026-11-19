import "dotenv/config";
import express from "express";
import cors from "cors";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import crypto from "node:crypto";
import { db } from "./db.js";
import { isEmailConfigured, sendPasswordResetEmail, sendPasswordChangedEmail, sendDonationConfirmedEmail } from "./mail.js";
import { insertNotification, notifyCampaignSubscribers } from "./notifications.js";
import { buildAppointmentSlots, isAllowedAppointmentTime } from "./appointments.js";
import path from "node:path";
import { fileURLToPath } from "node:url";

const app = express();
app.set("trust proxy", process.env.TRUST_PROXY === "true" ? 1 : false);
const PORT = Number(process.env.PORT || 3001);
const isProduction = process.env.NODE_ENV === "production";
const JWT_SECRET = process.env.JWT_SECRET;
if (isProduction && (!JWT_SECRET || JWT_SECRET.length < 32)) {
  throw new Error("Em produção, configure JWT_SECRET com pelo menos 32 caracteres aleatórios.");
}
const signingSecret = JWT_SECRET || "local-development-only-secret-change-before-deploying-32";
const allowedOrigins = (process.env.CORS_ORIGINS || "")
  .split(",").map(v => v.trim()).filter(Boolean);

app.disable("x-powered-by");
app.use((req,res,next)=>{
  const origin=req.headers.origin;
  if(origin){
    let sameOrigin=false;
    try {const parsed=new URL(origin);sameOrigin=parsed.host===req.headers.host && ["http:","https:"].includes(parsed.protocol);}catch{}
    if(!sameOrigin && (isProduction ? !allowedOrigins.includes(origin) : (allowedOrigins.length && !allowedOrigins.includes(origin)))) return res.status(403).json({error:"Origem não autorizada."});
  }
  next();
});
app.use(cors((req,callback)=>{
  const origin=req.headers.origin;
  let same=false;
  try {same=Boolean(origin && new URL(origin).host===req.headers.host);}catch{}
  callback(null,{origin:!origin || same || allowedOrigins.includes(origin),methods:["GET","POST","PATCH","PUT","DELETE","OPTIONS"],allowedHeaders:["Content-Type","Authorization"]});
}));
app.use(express.json({ limit: "100kb" }));
const cspConnectSources = (process.env.CSP_CONNECT_SRC || "")
  .split(",").map(value => value.trim()).filter(Boolean);
app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  res.set("X-Frame-Options", "DENY");
  res.set("Referrer-Policy", "strict-origin-when-cross-origin");
  res.set("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.set("Cross-Origin-Resource-Policy", "same-origin");
  res.set("Content-Security-Policy", [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    "script-src 'self' https://vlibras.gov.br https://cdn.jsdelivr.net",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data: https://vlibras.gov.br https://cdn.jsdelivr.net",
    "frame-src 'self' https://vlibras.gov.br",
    `connect-src 'self' ${cspConnectSources.join(" ")}`
  ].join("; "));
  if (isProduction && req.secure) {
    res.set("Strict-Transport-Security", "max-age=31536000");
  }
  if (req.path.startsWith("/api/")) res.set("Cache-Control", "no-store");
  next();
});

// Limitação simples por IP para reduzir tentativas automatizadas. Em produção com
// múltiplas instâncias, substitua por rate limit compartilhado (Redis/gateway).
const attempts = new Map();
const cleanup = setInterval(() => { const now=Date.now(); for (const [key,item] of attempts) if(item.resetAt < now) attempts.delete(key); }, 60000);
cleanup.unref();
function rateLimit({ windowMs = 15 * 60 * 1000, max = 30 } = {}) {
  return (req, res, next) => {
    const key = `${req.ip}:${req.path}`;
    const now = Date.now();
    const item = attempts.get(key);
    if (!item || now > item.resetAt) attempts.set(key, { count: 1, resetAt: now + windowMs });
    else if (++item.count > max) return res.status(429).json({ error: "Muitas tentativas. Aguarde alguns minutos e tente novamente." });
    next();
  };
}

const safeUser = (u) => ({
  id: u.id, name: u.name, email: u.email, role: u.role,
  bloodType: u.blood_type, bloodTypeVerified: Boolean(u.blood_type_verified),
  region: u.region, lastDonationDate: u.last_donation_date,
  notificationCampaigns: Boolean(u.notification_campaigns),
  notificationEligibility: Boolean(u.notification_eligibility),
  profileCompleted: Boolean(u.profile_completed),
  createdAt: u.created_at,
  hemocenterId: u.hemocenter_id || null,
  hemocenterName: u.hemocenter_id ? (db.prepare("SELECT name FROM hemocenters WHERE id=?").get(u.hemocenter_id)?.name || null) : null
});
const tokenFor = (u) => jwt.sign({ id: u.id, role: u.role, authVersion: Number(u.auth_version || 0) }, signingSecret, { expiresIn: "8h", issuer: "viva-plus", audience: "viva-plus-web" });
function auth(req, res, next) {
  const token = (req.headers.authorization || "").replace(/^Bearer\s+/i, "");
  try {
    if (!token) throw new Error("missing");
    req.auth = jwt.verify(token, signingSecret, { issuer: "viva-plus", audience: "viva-plus-web" });
    req.user = db.prepare("SELECT * FROM users WHERE id = ? AND active=1").get(req.auth.id);
    if (!req.user) throw new Error("missing user");
    if (Number(req.auth.authVersion ?? 0) !== Number(req.user.auth_version ?? 0)) throw new Error("session revoked");
    if (req.user.role === "hemocenter" && (!req.user.hemocenter_id || !db.prepare("SELECT id FROM hemocenters WHERE id=? AND active=1").get(req.user.hemocenter_id))) throw new Error("inactive institution");
    next();
  } catch {
    res.status(401).json({ error: "Sessão inválida ou expirada. Entre novamente." });
  }
}
const only = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ error: "Acesso não autorizado." });
  next();
};
const audit = (actor, action, type, id = null) => db.prepare(
  "INSERT INTO audit_logs (actor_user_id, action, entity_type, entity_id) VALUES (?, ?, ?, ?)"
).run(actor || null, action, type, id);
const isDate = value => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
};
const validBlood = value => !value || ["A+","A-","B+","B-","AB+","AB-","O+","O-"].includes(value);
const centerScope = user => user.role === "admin" ? null : user.hemocenter_id;
const localDate = () => new Intl.DateTimeFormat("en-CA", {timeZone:"America/Sao_Paulo",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
const localTime = () => new Intl.DateTimeFormat("en-GB", {timeZone:"America/Sao_Paulo",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).format(new Date());
const dummyHash = bcrypt.hashSync("not-a-real-account-password", 10);


// Estoque não é apresentado como tempo real sem API/autorização oficial.
app.get("/api/blood-stock", (_req,res)=>{
  const rows=db.prepare("SELECT blood_type,level,updated_at FROM blood_stock").all();
  const levels=Object.fromEntries(rows.map(r=>[r.blood_type,r.level]));
  res.json({levels,updatedAt:rows.length?rows[0].updated_at:null,source:"Lançamento administrativo, não integrado à Pró-Sangue"});
});
app.put("/api/admin/blood-stock",auth,only("admin"),(req,res)=>{
  const types=["A+","A-","B+","B-","AB+","AB-","O+","O-"];
  const source=String(req.body.source||"").trim();
  if(source.length<5||source.length>500)return res.status(400).json({error:"Informe fonte e autorização (5 a 500 caracteres)."});
  const levels=req.body.levels||{};
  if(Object.keys(levels).some(k=>!types.includes(k)||!["","Crítico","Baixo","Estável"].includes(levels[k])))return res.status(400).json({error:"Nível inválido."});
  const run=db.transaction(()=>{db.prepare("DELETE FROM blood_stock").run();for(const type of types)if(levels[type])db.prepare("INSERT INTO blood_stock(blood_type,level,source) VALUES(?,?,?)").run(type,levels[type],source);audit(req.user.id,"update_blood_stock","blood_stock");});run();res.json({ok:true});
});
app.get("/api/admin/management",auth,only("admin"),(_req,res)=>res.json({
  totals:{donors:db.prepare("SELECT COUNT(*) n FROM users WHERE role='donor'").get().n,donations:db.prepare("SELECT COUNT(*) n FROM donation_records WHERE status='validated'").get().n,pending:db.prepare("SELECT COUNT(*) n FROM donation_records WHERE status='pending'").get().n,campaigns:db.prepare("SELECT COUNT(*) n FROM campaigns").get().n},
  users:db.prepare("SELECT id,name,email,active,created_at AS createdAt,last_donation_date AS lastDonationDate FROM users WHERE role='donor' ORDER BY id DESC LIMIT 500").all(),
  staff:db.prepare("SELECT u.id,u.name,u.email,u.role,u.hemocenter_id AS hemocenterId,u.active AS active,h.name AS hemocenter FROM users u LEFT JOIN hemocenters h ON h.id=u.hemocenter_id WHERE u.role='hemocenter' ORDER BY u.id DESC").all(),
  centers:db.prepare("SELECT id,name,address,city,state,region,active,verified_at AS verifiedAt FROM hemocenters ORDER BY id DESC").all(),
  campaigns:db.prepare("SELECT id,title,description,status,start_date AS startDate,end_date AS endDate FROM campaigns ORDER BY id DESC LIMIT 100").all(),
  donations:db.prepare("SELECT d.id,d.user_id AS userId,u.name AS donor,d.donation_date AS date,d.status,h.name AS hemocenter FROM donation_records d JOIN users u ON u.id=d.user_id LEFT JOIN hemocenters h ON h.id=d.hemocenter_id ORDER BY d.id DESC LIMIT 100").all(),
  audit:db.prepare("SELECT a.id,a.action,a.entity_type AS entityType,a.entity_id AS entityId,a.created_at AS createdAt,u.name AS actor FROM audit_logs a LEFT JOIN users u ON u.id=a.actor_user_id ORDER BY a.id DESC LIMIT 100").all()
}));
app.post("/api/admin/staff",auth,only("admin"),(req,res)=>{
  const name=String(req.body.name||"").trim(),email=String(req.body.email||"").trim().toLowerCase(),password=String(req.body.password||""),centerId=Number(req.body.hemocenterId);
  if(name.length<2||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||password.length<10||!Number.isInteger(centerId))return res.status(400).json({error:"Informe nome, e-mail, senha com 10 caracteres e unidade."});
  if(!db.prepare("SELECT id FROM hemocenters WHERE id=? AND active=1").get(centerId))return res.status(400).json({error:"Selecione uma unidade ativa."});
  try{const hash=bcrypt.hashSync(password,12);const r=db.prepare("INSERT INTO users(name,email,password_hash,role,hemocenter_id,profile_completed) VALUES(?,?,?,'hemocenter',?,1)").run(name,email,hash,centerId);audit(req.user.id,"create_staff","user",r.lastInsertRowid);res.status(201).json({id:r.lastInsertRowid});}catch(e){if(e.code==="SQLITE_CONSTRAINT_UNIQUE")return res.status(409).json({error:"E-mail já cadastrado."});throw e;}
});
app.patch("/api/admin/staff/:id",auth,only("admin"),(req,res)=>{
  const id=Number(req.params.id),staff=db.prepare("SELECT id,role FROM users WHERE id=?").get(id);
  if(!staff||staff.role!=="hemocenter")return res.status(404).json({error:"Funcionário não encontrado."});
  const centerId=req.body.hemocenterId==null?null:Number(req.body.hemocenterId);
  if(centerId!==null&&(!Number.isInteger(centerId)||!db.prepare("SELECT id FROM hemocenters WHERE id=? AND active=1").get(centerId)))return res.status(400).json({error:"Selecione uma unidade ativa válida."});
  const active=req.body.active===false?0:1;
  db.prepare("UPDATE users SET hemocenter_id=?,active=?,auth_version=auth_version+1 WHERE id=? AND (hemocenter_id IS NOT ? OR active<>?)").run(centerId,active,id,centerId,active);
  audit(req.user.id,"update_staff","user",id);res.json({ok:true});
});
app.patch("/api/admin/users/:id",auth,only("admin"),(req,res)=>{
  const id=Number(req.params.id);
  if(!Number.isSafeInteger(id)||id<1||typeof req.body.active!=="boolean")return res.status(400).json({error:"Informe um usuário e um estado de conta válido."});
  const donor=db.prepare("SELECT id FROM users WHERE id=? AND role='donor'").get(id);
  if(!donor)return res.status(404).json({error:"Doador não encontrado."});
  db.prepare("UPDATE users SET active=?,auth_version=auth_version+1 WHERE id=? AND active<>?").run(req.body.active?1:0,id,req.body.active?1:0);
  audit(req.user.id,req.body.active?"activate_donor":"deactivate_donor","user",id);
  res.json({ok:true,active:req.body.active});
});
app.patch("/api/admin/campaigns/:id",auth,only("admin"),(req,res)=>{
  const id=Number(req.params.id),current=db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
  if(!current)return res.status(404).json({error:"Campanha não encontrada."});
  const title=String(req.body.title??current.title).trim(),description=String(req.body.description??current.description).trim(),startDate=String(req.body.startDate??current.start_date),endDate=String(req.body.endDate??current.end_date),status=String(req.body.status??current.status);
  if(!title||title.length>120||!description||description.length>2000||!isDate(startDate)||!isDate(endDate)||endDate<startDate||!["active","paused","closed"].includes(status))return res.status(400).json({error:"Revise título, descrição, período e status da campanha."});
  const run = db.transaction(() => {
    db.prepare("UPDATE campaigns SET title=?,description=?,start_date=?,end_date=?,status=? WHERE id=?").run(title,description,startDate,endDate,status,id);
    audit(req.user.id,"update_campaign","campaign",id);
    let notificationsCreated = 0;
    if (current.status !== "active" && status === "active") {
      const updated = db.prepare("SELECT * FROM campaigns WHERE id=?").get(id);
      notificationsCreated = notifyCampaignSubscribers(db, updated);
    }
    return notificationsCreated;
  }).immediate();
  res.json({ok:true,notificationsCreated:run});
});
app.patch("/api/admin/centers/:id",auth,only("admin"),(req,res)=>{const id=Number(req.params.id),current=db.prepare("SELECT * FROM hemocenters WHERE id=?").get(id);if(!current)return res.status(404).json({error:"Unidade não encontrada."});const active=req.body.active===undefined?current.active:(req.body.active?1:0);let name=String(req.body.name??current.name).trim();const demo=/\(teste\)|demonstração/i.test(current.name);if(demo&&!/\(teste\)$/i.test(name))name+= " (teste)";const region=String(req.body.region??current.region).trim(),address=String(req.body.address??current.address).trim(),city=String(req.body.city??current.city).trim(),state=String(req.body.state??current.state).trim().toUpperCase();if(!name||!region||!address||!city||!/^[A-Z]{2}$/.test(state))return res.status(400).json({error:"Dados institucionais inválidos."});const activeChanged=Number(current.active)!==Number(active);db.transaction(()=>{db.prepare("UPDATE hemocenters SET name=?,region=?,address=?,city=?,state=?,active=? WHERE id=?").run(name,region,address,city,state,active,id);if(activeChanged)db.prepare("UPDATE users SET auth_version=auth_version+1 WHERE role='hemocenter' AND hemocenter_id=?").run(id);audit(req.user.id,"update_hemocenter","hemocenter",id);}).immediate();res.json({ok:true});});
app.delete("/api/admin/management/:kind/:id",auth,only("admin"),(req,res)=>{
  const id=Number(req.params.id),kind=req.params.kind;
  if(!["users","campaigns","donations"].includes(kind)||!Number.isSafeInteger(id)||id<1)return res.status(400).json({error:"Registro inválido."});
  if(kind==="donations")return res.status(409).json({error:"Registros de doação são históricos e não podem ser apagados. Solicite correção formal com trilha de auditoria."});
  if(kind==="users"){
    const result=db.prepare("UPDATE users SET active=0,auth_version=auth_version+1 WHERE id=? AND role='donor' AND active=1").run(id);
    if(!result.changes)return res.status(404).json({error:"Doador ativo não encontrado."});
    audit(req.user.id,"deactivate_donor","user",id);
    return res.json({ok:true,archived:true});
  }
  const result=db.prepare("UPDATE campaigns SET status='closed' WHERE id=? AND status<>'closed'").run(id);
  if(!result.changes)return res.status(404).json({error:"Campanha ativa não encontrada."});
  audit(req.user.id,"close_campaign","campaign",id);
  res.json({ok:true,archived:true});
});

// Métricas agregadas e anônimas para a página de impacto (sem dados pessoais).
app.get("/api/public/impact", (_req, res) => {
  const one = (sql) => db.prepare(sql).get().n;
  const monthsBack = 6;
  const base = new Date(`${localDate()}T12:00:00`);
  const months = Array.from({ length: monthsBack }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - (monthsBack - 1 - i), 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const perMonth = Object.fromEntries(db.prepare("SELECT strftime('%Y-%m', donation_date) AS m, COUNT(*) AS n FROM donation_records WHERE status='validated' GROUP BY m").all().map(r => [r.m, r.n]));
  const byBlood = Object.fromEntries(db.prepare("SELECT blood_type AS t, COUNT(*) AS n FROM users WHERE role='donor' AND blood_type IS NOT NULL GROUP BY blood_type").all().map(r => [r.t, r.n]));
  const appt = Object.fromEntries(db.prepare("SELECT status, COUNT(*) AS n FROM appointments GROUP BY status").all().map(r => [r.status, r.n]));
  const donors = one("SELECT COUNT(*) AS n FROM users WHERE role='donor'");
  const donations = one("SELECT COUNT(*) AS n FROM donation_records WHERE status='validated'");
  res.json({
    donors,
    donations,
    recurringDonors: one("SELECT COUNT(*) AS n FROM (SELECT user_id FROM donation_records WHERE status='validated' GROUP BY user_id HAVING COUNT(*)>=2)"),
    donorsWithDonation: one("SELECT COUNT(DISTINCT user_id) AS n FROM donation_records WHERE status='validated'"),
    donorsWithAppointment: one("SELECT COUNT(DISTINCT user_id) AS n FROM appointments"),
    appointmentsRequested: Object.values(appt).reduce((a, b) => a + b, 0),
    appointmentsConfirmed: (appt.confirmed || 0) + (appt.completed || 0),
    units: one("SELECT COUNT(*) AS n FROM hemocenters WHERE active=1 AND verified_at IS NOT NULL"),
    activeCampaigns: one("SELECT COUNT(*) AS n FROM campaigns WHERE status='active'"),
    potentialLives: donations * 4,
    monthly: months.map(m => ({ month: m, donations: perMonth[m] || 0 })),
    bloodTypes: ["O+", "O-", "A+", "A-", "B+", "B-", "AB+", "AB-"].map(t => ({ type: t, donors: byBlood[t] || 0 })),
    demo: one("SELECT COUNT(*) AS n FROM users WHERE email LIKE '%@demo.viva'") > 0 || one("SELECT COUNT(*) AS n FROM hemocenters WHERE name LIKE '%(teste)%'") > 0,
    generatedAt: new Date().toISOString()
  });
});

app.get("/api/health", (_req, res) => {
  try {
    db.prepare("SELECT 1").get();
    res.json({ ok: true, app: "VIVA+", database: "connected", environment: isProduction ? "production" : "development" });
  } catch {
    res.status(503).json({ ok: false, database: "unavailable" });
  }
});

app.post("/api/auth/register", rateLimit({ max: 8 }), (req, res) => {
  const name = String(req.body.name || "").trim();
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  const bloodType = String(req.body.bloodType || "");
  const region = String(req.body.region || "").trim();
  if (name.length < 2 || name.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 180 || password.length < 10 || Buffer.byteLength(password,"utf8") > 72) {
    return res.status(400).json({ error: "Informe nome, e-mail válido e senha com pelo menos 10 caracteres." });
  }
  if (!validBlood(bloodType)) return res.status(400).json({ error: "Selecione um tipo sanguíneo válido ou deixe em branco." });
  if (region.length > 80) return res.status(400).json({error:"Região muito longa."});
  try {
    const hash = bcrypt.hashSync(password, 12);
    const result = db.prepare("INSERT INTO users (name,email,password_hash,role,blood_type,blood_type_verified,region,profile_completed) VALUES (?,?,?,'donor',?,0,?,1)")
      .run(name, email, hash, bloodType || null, region || null);
    const user = db.prepare("SELECT * FROM users WHERE id=?").get(result.lastInsertRowid);
    audit(user.id, "register", "user", user.id);
    res.status(201).json({ token: tokenFor(user), user: safeUser(user) });
  } catch (e) {
    res.status(e.code === "SQLITE_CONSTRAINT_UNIQUE" ? 409 : 500).json({ error: e.code === "SQLITE_CONSTRAINT_UNIQUE" ? "Este e-mail já está cadastrado." : "Não foi possível criar a conta." });
  }
});

app.post("/api/auth/login", rateLimit({ max: 10 }), (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const password = String(req.body.password || "");
  if (Buffer.byteLength(password,"utf8") > 72) return res.status(401).json({error:"E-mail ou senha incorretos."});
  const user = db.prepare("SELECT * FROM users WHERE email=?").get(email);
  if (!bcrypt.compareSync(password, user?.password_hash || dummyHash) || !user || !user.active) return res.status(401).json({ error: "E-mail ou senha incorretos." });
  audit(user.id, "login", "user", user.id);
  res.json({ token: tokenFor(user), user: safeUser(user) });
});

app.get("/api/me", auth, (req, res) => res.json({ user: safeUser(req.user) }));

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const passwordValid = (value) => typeof value === "string" && value.length >= 10 && Buffer.byteLength(value, "utf8") <= 72;
const resetEmailMessage = "Por segurança, não informamos se o endereço existe. Se ele estiver vinculado a uma conta ativa e o provedor aceitar o envio, você receberá as instruções.";

function getAppUrl() {
  const configured = process.env.APP_URL || (isProduction ? "" : "http://localhost:5173");
  if (!configured) throw new Error("APP_URL não configurada.");
  const parsed = new URL(configured);
  if (!["http:", "https:"].includes(parsed.protocol) || (isProduction && parsed.protocol !== "https:")) {
    throw new Error("APP_URL precisa usar HTTPS em produção.");
  }
  parsed.search = "";
  parsed.hash = "";
  return parsed;
}

app.post("/api/auth/forgot-password", rateLimit({ max: 5 }), async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  // A ausência do provedor deve ser explícita; nunca afirmar que uma mensagem foi enviada.
  if (!isEmailConfigured()) return res.status(503).json({ error: "Recuperação por e-mail ainda não está configurada no servidor." });
  let appUrl;
  try { appUrl = getAppUrl(); }
  catch { return res.status(503).json({ error: "O endereço público do VIVA+ não está configurado corretamente." }); }
  if (!emailPattern.test(email) || email.length > 180) return res.status(202).json({ message: resetEmailMessage });

  const user = db.prepare("SELECT id,name,email FROM users WHERE email=? AND active=1").get(email);
  if (!user) return res.status(202).json({ message: resetEmailMessage });

  const rawToken = crypto.randomBytes(32).toString("base64url");
  const tokenHash = crypto.createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = Date.now() + 30 * 60 * 1000;
  db.transaction(() => {
    db.prepare("UPDATE password_reset_tokens SET used_at=COALESCE(used_at,CURRENT_TIMESTAMP) WHERE user_id=? AND used_at IS NULL").run(user.id);
    db.prepare("DELETE FROM password_reset_tokens WHERE expires_at < ? - 7 * 24 * 60 * 60 * 1000").run(Date.now());
    db.prepare("INSERT INTO password_reset_tokens(user_id,token_hash,expires_at) VALUES(?,?,?)").run(user.id, tokenHash, expiresAt);
    audit(user.id, "password_reset_requested", "user", user.id);
  })();

  appUrl.searchParams.set("reset", rawToken);
  try {
    await sendPasswordResetEmail({
      to: user.email,
      name: user.name,
      resetUrl: appUrl.toString(),
      idempotencyKey: `viva-reset-${user.id}-${tokenHash}`
    });
    res.json({ message: resetEmailMessage });
  } catch (error) {
    db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE token_hash=? AND used_at IS NULL").run(tokenHash);
    console.error("Falha ao enviar e-mail de recuperação do VIVA+", { userId: user.id, code: error.code || "UNKNOWN", status: error.status || null });
    // Resposta uniforme para não permitir enumeração de contas. O log interno
    // registra a falha; a mensagem não afirma que o provedor aceitou o envio.
    res.status(202).json({ message: resetEmailMessage });
  }
});

app.post("/api/auth/reset-password", rateLimit({ max: 8 }), async (req, res) => {
  const token = String(req.body.token || "");
  const password = req.body.password;
  if (!/^[A-Za-z0-9_-]{43}$/.test(token) || !passwordValid(password)) {
    return res.status(400).json({ error: "Link inválido ou senha fora dos requisitos mínimos (10 caracteres)." });
  }
  const tokenHash = crypto.createHash("sha256").update(token).digest("hex");
  const candidate = db.prepare(`SELECT t.id,t.user_id,u.name,u.email
    FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
    WHERE t.token_hash=? AND t.used_at IS NULL AND t.expires_at>? AND u.active=1`).get(tokenHash, Date.now());
  if (!candidate) return res.status(400).json({ error: "Este link expirou, já foi utilizado ou é inválido. Solicite uma nova redefinição." });

  const passwordHash = bcrypt.hashSync(password, 12);
  const changed = db.transaction(() => {
    const current = db.prepare(`SELECT t.id FROM password_reset_tokens t JOIN users u ON u.id=t.user_id
      WHERE t.id=? AND t.used_at IS NULL AND t.expires_at>? AND u.active=1`).get(candidate.id, Date.now());
    if (!current) return false;
    db.prepare("UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?").run(passwordHash, candidate.user_id);
    db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL").run(candidate.user_id);
    audit(candidate.user_id, "password_reset_completed", "user", candidate.user_id);
    return true;
  }).immediate();
  if (!changed) return res.status(400).json({ error: "Este link expirou, já foi utilizado ou é inválido. Solicite uma nova redefinição." });

  let notificationSent = false;
  if (isEmailConfigured()) {
    try {
      await sendPasswordChangedEmail({ to: candidate.email, name: candidate.name, idempotencyKey: `viva-password-changed-${candidate.user_id}-${candidate.id}` });
      notificationSent = true;
    } catch (error) {
      console.error("Falha ao enviar alerta de alteração de senha do VIVA+", { userId: candidate.user_id, code: error.code || "UNKNOWN", status: error.status || null });
    }
  }
  res.json({ ok: true, notificationSent, message: "Senha alterada. Entre novamente com a nova senha." });
});

app.patch("/api/me/password", auth, rateLimit({ max: 5 }), async (req, res) => {
  const currentPassword = String(req.body.currentPassword || "");
  const newPassword = req.body.newPassword;
  if (!passwordValid(newPassword)) return res.status(400).json({ error: "A nova senha deve ter pelo menos 10 caracteres e respeitar o limite de segurança." });
  if (Buffer.byteLength(currentPassword, "utf8") > 72 || !bcrypt.compareSync(currentPassword, req.user.password_hash)) {
    return res.status(400).json({ error: "A senha atual está incorreta." });
  }
  if (currentPassword === newPassword) return res.status(400).json({ error: "Escolha uma senha diferente da atual." });
  const passwordHash = bcrypt.hashSync(newPassword, 12);
  db.transaction(() => {
    db.prepare("UPDATE users SET password_hash=?,auth_version=auth_version+1 WHERE id=?").run(passwordHash, req.user.id);
    db.prepare("UPDATE password_reset_tokens SET used_at=CURRENT_TIMESTAMP WHERE user_id=? AND used_at IS NULL").run(req.user.id);
    audit(req.user.id, "password_changed", "user", req.user.id);
  })();
  let notificationSent = false;
  if (isEmailConfigured()) {
    try {
      await sendPasswordChangedEmail({ to: req.user.email, name: req.user.name, idempotencyKey: `viva-password-changed-${req.user.id}-${Date.now()}` });
      notificationSent = true;
    } catch (error) {
      console.error("Falha ao enviar alerta de alteração de senha do VIVA+", { userId: req.user.id, code: error.code || "UNKNOWN", status: error.status || null });
    }
  }
  res.json({ ok: true, notificationSent, message: "Senha alterada. Entre novamente com a nova senha." });
});

// Código temporário digitável: não depende de câmera, leitor ou URL pública.
// Apenas o hash é persistido; o código expira e é consumido uma única vez.
const hashWalletCode = (value) => crypto.createHmac("sha256", signingSecret).update(String(value)).digest("hex");
app.get("/api/me/wallet-code", auth, rateLimit({ max: 30 }), (req, res) => {
  if (req.user.role !== "donor") return res.status(403).json({ error: "O código temporário está disponível somente para carteiras de doadores." });
  const ttlSeconds = 120;
  const now = Date.now();
  let code = "";
  const issue = db.transaction(() => {
    db.prepare("DELETE FROM wallet_access_codes WHERE expires_at < ?").run(now - 7 * 24 * 60 * 60 * 1000);
    db.prepare("UPDATE wallet_access_codes SET used_at=CURRENT_TIMESTAMP WHERE donor_id=? AND used_at IS NULL").run(req.user.id);
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      const candidateHash = hashWalletCode(candidate);
      const collision = db.prepare("SELECT 1 FROM wallet_access_codes WHERE code_hash=? AND used_at IS NULL AND expires_at>? LIMIT 1").get(candidateHash, now);
      if (collision) continue;
      db.prepare("INSERT INTO wallet_access_codes (code_hash,donor_id,expires_at) VALUES (?,?,?)")
        .run(candidateHash, req.user.id, now + ttlSeconds * 1000);
      code = candidate;
      return;
    }
    throw new Error("Não foi possível gerar um código temporário único.");
  });
  issue();
  res.set("Cache-Control", "no-store");
  res.json({ code, expiresIn: ttlSeconds, expiresAt: new Date(now + ttlSeconds * 1000).toISOString() });
});

app.post("/api/institution/wallet-code/verify", rateLimit({ max: 8 }), auth, only("hemocenter"), (req, res) => {
  if (req.user.role === "hemocenter" && !req.user.hemocenter_id) {
    return res.status(403).json({ error: "Perfil institucional sem unidade vinculada." });
  }
  const code = String(req.body.code || "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(code)) return res.status(400).json({ error: "Informe os 6 números exibidos na carteira do doador." });
  const now = Date.now();
  const donor = db.transaction(() => {
    const record = db.prepare(`SELECT c.id,c.donor_id,u.name
      FROM wallet_access_codes c JOIN users u ON u.id=c.donor_id
      WHERE c.code_hash=? AND c.used_at IS NULL AND c.expires_at>? AND u.role='donor' AND u.active=1`)
      .get(hashWalletCode(code), now);
    if (!record) return null;
    const updated = db.prepare(`UPDATE wallet_access_codes SET used_at=CURRENT_TIMESTAMP
      WHERE id=? AND used_at IS NULL AND expires_at>?`).run(record.id, now);
    if (updated.changes !== 1) return null;
    const verifiedDonor = { id: record.donor_id, name: record.name };
    db.prepare("INSERT INTO wallet_verified_sessions(donor_id,staff_user_id) VALUES(?,?)").run(verifiedDonor.id,req.user.id);
    audit(req.user.id, "verify_wallet_code", "user", verifiedDonor.id);
    return verifiedDonor;
  }).immediate();
  if (!donor) return res.status(400).json({ error: "Código incorreto, expirado ou já utilizado. Peça ao doador para atualizar o código na carteira." });
  res.set("Cache-Control", "no-store");
  res.json({ valid: true, donor: { ...donor, walletStatus: "ativa" }, verifiedAt: new Date().toISOString(), singleUse: true, note: "A conferência do código não substitui documento oficial ou triagem clínica." });
});

app.patch("/api/me/preferences", auth, only("donor"), (req, res) => {
  const campaigns = req.body.notificationCampaigns == null ? req.user.notification_campaigns : Number(Boolean(req.body.notificationCampaigns));
  const eligibility = req.body.notificationEligibility == null ? req.user.notification_eligibility : Number(Boolean(req.body.notificationEligibility));
  db.prepare("UPDATE users SET notification_campaigns=?, notification_eligibility=? WHERE id=?").run(campaigns, eligibility, req.user.id);
  audit(req.user.id, "update_preferences", "user", req.user.id);
  res.json({ user: safeUser(db.prepare("SELECT * FROM users WHERE id=?").get(req.user.id)) });
});

// Caixa de notificações persistente: cada doador só acessa seus próprios registros.
app.get("/api/notifications", auth, only("donor"), (req,res) => {
  const items = db.prepare(`
    SELECT id,type,title,message,target,reference_id AS referenceId,
      read_at AS readAt,created_at AS createdAt
    FROM notifications WHERE user_id=? ORDER BY id DESC LIMIT 40
  `).all(req.user.id);
  const unreadCount = db.prepare("SELECT COUNT(*) AS count FROM notifications WHERE user_id=? AND read_at IS NULL").get(req.user.id).count;
  res.json({items,unreadCount});
});
app.patch("/api/notifications/:id/read", auth, only("donor"), (req,res) => {
  const id = Number(req.params.id);
  if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({error:"Notificação inválida."});
  const result = db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE id=? AND user_id=? AND read_at IS NULL").run(id,req.user.id);
  const item = db.prepare("SELECT id,read_at AS readAt FROM notifications WHERE id=? AND user_id=?").get(id,req.user.id);
  if (!item) return res.status(404).json({error:"Notificação não encontrada."});
  res.json({ok:true,changed:result.changes,readAt:item.readAt});
});
app.patch("/api/notifications/read-all", auth, only("donor"), (req,res) => {
  const result = db.prepare("UPDATE notifications SET read_at=CURRENT_TIMESTAMP WHERE user_id=? AND read_at IS NULL").run(req.user.id);
  res.json({ok:true,changed:result.changes});
});

app.get("/api/dashboard", auth, only("donor"), (req, res) => {
  const donations = db.prepare(`SELECT d.id,d.donation_date AS date,d.status,h.name AS hemocenter
    FROM donation_records d LEFT JOIN hemocenters h ON h.id=d.hemocenter_id
    WHERE d.user_id=? ORDER BY d.donation_date DESC`).all(req.user.id);
  const count = donations.filter(d => d.status === "validated").length;
  const level = count >= 10 ? "Diamante" : count >= 5 ? "Ouro" : count >= 3 ? "Prata" : count >= 1 ? "Bronze" : "Iniciante";
  const next = count >= 10 ? 10 : count >= 5 ? 10 : count >= 3 ? 5 : count >= 1 ? 3 : 1;
  const appointments = db.prepare(`SELECT a.id,a.appointment_date AS date,a.appointment_time AS time,a.status,
    h.name AS hemocenter,h.address,h.region,h.city,h.state,a.institution_note AS institutionNote
    FROM appointments a JOIN hemocenters h ON h.id=a.hemocenter_id
    WHERE a.user_id=? ORDER BY a.appointment_date,a.appointment_time`).all(req.user.id);
  res.json({ donations, donationCount: count, level, nextLevelAt: next, appointments });
});

app.get("/api/hemocenters", (_req, res) => {
  res.json(db.prepare(`SELECT id,name,region,address,city,state,phone,opening_hours,
    source_url AS sourceUrl, booking_url AS bookingUrl, verified_at AS verifiedAt
    FROM hemocenters WHERE active=1 AND verified_at IS NOT NULL ORDER BY name`).all());
});

app.get("/api/campaigns", auth, only("donor"), (req, res) => {
  const rows = db.prepare(`SELECT c.id,c.title,c.description,c.blood_type AS bloodType,c.region,
    c.start_date AS startDate,c.end_date AS endDate,h.name AS hemocenter
    FROM campaigns c LEFT JOIN hemocenters h ON h.id=c.hemocenter_id
    WHERE c.status='active' AND date(c.end_date)>=date(?)
    AND (c.region='Nacional' OR c.region=?)
    ORDER BY c.start_date`).all(localDate(),req.user.region || "__SEM_REGIAO__");
  res.json(rows);
});

// Disponibilidade de horários internos do VIVA+: uma vaga por horário e unidade.
// Esta agenda não consulta nem altera sistemas externos de hemocentros.
app.get("/api/appointments/availability", auth, only("donor"), (req, res) => {
  const hemocenterId = Number(req.query.hemocenterId);
  const date = String(req.query.date || "");
  if (!Number.isInteger(hemocenterId) || !isDate(date)) {
    return res.status(400).json({ error: "Informe uma unidade e uma data válidas." });
  }
  if (date < localDate()) return res.status(400).json({ error: "Escolha uma data de hoje em diante." });
  const center = db.prepare("SELECT id,name FROM hemocenters WHERE id=? AND active=1 AND verified_at IS NOT NULL").get(hemocenterId);
  if (!center) return res.status(404).json({ error: "Unidade não encontrada ou ainda não verificada." });
  const bookedTimes = db.prepare(`
    SELECT appointment_time FROM appointments
    WHERE hemocenter_id=? AND appointment_date=? AND status IN ('pending','confirmed')
  `).all(hemocenterId, date).map(row => row.appointment_time);
  const slots = buildAppointmentSlots({ date, bookedTimes, today: localDate(), currentTime: localTime() });
  res.json({
    hemocenterId,
    hemocenterName: center.name,
    date,
    slots,
    availableCount: slots.filter(slot => slot.available).length,
    capacityPerSlot: 1
  });
});

// Reserva imediata: o horário fica confirmado no VIVA+ dentro da mesma transação.
app.post("/api/appointments", rateLimit({ max: 10 }), auth, only("donor"), (req, res) => {
  const hemocenterId = Number(req.body.hemocenterId);
  const date = String(req.body.date || "");
  const time = String(req.body.time || "");
  if (!Number.isInteger(hemocenterId) || !isDate(date) || !isAllowedAppointmentTime(time)) {
    return res.status(400).json({ error: "Informe unidade, data e um horário válido da agenda." });
  }
  if (date < localDate() || (date === localDate() && time <= localTime())) return res.status(400).json({ error: "Escolha um horário futuro." });
  const center = db.prepare("SELECT id,name FROM hemocenters WHERE id=? AND active=1 AND verified_at IS NOT NULL").get(hemocenterId);
  if (!center) return res.status(404).json({ error: "Unidade não encontrada ou ainda não verificada." });
  try {
    const appointmentId = db.transaction(() => {
      const dailyCount = db.prepare("SELECT COUNT(*) AS n FROM appointments WHERE user_id=? AND appointment_date=? AND status IN ('pending','confirmed')").get(req.user.id,date).n;
      if (dailyCount >= 2) throw Object.assign(new Error("Você já possui dois agendamentos ativos nesta data."), { code: "APPT_DAILY_LIMIT" });
      const exists = db.prepare("SELECT id FROM appointments WHERE hemocenter_id=? AND appointment_date=? AND appointment_time=? AND status IN ('pending','confirmed') LIMIT 1").get(hemocenterId,date,time);
      if (exists) throw Object.assign(new Error("Este horário acabou de ser reservado. Escolha outro horário disponível."), { code: "APPT_SLOT_TAKEN" });
      const result = db.prepare("INSERT INTO appointments (user_id,hemocenter_id,appointment_date,appointment_time,status) VALUES (?,?,?,?,'confirmed')").run(req.user.id,hemocenterId,date,time);
      insertNotification(db, {
        userId: req.user.id,
        type: "appointment",
        title: "Agendamento confirmado!",
        message: `Seu horário em ${center.name}, no dia ${date} às ${time}, foi reservado e confirmado no VIVA+.`,
        target: "agendamentos",
        referenceId: result.lastInsertRowid,
        dedupeKey: `appointment:${result.lastInsertRowid}:confirmed`
      });
      audit(req.user.id, "book_appointment", "appointment", result.lastInsertRowid);
      return result.lastInsertRowid;
    }).immediate();
    res.status(201).json({
      id: appointmentId,
      status: "confirmed",
      message: "Agendamento confirmado! Seu horário está reservado no VIVA+."
    });
  } catch (error) {
    if (["APPT_DAILY_LIMIT", "APPT_SLOT_TAKEN"].includes(error.code)) return res.status(409).json({ error: error.message });
    if (String(error.code || "").startsWith("SQLITE_CONSTRAINT")) return res.status(409).json({ error: "Este horário não está mais disponível. Atualize a disponibilidade e escolha outro." });
    throw error;
  }
});

app.patch("/api/appointments/:id/cancel", auth, only("donor"), (req, res) => {
  const appt = db.prepare("SELECT * FROM appointments WHERE id=?").get(Number(req.params.id));
  if (!appt) return res.status(404).json({ error: "Agendamento não encontrado." });
  if (appt.user_id !== req.user.id) return res.status(403).json({ error: "Acesso não autorizado." });
  if (!["pending","confirmed"].includes(appt.status)) return res.status(400).json({ error: "Este agendamento não pode ser cancelado." });
  if (req.user.role === "hemocenter" && req.user.hemocenter_id !== appt.hemocenter_id) return res.status(403).json({ error: "Agendamento de outra unidade." });
  db.prepare("UPDATE appointments SET status='cancelled' WHERE id=?").run(appt.id);
  audit(req.user.id, "cancel_appointment", "appointment", appt.id);
  res.json({ message: "Solicitação cancelada." });
});

app.post("/api/institution/donations", auth, only("hemocenter"), async (req, res) => {
  const userId = Number(req.body.userId);
  const date = String(req.body.date || "");
  if (!Number.isInteger(userId) || !isDate(date) || date !== localDate()) {
    return res.status(400).json({ error: "A data do registro institucional deve ser a data de hoje." });
  }
  if (!req.user.hemocenter_id) return res.status(403).json({ error: "Perfil institucional sem unidade vinculada." });
  const donor = db.prepare("SELECT id FROM users WHERE id=? AND role='donor'").get(userId);
  if (!donor) return res.status(404).json({ error: "Doador não encontrado." });
  const verified = db.prepare(`SELECT id FROM wallet_verified_sessions
    WHERE donor_id=? AND staff_user_id=? AND consumed_at IS NULL
      AND verified_at>=datetime('now','-10 minutes') ORDER BY id DESC LIMIT 1`)
    .get(userId, req.user.id);
  if (!verified) return res.status(409).json({ error: "Consulte novamente a carteira do doador antes de registrar a doação." });
  try {
    const donationId = db.transaction(() => {
      const session = db.prepare(`SELECT id FROM wallet_verified_sessions WHERE id=? AND donor_id=?
        AND staff_user_id=? AND consumed_at IS NULL AND verified_at>=datetime('now','-10 minutes')`)
        .get(verified.id,userId,req.user.id);
      if (!session) throw new Error("A consulta da carteira expirou ou já foi utilizada. Consulte novamente.");
      // A verificação fica dentro da transação para impedir duas unidades de validar
      // a mesma doação em paralelo para o mesmo doador e dia.
      const duplicate = db.prepare("SELECT id FROM donation_records WHERE user_id=? AND donation_date=? AND status='validated' LIMIT 1").get(userId,date);
      if (duplicate) throw Object.assign(new Error("Já existe uma doação validada nesta data para este doador."), { code: "DONATION_DUPLICATE" });
      const result = db.prepare(`INSERT INTO donation_records
        (user_id,hemocenter_id,donation_date,status,validated_at,notes)
        VALUES (?,?,?,'validated',CURRENT_TIMESTAMP,'Registro institucional após confirmação da doação')`)
        .run(userId,req.user.hemocenter_id,date);
      db.prepare("UPDATE wallet_verified_sessions SET consumed_at=CURRENT_TIMESTAMP WHERE id=? AND consumed_at IS NULL").run(verified.id);
      db.prepare("UPDATE users SET last_donation_date=(SELECT MAX(donation_date) FROM donation_records WHERE user_id=? AND status='validated') WHERE id=?").run(userId,userId);
      const centerName = db.prepare("SELECT name FROM hemocenters WHERE id=?").get(req.user.hemocenter_id)?.name || "unidade de atendimento";
      insertNotification(db, {
        userId,
        type: "donation",
        title: "Doação concluída!",
        message: `Sua doação de ${date} foi confirmada por ${centerName}. Seu histórico e seus selos foram atualizados.`,
        target: "carteira",
        referenceId: result.lastInsertRowid,
        dedupeKey: `donation:${result.lastInsertRowid}:validated`
      });
      audit(req.user.id,"validate_donation","donation",result.lastInsertRowid);
      return result.lastInsertRowid;
    }).immediate();
    let notificationSent = false;
    const donorAccount = db.prepare("SELECT name,email FROM users WHERE id=?").get(userId);
    if (isEmailConfigured() && donorAccount?.email) {
      try {
        await sendDonationConfirmedEmail({ to: donorAccount.email, name: donorAccount.name, donationDate: date, hemocenter: req.user.hemocenter_id ? db.prepare("SELECT name FROM hemocenters WHERE id=?").get(req.user.hemocenter_id)?.name : "unidade de atendimento", idempotencyKey: `viva-donation-${donationId}` });
        notificationSent = true;
      } catch (error) {
        console.error("Falha ao enviar confirmação de doação do VIVA+", { donationId, userId, code: error.code || "UNKNOWN", status: error.status || null });
      }
    }
    res.status(201).json({ id: donationId, status: "validated", notificationSent, message: "Doação registrada. O histórico e o selo do doador foram atualizados." });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE" || error.code === "DONATION_DUPLICATE") return res.status(409).json({ error: "Já existe uma doação validada nesta data para este doador." });
    if (error.message?.includes("consulte novamente") || error.message?.includes("expirou")) return res.status(409).json({ error: error.message });
    throw error;
  }
});

app.post("/api/admin/campaigns", auth, only("admin"), (req,res) => {
  const title = String(req.body.title || "").trim();
  const description = String(req.body.description || "").trim();
  const bloodType = String(req.body.bloodType || "");
  const region = String(req.body.region || "").trim();
  const startDate = String(req.body.startDate || "");
  const endDate = String(req.body.endDate || "");
  let hemocenterId = req.body.hemocenterId ? Number(req.body.hemocenterId) : (req.user.hemocenter_id || null);
  if (req.user.role === "hemocenter") hemocenterId = req.user.hemocenter_id;
  if (!title || title.length > 120 || !description || description.length > 2000 || !region || !isDate(startDate) || !isDate(endDate) || endDate < startDate || !validBlood(bloodType)) {
    return res.status(400).json({error:"Preencha título, descrição, região, tipo sanguíneo e período válido."});
  }
  if (req.user.role === "hemocenter" && !hemocenterId) return res.status(403).json({error:"Perfil institucional sem unidade vinculada."});
  if (hemocenterId && !db.prepare("SELECT id FROM hemocenters WHERE id=? AND verified_at IS NOT NULL AND active=1").get(hemocenterId)) return res.status(400).json({error:"Selecione uma unidade ativa e verificada."});
  const created = db.transaction(() => {
    const result = db.prepare(`INSERT INTO campaigns (title,description,blood_type,region,start_date,end_date,hemocenter_id)
      VALUES (?,?,?,?,?,?,?)`).run(title,description,bloodType || null,region,startDate,endDate,hemocenterId);
    const campaign = db.prepare("SELECT * FROM campaigns WHERE id=?").get(result.lastInsertRowid);
    const notificationsCreated = notifyCampaignSubscribers(db, campaign);
    audit(req.user.id,"create_campaign","campaign",result.lastInsertRowid);
    return {id:result.lastInsertRowid,notificationsCreated};
  }).immediate();
  res.status(201).json({id:created.id,notificationsCreated:created.notificationsCreated,message:"Campanha publicada no VIVA+ e notificações enviadas para os doadores elegíveis."});
});

// Unidades fictícias só podem ser criadas por um administrador e ficam marcadas no nome.
app.post("/api/admin/demo-hemocenters",auth,only("admin"),(req,res)=>{
  const name=String(req.body.name||"").trim().replace(/\s*\(teste\)$/i,"");const region=String(req.body.region||"").trim(),address=String(req.body.address||"").trim(),city=String(req.body.city||"").trim(),state=String(req.body.state||"").trim().toUpperCase();
  if(!name||!region||!address||!city||!/^[A-Z]{2}$/.test(state))return res.status(400).json({error:"Preencha nome, região, endereço, cidade e UF."});
  const result=db.prepare("INSERT INTO hemocenters(name,region,address,city,state,active,verified_at,verified_by) VALUES(?,?,?,?,?,1,CURRENT_TIMESTAMP,?)").run(`${name} (teste)`,region,address,city,state,req.user.id);audit(req.user.id,"create_demo_hemocenter","hemocenter",result.lastInsertRowid);res.status(201).json({id:result.lastInsertRowid,demo:true});
});

// Diretório só aceita cadastros inseridos/verificados por administrador com fonte oficial.
app.post("/api/admin/hemocenters", auth, only("admin"), (req,res) => {
  const name = String(req.body.name || "").trim();
  const region = String(req.body.region || "").trim();
  const address = String(req.body.address || "").trim();
  const city = String(req.body.city || "").trim();
  const state = String(req.body.state || "").trim().toUpperCase();
  const sourceUrl = String(req.body.sourceUrl || "").trim();
  const bookingUrl = String(req.body.bookingUrl || "").trim();
  if (!name || !region || !address || !city || !/^[A-Z]{2}$/.test(state) || !sourceUrl.toLowerCase().startsWith("https://")) {
    return res.status(400).json({ error: "Informe unidade, endereço, cidade, UF e URL HTTPS de uma fonte oficial." });
  }
  if (bookingUrl && !bookingUrl.toLowerCase().startsWith("https://")) return res.status(400).json({ error: "O link de agendamento precisa usar HTTPS." });
  const result = db.prepare(`INSERT INTO hemocenters
    (name,region,address,city,state,phone,opening_hours,source_url,booking_url,verified_at,verified_by)
    VALUES (?,?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,?)`)
    .run(name,region,address,city,state,String(req.body.phone || ""),String(req.body.openingHours || ""),sourceUrl,bookingUrl || null,req.user.id);
  audit(req.user.id,"create_verified_hemocenter","hemocenter",result.lastInsertRowid);
  res.status(201).json({ id: result.lastInsertRowid, message: "Unidade cadastrada com fonte informada. Confira os dados antes de publicar." });
});

// Em produção, a API e o frontend podem ser publicados no mesmo serviço.
if (isProduction) {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const dist = path.resolve(here, "../dist");
  app.use(express.static(dist, { index: false, maxAge: "1h" }));
  app.get("*", (req, res, next) => {
    if (req.path.startsWith("/api/")) return next();
    res.sendFile(path.join(dist, "index.html"));
  });
}

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = [400,401,403,404,409,413,429].includes(err.status) ? err.status : 500;
  res.status(status).json({ error: status === 413 ? "Solicitação muito grande." : status === 400 ? "JSON inválido." : "Erro interno. Tente novamente." });
});
app.listen(PORT, () => console.log(`VIVA+ API ouvindo na porta ${PORT}`));
