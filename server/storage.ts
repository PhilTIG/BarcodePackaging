import { 
  users, 
  jobs, 
  boxRequirements,
  scanSessions, 
  scanEvents, 
  jobAssignments,
  userPreferences,
  roleDefaults,
  jobTypes,
  workerBoxAssignments,
  // PHASE 4: sessionSnapshots removed
  jobArchives,
  archiveWorkerStats,
  // NEW CheckCount tables
  checkSessions,
  checkEvents,
  checkResults,
  // NEW Put Aside Items table
  putAsideItems,
  type User, 
  type InsertUser,
  type Job,
  type InsertJob,

  type BoxRequirement,
  type InsertBoxRequirement,
  type ScanSession,
  type InsertScanSession,
  type ScanEvent,
  type InsertScanEvent,
  type JobAssignment,
  type InsertJobAssignment,
  type UserPreferences,
  type InsertUserPreferences,
  type RoleDefaults,
  type InsertRoleDefaults,
  type JobType,
  type InsertJobType,
  type WorkerBoxAssignment,
  type InsertWorkerBoxAssignment,
  // Archive types
  type JobArchive,
  type InsertJobArchive,
  type ArchiveWorkerStats,
  type InsertArchiveWorkerStats,
  // NEW CheckCount types
  type CheckSession,
  type InsertCheckSession,
  type CheckEvent,
  type InsertCheckEvent,
  type CheckResult,
  type InsertCheckResult,
  // NEW Put Aside Item types
  type PutAsideItem,
  type InsertPutAsideItem
} from "@shared/schema";
import { db } from "./db";
import { eq, and, or, ne, desc, sql, inArray, isNull } from "drizzle-orm";

/**
 * Utility function to normalize barcodes by converting scientific notation to full numeric strings
 * Handles cases where CSV imports contain barcodes in scientific notation format (e.g., "9.32579E+12")
 */
function normalizeBarcodeFormat(barCode: string): string {
  // Check if the barcode is in scientific notation format
  if (/^\d+\.\d+[eE][+-]?\d+$/.test(barCode)) {
    try {
      // Convert scientific notation to full numeric string
      const numericValue = parseFloat(barCode);
      // Convert back to string without scientific notation
      return numericValue.toString();
    } catch (error) {
      console.warn(`Failed to normalize barcode: ${barCode}`, error);
      return barCode; // Return original if conversion fails
    }
  }
  return barCode; // Return as-is if not scientific notation
}

export interface IStorage {
  // User methods
  getUserById(id: string): Promise<User | undefined>;
  getUserByStaffId(staffId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;
  getAllUsersWithPreferences(): Promise<(User & { preferences?: any })[]>;

  // Job methods
  createJob(job: InsertJob): Promise<Job>;
  getJobById(id: string): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  getActiveJobs(): Promise<Job[]>;
  getVisibleJobsForWorkers(): Promise<Job[]>;
  getVisibleJobsForSupervisors(): Promise<Job[]>;
  updateJobStatus(id: string, status: string): Promise<Job | undefined>;
  updateJobActiveStatus(id: string, isActive: boolean): Promise<Job | undefined>;
  getJobProgress(id: string): Promise<any>;
  getJobs(): Promise<{ jobs: any[] }>;
  jobHasScanEvents(jobId: string): Promise<boolean>;
  deleteJob(jobId: string): Promise<boolean>;
  updateJobStatusBasedOnProgress(jobId: string): Promise<void>;

  // Products methods removed - functionality moved to box_requirements system

  // Box requirement methods - NEW SCANNING LOGIC
  createBoxRequirements(requirements: InsertBoxRequirement[]): Promise<BoxRequirement[]>;
  getBoxRequirementsByJobId(jobId: string): Promise<BoxRequirement[]>;
  getBoxRequirementsByBoxNumber(jobId: string, boxNumber: number): Promise<BoxRequirement[]>;
  findNextTargetBox(barCode: string, jobId: string, workerId: string): Promise<number | null>;
  updateBoxRequirementScannedQty(boxNumber: number, barCode: string, jobId: string, workerId: string, workerColor: string): Promise<BoxRequirement | undefined>;
  // Migration method removed - not needed after full migration completed

  // Scan session methods
  createScanSession(session: InsertScanSession): Promise<ScanSession>;
  getScanSessionById(id: string): Promise<ScanSession | undefined>;
  getActiveScanSession(userId: string): Promise<ScanSession | undefined>;
  createOrGetActiveScanSession(userId: string, jobId: string): Promise<ScanSession>;
  getScanSessionsByJobId(jobId: string): Promise<ScanSession[]>;
  updateScanSessionStatus(id: string, status: string): Promise<ScanSession | undefined>;
  updateScanSessionStats(sessionId: string): Promise<void>;

  // Scan event methods  
  createScanEvent(event: InsertScanEvent): Promise<ScanEvent>;
  getScanEventsBySessionId(sessionId: string): Promise<ScanEvent[]>;
  undoScanEvents(sessionId: string, count: number): Promise<ScanEvent[]>;
  getSessionPerformance(sessionId: string): Promise<any>;

  // Job assignment methods
  createJobAssignment(assignment: InsertJobAssignment): Promise<JobAssignment>;
  getJobAssignments(jobId: string): Promise<JobAssignment[]>;
  getJobAssignmentsWithUsers(jobId: string): Promise<(JobAssignment & { assignee: User })[]>;
  getJobAssignmentsByUser(userId: string): Promise<JobAssignment[]>;
  unassignWorkerFromJob(jobId: string, userId: string): Promise<boolean>;
  checkExistingAssignment(jobId: string, userId: string): Promise<JobAssignment | undefined>;

  // User preferences methods
  getUserPreferences(userId: string): Promise<UserPreferences | undefined>;
  updateUserPreferences(userId: string, preferences: Partial<UserPreferences>): Promise<UserPreferences | undefined>;
  createUserPreferences(insertPrefs: InsertUserPreferences): Promise<UserPreferences>;

  // Job types methods
  createJobType(jobType: InsertJobType): Promise<JobType>;
  getJobTypes(): Promise<JobType[]>;
  getJobTypeById(id: string): Promise<JobType | undefined>;
  updateJobType(id: string, updates: Partial<InsertJobType>): Promise<JobType | undefined>;
  deleteJobType(id: string): Promise<boolean>;

  // Worker box assignment methods
  createWorkerBoxAssignment(assignment: InsertWorkerBoxAssignment): Promise<WorkerBoxAssignment>;
  getWorkerBoxAssignments(jobId: string): Promise<WorkerBoxAssignment[]>;
  getWorkerBoxAssignmentsByWorker(workerId: string, jobId: string): Promise<WorkerBoxAssignment[]>;
  deleteWorkerBoxAssignments(jobId: string, workerId: string): Promise<boolean>;

  // PHASE 4: Session snapshot methods removed (unused dead code)

  // Job archive methods
  createJobArchive(archive: InsertJobArchive): Promise<JobArchive>;
  getJobArchives(): Promise<JobArchive[]>;
  getJobArchiveById(id: string): Promise<JobArchive | undefined>;
  deleteJobArchive(id: string): Promise<boolean>;

  // Archive worker stats methods
  createArchiveWorkerStats(stats: InsertArchiveWorkerStats[]): Promise<ArchiveWorkerStats[]>;
  getArchiveWorkerStatsByArchiveId(archiveId: string): Promise<ArchiveWorkerStats[]>;

  // Advanced archiving methods
  archiveJob(jobId: string, archivedBy: string): Promise<JobArchive>;
  unarchiveJob(archiveId: string): Promise<boolean>;
  purgeJobData(archiveId: string): Promise<boolean>;

  // NEW CheckCount methods
  // Check session methods
  createCheckSession(session: InsertCheckSession): Promise<CheckSession>;
  getCheckSessionById(id: string): Promise<CheckSession | undefined>;
  getCheckSessionsByJobId(jobId: string): Promise<CheckSession[]>;
  getCheckSessionsByBoxNumber(jobId: string, boxNumber: number): Promise<CheckSession[]>;
  updateCheckSessionStatus(id: string, status: string): Promise<CheckSession | undefined>;
  completeCheckSession(id: string, endTime: Date, discrepanciesFound: number, correctionsApplied?: boolean): Promise<CheckSession | undefined>;

  // Check event methods
  createCheckEvent(event: InsertCheckEvent): Promise<CheckEvent>;
  getCheckEventsBySessionId(sessionId: string): Promise<CheckEvent[]>;

  // Check result methods
  createCheckResult(resultData: InsertCheckResult): Promise<CheckResult>;
  getCheckResultsBySessionId(sessionId: string): Promise<CheckResult[]>;
  updateCheckResult(id: string, updates: Partial<InsertCheckResult>): Promise<CheckResult | undefined>;

  // Check correction methods
  applyCheckCorrections(jobId: string, boxNumber: number, corrections: any[], sessionUserId: string, resolvedBy: string): Promise<void>;
  createRejectedCheckResults(checkSessionId: string, corrections: any[], resolvedBy: string): Promise<void>;
  createExtraItemsFromCheck(jobId: string, extraItems: any[], sessionUserId: string): Promise<void>;

  // QA reporting methods
  getJobQAReport(jobId: string): Promise<any>;
  getDiscrepancyReport(jobId: string): Promise<any>;

  // NEW Put Aside Item methods
  createPutAsideItem(itemData: InsertPutAsideItem): Promise<PutAsideItem>;
  getPutAsideItems(jobId: string): Promise<PutAsideItem[]>;
  resolvePutAsideItem(itemId: string, boxNumber: number): Promise<boolean>;
  updatePutAsideAvailability(jobId: string): Promise<void>;
  findAvailableBoxForCustomer(jobId: string, customerName: string): Promise<{ boxNumber: number } | null>;
}

export class DatabaseStorage implements IStorage {
  constructor(private db: any) {} // Inject db instance

  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByStaffId(staffId: string): Promise<User | undefined> {
    const [user] = await this.db.select().from(users).where(eq(users.staffId, staffId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await this.db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await this.db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [user] = await this.db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, id))
      .returning();
    return !!user;
  }

  async getAllUsers(): Promise<User[]> {
    return await this.db.select().from(users).where(eq(users.isActive, true));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await this.db.select().from(users).where(and(eq(users.role, role), eq(users.isActive, true)));
  }

  // Fetch users with their preferences included (for management interface)
  async getAllUsersWithPreferences(): Promise<(User & { preferences?: any })[]> {
    const allUsers = await this.db.select().from(users).where(eq(users.isActive, true));
    const usersWithPreferences = [];

    for (const user of allUsers) {
      const preferences = await this.getUserPreferences(user.id);
      usersWithPreferences.push({ ...user, preferences });
    }

    return usersWithPreferences;
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await this.db
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [job] = await this.db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async getAllJobs(): Promise<Job[]> {
    return await this.db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async getActiveJobs(): Promise<Job[]> {
    return await this.db
      .select()
      .from(jobs)
      .where(eq(jobs.isArchived, false))
      .orderBy(desc(jobs.createdAt));
  }

  // Get jobs visible to workers (exclude locked jobs)
  async getVisibleJobsForWorkers(): Promise<Job[]> {
    return await this.db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.isArchived, false),
        or(
          ne(jobs.status, 'completed'), // Not completed jobs are always visible
          eq(jobs.isActive, true) // Completed but unlocked jobs are visible
        )
      ))
      .orderBy(desc(jobs.createdAt));
  }

