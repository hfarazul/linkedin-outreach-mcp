/**
 * SQLite Database Schema
 * Tracks prospects, sequences, enrollments, and action logs
 */

import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';

// Database instance (singleton)
let db: Database.Database | null = null;

// Get or create database connection
export function getDb(): Database.Database {
  if (!db) {
    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), 'outreach.db');
    db = new Database(dbPath);
    db.pragma('journal_mode = WAL');
    initializeSchema(db);
  }
  return db;
}

// Initialize database schema
function initializeSchema(database: Database.Database): void {
  database.exec(`
    -- Prospects discovered via search
    CREATE TABLE IF NOT EXISTS prospects (
      id TEXT PRIMARY KEY,
      linkedin_id TEXT UNIQUE,
      public_identifier TEXT,
      full_name TEXT NOT NULL,
      first_name TEXT,
      last_name TEXT,
      headline TEXT,
      company TEXT,
      location TEXT,
      profile_url TEXT,
      picture_url TEXT,
      connection_degree INTEGER,
      is_connection INTEGER DEFAULT 0,
      source_search TEXT,
      tags TEXT,  -- JSON array of tags
      notes TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Outreach sequences (campaigns)
    CREATE TABLE IF NOT EXISTS sequences (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      status TEXT DEFAULT 'draft',  -- draft, active, paused, completed
      steps TEXT NOT NULL,  -- JSON array of step definitions
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Track each prospect's journey through a sequence
    CREATE TABLE IF NOT EXISTS sequence_enrollments (
      id TEXT PRIMARY KEY,
      sequence_id TEXT NOT NULL REFERENCES sequences(id),
      prospect_id TEXT NOT NULL REFERENCES prospects(id),
      current_step INTEGER DEFAULT 0,
      status TEXT DEFAULT 'pending',  -- pending, in_progress, connected, replied, completed, failed, paused
      error_message TEXT,
      last_action_at TEXT,
      next_action_at TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(sequence_id, prospect_id)
    );

    -- Log all outreach actions
    CREATE TABLE IF NOT EXISTS actions_log (
      id TEXT PRIMARY KEY,
      enrollment_id TEXT REFERENCES sequence_enrollments(id),
      prospect_id TEXT REFERENCES prospects(id),
      action_type TEXT NOT NULL,  -- search, invitation_sent, message_sent, profile_viewed, post_liked, etc.
      step_index INTEGER,
      payload TEXT,  -- JSON
      response TEXT,  -- JSON
      status TEXT NOT NULL,  -- success, failed, rate_limited
      error_message TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Known connections (for detecting new connections)
    CREATE TABLE IF NOT EXISTS known_connections (
      linkedin_id TEXT PRIMARY KEY,
      full_name TEXT,
      connected_at TEXT,
      synced_at TEXT DEFAULT (datetime('now'))
    );

    -- Rate limiting counters
    CREATE TABLE IF NOT EXISTS rate_limits (
      id TEXT PRIMARY KEY,  -- action_type + date
      action_type TEXT NOT NULL,
      date TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      updated_at TEXT DEFAULT (datetime('now')),
      UNIQUE(action_type, date)
    );

    -- Create indexes for common queries
    CREATE INDEX IF NOT EXISTS idx_prospects_linkedin_id ON prospects(linkedin_id);
    CREATE INDEX IF NOT EXISTS idx_prospects_source ON prospects(source_search);
    CREATE INDEX IF NOT EXISTS idx_enrollments_sequence ON sequence_enrollments(sequence_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_prospect ON sequence_enrollments(prospect_id);
    CREATE INDEX IF NOT EXISTS idx_enrollments_status ON sequence_enrollments(status);
    CREATE INDEX IF NOT EXISTS idx_enrollments_next_action ON sequence_enrollments(next_action_at);
    CREATE INDEX IF NOT EXISTS idx_actions_enrollment ON actions_log(enrollment_id);
    CREATE INDEX IF NOT EXISTS idx_actions_type ON actions_log(action_type);
    CREATE INDEX IF NOT EXISTS idx_actions_date ON actions_log(created_at);
  `);
}

