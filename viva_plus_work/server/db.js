import "dotenv/config";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const dbPath = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.resolve(here, "../database/viva.sqlite");
fs.mkdirSync(path.dirname(dbPath), { recursive: true });

export const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.pragma("busy_timeout = 5000");
const schema = fs.readFileSync(path.resolve(here, "../database/schema.sql"), "utf8");
db.exec(schema);

// Migrações aditivas: preservam os cadastros existentes.
function addColumn(table, name, definition) {
  const columns = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name));
  if (!columns.has(name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}
addColumn("users", "phone", "TEXT");
addColumn("users", "birth_date", "TEXT");
addColumn("users", "city", "TEXT");
addColumn("users", "accessibility_libras", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "profile_completed", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "active", "INTEGER NOT NULL DEFAULT 1");
addColumn("users", "auth_version", "INTEGER NOT NULL DEFAULT 0");
addColumn("users", "hemocenter_id", "INTEGER REFERENCES hemocenters(id)");
addColumn("hemocenters", "source_url", "TEXT");
addColumn("hemocenters", "booking_url", "TEXT");
addColumn("hemocenters", "verified_at", "TEXT");
addColumn("hemocenters", "verified_by", "INTEGER REFERENCES users(id)");
addColumn("appointments", "institution_note", "TEXT");

// Corrige a FK legada de donation_records.hemocenter_id (users -> hemocenters).
// Preserva as doações; referências antigas sem unidade correspondente viram NULL.
const donationFk = db.pragma("foreign_key_list(donation_records)").find(fk => fk.from === "hemocenter_id");
if (donationFk && donationFk.table !== "hemocenters") {
  db.pragma("foreign_keys = OFF");
  try {
    db.exec(`
      BEGIN IMMEDIATE;
      ALTER TABLE donation_records RENAME TO donation_records_legacy_fk;
      CREATE TABLE donation_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        hemocenter_id INTEGER REFERENCES hemocenters(id),
        donation_date TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validated','rejected')),
        notes TEXT,
        validated_at TEXT,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
      INSERT INTO donation_records (id,user_id,hemocenter_id,donation_date,status,notes,validated_at,created_at)
      SELECT d.id,d.user_id,
        CASE WHEN d.hemocenter_id IS NULL OR EXISTS (SELECT 1 FROM hemocenters h WHERE h.id=d.hemocenter_id)
          THEN d.hemocenter_id ELSE NULL END,
        d.donation_date,d.status,d.notes,d.validated_at,d.created_at
      FROM donation_records_legacy_fk d;
      DROP TABLE donation_records_legacy_fk;
      CREATE INDEX IF NOT EXISTS idx_donations_user ON donation_records(user_id, donation_date);
      COMMIT;
    `);
  } catch (error) {
    try { db.exec("ROLLBACK"); } catch {}
    throw error;
  } finally {
    db.pragma("foreign_keys = ON");
  }
}

// A versão anterior usa status pending para pedidos aguardando a unidade.
// A tabela preserva esses registros legados; novos agendamentos são confirmados imediatamente.
const appointmentSql = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='appointments'").get()?.sql || "";
if (!appointmentSql.includes("'pending'")) {
  db.pragma("foreign_keys = OFF");
  db.exec(`
    ALTER TABLE appointments RENAME TO appointments_legacy;
    CREATE TABLE appointments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
      appointment_date TEXT NOT NULL,
      appointment_time TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
      institution_note TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    INSERT INTO appointments (id,user_id,hemocenter_id,appointment_date,appointment_time,status,created_at)
      SELECT id,user_id,hemocenter_id,appointment_date,appointment_time,status,created_at FROM appointments_legacy;
    DROP TABLE appointments_legacy;
  `);
  db.pragma("foreign_keys = ON");
}

db.exec(`CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date,status);`);

// Migração aditiva da caixa de notificações; preserva contas e históricos existentes.
db.exec(`
  CREATE TABLE IF NOT EXISTS notifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type TEXT NOT NULL CHECK(type IN ('donation','campaign','appointment','system')),
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    target TEXT NOT NULL CHECK(target IN ('carteira','campanhas','agendamentos','inicio')),
    reference_id INTEGER,
    dedupe_key TEXT NOT NULL,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(user_id, dedupe_key)
  );
  CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
    ON notifications(user_id, read_at, id DESC);
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS wallet_access_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    code_hash TEXT NOT NULL,
    donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    used_at TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_wallet_access_codes_donor ON wallet_access_codes(donor_id, expires_at);
  CREATE INDEX IF NOT EXISTS idx_wallet_access_codes_hash ON wallet_access_codes(code_hash, expires_at);
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS qr_verifications (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    jti TEXT NOT NULL UNIQUE,
    donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    institution_user_id INTEGER NOT NULL REFERENCES users(id),
    verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE INDEX IF NOT EXISTS idx_qr_verifications_donor ON qr_verifications(donor_id, verified_at);
  CREATE INDEX IF NOT EXISTS idx_appointments_center_date
    ON appointments(hemocenter_id, appointment_date, appointment_time, status);
`);
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_unique_validated
    ON donation_records(user_id, donation_date, hemocenter_id) WHERE status='validated'`);
} catch (error) {
  console.warn("Índice de unicidade por unidade não foi criado; revise registros duplicados:", error.message);
}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_donation_unique_donor_day
    ON donation_records(user_id, donation_date) WHERE status='validated'`);
} catch (error) {
  // Não apaga nem altera histórico para forçar uma migração. A rota mantém
  // checagem transacional; a restrição precisa ser instalada após revisão manual.
  console.warn("Índice global de doação única não foi criado; há possível histórico duplicado que exige revisão:", error.message);
}
try {
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_appointment_active_slot
    ON appointments(hemocenter_id, appointment_date, appointment_time)
    WHERE status IN ('pending','confirmed')`);
} catch (error) {
  console.warn("Índice de horário único não foi criado; revise solicitações ativas duplicadas:", error.message);
}

// Contas @demo.viva são fictícias: pedidos antigos do ambiente de demonstração
// passam a aparecer como confirmados no fluxo novo. Registros de usuários reais
// com status pending são preservados para não confirmar solicitações antigas sem consentimento.
db.prepare(`
  UPDATE appointments AS a SET status='confirmed'
  WHERE a.status='pending'
    AND EXISTS (SELECT 1 FROM users u WHERE u.id=a.user_id AND u.email LIKE '%@demo.viva')
    AND NOT EXISTS (
      SELECT 1 FROM appointments other
      WHERE other.id<>a.id
        AND other.hemocenter_id=a.hemocenter_id
        AND other.appointment_date=a.appointment_date
        AND other.appointment_time=a.appointment_time
        AND other.status IN ('pending','confirmed')
    )
`).run();

// Não inserir unidades fictícias: somente unidades verificadas por um administrador
// aparecem no diretório público.

// Estoque administrado manualmente; nunca inferir valores clínicos.
db.exec(`CREATE TABLE IF NOT EXISTS blood_stock (blood_type TEXT PRIMARY KEY, level TEXT NOT NULL, source TEXT NOT NULL, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)`);

db.exec(`CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
  staff_user_id INTEGER NOT NULL REFERENCES users(id),
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_records(user_id, attendance_date);`);

db.exec(`CREATE TABLE IF NOT EXISTS wallet_verified_sessions (id INTEGER PRIMARY KEY AUTOINCREMENT,donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,staff_user_id INTEGER NOT NULL REFERENCES users(id),verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,consumed_at TEXT);CREATE INDEX IF NOT EXISTS idx_wallet_verified_staff ON wallet_verified_sessions(staff_user_id,donor_id,verified_at);`);

db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_present ON attendance_records(user_id,hemocenter_id,attendance_date) WHERE status='present';`);


// Recuperação de senha: apenas o hash do token é persistido.
db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_expiry
  ON password_reset_tokens(user_id, expires_at);`);
