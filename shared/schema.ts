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
  totalProducts: integer("total_products").notNull(),
  totalCustomers: integer("total_customers").notNull(),
  completedItems: integer("completed_items").default(0),
  csvData: jsonb("csv_data").notNull(),
  createdBy: varchar("created_by").notNull().references(() => users.id),
  createdAt: timestamp("created_at").default(sql`now()`),
  completedAt: timestamp("completed_at"),
});

export const products = pgTable("products", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  jobId: varchar("job_id").notNull().references(() => jobs.id, { onDelete: 'cascade' }),
  barCode: text("bar_code").notNull(),
  productName: text("product_name").notNull(),
  qty: integer("qty").notNull(),
  customerName: text("customer_name").notNull(),
  groupName: text("group_name"),
  scannedQty: integer("scanned_qty").default(0),
  boxNumber: integer("box_number"),
  isComplete: boolean("is_complete").default(false),
});

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
  eventType: text("event_type").notNull(), // 'scan', 'undo', 'error'
  scanTime: timestamp("scan_time").default(sql`now()`),
  timeSincePrevious: integer("time_since_previous"), // milliseconds
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
});

// Relations
export const usersRelations = relations(users, ({ one, many }) => ({
  createdJobs: many(jobs, { relationName: "creator" }),
  scanSessions: many(scanSessions),
  jobAssignments: many(jobAssignments, { relationName: "assignee" }),
  assignmentsGiven: many(jobAssignments, { relationName: "assigner" }),
  preferences: one(userPreferences),
  createdRoleDefaults: many(roleDefaults),
}));

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
  products: many(products),
  scanSessions: many(scanSessions),
  assignments: many(jobAssignments),
}));

export const productsRelations = relations(products, ({ one }) => ({
  job: one(jobs, {
    fields: [products.jobId],
    references: [jobs.id],
  }),
}));

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

export const insertProductSchema = createInsertSchema(products).omit({
  id: true,
});

export const insertScanSessionSchema = createInsertSchema(scanSessions).omit({
  id: true,
  startTime: true,
  endTime: true,
  lastActivityTime: true,
});

export const insertScanEventSchema = createInsertSchema(scanEvents).omit({
  id: true,
  scanTime: true,
});

export const insertJobAssignmentSchema = createInsertSchema(jobAssignments).omit({
  id: true,
  assignedAt: true,
});

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
export type Product = typeof products.$inferSelect;
export type InsertProduct = z.infer<typeof insertProductSchema>;
export type ScanSession = typeof scanSessions.$inferSelect;
export type InsertScanSession = z.infer<typeof insertScanSessionSchema>;
export type ScanEvent = typeof scanEvents.$inferSelect;
export type InsertScanEvent = z.infer<typeof insertScanEventSchema>;
export type JobAssignment = typeof jobAssignments.$inferSelect;
export type InsertJobAssignment = z.infer<typeof insertJobAssignmentSchema>;
// Remove duplicates - use the interface defined above
export type RoleDefaults = typeof roleDefaults.$inferSelect;
export type InsertRoleDefaults = z.infer<typeof insertRoleDefaultsSchema>;
export type Login = z.infer<typeof loginSchema>;
export type CsvRow = z.infer<typeof csvRowSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PerformanceReport = z.infer<typeof performanceReportSchema>;
