import { sql, relations } from "drizzle-orm";
import { pgTable, text, varchar, integer, timestamp, boolean, jsonb, decimal } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  staffId: text("staff_id").notNull().unique(),
  pin: text("pin").notNull(),
  role: text("role").notNull(), // 'manager', 'supervisor', 'worker'
  name: text("name").notNull(),
  isActive: boolean("is_active").default(true),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const jobs = pgTable("jobs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  description: text("description"),
  status: text("status").notNull().default('pending'), // 'pending', 'active', 'completed', 'paused'
  isActive: boolean("is_active").default(false), // NEW: Controls if workers can scan this job
  isArchived: boolean("is_archived").default(false), // NEW: Controls if job is archived
  totalProducts: integer("total_products").notNull(),
  totalCustomers: integer("total_customers").notNull(),
  completedItems: integer("completed_items").default(0),
  csvData: jsonb("csv_data").notNull(),
  jobTypeId: varchar("job_type_id").references(() => jobTypes.id), // NEW
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

// Box Requirements: Each box contains specific items for specific customers
export const boxRequirements = pgTable("box_requirements", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  boxNumber: integer("box_number").notNull(),
  customerName: text("customer_name").notNull(),
  barCode: text("bar_code").notNull(),
  productName: text("product_name").notNull(),
  requiredQty: integer("required_qty").notNull(),
  scannedQty: integer("scanned_qty").default(0),
  isComplete: boolean("is_complete").default(false),
  groupName: text("group_name"), // NEW: Group information for filtering

  // Worker tracking fields for color highlighting
  lastWorkerUserId: varchar("last_worker_user_id").references(() => users.id),
  lastWorkerColor: text("last_worker_color"),
});

// Products table removed - all functionality moved to box_requirements system

export const scanSessions = pgTable("scan_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default('active'), // 'active', 'paused', 'completed'
  totalScans: integer("total_scans").default(0),
  successfulScans: integer("successful_scans").default(0),
  errorScans: integer("error_scans").default(0),
  undoOperations: integer("undo_operations").default(0),
  sessionData: jsonb("session_data"),
  startTime: timestamp("start_time").default(sql`now()`),
  endTime: timestamp("end_time"),
  lastActivityTime: timestamp("last_activity_time").default(sql`now()`),
});

export const scanEvents = pgTable("scan_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  sessionId: varchar("session_id").notNull().references(() => scanSessions.id, { onDelete: 'cascade' }),
  barCode: text("bar_code").notNull(),
  productName: text("product_name"),
  customerName: text("customer_name"),
  boxNumber: integer("box_number"),
  calculatedTargetBox: integer("calculated_target_box"), // NEW: Calculated target box based on worker allocation
  eventType: text("event_type").notNull(), // 'scan', 'undo', 'error', 'extra_item'
  scanTime: timestamp("scan_time").default(sql`now()`),
  timeSincePrevious: integer("time_since_previous"), // milliseconds

  // Worker assignment tracking (PHASE 4: Cleaned up unused fields)
  workerColor: text("worker_color"), // Track worker color for this scan

  // Extra Items tracking (NEW)
  isExtraItem: boolean("is_extra_item").default(false), // Mark if this is an extra item not in original job
  jobId: varchar("job_id").references(() => jobs.id), // Direct reference for extra items tracking
});

export const jobTypes = pgTable("job_types", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: varchar("name").notNull().unique(),
  benchmarkItemsPerHour: integer("benchmark_items_per_hour").default(71),
  requireGroupField: boolean("require_group_field").default(false),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const workerBoxAssignments = pgTable("worker_box_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  workerId: varchar("worker_id").notNull().references(() => users.id),
  boxNumber: integer("box_number"),
  assignmentType: text("assignment_type").notNull(), // 'ascending', 'descending', 'middle_up', 'middle_down'
  createdAt: timestamp("created_at").default(sql`now()`),
});

// PHASE 4: Removed sessionSnapshots table (unused dead code)

