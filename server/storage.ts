import { 
  users, 
  jobs, 
  products, 
  scanSessions, 
  scanEvents, 
  jobAssignments,
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
  type InsertJobAssignment
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
  getJobProgress(id: string): Promise<any>;

  // Product methods
  createProducts(products: InsertProduct[]): Promise<Product[]>;
  getProductsByJobId(jobId: string): Promise<Product[]>;
  updateProductScannedQty(barCode: string, jobId: string, increment: number): Promise<Product | undefined>;

  // Scan session methods
  createScanSession(session: InsertScanSession): Promise<ScanSession>;
  getScanSessionById(id: string): Promise<ScanSession | undefined>;
  getActiveScanSession(userId: string): Promise<ScanSession | undefined>;
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
}

export class DatabaseStorage implements IStorage {
  async getUserById(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByStaffId(staffId: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.staffId, staffId));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async updateUser(id: string, updates: Partial<InsertUser>): Promise<User | undefined> {
    const [user] = await db
      .update(users)
      .set(updates)
      .where(eq(users.id, id))
      .returning();
    return user || undefined;
  }

  async deleteUser(id: string): Promise<boolean> {
    // Soft delete by setting isActive to false
    const [user] = await db
      .update(users)
      .set({ isActive: false })
      .where(eq(users.id, id))
      .returning();
    return !!user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users).where(eq(users.isActive, true));
  }

  async getUsersByRole(role: string): Promise<User[]> {
    return await db.select().from(users).where(and(eq(users.role, role), eq(users.isActive, true)));
  }

  async createJob(insertJob: InsertJob): Promise<Job> {
    const [job] = await db
      .insert(jobs)
      .values(insertJob)
      .returning();
    return job;
  }

  async getJobById(id: string): Promise<Job | undefined> {
    const [job] = await db.select().from(jobs).where(eq(jobs.id, id));
    return job || undefined;
  }

  async getAllJobs(): Promise<Job[]> {
    return await db.select().from(jobs).orderBy(desc(jobs.createdAt));
  }

  async updateJobStatus(id: string, status: string): Promise<Job | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.completedAt = new Date();
    }

    const [job] = await db
      .update(jobs)
      .set(updateData)
      .where(eq(jobs.id, id))
      .returning();
    return job || undefined;
  }

  async getJobProgress(id: string): Promise<any> {
    // Get job with products
    const job = await this.getJobById(id);
    const jobProducts = await this.getProductsByJobId(id);
    const sessions = await this.getScanSessionsByJobId(id);

    if (!job) return null;

    // Calculate overall progress
    const totalItems = jobProducts.reduce((sum, p) => sum + p.qty, 0);
    const scannedItems = jobProducts.reduce((sum, p) => sum + (p.scannedQty || 0), 0);

    // Get worker performance data with assignment colors
    const workersData = await Promise.all(
      sessions.map(async (session) => {
        const user = await this.getUserById(session.userId);
        const events = await this.getScanEventsBySessionId(session.id);
        const performance = await this.getSessionPerformance(session.id);
        
        // Get the assignment to fetch the assigned color
        const assignment = await this.checkExistingAssignment(id, session.userId);

        return {
          id: session.userId,
          name: user?.name || 'Unknown',
          isActive: session.status === 'active',
          scansPerHour: performance?.scansPerHour || 0,
          score: performance?.score || 0,
          totalScans: session.totalScans,
          currentBox: this.getCurrentBox(jobProducts, session.userId),
          currentCustomer: this.getCurrentCustomer(jobProducts, session.userId),
          lastScan: events.length > 0 ? events[events.length - 1].scanTime : null,
          assignedColor: assignment?.assignedColor || '#3B82F6',
        };
      })
    );

    return {
      progress: {
        totalItems,
        scannedItems,
        completionPercentage: totalItems > 0 ? Math.round((scannedItems / totalItems) * 100) : 0,
        activeSessions: sessions.filter(s => s.status === 'active').length,
        waitingSessions: sessions.filter(s => s.status === 'paused').length,
        workers: workersData,
      },
    };
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

  async createProducts(productList: InsertProduct[]): Promise<Product[]> {
    if (productList.length === 0) return [];
    
    return await db
      .insert(products)
      .values(productList)
      .returning();
  }

  async getProductsByJobId(jobId: string): Promise<Product[]> {
    return await db.select().from(products).where(eq(products.jobId, jobId));
  }

  async updateProductScannedQty(barCode: string, jobId: string, increment: number): Promise<Product | undefined> {
    // Find products with this barcode in the job, ordered by customer priority
    const jobProducts = await db
      .select()
      .from(products)
      .where(and(eq(products.barCode, barCode), eq(products.jobId, jobId)));

    if (jobProducts.length === 0) return undefined;

    // Apply customer priority logic - fulfill first customer's quantity before moving to next
    for (const product of jobProducts) {
      if ((product.scannedQty || 0) < product.qty) {
        const newScannedQty = Math.min((product.scannedQty || 0) + increment, product.qty);
        const [updatedProduct] = await db
          .update(products)
          .set({ 
            scannedQty: newScannedQty,
            isComplete: newScannedQty >= product.qty
          })
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
    const completedItems = jobProducts.reduce((sum, p) => sum + p.scannedQty, 0);
    
    await db
      .update(jobs)
      .set({ completedItems })
      .where(eq(jobs.id, jobId));
  }

  async createScanSession(insertSession: InsertScanSession): Promise<ScanSession> {
    const [session] = await db
      .insert(scanSessions)
      .values(insertSession)
      .returning();
    return session;
  }

  async getScanSessionById(id: string): Promise<ScanSession | undefined> {
    const [session] = await db.select().from(scanSessions).where(eq(scanSessions.id, id));
    return session || undefined;
  }

  async getActiveScanSession(userId: string): Promise<ScanSession | undefined> {
    const [session] = await db
      .select()
      .from(scanSessions)
      .where(and(eq(scanSessions.userId, userId), eq(scanSessions.status, 'active')))
      .orderBy(desc(scanSessions.startTime));
    return session || undefined;
  }

  async getScanSessionsByJobId(jobId: string): Promise<ScanSession[]> {
    return await db.select().from(scanSessions).where(eq(scanSessions.jobId, jobId));
  }

  async updateScanSessionStatus(id: string, status: string): Promise<ScanSession | undefined> {
    const updateData: any = { status };
    if (status === 'completed') {
      updateData.endTime = new Date();
    }
    updateData.lastActivityTime = new Date();

    const [session] = await db
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

    await db
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
    const previousEvents = await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.sessionId, insertEvent.sessionId))
      .orderBy(desc(scanEvents.scanTime))
      .limit(1);

    let timeSincePrevious = null;
    if (previousEvents.length > 0) {
      timeSincePrevious = Date.now() - new Date(previousEvents[0].scanTime).getTime();
    }

    // Get product information for the scanned barcode
    const jobProducts = await db
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

    const [event] = await db
      .insert(scanEvents)
      .values(eventData)
      .returning();

    // Update product scanned quantity
    if (insertEvent.eventType === 'scan' && productInfo) {
      await this.updateProductScannedQty(insertEvent.barCode, productInfo.jobId, 1);
    }

    return event;
  }

  async getScanEventsBySessionId(sessionId: string): Promise<ScanEvent[]> {
    return await db
      .select()
      .from(scanEvents)
      .where(eq(scanEvents.sessionId, sessionId))
      .orderBy(desc(scanEvents.scanTime));
  }

  async undoScanEvents(sessionId: string, count: number): Promise<ScanEvent[]> {
    // Get the most recent scan events to undo
    const eventsToUndo = await db
      .select()
      .from(scanEvents)
      .where(and(eq(scanEvents.sessionId, sessionId), eq(scanEvents.eventType, 'scan')))
      .orderBy(desc(scanEvents.scanTime))
      .limit(count);

    if (eventsToUndo.length === 0) return [];

    // Mark these events as undone and create undo events
    const undoEvents: InsertScanEvent[] = eventsToUndo.map(event => ({
      sessionId,
      barCode: event.barCode,
      productName: event.productName,
      customerName: event.customerName,
      boxNumber: event.boxNumber,
      eventType: 'undo',
    }));

    const createdUndoEvents = await db
      .insert(scanEvents)
      .values(undoEvents)
      .returning();

    // Decrease product scanned quantities
    for (const event of eventsToUndo) {
      if (event.barCode) {
        const jobProducts = await db
          .select()
          .from(products)
          .where(eq(products.barCode, event.barCode));

        for (const product of jobProducts) {
          if (product.scannedQty > 0) {
            await db
              .update(products)
              .set({ 
                scannedQty: product.scannedQty - 1,
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
      ? new Date(session.endTime).getTime() - new Date(session.startTime).getTime()
      : Date.now() - new Date(session.startTime).getTime();

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
    const [assignment] = await db
      .insert(jobAssignments)
      .values(insertAssignment)
      .returning();
    return assignment;
  }

  async getJobAssignments(jobId: string): Promise<JobAssignment[]> {
    return await db
      .select()
      .from(jobAssignments)
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.isActive, true)));
  }

  async getJobAssignmentsWithUsers(jobId: string): Promise<(JobAssignment & { assignee: User })[]> {
    return await db
      .select({
        id: jobAssignments.id,
        jobId: jobAssignments.jobId,
        userId: jobAssignments.userId,
        assignedBy: jobAssignments.assignedBy,
        assignedAt: jobAssignments.assignedAt,
        isActive: jobAssignments.isActive,
        assignedColor: jobAssignments.assignedColor,
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
      .where(and(eq(jobAssignments.jobId, jobId), eq(jobAssignments.isActive, true)));
  }

  async getJobAssignmentsByUser(userId: string): Promise<JobAssignment[]> {
    return await db
      .select()
      .from(jobAssignments)
      .where(and(eq(jobAssignments.userId, userId), eq(jobAssignments.isActive, true)));
  }

  async unassignWorkerFromJob(jobId: string, userId: string): Promise<boolean> {
    const result = await db
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
    const [assignment] = await db
      .select()
      .from(jobAssignments)
      .where(and(
        eq(jobAssignments.jobId, jobId), 
        eq(jobAssignments.userId, userId),
        eq(jobAssignments.isActive, true)
      ));
    
    return assignment || undefined;
  }
}

export const storage = new DatabaseStorage();