  // Get jobs visible to supervisors (exclude locked jobs)  
  async getVisibleJobsForSupervisors(): Promise<Job[]> {
    return await this.db
      .select()
      .from(jobs)
      .where(and(
        eq(jobs.isArchived, false),
        or(
          ne(jobs.status, 'completed'), // Not completed jobs are always visible
          eq(jobs.isActive, true) // Completed but unlocked jobs are visible
        )
      ))
      .orderBy(desc(jobs.createdAt));
  }

  async updateJobStatus(id: string, status: string): Promise<Job | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const [job] = await this.db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
    return job || undefined;
  }

  async updateJobActiveStatus(jobId: string, isActive: boolean): Promise<Job | undefined> {
    try {
      const [job] = await this.db
        .update(jobs)
        .set({ 
          isActive,
          updatedAt: new Date()
        })
        .where(eq(jobs.id, jobId))
        .returning();

      return job || undefined;
    } catch (error) {
      console.error('Error updating job active status:', error);
      throw error;
    }
  }

  async updateJobStatusBasedOnProgress(jobId: string): Promise<void> {
    try {
      // Get current job
      const job = await this.getJobById(jobId);
      if (!job) return;

      // Check if using new box requirements system or legacy products
      const boxRequirements = await this.getBoxRequirementsByJobId(jobId);
      let totalItems = 0;
      let completedItems = 0;

      if (boxRequirements.length > 0) {
        // NEW SYSTEM: Use box requirements
        totalItems = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
        completedItems = boxRequirements.reduce((sum, req) => sum + Math.min(req.scannedQty || 0, req.requiredQty), 0);
      } else {
        // All jobs should have box requirements
        console.warn(`No box requirements found for job ${jobId} - this should not happen`);
        totalItems = 0;
        completedItems = 0;
      }

      let newStatus = job.status;

      // Determine new status based on progress
      if (completedItems === 0 && job.status === 'pending') {
        // Stay pending if no scans yet
        newStatus = 'pending';
      } else if (completedItems > 0 && completedItems < totalItems) {
        // Job is active if scanning has started but not complete
        newStatus = 'active';
      } else if (completedItems >= totalItems) {
        // Job is completed if all items scanned
        newStatus = 'completed';
      }

      // Update status if it has changed
      if (newStatus !== job.status) {
        await this.db
          .update(jobs)
          .set({ 
            status: newStatus,
            completedAt: newStatus === 'completed' ? new Date() : null
          })
          .where(eq(jobs.id, jobId));

        console.log(`Job ${jobId} status updated from ${job.status} to ${newStatus}`);
      }

      // Also update completedItems count
      await this.db
        .update(jobs)
        .set({ completedItems })
        .where(eq(jobs.id, jobId));

    } catch (error) {
      console.error('Error updating job status based on progress:', error);
    }
  }

  async jobHasScanEvents(jobId: string): Promise<boolean> {
    try {
      const scanEventsCount = await this.db
        .select({ count: sql<number>`count(*)` })
        .from(scanEvents)
        .innerJoin(scanSessions, eq(scanEvents.sessionId, scanSessions.id))
        .where(eq(scanSessions.jobId, jobId));

      return scanEventsCount[0]?.count > 0;
    } catch (error) {
      console.error('Error checking job scan events:', error);
      throw error;
    }
  }

  async deleteJob(jobId: string): Promise<boolean> {
    try {
      await this.db.transaction(async (tx: any) => {
        // Delete scan events first (via scan sessions)
        const jobScanSessions = await tx
          .select({ id: scanSessions.id })
          .from(scanSessions)
          .where(eq(scanSessions.jobId, jobId));

        for (const session of jobScanSessions) {
          await tx
            .delete(scanEvents)
            .where(eq(scanEvents.sessionId, session.id));
        }

        // Delete CheckCount data (must be done before check sessions)
        const jobCheckSessions = await tx
          .select({ id: checkSessions.id })
          .from(checkSessions)
          .where(eq(checkSessions.jobId, jobId));

        for (const checkSession of jobCheckSessions) {
          // Delete check results first (references check sessions)
          await tx
            .delete(checkResults)
            .where(eq(checkResults.checkSessionId, checkSession.id));

          // Delete check events (references check sessions)
          await tx
            .delete(checkEvents)
            .where(eq(checkEvents.checkSessionId, checkSession.id));
        }

        // Delete check sessions
        await tx
          .delete(checkSessions)
          .where(eq(checkSessions.jobId, jobId));

        // Delete scan sessions
        await tx
          .delete(scanSessions)
          .where(eq(scanSessions.jobId, jobId));

        // Delete job assignments
        await tx
          .delete(jobAssignments)
          .where(eq(jobAssignments.jobId, jobId));

        // Delete worker box assignments
        await tx
          .delete(workerBoxAssignments)
          .where(eq(workerBoxAssignments.jobId, jobId));

        // Delete box requirements (modern scanning system)
        await tx
          .delete(boxRequirements)
          .where(eq(boxRequirements.jobId, jobId));

        // Products table removed - deletion not needed

        // Finally delete the job
        await tx
          .delete(jobs)
          .where(eq(jobs.id, jobId));
      });

      return true;
    } catch (error) {
      console.error('Error deleting job:', error);
      throw error;
    }
  }

  async getJobProgress(id: string): Promise<any> {
    try {
      // Get job with products
      const job = await this.getJobById(id);

      // OPTIMIZED: Use direct database aggregation instead of loading all records
      const [progressStats] = await this.db
        .select({
          totalItems: sql<number>`COALESCE(SUM(${boxRequirements.requiredQty}), 0)`,
          scannedItems: sql<number>`COALESCE(SUM(LEAST(${boxRequirements.scannedQty}, ${boxRequirements.requiredQty})), 0)`,
          totalBoxes: sql<number>`COUNT(DISTINCT ${boxRequirements.boxNumber})`,
          completedBoxes: sql<number>`COUNT(DISTINCT CASE WHEN ${boxRequirements.isComplete} = true THEN ${boxRequirements.boxNumber} END)`
        })
        .from(boxRequirements)
        .where(eq(boxRequirements.jobId, id));

      const totalItems = progressStats.totalItems || 0;
      const scannedItems = progressStats.scannedItems || 0;

      // Get box data efficiently with aggregation query
      const boxData = await this.db
        .select({
          customerName: boxRequirements.customerName,
          boxNumber: boxRequirements.boxNumber,
          qty: sql<number>`SUM(${boxRequirements.requiredQty})`,
          scannedQty: sql<number>`SUM(LEAST(${boxRequirements.scannedQty}, ${boxRequirements.requiredQty}))`,
          isComplete: sql<boolean>`BOOL_AND(${boxRequirements.isComplete})`,
          lastWorkerColor: sql<string>`MAX(${boxRequirements.lastWorkerColor})`
        })
        .from(boxRequirements)
        .where(eq(boxRequirements.jobId, id))
        .groupBy(boxRequirements.customerName, boxRequirements.boxNumber);

      const jobProducts = boxData;

      const sessions = await this.getScanSessionsByJobId(id);
      const assignments = await this.getJobAssignmentsWithUsers(id);

      // Get extra items count and details (items scanned that are not in the original job)
      const extraItemsCount = await this.getExtraItemsCount(id);
      const extraItemsDetails = await this.getExtraItemsDetails(id);

      if (!job) return null;

      // Use pre-calculated box completion from aggregation
      const boxCompletion = {
        totalBoxes: progressStats.totalBoxes || 0,
        completedBoxes: progressStats.completedBoxes || 0,
        boxCompletionPercentage: (progressStats.totalBoxes || 0) > 0 ? 
          Math.round(((progressStats.completedBoxes || 0) / (progressStats.totalBoxes || 0)) * 100) : 0
      };

      // Get worker performance data for all assigned workers
      const workersData = await Promise.all(
        assignments.map(async (assignment) => {
          const session = sessions.find(s => s.userId === assignment.userId);
          const events = session ? await this.getScanEventsBySessionId(session.id) : [];
          const performance = session ? await this.getSessionPerformance(session.id) : null;

          return {
            id: assignment.userId,
            name: assignment.assignee.name,
            staffId: assignment.assignee.staffId,
            isActive: session?.status === 'active' || false,
            scansPerHour: performance?.scansPerHour || 0,
            score: performance?.score || 0,
            totalScans: session?.totalScans || 0,
            currentBox: this.getCurrentBox(jobProducts, assignment.userId),
            currentCustomer: this.getCurrentCustomer(jobProducts, assignment.userId),
            lastScan: events.length > 0 ? events[events.length - 1].scanTime : null,
            assignedColor: assignment.assignedColor,
          };
        })
      );

      return {
        progress: {
          totalItems,
          scannedItems,
          completionPercentage: totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0,
          totalBoxes: boxCompletion.totalBoxes,
          completedBoxes: boxCompletion.completedBoxes,
          boxCompletionPercentage: boxCompletion.boxCompletionPercentage,
          activeSessions: sessions.filter(s => s.status === 'active').length,
          waitingSessions: sessions.filter(s => s.status === 'paused').length,
          totalAssignedWorkers: assignments.length,
          extraItemsCount, // NEW: Extra items count for modal display
          extraItemsDetails, // NEW: Extra items details for modal display
          workers: workersData,
        },
        products: jobProducts, // ADD: Products array for completed boxes modal
      };
    } catch (error) {
      console.error(`[ERROR] getJobProgress failed for job ${id}:`, error);
      throw error;
    }
  }

  async getJobs(): Promise<{ jobs: any[] }> {
    try {
      const allJobs = await this.getAllJobs();

      const jobsWithStats = await Promise.all(allJobs.map(async (job: any) => {
        try {
          // Check if using new box requirements system or legacy products
          const boxRequirements = await this.getBoxRequirementsByJobId(job.id);
          const assignments = await this.getJobAssignmentsWithUsers(job.id);

          let totalProducts = 0;
          let completedItems = 0;
          let products: any[] = [];
          let totalItems = 0;

          if (boxRequirements.length > 0) {
            // NEW SYSTEM: Use box requirements
            totalItems = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
            completedItems = boxRequirements.reduce((sum, req) => sum + Math.min(req.scannedQty || 0, req.requiredQty), 0);

            // Transform to products format for box completion calculation
            const productMap = new Map();
            boxRequirements.forEach(req => {
              const key = `${req.customerName}-${req.boxNumber}`;
              if (!productMap.has(key)) {
                productMap.set(key, {
                  customerName: req.customerName,
                  qty: 0,
                  scannedQty: 0,
                  boxNumber: req.boxNumber,
                  isComplete: true
                });
              }
              const product = productMap.get(key);
              product.qty += req.requiredQty;
              product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
              product.isComplete = product.isComplete && req.isComplete;
            });
            products = Array.from(productMap.values());
            totalProducts = totalItems; // Use total items, not product count
          } else {
            // All jobs should have box requirements - this case should not happen
            console.warn(`No box requirements found for job ${job.id}`);
            products = [];
            totalProducts = 0;
            completedItems = 0;
          }

          // Calculate box completion using the same logic as getJobProgress
          const boxCompletion = this.calculateBoxCompletion(products);

          return {
            ...job,
            totalProducts,
            completedItems,
            totalCustomers: new Set(products.map((p: any) => p.customerName)).size,
            completedBoxes: boxCompletion.completedBoxes,
            assignments: assignments.map((a: any) => ({
              id: a.id,
              assignedColor: a.assignedColor,
              assignee: {
                id: a.assignee.id,
                name: a.assignee.name,
                staffId: a.assignee.staffId,
              }
            }))
          };
        } catch (error) {
          console.error(`Error processing job ${job.id}:`, error);
          return {
            ...job,
            totalProducts: 0,
            completedItems: 0,
            totalCustomers: 0,
            completedBoxes: 0,
            assignments: []
          };
        }
      }));

      return { jobs: jobsWithStats };
    } catch (error) {
      console.error('[ERROR] getJobs failed:', error);
      throw error;
    }
  }

  private getCurrentBox(products: any[], userId: string): number | null {
    // Find the box number for products currently being scanned by this user
    // This would need more sophisticated logic based on session data
    const activeProducts = products.filter(p => (p.scannedQty || 0) > 0 && (p.scannedQty || 0) < p.qty);
    return activeProducts.length > 0 ? activeProducts[0].boxNumber : null;
  }

  private getCurrentCustomer(products: any[], userId: string): string | null {
    // Find the customer for products currently being scanned by this user
    const activeProducts = products.filter(p => (p.scannedQty || 0) > 0 && (p.scannedQty || 0) < p.qty);
    return activeProducts.length > 0 ? activeProducts[0].customerName : null;
  }

  /**
   * Helper method to calculate box completion status for a set of products
   * Box Complete = 100% fulfillment: all items allocated to each box (CustomName) must be scanned
   */
  private calculateBoxCompletion(products: any[]): {
    totalBoxes: number;
    completedBoxes: number;
    boxCompletionPercentage: number;
    boxDetails: Map<string, { totalQty: number; scannedQty: number; isComplete: boolean }>;
  } {
    const boxProgress = new Map<string, { totalQty: number; scannedQty: number; isComplete: boolean }>();

    products.forEach(product => {
      const customerName = product.customerName;
      if (!boxProgress.has(customerName)) {
        boxProgress.set(customerName, { totalQty: 0, scannedQty: 0, isComplete: false });
      }

      const box = boxProgress.get(customerName)!;
      box.totalQty += product.qty;
      box.scannedQty += product.scannedQty || 0;

      // Box Complete = 100% fulfillment: scannedQty exactly equals totalQty
      box.isComplete = box.totalQty > 0 && box.scannedQty === box.totalQty;
    });

    const completedBoxes = Array.from(boxProgress.values()).filter(box => box.isComplete).length;
    const totalBoxes = boxProgress.size;

    return {
      totalBoxes,
      completedBoxes,
      boxCompletionPercentage: totalBoxes > 0 ? Math.round((completedBoxes / totalBoxes) * 100) : 0,
      boxDetails: boxProgress
    };
  }

  // Products table methods removed - all functionality moved to box_requirements system

  private async updateJobCompletedItems(jobId: string): Promise<void> {
    // Use box requirements system (all jobs should have box requirements)
    const boxRequirements = await this.getBoxRequirementsByJobId(jobId);
    const completedItems = boxRequirements.reduce((sum, req) => sum + (req.scannedQty || 0), 0);

    await this.db
      .update(jobs)
      .set({ completedItems })
      .where(eq(jobs.id, jobId));
  }

  async createScanSession(insertSession: InsertScanSession): Promise<ScanSession> {
    const [session] = await this.db
      .insert(scanSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getScanSessionById(id: string): Promise<ScanSession | undefined> {
    const [session] = await this.db.select().from(scanSessions).where(eq(scanSessions.id, id));
    return session || undefined;
  }

  async getActiveScanSession(userId: string): Promise<ScanSession | undefined> {
    const [session] = await this.db
      .select()
      .from(scanSessions)
      .where(and(eq(scanSessions.userId, userId), eq(scanSessions.status, 'active')))
      .orderBy(desc(scanSessions.startTime));
    return session || undefined;
  }

  async createOrGetActiveScanSession(userId: string, jobId: string): Promise<ScanSession> {
    // First check if there's already an active session for this user and job
    const existingSession = await this.getActiveScanSession(userId);

    if (existingSession && existingSession.jobId === jobId) {
      return existingSession;
    }

    // Check if the job is active for scanning
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error('Job not found');
    }

    if (!job.isActive) {
      throw new Error('Scanning is currently paused for this job. Please contact your manager.');
    }

    // Close any existing active sessions for this user
    if (existingSession) {
      await this.updateScanSessionStatus(existingSession.id, 'completed');
    }

    // Create new session
    return await this.createScanSession({
      userId,
      jobId,
      sessionData: {}
    });
  }

  async getScanSessionsByJobId(jobId: string): Promise<ScanSession[]> {
    return await this.db.select().from(scanSessions).where(eq(scanSessions.jobId, jobId));
  }

  async updateScanSessionStatus(id: string, status: string): Promise<ScanSession | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.endTime = new Date();
    }
    updateData.lastActivityTime = new Date();

    const [session] = await this.db
      .update(scanSessions)
      .set(updateData)
      .where(eq(scanSessions.id, id))
      .returning();
    return session || undefined;
  }



  async updateScanSessionStats(sessionId: string): Promise<void> {
    const events = await this.getScanEventsBySessionId(sessionId);

    const totalScans = events.length;
    const successfulScans = events.filter(e => e.eventType === 'scan').length;
    const errorScans = events.filter(e => e.eventType === 'error').length;
    const undoOperations = events.filter(e => e.eventType === 'undo').length;
    // Note: Extra items (eventType === 'extra_item') are tracked separately and don't count in worker statistics

    await this.db
      .update(scanSessions)
      .set({
        totalScans,
        successfulScans,
        errorScans,
        undoOperations,
        lastActivityTime: new Date(),
      })
      .where(eq(scanSessions.id, sessionId));
  }

  async createScanEvent(insertEvent: InsertScanEvent): Promise<ScanEvent> {
    try {
      // Calculate time since previous scan
      const previousEvents = await this.db
        .select()
        .from(scanEvents)
        .where(eq(scanEvents.sessionId, insertEvent.sessionId))
        .orderBy(desc(scanEvents.scanTime))
        .limit(1);

      let timeSincePrevious = null;
      if (previousEvents.length > 0 && previousEvents[0].scanTime) {
        timeSincePrevious = Date.now() - new Date(previousEvents[0].scanTime).getTime();
      }

      // Get session to determine worker and job
      const session = await this.getScanSessionById(insertEvent.sessionId);
      if (!session) {
        throw new Error('Session not found');
      }

      // Check if job has box requirements (new system) or fall back to products (old system)
      const hasBoxRequirements = await this.db
        .select()
        .from(boxRequirements)
        .where(eq(boxRequirements.jobId, session.jobId))
        .limit(1);

      let productName = null;
      let customerName = null;
      let targetBox = null;

      // Get worker's assigned color from job assignments
      const workerAssignment = await this.checkExistingAssignment(session.jobId, session.userId);
      let workerColor = workerAssignment?.assignedColor || insertEvent.workerColor || 'blue'; // Use assigned color, fallback to provided or default

      if (hasBoxRequirements.length > 0) {
        // NEW SYSTEM: Use box requirements logic
        console.log('Using new box requirements system for scanning');
        const workerId = session.userId;
        targetBox = await this.findNextTargetBox(insertEvent.barCode, session.jobId, workerId);

        if (targetBox) {
          // Get box requirement info for the target box
          const boxReq = await this.db
            .select()
            .from(boxRequirements)
            .where(and(
              eq(boxRequirements.jobId, session.jobId),
              eq(boxRequirements.barCode, insertEvent.barCode),
              eq(boxRequirements.boxNumber, targetBox)
            ))
            .limit(1);

          if (boxReq.length > 0) {
            productName = boxReq[0].productName;
            customerName = boxReq[0].customerName;
          }
        } else if (insertEvent.eventType === 'scan') {
          // Check if this is a known product anywhere in the job (excess quantity)
          const existingProduct = await this.db
            .select()
            .from(boxRequirements)
            .where(and(
              eq(boxRequirements.jobId, session.jobId),
              eq(boxRequirements.barCode, insertEvent.barCode)
            ))
            .limit(1);

          if (existingProduct.length > 0) {
            // This is a known product but all quantities fulfilled - mark as EXTRA ITEM (duplicate/consumed)
            console.log(`Duplicate/consumed barcode ${insertEvent.barCode} scanned - all quantities fulfilled - marking as extra item`);
            insertEvent.eventType = 'extra_item';
            productName = existingProduct[0].productName;
            customerName = existingProduct[0].customerName;
          } else {
            // Completely unknown barcode - mark as extra item with "Unknown" name
            console.log(`Unknown barcode ${insertEvent.barCode} scanned - marking as extra item`);
            insertEvent.eventType = 'extra_item';
            productName = 'Unknown';
            customerName = 'Unassigned';
          }
        }
      } else {
        // No box requirements found - this should not happen for modern jobs
        console.log(`No box requirements found for job ${session.jobId}, barcode ${insertEvent.barCode} - marking as error`);
        insertEvent.eventType = 'error';
      }

      const eventData = {
        ...insertEvent,
        productName,
        customerName,
        boxNumber: targetBox,
        calculatedTargetBox: targetBox,
        timeSincePrevious,
        workerColor,
        isExtraItem: insertEvent.eventType === 'extra_item',
        jobId: session.jobId, // Add direct job reference for extra items tracking
      };

      const [event] = await this.db
        .insert(scanEvents)
        .values(eventData)
        .returning();

      // Update quantities using box requirements system (all jobs should have box requirements)
      // Only update box requirements for normal scans, not extra items
      if (insertEvent.eventType === 'scan' && targetBox) {
        await this.updateBoxRequirementScannedQty(
          targetBox,
          insertEvent.barCode, 
          session.jobId, 
          session.userId,
          workerColor
        );
      }

      // Automatically update job status after a scan event
      await this.updateJobStatusBasedOnProgress(session.jobId);

      return event;
    } catch (error) {
      console.error('Error in createScanEvent:', error);
      throw error;
    }
  }

  private async getWorkerIdFromSession(sessionId: string): Promise<string | undefined> {
    const session = await this.getScanSessionById(sessionId);
    return session?.userId;
  }

  async getScanEventsBySessionId(sessionId: string): Promise<ScanEvent[]> {
    return await this.db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.sessionId, sessionId))
      .orderBy(desc(scanEvents.scanTime));
  }

  async undoScanEvents(sessionId: string, count: number): Promise<ScanEvent[]> {
    // Get the most recent undoable events (both scans and extra items) to undo
    const eventsToUndo = await this.db
      .select()
      .from(scanEvents)
      .where(and(
        eq(scanEvents.sessionId, sessionId), 
        or(eq(scanEvents.eventType, 'scan'), eq(scanEvents.eventType, 'extra_item'))
      ))
      .orderBy(desc(scanEvents.scanTime))
      .limit(count);

    if (eventsToUndo.length === 0) return [];

    // Mark these events as undone and create undo events  
    const undoEvents: InsertScanEvent[] = eventsToUndo.map((event: ScanEvent) => ({
      sessionId,
      barCode: event.barCode,
      productName: event.productName,
      customerName: event.customerName,
      boxNumber: event.boxNumber,
      eventType: 'undo',
    }));

    const createdUndoEvents = await this.db
      .insert(scanEvents)
      .values(undoEvents)
      .returning();

    // Decrease box requirement scanned quantities for successful scans only
    // Extra items don't affect box requirements, so skip them
    for (const event of eventsToUndo) {
      if (event.eventType === 'scan' && event.barCode && event.boxNumber) {
        // Find matching box requirements and decrement their scanned quantity
        const boxReqs = await this.db
          .select()
          .from(boxRequirements)
          .where(and(
            eq(boxRequirements.barCode, event.barCode),
            eq(boxRequirements.boxNumber, event.boxNumber)
          ));

        for (const boxReq of boxReqs) {
          if ((boxReq.scannedQty || 0) > 0) {
            const newScannedQty = (boxReq.scannedQty || 0) - 1;
            await this.db
              .update(boxRequirements)
              .set({ 
                scannedQty: newScannedQty,
                isComplete: newScannedQty >= boxReq.requiredQty
              })
              .where(eq(boxRequirements.id, boxReq.id));
          }
        }
      } else if (event.eventType === 'extra_item') {
        // For extra_item events, delete the original record from the database
        await this.db
          .delete(scanEvents)
          .where(eq(scanEvents.id, event.id));
      }
    }

    // Automatically update job status after an undo event
    const session = await this.getScanSessionById(sessionId);
    if (session) {
      await this.updateJobStatusBasedOnProgress(session.jobId);
    }

    return createdUndoEvents;
  }

  async getSessionPerformance(sessionId: string): Promise<any> {
    const session = await this.getScanSessionById(sessionId);
    if (!session) return null;

    const events = await this.getScanEventsBySessionId(sessionId);
    const scanEvents = events.filter(e => e.eventType === 'scan');
    const errorEvents = events.filter((e: ScanEvent) => e.eventType === 'error');
    const undoEvents = events.filter((e: ScanEvent) => e.eventType === 'undo');

    const sessionDuration = session.endTime 
      ? new Date(session.endTime).getTime() - new Date(session.startTime!).getTime()
      : Date.now() - new Date(session.startTime!).getTime();

    const sessionHours = sessionDuration / (1000 * 60 * 60);
    const scansPerHour = sessionHours > 0 ? Math.round(scanEvents.length / sessionHours) : 0;

    const accuracy = events.length > 0 
      ? Math.round((scanEvents.length / (scanEvents.length + errorEvents.length)) * 100)
      : 100;

    // Calculate score based on industry standards
    let score = 0;
    if (scansPerHour >= 360) score = 10;
    else if (scansPerHour >= 180) score = 8 + (scansPerHour - 180) / 180 * 2;
    else if (scansPerHour >= 71) score = 6 + (scansPerHour - 71) / 109 * 2;
    else if (scansPerHour >= 36) score = 4 + (scansPerHour - 36) / 35 * 2;
    else if (scansPerHour >= 18) score = 2 + (scansPerHour - 18) / 18 * 2;
    else score = 1;

    // Apply penalties
    score = Math.max(1, score - (errorEvents.length * 0.1) - (undoEvents.length * 0.05));
    score = Math.min(10, Math.round(score * 10) / 10);

    const averageTimePerScan = scanEvents.length > 0
      ? sessionDuration / scanEvents.length / 1000 // Convert to seconds
      : 0;

    return {
      sessionId,
      totalScans: scanEvents.length,
      scansPerHour,
      accuracy,
      score,
      sessionDuration: Math.round(sessionDuration / 1000), // Convert to seconds
      averageTimePerScan: Math.round(averageTimePerScan),
      errorCount: errorEvents.length,
      undoCount: undoEvents.length,
    };
  }

  async getJobWorkerPerformance(jobId: string, userId: string): Promise<any> {
    // Get all scan events for this worker on this job
    const allEvents = await this.db
      .select()
      .from(scanEvents)
      .innerJoin(scanSessions, eq(scanEvents.sessionId, scanSessions.id))
      .where(
        and(
          eq(scanSessions.jobId, jobId),
          eq(scanSessions.userId, userId)
        )
      )
      .orderBy(scanEvents.scanTime);

    if (allEvents.length === 0) {
      return {
        totalScans: 0,
        scansPerHour: 0,
        accuracy: 100,
        score: 0,
        activeScanningTime: 0,
        errorCount: 0,
        undoCount: 0
      };
    }

    const successfulScans = allEvents.filter((e: any) => e.scan_events.eventType === 'scan');
    const errorEvents = allEvents.filter((e: any) => e.scan_events.eventType === 'error');
    const undoEvents = allEvents.filter((e: any) => e.scan_events.eventType === 'undo');

    // Calculate active scanning time (excluding breaks > 30 seconds)
    let activeScanningTime = 0;
    let lastScanTime = new Date(allEvents[0].scan_events.scanTime).getTime();

    for (let i = 1; i < allEvents.length; i++) {
      const currentScanTime = new Date(allEvents[i].scan_events.scanTime).getTime();
      const timeDiff = currentScanTime - lastScanTime;

      // Only count time gaps <= 30 seconds as active scanning
      if (timeDiff <= 30000) {
        activeScanningTime += timeDiff;
      }
      lastScanTime = currentScanTime;
    }

    // Convert to hours for scans per hour calculation
    const activeScanningHours = activeScanningTime / (1000 * 60 * 60);
    const scansPerHour = activeScanningHours > 0 ? Math.round(successfulScans.length / activeScanningHours) : 0;

    // Calculate accuracy: successful scans / total scan attempts
    const totalAttempts = successfulScans.length + errorEvents.length;
    const accuracy = totalAttempts > 0 ? Math.round((successfulScans.length / totalAttempts) * 100) : 100;

    // Calculate score based on speed + accuracy
    let speedScore = 0;
    if (scansPerHour >= 360) speedScore = 10;
    else if (scansPerHour >= 180) speedScore = 8 + (scansPerHour - 180) / 180 * 2;
    else if (scansPerHour >= 71) speedScore = 6 + (scansPerHour - 71) / 109 * 2;
    else if (scansPerHour >= 36) speedScore = 4 + (scansPerHour - 36) / 35 * 2;
    else if (scansPerHour >= 18) speedScore = 2 + (scansPerHour - 18) / 18 * 2;
    else speedScore = 1;

    // Combine speed and accuracy for final score
    const accuracyMultiplier = accuracy / 100;
    let score = speedScore * accuracyMultiplier;

    // Apply penalties for undos
    score = Math.max(1, score - (undoEvents.length * 0.05));
    score = Math.min(10, Math.round(score * 10) / 10);

    return {
      totalScans: successfulScans.length,
      scansPerHour,
      accuracy,
      score,
      activeScanningTime: Math.round(activeScanningTime / 1000), // Convert to seconds
      errorCount: errorEvents.length,
      undoCount: undoEvents.length
    };
  }

  async createJobAssignment(insertAssignment: InsertJobAssignment): Promise<JobAssignment> {
    const [assignment] = await this.db
      .insert(jobAssignments)
      .values(insertAssignment)
      .returning();

    // PHASE 3 MODERNIZATION: No longer auto-create worker_box_assignments
    // worker_box_assignments are now created on-demand when workers start scanning
    console.log(`[createJobAssignment] Job assignment created for user ${insertAssignment.userId} with pattern ${insertAssignment.allocationPattern}`);

    return assignment;
  }

  async getJobAssignments(jobId: string): Promise<JobAssignment[]> {
    return await this.db
      .select()
      .from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.isActive, true)));
  }

  async getJobAssignmentsWithUsers(jobId: string): Promise<(JobAssignment & { assignee: User })[]> {
    return await this.db
      .select({
        id: jobAssignments.id,
        jobId: jobAssignments.jobId,
        userId: jobAssignments.userId,
        assignedBy: jobAssignments.assignedBy,
        assignedAt: jobAssignments.assignedAt,
        isActive: jobAssignments.isActive,
        assignedColor: jobAssignments.assignedColor,
        allocationPattern: jobAssignments.allocationPattern,
        workerIndex: jobAssignments.workerIndex,
        assignee: {
          id: users.id,
          staffId: users.staffId,
          pin: users.pin,
          role: users.role,
          name: users.name,
          isActive: users.isActive,
          createdAt: users.createdAt,
        }
      })
      .from(jobAssignments)
      .innerJoin(users, eq(jobAssignments.userId, users.id))
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.isActive, true)))
      .orderBy(jobAssignments.assignedAt); // Order by assignment time, not workerIndex
  }

  async getJobAssignmentsByUser(userId: string): Promise<JobAssignment[]> {
    try {
      return await this.db
        .select()
        .from(jobAssignments)
        .where(and(eq(jobAssignments.userId, userId), eq(jobAssignments.isActive, true)))
        .orderBy(desc(jobAssignments.assignedAt));
    } catch (error) {
      console.error('Error fetching job assignments by user:', error);
      throw error;
    }
  }

  async unassignWorkerFromJob(jobId: string, userId: string): Promise<boolean> {
    const result = await this.db
      .update(jobAssignments)
      .set({ isActive: false })
      .where(and(
        eq(jobAssignments.jobId, jobId), 
        eq(jobAssignments.userId, userId),
        eq(jobAssignments.isActive, true)
      ))
      .returning();

    // PHASE 3: Also clean up any remaining worker_box_assignments (optional cleanup)
    await this.deleteWorkerBoxAssignments(jobId, userId);

    return result.length > 0;
  }

  async checkExistingAssignment(jobId: string, userId: string): Promise<JobAssignment | undefined> {
    const [assignment] = await this.db
      .select()
      .from(jobAssignments)
      .where(and(
        eq(jobAssignments.jobId, jobId), 
        eq(jobAssignments.userId, userId),
        eq(jobAssignments.isActive, true)
      ));

    return assignment || undefined;
  }

  // User preferences methods
  async getUserPreferences(userId: string): Promise<UserPreferences | undefined> {
    const [result] = await this.db
      .select()
      .from(userPreferences)
      .where(eq(userPreferences.userId, userId));

    if (!result) {
      return undefined;
    }

    // Return structured preferences using the interface format
    return {
      maxBoxesPerRow: result.maxBoxesPerRow || 12,
      autoClearInput: result.autoClearInput || true,
      soundFeedback: result.soundFeedback || true,
      vibrationFeedback: result.vibrationFeedback || false,
      scannerType: (result.scannerType as "camera" | "hid") || "camera",
      targetScansPerHour: result.targetScansPerHour || 71,
      autoSaveSessions: result.autoSaveSessions || true,
      showRealtimeStats: result.showRealtimeStats || true,
      theme: (result.theme as "blue" | "green" | "orange" | "teal" | "red" | "dark") || "blue",
      compactMode: result.compactMode || false,
      showHelpTips: result.showHelpTips || true,
      enableAutoUndo: result.enableAutoUndo || false,
      undoTimeLimit: result.undoTimeLimit || 30,
      batchScanMode: result.batchScanMode || false,
      mobileModePreference: result.mobileModePreference || false,
      singleBoxMode: result.singleBoxMode || false,
      checkBoxEnabled: result.checkBoxEnabled || false,
    };
  }

  async createUserPreferences(insertPrefs: InsertUserPreferences): Promise<UserPreferences> {
    const [result] = await this.db
      .insert(userPreferences)
      .values(insertPrefs)
      .returning();

    // Return structured preferences using the interface format
    return {
      maxBoxesPerRow: result.maxBoxesPerRow || 12,
      autoClearInput: result.autoClearInput || true,
      soundFeedback: result.soundFeedback || true,
      vibrationFeedback: result.vibrationFeedback || false,
      scannerType: (result.scannerType as "camera" | "hid") || "camera",
      targetScansPerHour: result.targetScansPerHour || 71,
      autoSaveSessions: result.autoSaveSessions || true,
      showRealtimeStats: result.showRealtimeStats || true,
      theme: (result.theme as "blue" | "green" | "orange" | "teal" | "red" | "dark") || "blue",
      compactMode: result.compactMode || false,
      showHelpTips: result.showHelpTips || true,
      enableAutoUndo: result.enableAutoUndo || false,
      undoTimeLimit: result.undoTimeLimit || 30,
      batchScanMode: result.batchScanMode || false,
      mobileModePreference: result.mobileModePreference || false,
      singleBoxMode: result.singleBoxMode || false,
      checkBoxEnabled: result.checkBoxEnabled || false,
    };
  }

  async updateUserPreferences(userId: string, updates: Partial<UserPreferences>): Promise<UserPreferences | undefined> {
    console.log('[Storage] Updating user preferences for:', userId, 'with:', updates);

    const [result] = await this.db
      .update(userPreferences)
      .set({ 
        ...updates,
        updatedAt: sql`now()` 
      })
      .where(eq(userPreferences.userId, userId))
      .returning();

    if (!result) {
      return undefined;
    }

    // Return structured preferences using the interface format
    return {
      maxBoxesPerRow: result.maxBoxesPerRow || 12,
      autoClearInput: result.autoClearInput || true,
      soundFeedback: result.soundFeedback || true,
      vibrationFeedback: result.vibrationFeedback || false,
      scannerType: (result.scannerType as "camera" | "hid") || "camera",
      targetScansPerHour: result.targetScansPerHour || 71,
      autoSaveSessions: result.autoSaveSessions || true,
      showRealtimeStats: result.showRealtimeStats || true,
      theme: (result.theme as "blue" | "green" | "orange" | "teal" | "red" | "dark") || "blue",
      compactMode: result.compactMode || false,
      showHelpTips: result.showHelpTips || true,
      enableAutoUndo: result.enableAutoUndo || false,
      undoTimeLimit: result.undoTimeLimit || 30,
      batchScanMode: result.batchScanMode || false,
      mobileModePreference: result.mobileModePreference || false,
      singleBoxMode: result.singleBoxMode || false,
      checkBoxEnabled: result.checkBoxEnabled || false,
    };
  }

  async getRoleDefaults(role: string): Promise<any | undefined> {
    const [defaults] = await this.db
      .select()
      .from(roleDefaults)
      .where(eq(roleDefaults.role, role));

    return defaults ? defaults.defaultPreferences as any : undefined;
  }

  async createOrUpdateRoleDefaults(role: string, preferences: any, createdBy: string): Promise<RoleDefaults> {
    // Try to update existing first
    const [updated] = await this.db
      .update(roleDefaults)
      .set({ 
        defaultPreferences: preferences,
        updatedAt: sql`now()`
      })
      .where(eq(roleDefaults.role, role))
      .returning();

    if (updated) return updated;

    // Create new if doesn't exist
    const [created] = await this.db
      .insert(roleDefaults)
      .values({ role, defaultPreferences: preferences, createdBy })
      .returning();

    return created;
  }

  async getAllRoleDefaults(): Promise<RoleDefaults[]> {
    return await this.db
      .select()
      .from(roleDefaults);
  }

  // Job types methods
  async createJobType(jobType: InsertJobType): Promise<JobType> {
    const [result] = await this.db
      .insert(jobTypes)
      .values(jobType)
      .returning();
    return result;
  }

  async getJobTypes(): Promise<JobType[]> {
    return await this.db.select().from(jobTypes).orderBy(jobTypes.name);
  }

  async getJobTypeById(id: string): Promise<JobType | undefined> {
    const [result] = await this.db
      .select()
      .from(jobTypes)
      .where(eq(jobTypes.id, id));
    return result || undefined;
  }

  async updateJobType(id: string, updates: Partial<InsertJobType>): Promise<JobType | undefined> {
    const [result] = await this.db
      .update(jobTypes)
      .set(updates)
      .where(eq(jobTypes.id, id))
      .returning();
    return result || undefined;
  }

  async deleteJobType(id: string): Promise<boolean> {
    const result = await this.db
      .delete(jobTypes)
      .where(eq(jobTypes.id, id))
      .returning();
    return result.length > 0;
  }

  // Worker box assignment methods
  async createWorkerBoxAssignment(assignment: InsertWorkerBoxAssignment): Promise<WorkerBoxAssignment> {
    const [result] = await this.db
      .insert(workerBoxAssignments)
      .values(assignment)
      .returning();
    return result;
  }

  async getWorkerBoxAssignments(jobId: string): Promise<WorkerBoxAssignment[]> {
    return await this.db
      .select()
      .from(workerBoxAssignments)
      .where(eq(workerBoxAssignments.jobId, jobId))
      .orderBy(workerBoxAssignments.boxNumber);
  }

  async getWorkerBoxAssignmentsByWorker(workerId: string, jobId: string): Promise<WorkerBoxAssignment[]> {
    return await this.db
      .select()
      .from(workerBoxAssignments)
      .where(and(
        eq(workerBoxAssignments.workerId, workerId),
        eq(workerBoxAssignments.jobId, jobId)
      ))
      .orderBy(workerBoxAssignments.boxNumber);
  }

  async deleteWorkerBoxAssignments(jobId: string, workerId: string): Promise<boolean> {
    const result = await this.db
      .delete(workerBoxAssignments)
      .where(and(
        eq(workerBoxAssignments.jobId, jobId),
        eq(workerBoxAssignments.workerId, workerId)
      ))
      .returning();
    return result.length > 0;
  }

  // NEW BOX REQUIREMENT METHODS - CORRECT SCANNING LOGIC
  async createBoxRequirements(requirements: InsertBoxRequirement[]): Promise<BoxRequirement[]> {
    return await this.db
      .insert(boxRequirements)
      .values(requirements)
      .returning();
  }

  async getBoxRequirementsByJobId(jobId: string): Promise<BoxRequirement[]> {
    return await this.db
      .select()
      .from(boxRequirements)
      .where(eq(boxRequirements.jobId, jobId))
      .orderBy(boxRequirements.boxNumber, boxRequirements.barCode);
  }

  async getBoxRequirementsByBoxNumber(jobId: string, boxNumber: number): Promise<BoxRequirement[]> {
    return await this.db
      .select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        eq(boxRequirements.boxNumber, boxNumber)
      ))
      .orderBy(boxRequirements.barCode);
  }

  /**
   * Find the next target box for a scanned item based on worker allocation pattern
   * Logic: Find the appropriate box based on worker pattern and current progress
   */
  async findNextTargetBox(barCode: string, jobId: string, workerId: string): Promise<number | null> {
    // PHASE 3: Get worker assignment pattern from job_assignments (primary source)
    const jobAssignment = await this.db
      .select()
      .from(jobAssignments)
      .where(and(
        eq(jobAssignments.jobId, jobId),
        eq(jobAssignments.userId, workerId),
        eq(jobAssignments.isActive, true)
      ))
      .limit(1);

    if (jobAssignment.length === 0) {
      console.log(`No job assignment found for worker ${workerId}`);
      return null;
    }

    const workerPattern = jobAssignment[0].allocationPattern as 'ascending' | 'descending' | 'middle_up' | 'middle_down';

    // BARCODE FIX: Normalize barcode format for comparison
    const normalizedBarCode = normalizeBarcodeFormat(barCode);

    // Get all box requirements for this item that still need more items
    // Try both original and normalized barcode formats for maximum compatibility
    const availableBoxes = await this.db
      .select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        sql`(${boxRequirements.barCode} = ${barCode} OR ${boxRequirements.barCode} = ${normalizedBarCode})`,
        sql`${boxRequirements.scannedQty} < ${boxRequirements.requiredQty}`
      ))
      .orderBy(boxRequirements.boxNumber);

    if (availableBoxes.length === 0) {
      console.log(`No available boxes found for barcode ${barCode}`);
      return null;
    }

    const boxNumbers = availableBoxes.map((box: BoxRequirement) => box.boxNumber);
    console.log(`[Worker Pattern Debug] Worker ${workerId} (${workerPattern}) - Available boxes for barcode ${barCode}: [${boxNumbers.join(', ')}]`);

    // Apply worker allocation pattern to find next box
    let targetBox: number;

    switch (workerPattern) {
      case 'ascending':
        // Worker with ascending pattern: Always pick the lowest numbered available box
        targetBox = Math.min(...boxNumbers);
        break;

      case 'descending':
        // Worker with descending pattern: Always pick the highest numbered available box
        targetBox = Math.max(...boxNumbers);
        break;

      case 'middle_up':
        // Worker with middle_up pattern: Start from middle, work up
        const sortedAsc = [...boxNumbers].sort((a, b) => a - b);
        const middleUpIndex = Math.floor(sortedAsc.length / 2);
        targetBox = sortedAsc[middleUpIndex];
        break;

      case 'middle_down':
        // Worker with middle_down pattern: Start from middle, work down
        const sortedDesc = [...boxNumbers].sort((a, b) => b - a);
        const middleDownIndex = Math.floor(sortedDesc.length / 2);
        targetBox = sortedDesc[middleDownIndex];
        break;

      default:
        // Fallback to ascending
        targetBox = Math.min(...boxNumbers);
        break;
    }

    console.log(`[Worker Pattern Debug] Worker ${workerId} (${workerPattern}) selected box ${targetBox} from available boxes [${boxNumbers.join(', ')}]`);
    return targetBox;
  }

  /**
   * Update scanned quantity for a specific box requirement
   */
  async updateBoxRequirementScannedQty(
    boxNumber: number, 
    barCode: string, 
    jobId: string, 
    workerId: string, 
    workerColor: string
  ): Promise<BoxRequirement | undefined> {
    // BARCODE FIX: Normalize barcode format for comparison
    const normalizedBarCode = normalizeBarcodeFormat(barCode);

    // Find the specific box requirement with both original and normalized barcode formats
    const requirement = await this.db
      .select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        sql`(${boxRequirements.barCode} = ${barCode} OR ${boxRequirements.barCode} = ${normalizedBarCode})`,
        eq(boxRequirements.boxNumber, boxNumber)
      ))
      .limit(1);

    if (requirement.length === 0) {
      console.log(`No box requirement found for box ${boxNumber}, barcode ${barCode}`);
      return undefined;
    }

    const currentRequirement = requirement[0];

    // Check if box can accept more items
    if ((currentRequirement.scannedQty || 0) >= currentRequirement.requiredQty) {
      console.log(`Box ${boxNumber} is already full for barcode ${barCode}`);
      return undefined;
    }

    // Update scanned quantity
    const newScannedQty = (currentRequirement.scannedQty || 0) + 1;
    const isComplete = newScannedQty >= currentRequirement.requiredQty;

    const [updatedRequirement] = await this.db
      .update(boxRequirements)
      .set({
        scannedQty: newScannedQty,
        isComplete,
        lastWorkerUserId: workerId,
        lastWorkerColor: workerColor
      })
      .where(eq(boxRequirements.id, currentRequirement.id))
      .returning();

    console.log(`Updated box ${boxNumber} for barcode ${barCode}: ${newScannedQty}/${currentRequirement.requiredQty}`);
    return updatedRequirement;
  }

  // Migration method removed - all jobs now use box_requirements system

  // Extra Items tracking methods (NEW)
  async getExtraItemsCount(jobId: string): Promise<number> {
    const result = await this.db
      .select({ count: sql<number>`count(*)` })
      .from(scanEvents)
      .where(and(
        eq(scanEvents.jobId, jobId),
        eq(scanEvents.isExtraItem, true)
      ));
    return result[0]?.count || 0;
  }

  async getExtraItemsDetails(jobId: string): Promise<any[]> {
    const extraItems = await this.db
      .select({
        barCode: scanEvents.barCode,
        productName: scanEvents.productName,
        scanTime: scanEvents.scanTime,
        workerColor: scanEvents.workerColor,
        sessionId: scanEvents.sessionId,
      })
      .from(scanEvents)
      .where(and(
        eq(scanEvents.jobId, jobId),
        eq(scanEvents.isExtraItem, true)
      ))
      .orderBy(desc(scanEvents.scanTime));

    // Get worker info and group by barcode
    const itemsWithWorkers = await Promise.all(
      extraItems.map(async (item: any) => {
        const session = await this.getScanSessionById(item.sessionId);
        const worker = session ? await this.getUserById(session.userId) : null;
        return {
          ...item,
          workerName: worker?.name || 'Unknown',
          workerStaffId: worker?.staffId || 'Unknown',
        };
      })
    );

    // Group by barcode
    const groupedItems = itemsWithWorkers.reduce((acc: any[], item: any) => {
      const existing = acc.find((group: any) => group.barCode === item.barCode);
      if (existing) {
        existing.quantity += 1;
        existing.scans.push(item);
      } else {
        acc.push({
          barCode: item.barCode,
          productName: item.productName,
          quantity: 1,
          scans: [item],
        });
      }
      return acc;
    }, [] as any[]);

    return groupedItems;
  }

  // PHASE 4: Session snapshot methods removed (unused dead code)

  // Job archive methods - moved to end of class to avoid duplicates

  // Delete all job data while preserving users and their settings
  async deleteAllJobData(): Promise<{ deletedJobs: number; message: string }> {
    try {
      // Get count of jobs before deletion
      const jobCount = await this.db.select().from(jobs);

      // Delete in correct order due to foreign key constraints

      // 1. Delete CheckCount results first (references check sessions and box requirements)
      await this.db.delete(checkResults);

      // 2. Delete CheckCount events (references check sessions)
      await this.db.delete(checkEvents);

      // 3. Delete CheckCount sessions (references jobs)
      await this.db.delete(checkSessions);

      // 4. Delete scan events (references scan sessions)
      await this.db.delete(scanEvents);

      // 5. Delete scan sessions (references jobs and users)
      await this.db.delete(scanSessions);

      // 6. Delete worker box assignments (references jobs and users)
      await this.db.delete(workerBoxAssignments);

      // 7. Delete job assignments (references jobs and users)
      await this.db.delete(jobAssignments);

      // 8. Delete box requirements (modern scanning system, references jobs)
      await this.db.delete(boxRequirements);

      // Products table removed - deletion not needed

      // 10. Finally delete jobs (parent table)
      // NOTE: job_archives is preserved to maintain historical summaries
      await this.db.delete(jobs);

      return {
        deletedJobs: jobCount.length,
        message: `Successfully deleted ${jobCount.length} jobs and all associated data including CheckCount QA records. User accounts, job types, settings, and job archives preserved.`
      };
    } catch (error) {
      console.error('Error deleting all job data:', error);
      throw new Error('Failed to delete job data: ' + (error as Error).message);
    }
  }

  // NEW CheckCount Methods Implementation
  async createCheckSession(session: InsertCheckSession): Promise<CheckSession> {
    const [result] = await this.db
      .insert(checkSessions)
      .values(session)
      .returning();
    return result;
  }

  async getCheckSessionById(id: string): Promise<CheckSession | undefined> {
    const [session] = await this.db
      .select()
      .from(checkSessions)
      .where(eq(checkSessions.id, id));
    return session || undefined;
  }

  async getCheckSessionsByJobId(jobId: string): Promise<CheckSession[]> {
    return await this.db
      .select()
      .from(checkSessions)
      .where(eq(checkSessions.jobId, jobId))
      .orderBy(desc(checkSessions.startTime));
  }

  async getCheckSessionsByBoxNumber(jobId: string, boxNumber: number): Promise<CheckSession[]> {
    return await this.db
      .select()
      .from(checkSessions)
      .where(and(
        eq(checkSessions.jobId, jobId),
        eq(checkSessions.boxNumber, boxNumber)
      ))
      .orderBy(desc(checkSessions.startTime));
  }

  async updateCheckSessionStatus(id: string, status: string): Promise<CheckSession | undefined> {
    const [session] = await this.db
      .update(checkSessions)
      .set({ status })
      .where(eq(checkSessions.id, id))
      .returning();
    return session || undefined;
  }

  async completeCheckSession(id: string, endTime: Date, discrepanciesFound: number, correctionsApplied?: boolean): Promise<CheckSession | undefined> {
    const [session] = await this.db
      .update(checkSessions)
      .set({ 
        status: 'completed',
        endTime,
        discrepanciesFound,
        correctionsApplied: correctionsApplied || false,
        isComplete: true 
      })
      .where(eq(checkSessions.id, id))
      .returning();
    return session || undefined;
  }

  async createCheckEvent(event: InsertCheckEvent): Promise<CheckEvent> {
    const [result] = await this.db
      .insert(checkEvents)
      .values(event)
      .returning();
    return result;
  }

  async getCheckEventsBySessionId(sessionId: string): Promise<CheckEvent[]> {
    return await this.db
      .select()
      .from(checkEvents)
      .where(eq(checkEvents.checkSessionId, sessionId))
      .orderBy(checkEvents.scanTime);
  }

  async createCheckResult(resultData: InsertCheckResult): Promise<CheckResult> {
    const [result] = await this.db.insert(checkResults).values(resultData).returning();
    return result;
  }

  async getCheckResultsBySessionId(sessionId: string): Promise<CheckResult[]> {
    return await this.db.select().from(checkResults)
      .where(eq(checkResults.checkSessionId, sessionId))
      .orderBy(checkResults.createdAt);
  }

  async updateCheckResult(id: string, updates: Partial<InsertCheckResult>): Promise<CheckResult | undefined> {
    const [result] = await this.db
      .update(checkResults)
      .set(updates)
      .where(eq(checkResults.id, id))
      .returning();
    return result || undefined;
  }

  async getJobQAReport(jobId: string): Promise<any> {
    // Get job information first
    const job = await this.getJobById(jobId);
    if (!job) {
      throw new Error(`Job not found: ${jobId}`);
    }

    // Get all check sessions for this job with user info
    const sessions = await this.db
      .select({
        sessionId: checkSessions.id,
        boxNumber: checkSessions.boxNumber,
        status: checkSessions.status,
        startTime: checkSessions.startTime,
        endTime: checkSessions.endTime,
        totalItemsExpected: checkSessions.totalItemsExpected,
        totalItemsScanned: checkSessions.totalItemsScanned,
        discrepanciesFound: checkSessions.discrepanciesFound,
        isComplete: checkSessions.isComplete,
        userId: checkSessions.userId,
        userName: users.name,
        userStaffId: users.staffId,
      })
      .from(checkSessions)
      .leftJoin(users, eq(checkSessions.userId, users.id))
      .where(eq(checkSessions.jobId, jobId))
      .orderBy(desc(checkSessions.startTime));

    // Get total box count for the job
    const boxesQuery = await this.db
      .select({ boxNumber: boxRequirements.boxNumber })
      .from(boxRequirements)
      .where(eq(boxRequirements.jobId, jobId));

    const uniqueBoxes = new Set(boxesQuery.map((b: any) => b.boxNumber));
    const totalBoxes = uniqueBoxes.size;

    // Get verified boxes (boxes that have at least one completed CheckCount session)
    const verifiedBoxes = new Set(
      sessions
        .filter((s: any) => s.status === 'completed')
        .map((s: any) => s.boxNumber)
    ).size;

    // Calculate basic metrics
    const totalSessions = sessions.length;
    const completedSessions = sessions.filter((s: any) => s.status === 'completed').length;
    const totalDiscrepancies = sessions.reduce((sum: number, s: any) => sum + (s.discrepanciesFound || 0), 0);

    // Calculate verification rate (percentage of boxes verified)
    const verificationRate = totalBoxes > 0 ? (verifiedBoxes / totalBoxes) * 100 : 0;

    // Calculate accuracy score (percentage of sessions with zero discrepancies)
    const accuracySessions = sessions.filter((s: any) => s.discrepanciesFound === 0).length;
    const accuracyScore = totalSessions > 0 ? (accuracySessions / totalSessions) * 100 : 0;

    // Calculate discrepancy rate
    const discrepancyRate = totalSessions > 0 ? (totalDiscrepancies / totalSessions) * 100 : 0;

    // Get detailed discrepancy analysis
    const discrepancyReport = await this.getDiscrepancyReport(jobId);

    // Analyze common issues from discrepancy notes
    const commonIssues: Array<{ type: string; count: number; percentage: number }> = [];
    const issueTypes = new Map<string, number>();

    discrepancyReport.discrepancies.forEach((d: any) => {
      if (d.discrepancyNotes) {
        const notes = d.discrepancyNotes.toLowerCase();
        if (notes.includes('shortage') || notes.includes('missing')) {
          issueTypes.set('Item Shortage', (issueTypes.get('Item Shortage') || 0) + 1);
        } else if (notes.includes('excess') || notes.includes('extra')) {
          issueTypes.set('Excess Items', (issueTypes.get('Excess Items') || 0) + 1);
        } else if (notes.includes('wrong') || notes.includes('incorrect')) {
          issueTypes.set('Wrong Item', (issueTypes.get('Wrong Item') || 0) + 1);
        } else if (notes.includes('damage') || notes.includes('broken')) {
          issueTypes.set('Damaged Item', (issueTypes.get('Damaged Item') || 0) + 1);
        } else {
          issueTypes.set('Other', (issueTypes.get('Other') || 0) + 1);
        }
      }
    });

    issueTypes.forEach((count, type) => {
      commonIssues.push({
        type,
        count,
        percentage: totalDiscrepancies > 0 ? (count / totalDiscrepancies) * 100 : 0
      });
    });

    // Calculate worker performance
    const workerPerformance: Array<{
      userId: string;
      staffId: string;
      name: string;
      totalSessions: number;
      accuracySessions: number;
      accuracyRate: number;
      totalDiscrepancies: number;
      avgDiscrepanciesPerSession: number;
    }> = [];

    const workerMap = new Map<string, any>();
    sessions.forEach((session: any) => {
      if (!session.userId) return;

      if (!workerMap.has(session.userId)) {
        workerMap.set(session.userId, {
          userId: session.userId,
          staffId: session.userStaffId,
          name: session.userName,
          totalSessions: 0,
          accuracySessions: 0,
          totalDiscrepancies: 0
        });
      }

      const worker = workerMap.get(session.userId);
      worker.totalSessions++;
      worker.totalDiscrepancies += session.discrepanciesFound || 0;
      if ((session.discrepanciesFound || 0) === 0) {
        worker.accuracySessions++;
      }
    });

    workerMap.forEach((worker) => {
      workerPerformance.push({
        ...worker,
        accuracyRate: worker.totalSessions > 0 ? (worker.accuracySessions / worker.totalSessions) * 100 : 0,
        avgDiscrepanciesPerSession: worker.totalSessions > 0 ? worker.totalDiscrepancies / worker.totalSessions : 0
      });
    });

    // Sort workers by accuracy rate descending
    workerPerformance.sort((a, b) => b.accuracyRate - a.accuracyRate);

    // Calculate timeline data (daily aggregation)
    const timeline: Array<{
      date: string;
      sessionsCompleted: number;
      discrepanciesFound: number;
      accuracyRate: number;
    }> = [];

    const dailyMap = new Map<string, any>();
    sessions.forEach((session: any) => {
      if (session.status !== 'completed') return;

      const date = new Date(session.startTime).toISOString().split('T')[0];
      if (!dailyMap.has(date)) {
        dailyMap.set(date, {
          date,
          sessionsCompleted: 0,
          discrepanciesFound: 0,
          accurateSessions: 0
        });
      }

      const day = dailyMap.get(date);
      day.sessionsCompleted++;
      day.discrepanciesFound += session.discrepanciesFound || 0;
      if ((session.discrepanciesFound || 0) === 0) {
        day.accurateSessions++;
      }
    });

    dailyMap.forEach((day) => {
      timeline.push({
        ...day,
        accuracyRate: day.sessionsCompleted > 0 ? (day.accurateSessions / day.sessionsCompleted) * 100 : 0
      });
    });

    // Sort timeline by date ascending
    timeline.sort((a, b) => a.date.localeCompare(b.date));

    return {
      jobInfo: {
        id: job.id,
        name: job.name || `Job ${job.id}`,
        status: job.status,
        totalBoxes,
        verifiedBoxes
      },
      verificationRate,
      accuracyScore,
      discrepancyAnalysis: {
        totalDiscrepancies,
        discrepancyRate,
        commonIssues
      },
      workerPerformance,
      timeline
    };
  }

  async getDiscrepancyReport(jobId: string): Promise<any> {
    // Get all check results that show discrepancies
    const discrepancies = await this.db
      .select({
        sessionId: checkResults.checkSessionId,
        boxNumber: checkSessions.boxNumber,
        boxRequirementId: checkResults.boxRequirementId,
        finalQty: checkResults.finalQty,
        discrepancyNotes: checkResults.discrepancyNotes,
        resolutionAction: checkResults.resolutionAction,
        resolvedBy: checkResults.resolvedBy,
        createdAt: checkResults.createdAt,
        userName: users.name,
        userStaffId: users.staffId,
        barCode: boxRequirements.barCode,
        productName: boxRequirements.productName,
        customerName: boxRequirements.customerName,
      })
      .from(checkResults)
      .leftJoin(checkSessions, eq(checkResults.checkSessionId, checkSessions.id))
      .leftJoin(users, eq(checkSessions.userId, users.id))
      .leftJoin(boxRequirements, eq(checkResults.boxRequirementId, boxRequirements.id))
      .where(and(
        eq(checkSessions.jobId, jobId),
        sql`${checkResults.discrepancyNotes} IS NOT NULL`
      ))
      .orderBy(desc(checkResults.createdAt));

    return {
      jobId,
      totalDiscrepancies: discrepancies.length,
      discrepancies
    };
  }

  async applyCheckCorrections(jobId: string, boxNumber: number, corrections: any[], sessionUserId: string, resolvedBy: string): Promise<void> {
    for (const correction of corrections) {
      // New allocation logic: 
      // - correctedQty is already calculated to be min(checkQty, requiredQty) from frontend
      // - This ensures only items up to required_qty are allocated to the box
      // - Excess items beyond required_qty are handled as extras separately

      // Update box requirement with corrected quantity (capped at required_qty)
      await this.db
        .update(boxRequirements)
        .set({ 
          scannedQty: correction.correctedQty, // Already capped at required_qty by frontend
          lastWorkerUserId: sessionUserId,
        })
        .where(and(
          eq(boxRequirements.jobId, jobId),
          eq(boxRequirements.boxNumber, boxNumber),
          eq(boxRequirements.barCode, correction.barCode)
        ));

      // Create check result record for tracking with enhanced notes
      const allocationNotes = correction.checkQty > (correction.requiredQty || 0) 
        ? `Original: ${correction.originalQty}, Checked: ${correction.checkQty}, Allocated to box: ${correction.correctedQty}, Excess: ${correction.checkQty - correction.correctedQty}`
        : `Original: ${correction.originalQty}, Checked: ${correction.checkQty}, Applied: ${correction.correctedQty}`;

      await this.db
        .insert(checkResults)
        .values({
          checkSessionId: correction.sessionId,
          boxRequirementId: correction.boxRequirementId,
          finalQty: correction.correctedQty,
          discrepancyNotes: allocationNotes,
          resolutionAction: 'correction_applied',
          resolvedBy: resolvedBy,
        });
    }
  }

  async createRejectedCheckResults(checkSessionId: string, corrections: any[], resolvedBy: string): Promise<void> {
    // Create check results for rejected corrections
    for (const correction of corrections) {
      await this.db
        .insert(checkResults)
        .values({
          checkSessionId: checkSessionId,
          boxRequirementId: correction.boxRequirementId,
          finalQty: correction.originalQty, // Keep original quantity since corrections were rejected
          discrepancyNotes: `Original: ${correction.originalQty}, Checked: ${correction.checkQty}, Status: REJECTED`,
          resolutionAction: 'correction_rejected',
          resolvedBy: resolvedBy,
        });
    }
  }

  async createExtraItemsFromCheck(jobId: string, extraItems: any[], sessionUserId: string): Promise<void> {
    // Get an active scan session for this user to attach extra items
    const activeSession = await this.db
      .select()
      .from(scanSessions)
      .where(and(
        eq(scanSessions.userId, sessionUserId),
        eq(scanSessions.jobId, jobId),
        eq(scanSessions.status, 'active')
      ))
      .limit(1);

    let sessionId = activeSession.length > 0 ? activeSession[0].id : null;

    // If no active session, create one for extra items
    if (!sessionId) {
      const newSession = await this.db
        .insert(scanSessions)
        .values({
          userId: sessionUserId,
          jobId: jobId,
          status: 'active',
          startTime: new Date(),
        })
        .returning();
      sessionId = newSession[0].id;
    }

    // Create scan events for extra items
    for (const extraItem of extraItems) {
      await this.db
        .insert(scanEvents)
        .values({
          sessionId: sessionId,
          jobId: jobId, // Ensure jobId is included for proper tracking
          barCode: extraItem.barCode,
          productName: extraItem.productName || 'Unknown',
          customerName: 'Unassigned',
          boxNumber: null,
          eventType: 'extra_item',
          isExtraItem: true,
          scanTime: new Date(),
        });
    }
  }

  // QA Dashboard Summary Methods
  async getQASummary(): Promise<any> {
    try {
      // Get all active jobs
      const activeJobs = await this.db
        .select()
        .from(jobs)
        .where(eq(jobs.status, 'active'));

      // Calculate QA metrics for each active job
      const jobSummaries = await Promise.all(
        activeJobs.map(async (job: any) => {
          // Get CheckCount sessions for this job (last 7 days)
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

          const sessionsData = await this.db
            .select({
              id: checkSessions.id,
              boxNumber: checkSessions.boxNumber,
              status: checkSessions.status,
              startTime: checkSessions.startTime,
              endTime: checkSessions.endTime,
              discrepanciesFound: checkSessions.discrepanciesFound,
              isComplete: checkSessions.isComplete,
              userId: checkSessions.userId,
            })
            .from(checkSessions)
            .where(and(
              eq(checkSessions.jobId, job.id),
              sql`${checkSessions.startTime} >= ${sevenDaysAgo}`
            ));

          // Get total boxes for verification rate calculation
          const boxRequirements = await this.getBoxRequirementsByJobId(job.id);
          const totalBoxes = new Set(boxRequirements.map(req => req.boxNumber)).size;

          // Get boxes with completed CheckCount sessions
          const verifiedBoxes = new Set(
            sessionsData
              .filter((session: any) => session.status === 'completed')
              .map((session: any) => session.boxNumber)
          ).size;

          // Calculate verification rate
          const verificationRate = totalBoxes > 0 ? (verifiedBoxes / totalBoxes) * 100 : 0;

          // Calculate accuracy score (sessions with 0 discrepancies / total completed sessions)
          const completedSessions = sessionsData.filter((session: any) => session.status === 'completed');
          const accurateSessions = completedSessions.filter((session: any) => (session.discrepanciesFound || 0) === 0);
          const accuracyScore = completedSessions.length > 0 ? (accurateSessions.length / completedSessions.length) * 100 : 0;

          // Get recent activity (last 5 CheckCount completions)
          const recentSessions = sessionsData
            .filter((session: any) => session.status === 'completed')
            .sort((a: any, b: any) => new Date(b.endTime || b.startTime).getTime() - new Date(a.endTime || a.startTime).getTime())
            .slice(0, 5);

          // Get worker QA performance summary
          const workerStats = new Map();
          sessionsData.forEach((session: any) => {
            if (!workerStats.has(session.userId)) {
              workerStats.set(session.userId, {
                totalSessions: 0,
                accurateSessions: 0,
                totalDiscrepancies: 0
              });
            }
            const stats = workerStats.get(session.userId);
            if (session.status === 'completed') {
              stats.totalSessions++;
              if ((session.discrepanciesFound || 0) === 0) {
                stats.accurateSessions++;
              }
              stats.totalDiscrepancies += (session.discrepanciesFound || 0);
            }
          });

          const topWorkers = Array.from(workerStats.entries())
            .map(([userId, stats]) => ({
              userId,
              accuracy: stats.totalSessions > 0 ? (stats.accurateSessions / stats.totalSessions) * 100 : 0,
              totalSessions: stats.totalSessions,
              totalDiscrepancies: stats.totalDiscrepancies
            }))
            .sort((a, b) => b.accuracy - a.accuracy)
            .slice(0, 3);

          return {
            jobId: job.id,
            jobName: job.name,
            verificationRate: Math.round(verificationRate * 100) / 100,
            accuracyScore: Math.round(accuracyScore * 100) / 100,
            totalSessions: sessionsData.length,
            completedSessions: completedSessions.length,
            totalDiscrepancies: sessionsData.reduce((sum: number, session: any) => sum + (session.discrepanciesFound || 0), 0),
            recentActivity: recentSessions,
            topWorkers
          };
        })
      );

      // Calculate overall aggregated metrics
      const totalSessions = jobSummaries.reduce((sum, job) => sum + job.totalSessions, 0);
      const totalCompletedSessions = jobSummaries.reduce((sum, job) => sum + job.completedSessions, 0);
      const totalDiscrepancies = jobSummaries.reduce((sum, job) => sum + job.totalDiscrepancies, 0);

      const overallVerificationRate = jobSummaries.length > 0 
        ? jobSummaries.reduce((sum, job) => sum + job.verificationRate, 0) / jobSummaries.length 
        : 0;

      const overallAccuracyScore = jobSummaries.length > 0
        ? jobSummaries.reduce((sum, job) => sum + job.accuracyScore, 0) / jobSummaries.length
        : 0;

      return {
        summary: {
          totalActiveJobs: activeJobs.length,
          overallVerificationRate: Math.round(overallVerificationRate * 100) / 100,
          overallAccuracyScore: Math.round(overallAccuracyScore * 100) / 100,
          totalSessions,
          totalCompletedSessions,
          totalDiscrepancies,
          dataTimestamp: new Date().toISOString()
        },
        jobs: jobSummaries
      };
    } catch (error) {
      console.error('Error generating QA summary:', error);
      throw error;
    }
  }

  // ========================
  // JOB ARCHIVING METHODS
  // ========================

  async createJobArchive(archive: InsertJobArchive): Promise<JobArchive> {
    const [result] = await this.db
      .insert(jobArchives)
      .values(archive)
      .returning();
    return result;
  }

  async getJobArchives(): Promise<JobArchive[]> {
    return await this.db
      .select()
      .from(jobArchives)
      .orderBy(desc(jobArchives.archivedAt));
  }

  async getJobArchiveById(id: string): Promise<JobArchive | undefined> {
    const [archive] = await this.db
      .select()
      .from(jobArchives)
      .where(eq(jobArchives.id, id));
    return archive || undefined;
  }

  async deleteJobArchive(id: string): Promise<boolean> {
    try {
      // Get the archive to find the original job ID
      const archive = await this.getJobArchiveById(id);
      if (!archive) {
        return false;
      }

      const originalJobId = archive.originalJobId;

      // Delete ALL job-related data from live operational tables
      // Note: scan_events will cascade delete when scan_sessions are deleted
      // Note: check_events and check_results will cascade delete when check_sessions are deleted

      // Delete check sessions and related data
      await this.db
        .delete(checkSessions)
        .where(eq(checkSessions.jobId, originalJobId));

      // Delete scan sessions and related data
      await this.db
        .delete(scanSessions)
        .where(eq(scanSessions.jobId, originalJobId));

      // Delete job assignments
      await this.db
        .delete(jobAssignments)
        .where(eq(jobAssignments.jobId, originalJobId));

      // Delete worker box assignments
      await this.db
        .delete(workerBoxAssignments)
        .where(eq(workerBoxAssignments.jobId, originalJobId));

      // Delete box requirements
      await this.db
        .delete(boxRequirements)
        .where(eq(boxRequirements.jobId, originalJobId));

      // Delete products (legacy table)
      await this.db
        .delete(products)
        .where(eq(products.jobId, originalJobId));

      // Delete any scan events that directly reference the job (extra items)
      await this.db
        .delete(scanEvents)
        .where(eq(scanEvents.jobId, originalJobId));

      // Delete the main job record
      await this.db
        .delete(jobs)
        .where(eq(jobs.id, originalJobId));

      // Finally delete archive worker stats
      await this.db
        .delete(archiveWorkerStats)
        .where(eq(archiveWorkerStats.archiveId, id));

      // Delete the archive record
      const result = await this.db
        .delete(jobArchives)
        .where(eq(jobArchives.id, id));

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error deleting job archive:', error);
      return false;
    }
  }

  async createArchiveWorkerStats(stats: InsertArchiveWorkerStats[]): Promise<ArchiveWorkerStats[]> {
    if (stats.length === 0) return [];

    const results = await this.db
      .insert(archiveWorkerStats)
      .values(stats)
      .returning();
    return results;
  }

  async getArchiveWorkerStatsByArchiveId(archiveId: string): Promise<ArchiveWorkerStats[]> {
    return await this.db
      .select()
      .from(archiveWorkerStats)
      .where(eq(archiveWorkerStats.archiveId, archiveId))
      .orderBy(desc(archiveWorkerStats.checkAccuracy));
  }

  async archiveJob(jobId: string, archivedBy: string): Promise<JobArchive> {
    try {
      // Get job details
      const [job] = await this.db
        .select()
        .from(jobs)
        .where(eq(jobs.id, jobId));

      if (!job) {
        throw new Error('Job not found');
      }

      // Get manager details
      const [manager] = await this.db
        .select()
        .from(users)
        .where(eq(users.id, job.createdBy));

      // Calculate totals
      const boxRequirements = await this.getBoxRequirementsByJobId(jobId);
      const totalItems = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
      const totalBoxes = new Set(boxRequirements.map(req => req.boxNumber)).size;

      // Calculate CheckCount statistics
      const checkSessions = await this.getCheckSessionsByJobId(jobId);
      const completedSessions = checkSessions.filter(session => session.status === 'completed');

      // Get extras from scan events (items marked as extra)
      const extraItems = await this.db
        .select()
        .from(scanEvents)
        .where(and(
          eq(scanEvents.jobId, jobId),
          eq(scanEvents.isExtraItem, true)
        ));

      const totalExtrasFound = extraItems.length;
      const totalItemsChecked = completedSessions.reduce((sum, session) => sum + (session.discrepanciesFound || 0), 0);
      const totalCorrectChecks = completedSessions.filter(session => (session.discrepanciesFound || 0) === 0).length;
      const overallCheckAccuracy = completedSessions.length > 0 ? (totalCorrectChecks / completedSessions.length) * 100 : 0;

      // Get complete job data for snapshot
      const jobDataSnapshot = {
        job,
        boxRequirements,
        checkSessions: completedSessions,
        extraItems,
        assignments: await this.getJobAssignmentsWithUsers(jobId)
      };

      // Create archive
      const archive = await this.createJobArchive({
        originalJobId: jobId,
        jobName: job.name || `Job ${job.id}`,
        totalItems,
        totalBoxes,
        managerName: manager?.name || 'Unknown',
        managerId: job.createdBy,
        totalExtrasFound,
        totalItemsChecked,
        totalCorrectChecks,
        overallCheckAccuracy: overallCheckAccuracy.toString(),
        archivedBy,
        jobDataSnapshot
      });

      // Calculate and create worker statistics from scan_sessions (aggregated data)
      const jobScanSessions = await this.db
        .select()
        .from(scanSessions)
        .leftJoin(users, eq(scanSessions.userId, users.id))
        .where(eq(scanSessions.jobId, jobId));

      const workerStatsRecords: InsertArchiveWorkerStats[] = [];

      for (const sessionRecord of jobScanSessions) {
        const session = sessionRecord.scan_sessions;
        const worker = sessionRecord.users;

        if (!worker) continue;

        // Find CheckCount sessions for this worker
        const workerCheckSessions = checkSessions.filter(cs => cs.userId === worker.id);
        const totalItemsChecked = workerCheckSessions.length;
        const correctChecks = workerCheckSessions.filter(cs => (cs.discrepanciesFound || 0) === 0).length;
        const checkAccuracy = totalItemsChecked > 0 ? (correctChecks / totalItemsChecked) * 100 : 0;

        // Calculate session time in minutes
        const sessionTimeMinutes = session.endTime && session.startTime 
          ? Math.round((new Date(session.endTime).getTime() - new Date(session.startTime).getTime()) / (1000 * 60))
          : 0;

        workerStatsRecords.push({
          archiveId: archive.id,
          workerId: worker.id,
          workerName: worker.name,
          totalScans: session.totalScans || 0,
          totalSessionTime: sessionTimeMinutes,
          itemsChecked: totalItemsChecked,
          correctChecks,
          checkAccuracy: checkAccuracy.toString(),
          extrasFound: 0, // Will be calculated from extra items in scan events
          errorsCaused: session.errorScans || 0
        });
      }

      if (workerStatsRecords.length > 0) {
        await this.createArchiveWorkerStats(workerStatsRecords);
      }

      // Mark the job as archived
      await this.db
        .update(jobs)
        .set({ isArchived: true })
        .where(eq(jobs.id, jobId));

      return archive;
    } catch (error) {
      console.error('Error archiving job:', error);
      throw new Error('Failed to archive job: ' + (error as Error).message);
    }
  }

  async unarchiveJob(archiveId: string): Promise<boolean> {
    try {
      const archive = await this.getJobArchiveById(archiveId);
      if (!archive || !archive.jobDataSnapshot) {
        throw new Error('Archive not found or missing snapshot data');
      }

      const snapshot = archive.jobDataSnapshot as any;

      // Clean up any existing related data to prevent conflicts
      await this.db
        .delete(jobAssignments)
        .where(eq(jobAssignments.jobId, archive.originalJobId));

      await this.db
        .delete(boxRequirements)
        .where(eq(boxRequirements.jobId, archive.originalJobId));

      // Check if job already exists (prevent duplicate key error)
      const existingJob = await this.getJobById(archive.originalJobId);
      if (existingJob) {
        // Job already exists, just mark as not archived
        await this.db
          .update(jobs)
          .set({ isArchived: false })
          .where(eq(jobs.id, archive.originalJobId));
      } else {
        // Restore job with proper date conversion
        const jobData = {
          ...snapshot.job,
          id: archive.originalJobId,
          createdAt: snapshot.job.createdAt ? new Date(snapshot.job.createdAt) : null,
          completedAt: snapshot.job.completedAt ? new Date(snapshot.job.completedAt) : null,
          isArchived: false // Ensure it's marked as not archived
        };

        const [restoredJob] = await this.db
          .insert(jobs)
          .values(jobData)
          .returning();
      }

      // Restore box requirements
      if (snapshot.boxRequirements?.length > 0) {
        await this.db
          .insert(boxRequirements)
          .values(snapshot.boxRequirements);
      }

      // Mark archive as un-purged
      await this.db
        .update(jobArchives)
        .set({ isPurged: false })
        .where(eq(jobArchives.id, archiveId));

      return true;
    } catch (error) {
      console.error('Error unarchiving job:', error);
      throw new Error('Failed to unarchive job: ' + (error as Error).message);
    }
  }

  async purgeJobData(archiveId: string): Promise<boolean> {
    try {
      // Get the archive to find the original job ID
      const archive = await this.getJobArchiveById(archiveId);
      if (!archive) {
        return false;
      }

      const originalJobId = archive.originalJobId;

      // Delete ALL job-related data from live operational tables
      // This removes all session data, extra items, check data, etc.

      // Delete check sessions and related data (cascade deletes check_events and check_results)
      await this.db
        .delete(checkSessions)
        .where(eq(checkSessions.jobId, originalJobId));

      // Delete scan sessions and related data (cascade deletes scan_events)
      await this.db
        .delete(scanSessions)
        .where(eq(scanSessions.jobId, originalJobId));

      // Delete job assignments (worker/supervisor/manager assignments to this job)
      await this.db
        .delete(jobAssignments)
        .where(eq(jobAssignments.jobId, originalJobId));

      // Delete worker box assignments
      await this.db
        .delete(workerBoxAssignments)
        .where(eq(workerBoxAssignments.jobId, originalJobId));

      // Delete box requirements
      await this.db
        .delete(boxRequirements)
        .where(eq(boxRequirements.jobId, originalJobId));

      // Delete products (legacy table)
      await this.db
        .delete(products)
        .where(eq(products.jobId, originalJobId));

      // Delete any scan events that directly reference the job (extra items)
      await this.db
        .delete(scanEvents)
        .where(eq(scanEvents.jobId, originalJobId));

      // Delete the main job record
      await this.db
        .delete(jobs)
        .where(eq(jobs.id, originalJobId));

      // Mark archive as purged and clear snapshot data, but keep archive summary
      const result = await this.db
        .update(jobArchives)
        .set({ 
          isPurged: true,
          jobDataSnapshot: null
        })
        .where(eq(jobArchives.id, archiveId));

      return result.rowCount > 0;
    } catch (error) {
      console.error('Error purging job data:', error);
      return false;
    }
  }

  // NEW Put Aside Item methods
  async createPutAsideItem(itemData: InsertPutAsideItem): Promise<PutAsideItem> {
    const [item] = await this.db.insert(putAsideItems).values(itemData).returning();
    await this.updatePutAsideAvailability(itemData.jobId);
    return item;
  }

  async getPutAsideItems(jobId: string): Promise<PutAsideItem[]> {
    return await this.db.select().from(putAsideItems)
      .where(and(
        eq(putAsideItems.jobId, jobId),
        isNull(putAsideItems.resolvedAt)
      ))
      .orderBy(putAsideItems.putAsideAt);
  }

  async resolvePutAsideItem(itemId: string, boxNumber: number): Promise<boolean> {
    const [updated] = await this.db.update(putAsideItems)
      .set({ 
        resolvedAt: new Date(),
        assignedToBox: boxNumber 
      })
      .where(eq(putAsideItems.id, itemId))
      .returning();
    return !!updated;
  }

  async updatePutAsideAvailability(jobId: string): Promise<void> {
    const items = await this.getPutAsideItems(jobId);

    for (const item of items) {
      // Check if there's an available box for this customer
      const availableBox = await this.findAvailableBoxForCustomer(jobId, item.customerName);

      await this.db.update(putAsideItems)
        .set({ 
          isBoxAvailable: !!availableBox,
          assignedToBox: availableBox?.boxNumber || null
        })
        .where(eq(putAsideItems.id, item.id));
    }
  }

  async findAvailableBoxForCustomer(jobId: string, customerName: string): Promise<{ boxNumber: number } | null> {
    // Check if customer has any incomplete boxes
    const customerBoxes = await this.db.select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        eq(boxRequirements.customerName, customerName),
        eq(boxRequirements.isComplete, false)
      ))
      .limit(1);

    if (customerBoxes.length > 0) {
      return { boxNumber: customerBoxes[0].boxNumber };
    }

    return null;
  }
}

export const storage = new DatabaseStorage(db);