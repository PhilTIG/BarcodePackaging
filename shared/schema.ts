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
  preferences: jsonb("preferences").notNull(),
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

// User preferences schemas
export const userPreferencesSchema = z.object({
  maxBoxesPerRow: z.number().min(4).max(16),
  autoClearInput: z.boolean(),
  soundFeedback: z.boolean(),
  vibrationFeedback: z.boolean(),
  scannerType: z.enum(["camera", "usb", "bluetooth"]),
  targetScansPerHour: z.number().min(10).max(200),
  autoSaveSessions: z.boolean(),
  showRealtimeStats: z.boolean(),
});

export const insertUserPreferencesSchema = createInsertSchema(userPreferences).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

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
export type UserPreferences = typeof userPreferences.$inferSelect;
export type RoleDefaults = typeof roleDefaults.$inferSelect;
export type InsertUserPreferences = z.infer<typeof insertUserPreferencesSchema>;
export type InsertRoleDefaults = z.infer<typeof insertRoleDefaultsSchema>;
export type UserPreferencesData = z.infer<typeof userPreferencesSchema>;
export type Login = z.infer<typeof loginSchema>;
export type CsvRow = z.infer<typeof csvRowSchema>;
export type Theme = z.infer<typeof themeSchema>;
export type PerformanceReport = z.infer<typeof performanceReportSchema>;