// Generate UUID
export function generateId(): string {
  return uuidv4();
}

// ============ Prospect Operations ============

export interface Prospect {
  id: string;
  linkedin_id: string;
  public_identifier?: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  company?: string;
  location?: string;
  profile_url?: string;
  picture_url?: string;
  connection_degree?: number;
  is_connection: boolean;
  source_search?: string;
  tags?: string[];
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Database row type (before conversion)
interface ProspectRow {
  id: string;
  linkedin_id: string;
  public_identifier: string | null;
  full_name: string;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  company: string | null;
  location: string | null;
  profile_url: string | null;
  picture_url: string | null;
  connection_degree: number | null;
  is_connection: number;
  source_search: string | null;
  tags: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

function rowToProspect(row: ProspectRow): Prospect {
  return {
    id: row.id,
    linkedin_id: row.linkedin_id,
    public_identifier: row.public_identifier || undefined,
    full_name: row.full_name,
    first_name: row.first_name || undefined,
    last_name: row.last_name || undefined,
    headline: row.headline || undefined,
    company: row.company || undefined,
    location: row.location || undefined,
    profile_url: row.profile_url || undefined,
    picture_url: row.picture_url || undefined,
    connection_degree: row.connection_degree || undefined,
    is_connection: row.is_connection === 1,
    source_search: row.source_search || undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
    notes: row.notes || undefined,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export function saveProspect(prospect: Omit<Prospect, 'id' | 'created_at' | 'updated_at' | 'is_connection'> & { id?: string; is_connection?: boolean }): Prospect {
  const database = getDb();
  const id = prospect.id || generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO prospects (id, linkedin_id, public_identifier, full_name, first_name, last_name,
      headline, company, location, profile_url, picture_url, connection_degree, is_connection,
      source_search, tags, notes, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(linkedin_id) DO UPDATE SET
      public_identifier = excluded.public_identifier,
      full_name = excluded.full_name,
      first_name = excluded.first_name,
      last_name = excluded.last_name,
      headline = excluded.headline,
      company = excluded.company,
      location = excluded.location,
      profile_url = excluded.profile_url,
      picture_url = excluded.picture_url,
      connection_degree = excluded.connection_degree,
      is_connection = excluded.is_connection,
      updated_at = excluded.updated_at
    RETURNING *
  `);

  const result = stmt.get(
    id,
    prospect.linkedin_id,
    prospect.public_identifier || null,
    prospect.full_name,
    prospect.first_name || null,
    prospect.last_name || null,
    prospect.headline || null,
    prospect.company || null,
    prospect.location || null,
    prospect.profile_url || null,
    prospect.picture_url || null,
    prospect.connection_degree || null,
    prospect.is_connection ? 1 : 0,
    prospect.source_search || null,
    prospect.tags ? JSON.stringify(prospect.tags) : null,
    prospect.notes || null,
    now,
    now
  ) as ProspectRow;

  return rowToProspect(result);
}

export function getProspect(id: string): Prospect | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM prospects WHERE id = ?');
  const result = stmt.get(id) as ProspectRow | undefined;

  if (!result) return null;

  return rowToProspect(result);
}

export function getProspectByLinkedInId(linkedinId: string): Prospect | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM prospects WHERE linkedin_id = ?');
  const result = stmt.get(linkedinId) as ProspectRow | undefined;

  if (!result) return null;

  return rowToProspect(result);
}

export interface ProspectFilters {
  source_search?: string;
  is_connection?: boolean;
  has_enrollment?: boolean;
  tags?: string[];
  limit?: number;
  offset?: number;
}

export function getProspects(filters: ProspectFilters = {}): Prospect[] {
  const database = getDb();

  let query = 'SELECT p.* FROM prospects p';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.source_search) {
    conditions.push('p.source_search = ?');
    params.push(filters.source_search);
  }

  if (filters.is_connection !== undefined) {
    conditions.push('p.is_connection = ?');
    params.push(filters.is_connection ? 1 : 0);
  }

  if (filters.has_enrollment !== undefined) {
    if (filters.has_enrollment) {
      query += ' INNER JOIN sequence_enrollments e ON p.id = e.prospect_id';
    } else {
      query += ' LEFT JOIN sequence_enrollments e ON p.id = e.prospect_id';
      conditions.push('e.id IS NULL');
    }
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY p.created_at DESC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  if (filters.offset) {
    query += ' OFFSET ?';
    params.push(filters.offset);
  }

  const stmt = database.prepare(query);
  const results = stmt.all(...params) as ProspectRow[];

  return results.map(rowToProspect);
}

// ============ Sequence Operations ============

export interface SequenceStep {
  type: 'visit_profile' | 'send_invitation' | 'wait_for_acceptance' | 'send_message' | 'send_followup' | 'delay';
  delay_days?: number;
  timeout_days?: number;  // For wait_for_acceptance
  message?: string;  // Template with {{first_name}}, {{company}}, etc.
}

export interface Sequence {
  id: string;
  name: string;
  description?: string;
  status: 'draft' | 'active' | 'paused' | 'completed';
  steps: SequenceStep[];
  created_at: string;
  updated_at: string;
}

export function createSequence(sequence: Omit<Sequence, 'id' | 'created_at' | 'updated_at' | 'status'>): Sequence {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO sequences (id, name, description, status, steps, created_at, updated_at)
    VALUES (?, ?, ?, 'draft', ?, ?, ?)
    RETURNING *
  `);

  const result = stmt.get(
    id,
    sequence.name,
    sequence.description || null,
    JSON.stringify(sequence.steps),
    now,
    now
  ) as Sequence & { steps: string };

  return {
    ...result,
    steps: JSON.parse(result.steps),
  };
}

export function getSequence(id: string): Sequence | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM sequences WHERE id = ?');
  const result = stmt.get(id) as (Sequence & { steps: string }) | undefined;

  if (!result) return null;

  return {
    ...result,
    steps: JSON.parse(result.steps),
  };
}

export function getSequences(status?: Sequence['status']): Sequence[] {
  const database = getDb();

  let query = 'SELECT * FROM sequences';
  const params: unknown[] = [];

  if (status) {
    query += ' WHERE status = ?';
    params.push(status);
  }

  query += ' ORDER BY created_at DESC';

  const stmt = database.prepare(query);
  const results = stmt.all(...params) as (Sequence & { steps: string })[];

  return results.map(r => ({
    ...r,
    steps: JSON.parse(r.steps),
  }));
}

export function updateSequenceStatus(id: string, status: Sequence['status']): void {
  const database = getDb();
  const stmt = database.prepare(`
    UPDATE sequences SET status = ?, updated_at = datetime('now') WHERE id = ?
  `);
  stmt.run(status, id);
}

// ============ Enrollment Operations ============

export interface SequenceEnrollment {
  id: string;
  sequence_id: string;
  prospect_id: string;
  current_step: number;
  status: 'pending' | 'in_progress' | 'connected' | 'replied' | 'completed' | 'failed' | 'paused';
  error_message?: string;
  last_action_at?: string;
  next_action_at?: string;
  created_at: string;
  updated_at: string;
}

export function enrollProspect(sequenceId: string, prospectId: string, nextActionAt?: Date): SequenceEnrollment {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO sequence_enrollments (id, sequence_id, prospect_id, current_step, status, next_action_at, created_at, updated_at)
    VALUES (?, ?, ?, 0, 'pending', ?, ?, ?)
    ON CONFLICT(sequence_id, prospect_id) DO NOTHING
    RETURNING *
  `);

  const result = stmt.get(
    id,
    sequenceId,
    prospectId,
    nextActionAt?.toISOString() || now,
    now,
    now
  ) as SequenceEnrollment | undefined;

  if (!result) {
    // Already enrolled
    const existing = database.prepare(
      'SELECT * FROM sequence_enrollments WHERE sequence_id = ? AND prospect_id = ?'
    ).get(sequenceId, prospectId) as SequenceEnrollment;
    return existing;
  }

  return result;
}

export function getEnrollment(id: string): SequenceEnrollment | null {
  const database = getDb();
  const stmt = database.prepare('SELECT * FROM sequence_enrollments WHERE id = ?');
  return stmt.get(id) as SequenceEnrollment | undefined || null;
}

export function getEnrollmentByProspect(prospectId: string, sequenceId?: string): SequenceEnrollment | null {
  const database = getDb();

  if (sequenceId) {
    const stmt = database.prepare('SELECT * FROM sequence_enrollments WHERE prospect_id = ? AND sequence_id = ?');
    return stmt.get(prospectId, sequenceId) as SequenceEnrollment | undefined || null;
  }

  const stmt = database.prepare('SELECT * FROM sequence_enrollments WHERE prospect_id = ? ORDER BY created_at DESC LIMIT 1');
  return stmt.get(prospectId) as SequenceEnrollment | undefined || null;
}

export function updateEnrollment(
  id: string,
  updates: Partial<Pick<SequenceEnrollment, 'current_step' | 'status' | 'error_message' | 'last_action_at' | 'next_action_at'>>
): void {
  const database = getDb();
  const setClauses: string[] = ["updated_at = datetime('now')"];
  const params: unknown[] = [];

  if (updates.current_step !== undefined) {
    setClauses.push('current_step = ?');
    params.push(updates.current_step);
  }
  if (updates.status !== undefined) {
    setClauses.push('status = ?');
    params.push(updates.status);
  }
  if (updates.error_message !== undefined) {
    setClauses.push('error_message = ?');
    params.push(updates.error_message);
  }
  if (updates.last_action_at !== undefined) {
    setClauses.push('last_action_at = ?');
    params.push(updates.last_action_at);
  }
  if (updates.next_action_at !== undefined) {
    setClauses.push('next_action_at = ?');
    params.push(updates.next_action_at);
  }

  params.push(id);

  const stmt = database.prepare(`UPDATE sequence_enrollments SET ${setClauses.join(', ')} WHERE id = ?`);
  stmt.run(...params);
}

export interface EnrollmentFilters {
  sequence_id?: string;
  status?: SequenceEnrollment['status'];
  due_for_action?: boolean;  // next_action_at <= now
  limit?: number;
}

export function getEnrollments(filters: EnrollmentFilters = {}): SequenceEnrollment[] {
  const database = getDb();

  let query = 'SELECT * FROM sequence_enrollments';
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (filters.sequence_id) {
    conditions.push('sequence_id = ?');
    params.push(filters.sequence_id);
  }

  if (filters.status) {
    conditions.push('status = ?');
    params.push(filters.status);
  }

  if (filters.due_for_action) {
    // Use replace to normalize ISO format (with 'T') to SQLite format (with space)
    conditions.push("replace(next_action_at, 'T', ' ') <= datetime('now')");
    conditions.push("status IN ('pending', 'in_progress', 'connected')");
  }

  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }

  query += ' ORDER BY next_action_at ASC';

  if (filters.limit) {
    query += ' LIMIT ?';
    params.push(filters.limit);
  }

  const stmt = database.prepare(query);
  return stmt.all(...params) as SequenceEnrollment[];
}

// ============ Action Log Operations ============

export interface ActionLog {
  id: string;
  enrollment_id?: string;
  prospect_id?: string;
  action_type: string;
  step_index?: number;
  payload?: Record<string, unknown>;
  response?: Record<string, unknown>;
  status: 'success' | 'failed' | 'rate_limited';
  error_message?: string;
  created_at: string;
}

export function logAction(action: Omit<ActionLog, 'id' | 'created_at'>): ActionLog {
  const database = getDb();
  const id = generateId();
  const now = new Date().toISOString();

  const stmt = database.prepare(`
    INSERT INTO actions_log (id, enrollment_id, prospect_id, action_type, step_index, payload, response, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    RETURNING *
  `);

  const result = stmt.get(
    id,
    action.enrollment_id || null,
    action.prospect_id || null,
    action.action_type,
    action.step_index ?? null,
    action.payload ? JSON.stringify(action.payload) : null,
    action.response ? JSON.stringify(action.response) : null,
    action.status,
    action.error_message || null,
    now
  ) as ActionLog & { payload: string | null; response: string | null };

  return {
    ...result,
    payload: result.payload ? JSON.parse(result.payload) : undefined,
    response: result.response ? JSON.parse(result.response) : undefined,
  };
}

export function getRecentActions(actionType?: string, limit = 50): ActionLog[] {
  const database = getDb();

  let query = 'SELECT * FROM actions_log';
  const params: unknown[] = [];

  if (actionType) {
    query += ' WHERE action_type = ?';
    params.push(actionType);
  }

  query += ' ORDER BY created_at DESC LIMIT ?';
  params.push(limit);

  const stmt = database.prepare(query);
  const results = stmt.all(...params) as (ActionLog & { payload: string | null; response: string | null })[];

  return results.map(r => ({
    ...r,
    payload: r.payload ? JSON.parse(r.payload) : undefined,
    response: r.response ? JSON.parse(r.response) : undefined,
  }));
}

// ============ Known Connections Operations ============

export function isKnownConnection(linkedinId: string): boolean {
  const database = getDb();
  const stmt = database.prepare('SELECT 1 FROM known_connections WHERE linkedin_id = ?');
  return !!stmt.get(linkedinId);
}

export function markAsKnownConnection(linkedinId: string, fullName?: string): void {
  const database = getDb();
  const stmt = database.prepare(`
    INSERT INTO known_connections (linkedin_id, full_name, connected_at, synced_at)
    VALUES (?, ?, datetime('now'), datetime('now'))
    ON CONFLICT(linkedin_id) DO UPDATE SET synced_at = datetime('now')
  `);
  stmt.run(linkedinId, fullName || null);
}

// ============ Rate Limiting Operations ============

export function getRateLimitCount(actionType: string, date?: string): number {
  const database = getDb();
  const dateStr = date || new Date().toISOString().split('T')[0];

  const stmt = database.prepare('SELECT count FROM rate_limits WHERE action_type = ? AND date = ?');
  const result = stmt.get(actionType, dateStr) as { count: number } | undefined;

  return result?.count || 0;
}

export function incrementRateLimit(actionType: string, date?: string): number {
  const database = getDb();
  const dateStr = date || new Date().toISOString().split('T')[0];
  const id = `${actionType}_${dateStr}`;

  const stmt = database.prepare(`
    INSERT INTO rate_limits (id, action_type, date, count, updated_at)
    VALUES (?, ?, ?, 1, datetime('now'))
    ON CONFLICT(action_type, date) DO UPDATE SET
      count = count + 1,
      updated_at = datetime('now')
    RETURNING count
  `);

  const result = stmt.get(id, actionType, dateStr) as { count: number };
  return result.count;
}

export function getWeeklyRateLimitCount(actionType: string): number {
  const database = getDb();

  // Get count for last 7 days
  const stmt = database.prepare(`
    SELECT SUM(count) as total FROM rate_limits
    WHERE action_type = ? AND date >= date('now', '-7 days')
  `);

  const result = stmt.get(actionType) as { total: number | null };
  return result?.total || 0;
}

// Close database connection
export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