export const jobArchives = pgTable("job_archives", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  originalJobId: varchar("original_job_id").notNull(),

  // Job snapshot data
  jobName: varchar("job_name").notNull(),
  totalItems: integer("total_items").notNull(),
  totalBoxes: integer("total_boxes").notNull(),
  managerName: varchar("manager_name").notNull(), // User who created the job
  managerId: varchar("manager_id").notNull().references(() => users.id),

  // CheckCount statistics
  totalExtrasFound: integer("total_extras_found").default(0),
  totalItemsChecked: integer("total_items_checked").default(0),
  totalCorrectChecks: integer("total_correct_checks").default(0),
  overallCheckAccuracy: decimal("overall_check_accuracy", { precision: 5, scale: 2 }).default("0.00"),

  // Archive metadata
  archivedBy: varchar("archived_by").notNull().references(() => users.id),
  archivedAt: timestamp("archived_at").default(sql`now()`),
  isPurged: boolean("is_purged").default(false), // True if live data has been deleted

  // Full snapshot for restore capability (when not purged)
  jobDataSnapshot: jsonb("job_data_snapshot"), // Complete job data for restore
});

// Archive worker statistics - tracks individual worker performance for each archive
export const archiveWorkerStats = pgTable("archive_worker_stats", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  archiveId: varchar("archive_id").notNull().references(() => jobArchives.id, { onDelete: 'cascade' }),
  workerId: varchar("worker_id").notNull().references(() => users.id),
  workerName: varchar("worker_name").notNull(),

  // Scanning statistics
  totalScans: integer("total_scans").default(0),
  totalSessionTime: integer("total_session_time").default(0), // in minutes

  // CheckCount statistics per worker
  itemsChecked: integer("items_checked").default(0),
  correctChecks: integer("correct_checks").default(0),
  checkAccuracy: decimal("check_accuracy", { precision: 5, scale: 2 }).default("0.00"),
  extrasFound: integer("extras_found").default(0), // Extras found by this worker during CheckCount
  errorsCaused: integer("errors_caused").default(0), // Items this worker scanned incorrectly (found during CheckCount)

  createdAt: timestamp("created_at").default(sql`now()`),
});

export const userPreferences = pgTable("user_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: 'cascade' }).unique(),

  // Scanner Settings
  maxBoxesPerRow: integer("max_boxes_per_row").default(12),
  autoClearInput: boolean("auto_clear_input").default(true),
  soundFeedback: boolean("sound_feedback").default(true),
  vibrationFeedback: boolean("vibration_feedback").default(false),
  scannerType: text("scanner_type").default("camera"), // "camera" or "hid"
  targetScansPerHour: integer("target_scans_per_hour").default(71),
  autoSaveSessions: boolean("auto_save_sessions").default(true),
  showRealtimeStats: boolean("show_realtime_stats").default(true),

  // Interface Preferences
  theme: text("theme").default("blue"), // "blue", "green", "orange", "teal", "red", "dark"
  compactMode: boolean("compact_mode").default(false),
  showHelpTips: boolean("show_help_tips").default(true),

  // Performance Preferences
  enableAutoUndo: boolean("enable_auto_undo").default(false),
  undoTimeLimit: integer("undo_time_limit").default(30), // seconds
  batchScanMode: boolean("batch_scan_mode").default(false),

  // Mobile Preferences (NEW)
  mobileModePreference: boolean("mobile_mode_preference").default(false),
  singleBoxMode: boolean("single_box_mode").default(false),

  // CheckCount Preferences (NEW)
  checkBoxEnabled: boolean("check_box_enabled").default(false), // Worker permission to perform checks

  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const roleDefaults = pgTable("role_defaults", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  role: text("role").notNull().unique(), // 'manager', 'supervisor', 'worker'
  defaultPreferences: jsonb("default_preferences").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  updatedAt: timestamp("updated_at").default(sql`now()`),
});

export const jobAssignments = pgTable("job_assignments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  userId: varchar("user_id").notNull().references(() => users.id),
  assignedBy: varchar("assigned_by").notNull().references(() => users.id),
  assignedAt: timestamp("assigned_at").default(sql`now()`),
  isActive: boolean("is_active").default(true),
  assignedColor: text("assigned_color"), // Color for the worker in dashboards/reports
  allocationPattern: text("allocation_pattern").default('ascending'), // Box allocation pattern (ascending, descending, middle_up, middle_down)
  workerIndex: integer("worker_index").default(0), // Position in worker assignment order (0-3)
});

