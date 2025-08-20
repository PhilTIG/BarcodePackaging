import { 
  users, 
  jobs, 
  products, 
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
  type User, 
  type InsertUser,
  type Job,
  type InsertJob,
  type Product,
  type InsertProduct,
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
  // PHASE 4: SessionSnapshot types removed
  type JobArchive,
  type InsertJobArchive
} from "@shared/schema";
import { db } from "./db";
import { eq, and, desc, sql, inArray } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUserById(id: string): Promise<User | undefined>;
  getUserByStaffId(staffId: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined>;
  deleteUser(id: string): Promise<boolean>;
  getAllUsers(): Promise<User[]>;
  getUsersByRole(role: string): Promise<User[]>;

  // Job methods
  createJob(job: InsertJob): Promise<Job>;
  getJobById(id: string): Promise<Job | undefined>;
  getAllJobs(): Promise<Job[]>;
  updateJobStatus(id: string, status: string): Promise<Job | undefined>;
  updateJobActiveStatus(id: string, isActive: boolean): Promise<Job | undefined>;
  getJobProgress(id: string): Promise<any>;
  getJobs(): Promise<{ jobs: any[] }>;
  jobHasScanEvents(jobId: string): Promise<boolean>;
  deleteJob(jobId: string): Promise<boolean>;
  updateJobStatusBasedOnProgress(jobId: string): Promise<void>;

  // Product methods
  createProducts(products: InsertProduct[]): Promise<Product[]>;
  getProductsByJobId(jobId: string): Promise<Product[]>;
  updateProductScannedQty(barCode: string, jobId: string, increment: number, workerId?: string, workerColor?: string): Promise<Product | undefined>;

  // Box requirement methods - NEW SCANNING LOGIC
  createBoxRequirements(requirements: InsertBoxRequirement[]): Promise<BoxRequirement[]>;
  getBoxRequirementsByJobId(jobId: string): Promise<BoxRequirement[]>;
  findNextTargetBox(barCode: string, jobId: string, workerId: string): Promise<number | null>;
  updateBoxRequirementScannedQty(boxNumber: number, barCode: string, jobId: string, workerId: string, workerColor: string): Promise<BoxRequirement | undefined>;
  migrateProductsToBoxRequirements(jobId: string): Promise<void>;

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
  searchJobArchives(query: string): Promise<JobArchive[]>;
  deleteJobArchive(id: string): Promise<boolean>;

  // Extra Items tracking methods (NEW)
  getExtraItemsCount(jobId: string): Promise<number>;
  getExtraItemsDetails(jobId: string): Promise<any[]>;

  // Worker ID consistency analysis
  analyzeWorkerIdConsistency(jobId: string): Promise<any>;
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
        // LEGACY SYSTEM: Use products table
        const products = await this.getProductsByJobId(jobId);
        totalItems = products.reduce((sum, p) => sum + p.qty, 0);
        completedItems = products.reduce((sum, p) => sum + (p.scannedQty || 0), 0);
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

        // Delete scan sessions
        await tx
          .delete(scanSessions)
          .where(eq(scanSessions.jobId, jobId));

        // Delete job assignments
        await tx
          .delete(jobAssignments)
          .where(eq(jobAssignments.jobId, jobId));

        // Delete products
        await tx
          .delete(products)
          .where(eq(products.jobId, jobId));

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

      // Use box requirements system (all jobs should have box requirements)
      const boxRequirements = await this.getBoxRequirementsByJobId(id);
      const totalItems = boxRequirements.reduce((sum, req) => sum + req.requiredQty, 0);
      const scannedItems = boxRequirements.reduce((sum, req) => sum + Math.min(req.scannedQty || 0, req.requiredQty), 0);

      // Transform to products format for compatibility with existing components
      const productMap = new Map();
      boxRequirements.forEach(req => {
        const key = `${req.customerName}-${req.boxNumber}`;
        if (!productMap.has(key)) {
          productMap.set(key, {
            customerName: req.customerName,
            qty: 0,
            scannedQty: 0,
            boxNumber: req.boxNumber,
            isComplete: true,
            lastWorkerColor: req.lastWorkerColor
          });
        }
        const product = productMap.get(key);
        product.qty += req.requiredQty;
        product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
        product.isComplete = product.isComplete && req.isComplete;
        // Keep the most recent worker info
        if (req.lastWorkerColor) product.lastWorkerColor = req.lastWorkerColor;
      });
      const jobProducts = Array.from(productMap.values());

      const sessions = await this.getScanSessionsByJobId(id);
      const assignments = await this.getJobAssignmentsWithUsers(id);

      // Get extra items count and details (items scanned that are not in the original job)
      const extraItemsCount = await this.getExtraItemsCount(id);
      const extraItemsDetails = await this.getExtraItemsDetails(id);

      if (!job) return null;

      // Calculate Box Complete logic using helper method
      const boxCompletion = this.calculateBoxCompletion(jobProducts);

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
            // LEGACY SYSTEM: Use products table
            products = await this.getProductsByJobId(job.id);
            totalProducts = products.reduce((sum, p) => sum + p.qty, 0); // Use total quantities, not product count
            completedItems = products.reduce((sum, p) => sum + (p.scannedQty || 0), 0);
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

  private getCurrentBox(products: Product[], userId: string): number | null {
    // Find the box number for products currently being scanned by this user
    // This would need more sophisticated logic based on session data
    const activeProducts = products.filter(p => (p.scannedQty || 0) > 0 && (p.scannedQty || 0) < p.qty);
    return activeProducts.length > 0 ? activeProducts[0].boxNumber : null;
  }

  private getCurrentCustomer(products: Product[], userId: string): string | null {
    // Find the customer for products currently being scanned by this user
    const activeProducts = products.filter(p => (p.scannedQty || 0) > 0 && (p.scannedQty || 0) < p.qty);
    return activeProducts.length > 0 ? activeProducts[0].customerName : null;
  }

  /**
   * Helper method to calculate box completion status for a set of products
   * Box Complete = 100% fulfillment: all items allocated to each box (CustomName) must be scanned
   */
  private calculateBoxCompletion(products: Product[]): {
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

  async createProducts(productList: InsertProduct[]): Promise<Product[]> {
    if (productList.length === 0) return [];

    return await this.db
      .insert(products)
      .values(productList)
      .returning();
  }

  async getProductsByJobId(jobId: string): Promise<Product[]> {
    return await this.db.select().from(products).where(eq(products.jobId, jobId));
  }

  // DEPRECATED: Legacy method for products table scanning - use box requirements system instead
  async updateProductScannedQty(barCode: string, jobId: string, increment: number, workerId?: string, workerColor?: string): Promise<Product | undefined> {
    console.warn('[DEPRECATED] updateProductScannedQty called - this method is deprecated, use box requirements system instead');

    // This method is kept only for potential emergency fallback
    // All new jobs should use the box_requirements system via updateBoxRequirement()
    return undefined;
  }

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
    // Get the most recent scan events to undo
    const eventsToUndo = await this.db
      .select()
      .from(scanEvents)
      .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.eventType, 'scan')))
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

    // Decrease box requirement scanned quantities using modern system
    for (const event of eventsToUndo) {
      if (event.barCode && event.boxNumber) {
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
      .orderBy(jobAssignments.workerIndex);
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

  /**
   * Find the next target box for a scanned item based on worker allocation pattern
   * Logic: Find lowest numbered box that has this item in requirement list AND still needs more of this item
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

    // Get all box requirements for this item that still need more items
    const availableBoxes = await this.db
      .select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        eq(boxRequirements.barCode, barCode),
        sql`${boxRequirements.scannedQty} < ${boxRequirements.requiredQty}`
      ))
      .orderBy(boxRequirements.boxNumber);

    if (availableBoxes.length === 0) {
      console.log(`No available boxes found for barcode ${barCode}`);
      return null;
    }

    const boxNumbers = availableBoxes.map((box: BoxRequirement) => box.boxNumber);

    // Apply worker allocation pattern to find next box
    switch (workerPattern) {
      case 'ascending':
        // Worker 1: Find lowest numbered box
        return Math.min(...boxNumbers);

      case 'descending':
        // Worker 2: Find highest numbered box
        return Math.max(...boxNumbers);

      case 'middle_up':
        // Worker 3: Find middle or next higher box
        const sortedAsc = [...boxNumbers].sort((a, b) => a - b);
        const middleIndex = Math.floor(sortedAsc.length / 2);
        return sortedAsc[middleIndex];

      case 'middle_down':
        // Worker 4: Find middle or next lower box  
        const sortedDesc = [...boxNumbers].sort((a, b) => b - a);
        const middleDownIndex = Math.floor(sortedDesc.length / 2);
        return sortedDesc[middleDownIndex];

      default:
        // Fallback to ascending
        return Math.min(...boxNumbers);
    }
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
    // Find the specific box requirement
    const requirement = await this.db
      .select()
      .from(boxRequirements)
      .where(and(
        eq(boxRequirements.jobId, jobId),
        eq(boxRequirements.barCode, barCode),
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

  /**
   * Migrate existing CSV product data to the new box requirements structure
   * This preserves existing data while enabling the new scanning logic
   */
  async migrateProductsToBoxRequirements(jobId: string): Promise<void> {
    console.log(`Starting migration of products to box requirements for job ${jobId}`);

    // Get existing products for this job
    const existingProducts = await this.getProductsByJobId(jobId);

    if (existingProducts.length === 0) {
      console.log('No products found to migrate');
      return;
    }

    // Create box requirements from products, preserving original CSV box assignments
    // Use the existing boxNumber from the products table (which follows CSV order)
    const boxRequirements: InsertBoxRequirement[] = existingProducts
      .filter(product => product.boxNumber !== null) // Skip any products without box assignments
      .map(product => ({
        jobId: product.jobId,
        boxNumber: product.boxNumber!, // Use existing box assignment from CSV
        customerName: product.customerName,
        barCode: product.barCode,
        productName: product.productName,
        requiredQty: product.qty,
        scannedQty: product.scannedQty || 0,
        isComplete: (product.scannedQty || 0) >= product.qty,
        lastWorkerUserId: product.lastWorkerUserId,
        lastWorkerColor: product.lastWorkerColor
      }));

    // Insert box requirements
    await this.createBoxRequirements(boxRequirements);

    // Create worker assignments for the job (up to 4 workers with their patterns)
    const jobAssignments = await this.getJobAssignmentsWithUsers(jobId);
    const workers = jobAssignments.slice(0, 4); // Max 4 workers

    const workerAssignments: InsertWorkerBoxAssignment[] = workers.map((assignment, index) => {
      const patterns = ['ascending', 'descending', 'middle_up', 'middle_down'];
      return {
        jobId,
        workerId: assignment.userId,
        assignmentType: patterns[index % 4]
      };
    });

    // Insert worker assignments
    for (const assignment of workerAssignments) {
      await this.createWorkerBoxAssignment(assignment);
    }

    console.log(`Migration completed: Created ${boxRequirements.length} box requirements and ${workerAssignments.length} worker assignments`);
  }

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

  // Get extra items details with worker information
  async getExtraItemsDetails(jobId: string): Promise<any[]> {
    try {
      const extraItems = await this.db
        .select({
          id: scanEvents.id,
          barCode: scanEvents.barCode,
          productName: scanEvents.productName,
          scanTime: scanEvents.scanTime,
          workerColor: scanEvents.workerColor,
          sessionId: scanEvents.sessionId,
          // Get worker info from session
          workerId: scanSessions.userId,
        })
        .from(scanEvents)
        .innerJoin(scanSessions, eq(scanEvents.sessionId, scanSessions.id))
        .where(
          and(
            eq(scanEvents.jobId, jobId),
            eq(scanEvents.isExtraItem, true)
          )
        )
        .orderBy(desc(scanEvents.scanTime));

      // Get worker details for each extra item
      const workerIds = [...new Set(extraItems.map(item => item.workerId))];
      const workers = await Promise.all(
        workerIds.map(id => this.getUserById(id))
      );
      const workerMap = new Map(workers.filter(Boolean).map(worker => [worker!.id, worker]));

      // Enhance extra items with worker information
      const enhancedExtraItems = extraItems.map(item => ({
        ...item,
        workerName: workerMap.get(item.workerId)?.name || 'Unknown',
        workerStaffId: workerMap.get(item.workerId)?.staffId || 'Unknown'
      }));

      return enhancedExtraItems;
    } catch (error) {
      console.error('Error fetching extra items details:', error);
      throw error;
    }
  }

  // Diagnostic method to investigate worker ID consistency
  async analyzeWorkerIdConsistency(jobId: string) {
    try {
      // Get all data sources that reference worker IDs
      const [boxRequirements, scanSessions, scanEvents, jobAssignments] = await Promise.all([
        this.getBoxRequirementsByJobId(jobId),
        this.getScanSessionsByJobId(jobId),
        this.db.select().from(scanEvents).where(eq(scanEvents.jobId, jobId)),
        this.getJobAssignmentsWithUsers(jobId)
      ]);

      // Extract worker IDs from each source
      const boxReqWorkerIds = [...new Set(boxRequirements
        .filter(req => req.lastWorkerUserId)
        .map(req => req.lastWorkerUserId!))]
        .filter(Boolean);

      const sessionWorkerIds = [...new Set(scanSessions.map(session => session.userId))];

      const eventWorkerIds = [...new Set(scanEvents
        .map(event => event.sessionId)
        .filter(Boolean))];

      const assignmentWorkerIds = jobAssignments.map(assignment => assignment.userId);

      // Get all actual workers
      const allWorkers = await this.getUsersByRole('worker');
      const validWorkerIds = allWorkers.map(w => w.id);

      return {
        sources: {
          boxRequirements: { count: boxReqWorkerIds.length, ids: boxReqWorkerIds },
          scanSessions: { count: sessionWorkerIds.length, ids: sessionWorkerIds },
          scanEvents: { count: eventWorkerIds.length, ids: eventWorkerIds },
          jobAssignments: { count: assignmentWorkerIds.length, ids: assignmentWorkerIds }
        },
        validWorkers: { count: validWorkerIds.length, ids: validWorkerIds },
        mismatches: {
          boxReqMissing: boxReqWorkerIds.filter(id => !validWorkerIds.includes(id)),
          sessionMissing: sessionWorkerIds.filter(id => !validWorkerIds.includes(id)),
          assignmentMissing: assignmentWorkerIds.filter(id => !validWorkerIds.includes(id))
        },
        idFormats: {
          boxReqIdLengths: boxReqWorkerIds.map(id => id.length),
          validWorkerIdLengths: validWorkerIds.map(id => id.length),
          exampleBoxReqIds: boxReqWorkerIds.slice(0, 3),
          exampleValidIds: validWorkerIds.slice(0, 3)
        }
      };
    } catch (error) {
      console.error('Error analyzing worker ID consistency:', error);
      throw error;
    }
  }

  // PHASE 4: Session snapshot methods removed (unused dead code)

  // Job archive methods
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
      .orderBy(sql`archived_at DESC`);
  }

  async searchJobArchives(query: string): Promise<JobArchive[]> {
    return await this.db
      .select()
      .from(jobArchives)
      .where(sql`job_data::text ILIKE ${`%${query}%`}`)
      .orderBy(sql`archived_at DESC`);
  }

  async deleteJobArchive(id: string): Promise<boolean> {
    const result = await this.db
      .delete(jobArchives)
      .where(eq(jobArchives.id, id))
      .returning();
    return result.length > 0;
  }

  // Delete all job data while preserving users and their settings
  async deleteAllJobData(): Promise<{ deletedJobs: number; message: string }> {
    try {
      // Get count of jobs before deletion
      const jobCount = await this.db.select().from(jobs);

      // Delete in correct order due to foreign key constraints
      // 1. Delete scan events first (references scan sessions)
      await this.db.delete(scanEvents);

      // PHASE 4: session snapshots deletion removed (table no longer exists)

      // 3. Delete scan sessions (references jobs and users)
      await this.db.delete(scanSessions);

      // 4. Delete worker box assignments (references jobs and users)
      await this.db.delete(workerBoxAssignments);

      // 5. Delete job assignments (references jobs and users)
      await this.db.delete(jobAssignments);

      // 6. Delete products (references jobs)
      await this.db.delete(products);

      // 7. Delete job archives
      await this.db.delete(jobArchives);

      // 8. Finally delete jobs (parent table)
      await this.db.delete(jobs);

      return {
        deletedJobs: jobCount.length,
        message: `Successfully deleted ${jobCount.length} jobs and all associated data. User accounts and settings preserved.`
      };
    } catch (error) {
      console.error('Error deleting all job data:', error);
      throw new Error('Failed to delete job data: ' + (error as Error).message);
    }
  }
}

export const storage = new DatabaseStorage(db);