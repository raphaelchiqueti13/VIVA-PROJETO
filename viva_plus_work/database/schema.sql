PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  auth_version INTEGER NOT NULL DEFAULT 0,
  role TEXT NOT NULL DEFAULT 'donor' CHECK(role IN ('donor','hemocenter','admin')),
  blood_type TEXT CHECK(blood_type IN ('A+','A-','B+','B-','AB+','AB-','O+','O-') OR blood_type IS NULL),
  blood_type_verified INTEGER NOT NULL DEFAULT 0 CHECK(blood_type_verified IN (0,1)),
  region TEXT,
  phone TEXT,
  birth_date TEXT,
  city TEXT,
  accessibility_libras INTEGER NOT NULL DEFAULT 0 CHECK(accessibility_libras IN (0,1)),
  profile_completed INTEGER NOT NULL DEFAULT 0 CHECK(profile_completed IN (0,1)),
  active INTEGER NOT NULL DEFAULT 1 CHECK(active IN (0,1)),
  hemocenter_id INTEGER REFERENCES hemocenters(id),
  last_donation_date TEXT,
  notification_campaigns INTEGER NOT NULL DEFAULT 1,
  notification_eligibility INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS hemocenters (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  region TEXT NOT NULL,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  phone TEXT,
  opening_hours TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  source_url TEXT,
  booking_url TEXT,
  verified_at TEXT,
  verified_by INTEGER REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS donation_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER REFERENCES hemocenters(id),
  donation_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','validated','rejected')),
  notes TEXT,
  validated_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS appointments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
  appointment_date TEXT NOT NULL,
  appointment_time TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','confirmed','cancelled','completed')),
  institution_note TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS campaigns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  blood_type TEXT,
  region TEXT NOT NULL,
  hemocenter_id INTEGER REFERENCES hemocenters(id),
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','paused','closed')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor_user_id INTEGER REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id INTEGER,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS qr_verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  jti TEXT NOT NULL UNIQUE,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  institution_user_id INTEGER NOT NULL REFERENCES users(id),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_donations_user ON donation_records(user_id, donation_date);
CREATE INDEX IF NOT EXISTS idx_appointments_date ON appointments(appointment_date, status);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status, region);
CREATE INDEX IF NOT EXISTS idx_qr_verifications_donor ON qr_verifications(donor_id, verified_at);


-- Códigos temporários de apresentação da carteira (não são senha nem documento).
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


CREATE TABLE IF NOT EXISTS attendance_records (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  hemocenter_id INTEGER NOT NULL REFERENCES hemocenters(id),
  staff_user_id INTEGER NOT NULL REFERENCES users(id),
  attendance_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'present' CHECK(status IN ('present','cancelled')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_attendance_user ON attendance_records(user_id, attendance_date);

CREATE TABLE IF NOT EXISTS wallet_verified_sessions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  donor_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  staff_user_id INTEGER NOT NULL REFERENCES users(id),
  verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  consumed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_wallet_verified_staff ON wallet_verified_sessions(staff_user_id, donor_id, verified_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_attendance_unique_present ON attendance_records(user_id,hemocenter_id,attendance_date) WHERE status='present';


-- Tokens de recuperação são armazenados somente como hash e têm uso único.
CREATE TABLE IF NOT EXISTS password_reset_tokens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL,
  used_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_password_reset_user_expiry
  ON password_reset_tokens(user_id, expires_at);


-- Caixa de notificações internas por usuário. O dedupe_key impede eventos duplicados.
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
