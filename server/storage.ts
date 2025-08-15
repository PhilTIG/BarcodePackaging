import { 
  users, 
  jobs, 
  products, 
  scanSessions, 
  scanEvents, 
  jobAssignments,
  userPreferences,
  roleDefaults,
  jobTypes,
  workerBoxAssignments,
  sessionSnapshots,
  jobArchives,
  type User, 
  type InsertUser,
  type Job,
  type InsertJob,
  type Product,
  type InsertProduct,
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
  type SessionSnapshot,
  type InsertSessionSnapshot,
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

  // Product methods
  createProducts(products: InsertProduct[]): Promise<Product[]>;
  getProductsByJobId(jobId: string): Promise<Product[]>;
  updateProductScannedQty(barCode: string, jobId: string, increment: number, workerId?: string, workerColor?: string): Promise<Product | undefined>;

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

  // Session snapshot methods
  createSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot>;
  getSessionSnapshots(sessionId: string): Promise<SessionSnapshot[]>;
  getLatestSessionSnapshot(sessionId: string): Promise<SessionSnapshot | undefined>;
  deleteSessionSnapshot(id: string): Promise<boolean>;

  // Job archive methods
  createJobArchive(archive: InsertJobArchive): Promise<JobArchive>;
  getJobArchives(): Promise<JobArchive[]>;
  searchJobArchives(query: string): Promise<JobArchive[]>;
  deleteJobArchive(id: string): Promise<boolean>;
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
      const jobProducts = await this.getProductsByJobId(id);
      const sessions = await this.getScanSessionsByJobId(id);
      const assignments = await this.getJobAssignmentsWithUsers(id);

      if (!job) return null;

      // Calculate overall progress
      const totalItems = jobProducts.reduce((sum, p) => sum + p.qty, 0);
      const scannedItems = jobProducts.reduce((sum, p) => sum + (p.scannedQty || 0), 0);

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
          workers: workersData,
        },
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
          const products = await this.getProductsByJobId(job.id);
          const assignments = await this.getJobAssignmentsWithUsers(job.id);

          const totalProducts = products.length;
          const completedItems = products.filter((p: any) => (p.scannedQty || 0) >= p.qty).length;

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

  async updateProductScannedQty(barCode: string, jobId: string, increment: number, workerId?: string, workerColor?: string): Promise<Product | undefined> {
    // Find products with this barcode in the job, ordered by customer priority
    const jobProducts = await this.db
      .select()
      .from(products)
      .where(and(eq(products.barCode, barCode), eq(products.jobId, jobId)));

    if (jobProducts.length === 0) return undefined;

    // Apply customer priority logic - fulfill first customer's quantity before moving to next
    for (const product of jobProducts) {
      if ((product.scannedQty || 0) < product.qty) {
        const newScannedQty = Math.min((product.scannedQty || 0) + increment, product.qty);
        // Update product with worker tracking
        const updateData: any = {
          scannedQty: newScannedQty,
          isComplete: newScannedQty >= product.qty
        };

        // Track last worker to scan into this box (for color highlighting)
        if (workerId && workerColor) {
          updateData.lastWorkerUserId = workerId;
          updateData.lastWorkerColor = workerColor;
        }

        const [updatedProduct] = await this.db
          .update(products)
          .set(updateData)
          .where(eq(products.id, product.id))
          .returning();

        // Update job's completed items count
        await this.updateJobCompletedItems(jobId);

        return updatedProduct;
      }
    }

    return undefined;
  }

  private async updateJobCompletedItems(jobId: string): Promise<void> {
    const jobProducts = await this.getProductsByJobId(jobId);
    const completedItems = jobProducts.reduce((sum, p) => sum + (p.scannedQty || 0), 0);

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

    // Get product information for the scanned barcode
    const jobProducts = await this.db
      .select()
      .from(products)
      .where(eq(products.barCode, insertEvent.barCode))
      .limit(1);

    const productInfo = jobProducts[0];

    const eventData = {
      ...insertEvent,
      productName: productInfo?.productName,
      customerName: productInfo?.customerName,
      boxNumber: productInfo?.boxNumber,
      timeSincePrevious,
    };

    const [event] = await this.db
      .insert(scanEvents)
      .values(eventData)
      .returning();

    // Update product scanned quantity with worker tracking
    if (insertEvent.eventType === 'scan' && productInfo) {
      await this.updateProductScannedQty(
        insertEvent.barCode, 
        productInfo.jobId, 
        1,
        insertEvent.workerAssignmentType ? await this.getWorkerIdFromSession(insertEvent.sessionId) : undefined,
        insertEvent.workerColor || undefined
      );
    }

    return event;
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
    const undoEvents: InsertScanEvent[] = eventsToUndo.map((event: any) => ({
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

    // Decrease product scanned quantities
    for (const event of eventsToUndo) {
      if (event.barCode) {
        const jobProducts = await this.db
          .select()
          .from(products)
          .where(eq(products.barCode, event.barCode));

        for (const product of jobProducts) {
          if ((product.scannedQty || 0) > 0) {
            await this.db
              .update(products)
              .set({ 
                scannedQty: (product.scannedQty || 0) - 1,
                isComplete: false
              })
              .where(eq(products.id, product.id));
          }
        }
      }
    }

    return createdUndoEvents;
  }

  async getSessionPerformance(sessionId: string): Promise<any> {
    const session = await this.getScanSessionById(sessionId);
    if (!session) return null;

    const events = await this.getScanEventsBySessionId(sessionId);
    const scanEvents = events.filter(e => e.eventType === 'scan');
    const errorEvents = events.filter(e => e.eventType === 'error');
    const undoEvents = events.filter(e => e.eventType === 'undo');

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

  async createJobAssignment(insertAssignment: InsertJobAssignment): Promise<JobAssignment> {
    const [assignment] = await this.db
      .insert(jobAssignments)
      .values(insertAssignment)
      .returning();
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

  // Session snapshot methods
  async createSessionSnapshot(snapshot: InsertSessionSnapshot): Promise<SessionSnapshot> {
    const [result] = await this.db
      .insert(sessionSnapshots)
      .values(snapshot)
      .returning();
    return result;
  }

  async getSessionSnapshots(sessionId: string): Promise<SessionSnapshot[]> {
    return await this.db
      .select()
      .from(sessionSnapshots)
      .where(eq(sessionSnapshots.sessionId, sessionId))
      .orderBy(sessionSnapshots.createdAt);
  }

  async getLatestSessionSnapshot(sessionId: string): Promise<SessionSnapshot | undefined> {
    const [result] = await this.db
      .select()
      .from(sessionSnapshots)
      .where(eq(sessionSnapshots.sessionId, sessionId))
      .orderBy(sql`created_at DESC`)
      .limit(1);
    return result || undefined;
  }

  async deleteSessionSnapshot(id: string): Promise<boolean> {
    const result = await this.db
      .delete(sessionSnapshots)
      .where(eq(sessionSnapshots.id, id))
      .returning();
    return result.length > 0;
  }

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
}

export const storage = new DatabaseStorage(db);