// CheckCount Tables (NEW)
export const checkSessions = pgTable("check_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  boxNumber: integer("box_number").notNull(),
  userId: varchar("user_id").notNull().references(() => users.id),
  status: text("status").notNull().default('active'), // 'active', 'completed', 'cancelled'
  startTime: timestamp("start_time").default(sql`now()`),
  endTime: timestamp("end_time"),
  totalItemsExpected: integer("total_items_expected").notNull(),
  totalItemsScanned: integer("total_items_scanned").default(0),
  discrepanciesFound: integer("discrepancies_found").default(0),
  correctionsApplied: boolean("corrections_applied").default(false), // NEW: Track if corrections were applied
  isComplete: boolean("is_complete").default(false),
  createdAt: timestamp("created_at").default(sql`now()`),
});

export const checkEvents = pgTable("check_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkSessionId: varchar("check_session_id").notNull().references(() => checkSessions.id, { onDelete: 'cascade' }),
  barCode: text("bar_code").notNull(),
  productName: text("product_name"),
  scannedQty: integer("scanned_qty").notNull(),
  expectedQty: integer("expected_qty").notNull(),
  discrepancyType: text("discrepancy_type").notNull(), // 'match', 'shortage', 'excess'
  eventType: text("event_type").notNull().default('scan'), // 'scan', 'manual_adjustment'
  scanTime: timestamp("scan_time").default(sql`now()`),
});

export const checkResults = pgTable("check_results", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  checkSessionId: varchar("check_session_id").notNull().references(() => checkSessions.id, { onDelete: 'cascade' }),
  boxRequirementId: varchar("box_requirement_id").notNull().references(() => boxRequirements.id),
  finalQty: integer("final_qty").notNull(),
  discrepancyNotes: text("discrepancy_notes"),
  resolutionAction: text("resolution_action"),
  resolvedBy: varchar("resolved_by").references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  createdJobs: many(jobs, { relationName: "creator" }),
  scanSessions: many(scanSessions),
  jobAssignments: many(jobAssignments, { relationName: "assignee" }),
  assignmentsGiven: many(jobAssignments, { relationName: "assigner" }),
  preferences: one(userPreferences),
  createdRoleDefaults: many(roleDefaults),
  createdJobTypes: many(jobTypes),
  workerBoxAssignments: many(workerBoxAssignments),
  archivedJobs: many(jobArchives),
  checkSessions: many(checkSessions), // NEW
}));

export const jobTypesRelations = relations(jobTypes, ({ one, many }) => ({
  creator: one(users, {
    fields: [jobTypes.createdBy],
    references: [users.id],
  }),
  jobs: many(jobs),
}));

export const workerBoxAssignmentsRelations = relations(workerBoxAssignments, ({ one }) => ({
  job: one(jobs, {
    fields: [workerBoxAssignments.jobId],
    references: [jobs.id],
  }),
  worker: one(users, {
    fields: [workerBoxAssignments.workerId],
    references: [users.id],
  }),
}));

// PHASE 4: Removed sessionSnapshotsRelations (table removed)

// Archive relations moved to proper location below

export const userPreferencesRelations = relations(userPreferences, ({ one }) => ({
  user: one(users, {
    fields: [userPreferences.userId],
    references: [users.id],
  }),
}));

export const roleDefaultsRelations = relations(roleDefaults, ({ one }) => ({
  creator: one(users, {
    fields: [roleDefaults.createdBy],
    references: [users.id],
  }),
}));

export const jobsRelations = relations(jobs, ({ one, many }) => ({
  creator: one(users, {
    fields: [jobs.createdBy],
    references: [users.id],
    relationName: "creator",
  }),
  jobType: one(jobTypes, {
    fields: [jobs.jobTypeId],
    references: [jobTypes.id],
  }),

  boxRequirements: many(boxRequirements),
  scanSessions: many(scanSessions),
  assignments: many(jobAssignments),
  workerBoxAssignments: many(workerBoxAssignments),
  checkSessions: many(checkSessions), // NEW
}));

export const boxRequirementsRelations = relations(boxRequirements, ({ one, many }) => ({
  job: one(jobs, {
    fields: [boxRequirements.jobId],
    references: [jobs.id],
  }),
  lastWorker: one(users, {
    fields: [boxRequirements.lastWorkerUserId],
    references: [users.id],
  }),
  checkResults: many(checkResults), // NEW
}));

// Products relations removed - table eliminated

export const scanSessionsRelations = relations(scanSessions, ({ one, many }) => ({
  job: one(jobs, {
    fields: [scanSessions.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [scanSessions.userId],
    references: [users.id],
  }),
  scanEvents: many(scanEvents),
  // PHASE 4: snapshots: many(sessionSnapshots) removed
}));

export const scanEventsRelations = relations(scanEvents, ({ one }) => ({
  session: one(scanSessions, {
    fields: [scanEvents.sessionId],
    references: [scanSessions.id],
  }),
}));

export const jobAssignmentsRelations = relations(jobAssignments, ({ one }) => ({
  job: one(jobs, {
    fields: [jobAssignments.jobId],
    references: [jobs.id],
  }),
  assignee: one(users, {
    fields: [jobAssignments.userId],
    references: [users.id],
    relationName: "assignee",
  }),
  assigner: one(users, {
    fields: [jobAssignments.assignedBy],
    references: [users.id],
    relationName: "assigner",
  }),
}));

// NEW CheckCount Relations
export const checkSessionsRelations = relations(checkSessions, ({ one, many }) => ({
  job: one(jobs, {
    fields: [checkSessions.jobId],
    references: [jobs.id],
  }),
  user: one(users, {
    fields: [checkSessions.userId],
    references: [users.id],
  }),
  checkEvents: many(checkEvents),
  checkResults: many(checkResults),
}));

export const checkEventsRelations = relations(checkEvents, ({ one }) => ({
  checkSession: one(checkSessions, {
    fields: [checkEvents.checkSessionId],
    references: [checkSessions.id],
  }),
}));

export const checkResultsRelations = relations(checkResults, ({ one }) => ({
  checkSession: one(checkSessions, {
    fields: [checkResults.checkSessionId],
    references: [checkSessions.id],
  }),
  boxRequirement: one(boxRequirements, {
    fields: [checkResults.boxRequirementId],
    references: [boxRequirements.id],
  }),
}));

// Archive relations
export const jobArchivesRelations = relations(jobArchives, ({ one, many }) => ({
  manager: one(users, {
    fields: [jobArchives.managerId],
    references: [users.id],
    relationName: "manager",
  }),
  archivedBy: one(users, {
    fields: [jobArchives.archivedBy],
    references: [users.id],
    relationName: "archiver",
  }),
  workerStats: many(archiveWorkerStats),
}));

export const archiveWorkerStatsRelations = relations(archiveWorkerStats, ({ one }) => ({
  archive: one(jobArchives, {
    fields: [archiveWorkerStats.archiveId],
    references: [jobArchives.id],
  }),
  worker: one(users, {
    fields: [archiveWorkerStats.workerId],
    references: [users.id],
  }),
}));

// Zod schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
});

export const insertJobSchema = createInsertSchema(jobs).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

// Product schema removed - table eliminated

export const insertBoxRequirementSchema = createInsertSchema(boxRequirements).omit({
  id: true,
});

export const insertScanSessionSchema = createInsertSchema(scanSessions).omit({
  id: true,
  startTime: true,
  endTime: true,
  lastActivityTime: true,
});

// DUPLICATE REMOVED: insertScanEventSchema moved to proper location below

export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({
  id: true,
  assignedAt: true,
});

// NEW CheckCount Schemas
export const insertCheckSessionSchema = createInsertSchema(checkSessions).omit({
  id: true,
  startTime: true,
  createdAt: true,
});

export const insertCheckEventSchema = createInsertSchema(checkEvents).omit({
  id: true,
  scanTime: true,
});

export const insertCheckResultSchema = createInsertSchema(checkResults).omit({
  id: true,
  createdAt: true,
});

// New table insert schemas
export const insertJobTypeSchema = createInsertSchema(jobTypes).omit({
  id: true,
  createdAt: true,
});

export const insertWorkerBoxAssignmentSchema = createInsertSchema(workerBoxAssignments).omit({
  id: true,
  createdAt: true,
});

// PHASE 4: Removed insertSessionSnapshotSchema (table removed)

// Extra Items schemas (NEW)
export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  scanTime: true,
  timeSincePrevious: true,
});
export type InsertScanEvent = z.infer<typeof insertScanEventSchema>;
export type ScanEvent = typeof scanEvents.$inferSelect;

export const insertJobArchiveSchema = createInsertSchema(jobArchives).omit({
  id: true,
  archivedAt: true,
});

// Archive worker stats schemas
export const insertArchiveWorkerStatsSchema = createInsertSchema(archiveWorkerStats).omit({
  id: true,
  createdAt: true,
});

export type InsertJobArchive = z.infer<typeof insertJobArchiveSchema>;
export type JobArchive = typeof jobArchives.$inferSelect;
export type InsertArchiveWorkerStats = z.infer<typeof insertArchiveWorkerStatsSchema>;
export type ArchiveWorkerStats = typeof archiveWorkerStats.$inferSelect;

// User Preferences Schema
export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type SelectUserPreferences = typeof userPreferences.$inferSelect;

// User Preferences Type for frontend use
export interface UserPreferences {
  // Scanner Settings
  maxBoxesPerRow: number;
  autoClearInput: boolean;
  soundFeedback: boolean;
  vibrationFeedback: boolean;
  scannerType: "camera" | "hid";
  targetScansPerHour: number;
  autoSaveSessions: boolean;
  showRealtimeStats: boolean;

  // Interface Preferences
  theme: "blue" | "green" | "orange" | "teal" | "red" | "dark";
  compactMode: boolean;
  showHelpTips: boolean;

  // Performance Preferences
  enableAutoUndo: boolean;
  undoTimeLimit: number;
  batchScanMode: boolean;

  // Mobile Preferences (NEW)
  mobileModePreference: boolean;
  singleBoxMode: boolean;

  // CheckCount Preferences (NEW)
  checkBoxEnabled: boolean;
}

// Remove duplicate schemas that were already defined earlier



export const insertRoleDefaultsSchema = createInsertSchema(roleDefaults).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Login schema
export const loginSchema = z.object({
  staffId: z.string().min(1, "Staff ID is required"),
  pin: z.string().min(1, "PIN is required"),
});

// CSV upload schema
export const csvRowSchema = z.object({
  BarCode: z.string().min(1, "BarCode is required"),
  "Product Name": z.string().min(1, "Product Name is required"),
  Qty: z.coerce.number().int().positive("Qty must be a positive integer"),
  CustomName: z.string().min(1, "CustomName is required"),
  Group: z.string().optional().refine((val) => val === undefined || val === "" || val.length > 0, {
    message: "Group must not be empty when provided"
  }),
});

// Theme schema
export const themeSchema = z.object({
  name: z.string(),
  primary: z.string(),
  success: z.string(),
  warning: z.string(),
  error: z.string(),
});

// Performance report schema
export const performanceReportSchema = z.object({
  sessionId: z.string(),
  totalScans: z.number(),
  scansPerHour: z.number(),
  accuracy: z.number(),
  score: z.number(),
  sessionDuration: z.number(),
  averageTimePerScan: z.number(),
});

// Types
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;
export type Job = typeof jobs.$inferSelect;
export type InsertJob = z.infer<typeof insertJobSchema>;
// Product types removed - table eliminated
export type ScanSession = typeof scanSessions.$inferSelect;
export type InsertScanSession = z.infer<typeof insertScanSessionSchema>;
// ScanEvent types already defined above
export type JobAssignment = typeof jobAssignments.$inferSelect;
export type InsertJobAssignment = z.infer<typeof insertJobAssignmentSchema>;
export type RoleDefaults = typeof roleDefaults.$inferSelect;
export type InsertRoleDefaults = z.infer<typeof insertRoleDefaultsSchema>;

// New table types
export type JobType = typeof jobTypes.$inferSelect;
export type InsertJobType = z.infer<typeof insertJobTypeSchema>;
export type WorkerBoxAssignment = typeof workerBoxAssignments.$inferSelect;
export type InsertWorkerBoxAssignment = z.infer<typeof insertWorkerBoxAssignmentSchema>;
// PHASE 4: Removed SessionSnapshot types (table removed)
// JobArchive type moved to archive section

// NEW CheckCount Types
export type CheckSession = typeof checkSessions.$inferSelect;
export type InsertCheckSession = z.infer<typeof insertCheckSessionSchema>;
export type CheckEvent = typeof checkEvents.$inferSelect;
export type InsertCheckEvent = z.infer<typeof insertCheckEventSchema>;
export type CheckResult = typeof checkResults.$inferSelect;
export type InsertCheckResult = z.infer<typeof insertCheckResultSchema>;
export type InsertPutAsideItem = z.infer<typeof insertPutAsideItemSchema>;
export type PutAsideItem = typeof putAsideItems.$inferSelect;
export type BoxRequirement = typeof boxRequirements.$inferSelect;
export type InsertBoxRequirement = z.infer<typeof insertBoxRequirementSchema>;

export type Login = z.infer<typeof loginSchema>;
export type CsvRow = z.infer<typeof csvRowSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PerformanceReport = z.infer<typeof performanceReportSchema>;