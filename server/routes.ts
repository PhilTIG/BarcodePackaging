import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { WebSocketServer, WebSocket } from "ws";
import { storage } from "./storage";
import { 
  loginSchema, 
  csvRowSchema, 
  insertJobSchema,
  insertScanEventSchema,
  insertJobAssignmentSchema,
  type User,
  type Job,
  type Product,
  type ScanSession,
  type ScanEvent
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import bcrypt from "bcryptjs";

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends Request {
  user?: User;
}

// WebSocket message types
interface WSMessage {
  type: string;
  data: any;
  jobId?: string;
  sessionId?: string;
}

export async function registerRoutes(app: Express): Promise<Server> {
  const httpServer = createServer(app);
  
  // WebSocket setup
  const wss = new WebSocketServer({ server: httpServer, path: '/ws' });
  const connectedClients = new Map<string, { ws: WebSocket; userId: string; jobId?: string }>();

  wss.on('connection', (ws, req) => {
    const clientId = Math.random().toString(36).substring(7);
    const clientIP = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    
    console.log(`[WebSocket Server] New connection established. ClientId: ${clientId}, IP: ${clientIP}`);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as WSMessage;
        console.log(`[WebSocket Server] Message received from client ${clientId}:`, data);
        
        if (data.type === 'authenticate') {
          connectedClients.set(clientId, { 
            ws, 
            userId: data.data.userId,
            jobId: data.data.jobId 
          });
          console.log(`[WebSocket Server] Client ${clientId} authenticated as user ${data.data.userId}${data.data.jobId ? ` for job ${data.data.jobId}` : ''}`);
          
          // Send authentication confirmation
          ws.send(JSON.stringify({
            type: 'authenticated',
            data: { 
              clientId,
              userId: data.data.userId,
              jobId: data.data.jobId 
            }
          }));
        }
        
        if (data.type === 'scan_event') {
          console.log(`[WebSocket Server] Broadcasting scan event for job ${data.jobId}`);
          // Broadcast scan event to all clients monitoring this job
          broadcastToJob(data.jobId!, {
            type: 'scan_update',
            data: data.data
          });
        }
      } catch (error) {
        console.error(`[WebSocket Server] Message parsing error from client ${clientId}:`, error, 'Raw message:', message.toString());
      }
    });

    ws.on('close', (code, reason) => {
      console.log(`[WebSocket Server] Client ${clientId} disconnected. Code: ${code}, Reason: ${reason}`);
      connectedClients.delete(clientId);
    });

    ws.on('error', (error) => {
      console.error(`[WebSocket Server] Error for client ${clientId}:`, error);
    });

    // Send welcome message
    ws.send(JSON.stringify({
      type: 'connected',
      data: { 
        clientId,
        message: 'WebSocket connection established successfully'
      }
    }));
  });

  function broadcastToJob(jobId: string, message: WSMessage) {
    let broadcastCount = 0;
    connectedClients.forEach((client, clientId) => {
      if (client.jobId === jobId && client.ws.readyState === WebSocket.OPEN) {
        try {
          client.ws.send(JSON.stringify(message));
          broadcastCount++;
        } catch (error) {
          console.error(`[WebSocket Server] Failed to send message to client ${clientId}:`, error);
          // Remove dead connection
          connectedClients.delete(clientId);
        }
      }
    });
    console.log(`[WebSocket Server] Broadcasted message to ${broadcastCount} clients for job ${jobId}:`, message);
  }

  function broadcastToUser(userId: string, message: WSMessage) {
    connectedClients.forEach((client) => {
      if (client.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
  }

  // Authentication middleware
  const requireAuth = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'Authentication required' });
    }

    try {
      // Simple token validation - in production use proper JWT
      const user = await storage.getUserById(token);
      if (!user) {
        return res.status(401).json({ message: 'Invalid token' });
      }
      req.user = user;
      next();
    } catch (error) {
      res.status(401).json({ message: 'Invalid token' });
    }
  };

  // Role-based authorization
  const requireRole = (roles: string[]) => {
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
      if (!req.user || !roles.includes(req.user.role)) {
        return res.status(403).json({ message: 'Insufficient permissions' });
      }
      next();
    };
  };

  // Auth routes
  app.post('/api/auth/login', async (req, res) => {
    try {
      const { staffId, pin } = loginSchema.parse(req.body);
      
      const user = await storage.getUserByStaffId(staffId);
      if (!user) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      const validPin = await bcrypt.compare(pin, user.pin);
      if (!validPin) {
        return res.status(401).json({ message: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ message: 'Account is deactivated' });
      }

      // Return user ID as token (in production use proper JWT)
      res.json({ 
        token: user.id,
        user: {
          id: user.id,
          staffId: user.staffId,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(400).json({ message: 'Invalid request data' });
    }
  });

  app.post('/api/auth/register', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const userData = req.body;
      const hashedPin = await bcrypt.hash(userData.pin, 10);
      
      const user = await storage.createUser({
        ...userData,
        pin: hashedPin
      });

      res.json({ 
        user: {
          id: user.id,
          staffId: user.staffId,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(400).json({ message: 'Failed to create user' });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    res.json({
      user: {
        id: req.user!.id,
        staffId: req.user!.staffId,
        name: req.user!.name,
        role: req.user!.role
      }
    });
  });

  // Job management routes
  app.post('/api/jobs', requireAuth, requireRole(['manager']), upload.single('csv'), async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'CSV file is required' });
      }

      const csvData: any[] = [];
      const stream = Readable.from(req.file.buffer);
      
      const validationErrors: string[] = [];
      let rowIndex = 0;
      let headerValidated = false;
      
      await new Promise((resolve, reject) => {
        stream
          .pipe(csv())
          .on('data', (row) => {
            rowIndex++;
            
            // Validate headers on first row
            if (!headerValidated) {
              headerValidated = true;
              const headers = Object.keys(row);
              const expectedHeaders = ['BarCode', 'Product Name', 'Qty', 'CustomName', 'Group'];
              const requiredHeaders = ['BarCode', 'Product Name', 'Qty', 'CustomName'];
              
              const missingRequired = requiredHeaders.filter(h => !headers.includes(h));
              const hasOldCustomerName = headers.includes('CustomerName');
              
              if (missingRequired.length > 0 || hasOldCustomerName) {
                let errorMsg = '';
                if (hasOldCustomerName) {
                  errorMsg = `CSV header error: Found "CustomerName" but expected "CustomName". Please update your CSV header.`;
                } else if (missingRequired.length > 0) {
                  errorMsg = `CSV header error: Missing required columns: ${missingRequired.join(', ')}. Expected: ${expectedHeaders.join(', ')}`;
                }
                reject(new Error(errorMsg));
                return;
              }
            }
            
            try {
              const validatedRow = csvRowSchema.parse(row);
              csvData.push(validatedRow);
            } catch (error: any) {
              const errorMsg = `Row ${rowIndex}: ${error.errors?.map((e: any) => e.message).join(', ') || 'Invalid data format'}`;
              validationErrors.push(errorMsg);
              
              // Stop processing if too many errors
              if (validationErrors.length >= 10) {
                reject(new Error(`CSV validation failed with ${validationErrors.length}+ errors. First errors: ${validationErrors.slice(0, 3).join('; ')}`));
                return;
              }
            }
          })
          .on('end', () => {
            if (validationErrors.length > 0) {
              reject(new Error(`CSV validation failed with ${validationErrors.length} errors: ${validationErrors.slice(0, 3).join('; ')}`));
            } else {
              resolve(undefined);
            }
          })
          .on('error', reject);
      });

      if (csvData.length === 0) {
        return res.status(400).json({ 
          message: 'CSV file is empty or contains no valid data',
          details: 'Expected columns: BarCode, Product Name, Qty, CustomName, Group (optional)'
        });
      }

      // Validate job type and group field requirements
      const jobTypeId = req.body.jobTypeId;
      if (!jobTypeId) {
        return res.status(400).json({ 
          message: 'Job type is required',
          details: 'Please select a job type for this job'
        });
      }

      // Check if job type exists and get its requirements
      const jobType = await storage.getJobTypeById(jobTypeId);
      if (!jobType) {
        return res.status(400).json({ 
          message: 'Invalid job type selected',
          details: 'The selected job type does not exist'
        });
      }

      // Validate Group field requirement
      if (jobType.requireGroupField) {
        const hasGroupField = csvData.every(row => row.Group !== undefined && row.Group !== null);
        if (!hasGroupField) {
          return res.status(400).json({ 
            message: `CSV validation failed: Group field is required for job type "${jobType.name}"`,
            details: 'This job type requires all products to have a Group value. Please ensure your CSV includes a Group column with values for all rows.'
          });
        }
      }

      // Create job
      const jobData = {
        name: req.body.name || `Job ${new Date().toISOString().split('T')[0]}`,
        description: req.body.description || '',
        jobTypeId: jobTypeId,
        totalProducts: csvData.length,
        totalCustomers: Array.from(new Set(csvData.map(row => row.CustomName))).length,
        csvData,
        createdBy: req.user!.id
      };

      const job = await storage.createJob(jobData);

      // POC-Compliant Box Assignment: Customers assigned to boxes 1-100 by first appearance order
      const customerToBoxMap = new Map<string, number>();
      let nextBoxNumber = 1;
      
      // Build customer-to-box mapping based on first appearance in CSV
      csvData.forEach(row => {
        if (!customerToBoxMap.has(row.CustomName)) {
          customerToBoxMap.set(row.CustomName, nextBoxNumber);
          nextBoxNumber++;
        }
      });

      // Create products with POC-compliant box assignments
      const products = csvData.map((row) => ({
        jobId: job.id,
        barCode: row.BarCode,
        productName: row['Product Name'],
        qty: row.Qty,
        customerName: row.CustomName,
        groupName: row.Group || null,
        boxNumber: customerToBoxMap.get(row.CustomName)! // Assign based on customer first appearance
      }));

      await storage.createProducts(products);

      res.status(201).json({ 
        job, 
        products: products,
        productsCount: products.length,
        customersCount: jobData.totalCustomers,
        message: 'CSV uploaded and job created successfully' 
      });
    } catch (error: any) {
      console.error('Job creation error:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to create job from CSV',
        details: error.message?.includes('validation') ? 'Please check your CSV format. Expected columns: BarCode, Product Name, Qty, CustomName, Group (optional)' : undefined
      });
    }
  });

  // Worker assignment to job
  app.post('/api/jobs/:jobId/assign', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { userId, assignedColor, allocationPattern, workerIndex } = req.body;

      if (!userId) {
        return res.status(400).json({ message: 'User ID is required' });
      }

      // Check if job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user exists
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Check for existing assignment to prevent duplicates
      const existingAssignment = await storage.checkExistingAssignment(jobId, userId);
      if (existingAssignment) {
        return res.status(400).json({ message: 'Worker is already assigned to this job' });
      }

      // Validate worker limit (max 4 workers)
      const currentAssignments = await storage.getJobAssignmentsWithUsers(jobId);
      if (currentAssignments.length >= 4) {
        return res.status(400).json({ message: 'Maximum of 4 workers can be assigned per job' });
      }

      // Create assignment with allocation pattern
      const assignment = await storage.createJobAssignment({
        jobId,
        userId,
        assignedBy: req.user!.id,
        assignedColor: assignedColor || '#3B82F6',
        allocationPattern: allocationPattern || 'ascending',
        workerIndex: typeof workerIndex === 'number' ? workerIndex : currentAssignments.length,
        isActive: true,
      });

      res.status(201).json({ 
        assignment: {
          ...assignment,
          allocationPattern: allocationPattern || 'ascending'
        },
        message: `Worker assigned to job with ${allocationPattern || 'ascending'} box allocation pattern`
      });
    } catch (error: any) {
      console.error('Job assignment error:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to assign worker to job'
      });
    }
  });

  app.get('/api/auth/me', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      res.json({ 
        user: {
          id: req.user!.id,
          staffId: req.user!.staffId,
          name: req.user!.name,
          role: req.user!.role,
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to get user info' });
    }
  });

  app.get('/api/jobs', requireAuth, async (req, res) => {
    try {
      const jobs = await storage.getAllJobs();
      
      // Fetch assignments for each job
      const jobsWithAssignments = await Promise.all(
        jobs.map(async (job) => {
          const assignments = await storage.getJobAssignmentsWithUsers(job.id);
          return {
            ...job,
            assignments: assignments
          };
        })
      );
      
      res.json({ jobs: jobsWithAssignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch jobs' });
    }
  });

  app.get('/api/jobs/:id', requireAuth, async (req, res) => {
    try {
      const job = await storage.getJobById(req.params.id);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }
      
      // Check if job uses new box requirements system
      const boxRequirements = await storage.getBoxRequirementsByJobId(job.id);
      let products;
      
      if (boxRequirements.length > 0) {
        // Transform box requirements to product format for UI compatibility
        const productMap = new Map();
        
        boxRequirements.forEach(req => {
          const key = `${req.customerName}-${req.boxNumber}`;
          if (!productMap.has(key)) {
            productMap.set(key, {
              id: `${req.customerName}-${req.boxNumber}`, // Synthetic ID for UI
              customerName: req.customerName,
              qty: 0,
              scannedQty: 0,
              boxNumber: req.boxNumber,
              isComplete: true,
              lastWorkerUserId: req.lastWorkerUserId,
              lastWorkerColor: req.lastWorkerColor
            });
          }
          
          const product = productMap.get(key);
          product.qty += req.requiredQty;
          product.scannedQty += req.scannedQty;
          product.isComplete = product.isComplete && req.isComplete;
          
          // Update worker info if this requirement has more recent worker data
          if (req.lastWorkerUserId) {
            product.lastWorkerUserId = req.lastWorkerUserId;
            product.lastWorkerColor = req.lastWorkerColor;
          }
        });
        
        products = Array.from(productMap.values());
      } else {
        // Fallback to legacy products table
        products = await storage.getProductsByJobId(job.id);
      }
      
      const sessions = await storage.getScanSessionsByJobId(job.id);
      
      res.json({ job, products, sessions });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch job details' });
    }
  });

  app.patch('/api/jobs/:id/status', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const { status } = req.body;
      const job = await storage.updateJobStatus(req.params.id, status);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Broadcast status change to all connected clients
      broadcastToJob(job.id, {
        type: 'job_status_update',
        data: { jobId: job.id, status }
      });

      res.json({ job });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update job status' });
    }
  });

  // Update job active status for scanning control
  app.patch('/api/jobs/:id/active', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const { isActive } = req.body;
      const job = await storage.updateJobActiveStatus(req.params.id, isActive);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Broadcast scanning status change to all connected clients
      broadcastToJob(job.id, {
        type: 'job_scanning_update',
        data: { jobId: job.id, isActive }
      });

      res.json({ job });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update job scanning status' });
    }
  });

  app.patch('/api/jobs/:id/active', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const { isActive } = req.body;
      const job = await storage.updateJobActiveStatus(req.params.id, isActive);
      
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Broadcast job active status change to all connected clients
      broadcastToJob(job.id, {
        type: 'job_active_update',
        data: { jobId: job.id, isActive }
      });

      res.json({ job });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update job active status' });
    }
  });

  // Delete all job data (Manager only) - Emergency cleanup endpoint - MOVED UP TO AVOID CONFLICTS
  app.delete('/api/jobs/all-data', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const result = await storage.deleteAllJobData();
      
      // Broadcast system-wide notification that all jobs have been cleared
      connectedClients.forEach((client) => {
        if (client.ws.readyState === WebSocket.OPEN) {
          try {
            client.ws.send(JSON.stringify({
              type: 'all_jobs_deleted',
              data: { message: result.message }
            }));
          } catch (error) {
            console.error('Failed to broadcast job deletion:', error);
          }
        }
      });

      res.json(result);
    } catch (error: any) {
      console.error('Error deleting all job data:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to delete all job data'
      });
    }
  });

  // Remove job (only if 0% complete)
  app.delete('/api/jobs/:id', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const jobId = req.params.id;
      
      // Check if job exists and get its progress
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if job has any scan events (0% complete check)
      const hasScanEvents = await storage.jobHasScanEvents(jobId);
      if (hasScanEvents) {
        return res.status(400).json({ 
          message: 'Cannot remove job with scan progress. Only jobs with 0% completion can be removed.' 
        });
      }

      // Remove all job data
      const success = await storage.deleteJob(jobId);
      if (!success) {
        return res.status(500).json({ message: 'Failed to remove job' });
      }

      // Broadcast job removal to all connected clients
      broadcastToJob(jobId, {
        type: 'job_removed',
        data: { jobId }
      });

      res.json({ message: 'Job removed successfully', jobId });
    } catch (error: any) {
      console.error('Job removal error:', error);
      res.status(500).json({ 
        message: error.message || 'Failed to remove job'
      });
    }
  });

  // Job assignments
  app.post('/api/jobs/:id/assignments', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { userIds } = req.body;
      const assignments = [];

      for (const userId of userIds) {
        const assignment = await storage.createJobAssignment({
          jobId: req.params.id,
          userId,
          assignedBy: req.user!.id
        });
        assignments.push(assignment);
      }

      res.json({ assignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to assign users to job' });
    }
  });

  app.get('/api/jobs/:id/assignments', requireAuth, async (req, res) => {
    try {
      const assignments = await storage.getJobAssignments(req.params.id);
      res.json({ assignments });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch job assignments' });
    }
  });

  // Unassign worker from job
  app.delete('/api/jobs/:jobId/assign/:userId', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const { jobId, userId } = req.params;

      // Check if job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Check if user exists
      const user = await storage.getUserById(userId);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      // Unassign worker
      const success = await storage.unassignWorkerFromJob(jobId, userId);
      if (!success) {
        return res.status(404).json({ message: 'Assignment not found or already inactive' });
      }

      res.json({ 
        message: 'Worker unassigned from job successfully',
        jobId,
        userId 
      });
    } catch (error: any) {
      console.error('Job unassignment error:', error);
      res.status(400).json({ 
        message: error.message || 'Failed to unassign worker from job'
      });
    }
  });

  // Get current user's assignments with job details
  app.get('/api/users/me/assignments', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      console.log(`Fetching assignments for user: ${req.user!.id}`);
      
      const assignments = await storage.getJobAssignmentsByUser(req.user!.id);
      console.log(`Found ${assignments.length} assignments for user ${req.user!.id}`);
      
      const assignmentsWithJobs = await Promise.all(
        assignments.map(async (assignment) => {
          try {
            const job = await storage.getJobById(assignment.jobId);
            return {
              ...assignment,
              job
            };
          } catch (jobError) {
            console.error(`Error fetching job ${assignment.jobId}:`, jobError);
            return {
              ...assignment,
              job: null
            };
          }
        })
      );
      
      // Filter out assignments with null jobs (deleted jobs)
      const validAssignments = assignmentsWithJobs.filter(assignment => assignment.job !== null);
      
      res.json({ assignments: validAssignments });
    } catch (error) {
      console.error('Error in /api/users/me/assignments:', error);
      res.status(500).json({ 
        message: 'Failed to fetch user assignments',
        error: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.message : 'Unknown error') : undefined
      });
    }
  });

  // Scanning routes
  app.post('/api/scan-sessions', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const sessionData = {
        jobId: req.body.jobId,
        userId: req.user!.id,
        sessionData: req.body.sessionData || {}
      };

      const session = await storage.createScanSession(sessionData);
      res.json({ session });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create scan session' });
    }
  });

  app.get('/api/scan-sessions/my-active', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const session = await storage.getActiveScanSession(req.user!.id);
      res.json({ session });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch active session' });
    }
  });

  app.post('/api/scan-sessions/auto', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.body;
      const session = await storage.createOrGetActiveScanSession(req.user!.id, jobId);
      res.status(201).json({ session });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to create or get active session';
      res.status(400).json({ message: errorMessage });
    }
  });

  app.post('/api/scan-events', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const eventData = req.body;
      const scanEvent = await storage.createScanEvent(eventData);
      
      // Update session statistics
      await storage.updateScanSessionStats(eventData.sessionId);
      
      // Auto-update job status based on scan progress
      await storage.updateJobStatusBasedOnProgress(eventData.jobId);
      
      // Broadcast scan event to supervisors and managers
      broadcastToJob(eventData.jobId, {
        type: 'scan_event',
        data: {
          ...scanEvent,
          userId: req.user!.id,
          userName: req.user!.name
        }
      });

      res.json({ scanEvent });
    } catch (error) {
      res.status(500).json({ message: 'Failed to record scan event' });
    }
  });

  app.post('/api/scan-events/undo', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const { sessionId, count = 1 } = req.body;
      
      const undoneEvents = await storage.undoScanEvents(sessionId, count);
      await storage.updateScanSessionStats(sessionId);

      // Broadcast undo event and update job status
      const session = await storage.getScanSessionById(sessionId);
      if (session) {
        // Auto-update job status after undo
        await storage.updateJobStatusBasedOnProgress(session.jobId);
        
        broadcastToJob(session.jobId, {
          type: 'undo_event',
          data: {
            sessionId,
            undoneEvents,
            userId: req.user!.id
          }
        });
      }

      res.json({ undoneEvents });
    } catch (error) {
      res.status(500).json({ message: 'Failed to undo scan events' });
    }
  });

  // NEW BOX REQUIREMENTS API ENDPOINTS
  app.get('/api/jobs/:id/box-requirements', requireAuth, async (req, res) => {
    try {
      const boxRequirements = await storage.getBoxRequirementsByJobId(req.params.id);
      res.json({ boxRequirements });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch box requirements' });
    }
  });

  app.post('/api/jobs/:id/migrate-to-box-requirements', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      await storage.migrateProductsToBoxRequirements(req.params.id);
      res.json({ message: 'Migration completed successfully' });
    } catch (error) {
      console.error('Migration failed:', error);
      res.status(500).json({ message: 'Failed to migrate to box requirements' });
    }
  });

  app.post('/api/jobs/:id/find-target-box', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const { barCode } = req.body;
      const targetBox = await storage.findNextTargetBox(barCode, req.params.id, req.user!.id);
      
      if (targetBox === null) {
        return res.status(404).json({ message: 'No available target box found for this item' });
      }
      
      res.json({ targetBox });
    } catch (error) {
      res.status(500).json({ message: 'Failed to find target box' });
    }
  });

  app.patch('/api/scan-sessions/:id/status', requireAuth, requireRole(['worker']), async (req, res) => {
    try {
      const { status } = req.body;
      const session = await storage.updateScanSessionStatus(req.params.id, status);
      
      if (!session) {
        return res.status(404).json({ message: 'Session not found' });
      }

      res.json({ session });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update session status' });
    }
  });

  // Performance and reporting
  app.get('/api/scan-sessions/:id/performance', requireAuth, async (req, res) => {
    try {
      const performance = await storage.getSessionPerformance(req.params.id);
      res.json({ performance });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch performance data' });
    }
  });

  app.get('/api/jobs/:id/progress', requireAuth, async (req, res) => {
    try {
      const progressData = await storage.getJobProgress(req.params.id);
      res.json(progressData);
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch job progress' });
    }
  });

  // User preferences routes - EMERGENCY BLOCK to stop infinite requests
  // User Preferences endpoints
  app.get('/api/users/me/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const preferences = await storage.getUserPreferences(req.user.id);
      
      if (!preferences) {
        // Create default preferences for new user
        const defaultPrefs = {
          userId: req.user.id,
          maxBoxesPerRow: 12,
          autoClearInput: true,
          soundFeedback: true,
          vibrationFeedback: false,
          scannerType: "camera" as const,
          targetScansPerHour: 71,
          autoSaveSessions: true,
          showRealtimeStats: true,
          theme: "blue" as const,
          compactMode: false,
          showHelpTips: true,
          enableAutoUndo: false,
          undoTimeLimit: 30,
          batchScanMode: false,
        };
        
        const newPreferences = await storage.createUserPreferences(defaultPrefs);
        return res.json({ preferences: newPreferences });
      }
      
      res.json({ preferences });
    } catch (error) {
      console.error('Error fetching user preferences:', error);
      res.status(500).json({ error: "Failed to fetch preferences" });
    }
  });

  app.put('/api/users/me/preferences', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      if (!req.user?.id) {
        return res.status(401).json({ error: "User not authenticated" });
      }

      const updates = req.body;
      const updatedPreferences = await storage.updateUserPreferences(req.user.id, updates);
      
      if (!updatedPreferences) {
        return res.status(404).json({ error: "User preferences not found" });
      }
      
      res.json({ preferences: updatedPreferences });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // User management
  app.get('/api/users', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.get('/api/users/workers', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const workers = await storage.getUsersByRole('worker');
      res.json({ workers });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch workers' });
    }
  });

  

  // User management routes (Manager only)
  app.get('/api/users', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json({ users });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  app.post('/api/users', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { staffId, name, role, pin } = req.body;
      
      // Validate required fields
      if (!staffId || !name || !role || !pin) {
        return res.status(400).json({ message: 'All fields are required' });
      }

      // Check if staffId already exists
      const existingUser = await storage.getUserByStaffId(staffId);
      if (existingUser) {
        return res.status(400).json({ message: 'Staff ID already exists' });
      }

      // Validate role
      if (!['manager', 'supervisor', 'worker'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const hashedPin = await bcrypt.hash(pin, 10);
      const userData = {
        staffId,
        name,
        role,
        pin: hashedPin
      };

      const user = await storage.createUser(userData);
      res.json({ 
        user: {
          id: user.id,
          staffId: user.staffId,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { staffId, name, role, pin } = req.body;
      const userId = req.params.id;

      // Validate required fields (pin is optional for updates)
      if (!staffId || !name || !role) {
        return res.status(400).json({ message: 'Staff ID, name, and role are required' });
      }

      // Check if staffId already exists for other users
      const existingUser = await storage.getUserByStaffId(staffId);
      if (existingUser && existingUser.id !== userId) {
        return res.status(400).json({ message: 'Staff ID already exists' });
      }

      // Validate role
      if (!['manager', 'supervisor', 'worker'].includes(role)) {
        return res.status(400).json({ message: 'Invalid role' });
      }

      const updateData: any = {
        staffId,
        name,
        role,
      };

      // Only update PIN if provided
      if (pin) {
        updateData.pin = await bcrypt.hash(pin, 10);
      }

      const user = await storage.updateUser(userId, updateData);
      if (!user) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ 
        user: {
          id: user.id,
          staffId: user.staffId,
          name: user.name,
          role: user.role
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to update user' });
    }
  });

  app.delete('/api/users/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const userId = req.params.id;

      // Prevent deleting self
      if (userId === req.user!.id) {
        return res.status(400).json({ message: 'Cannot delete your own account' });
      }

      const deleted = await storage.deleteUser(userId);
      if (!deleted) {
        return res.status(404).json({ message: 'User not found' });
      }

      res.json({ message: 'User deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Job Types API routes (Manager only)
  app.get('/api/job-types', requireAuth, async (req, res) => {
    try {
      const jobTypes = await storage.getJobTypes();
      res.json({ jobTypes });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch job types' });
    }
  });

  app.post('/api/job-types', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { name, benchmarkItemsPerHour, requireGroupField } = req.body;
      
      if (!name) {
        return res.status(400).json({ message: 'Job type name is required' });
      }

      const jobTypeData = {
        name,
        benchmarkItemsPerHour: benchmarkItemsPerHour || 71,
        requireGroupField: requireGroupField || false,
        createdBy: req.user!.id
      };

      const jobType = await storage.createJobType(jobTypeData);
      res.json({ jobType });
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: 'Job type name already exists' });
      }
      res.status(500).json({ message: 'Failed to create job type' });
    }
  });

  app.put('/api/job-types/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { name, benchmarkItemsPerHour, requireGroupField } = req.body;
      const jobTypeId = req.params.id;

      if (!name) {
        return res.status(400).json({ message: 'Job type name is required' });
      }

      const updateData = {
        name,
        benchmarkItemsPerHour: benchmarkItemsPerHour || 71,
        requireGroupField: requireGroupField || false
      };

      const jobType = await storage.updateJobType(jobTypeId, updateData);
      if (!jobType) {
        return res.status(404).json({ message: 'Job type not found' });
      }

      res.json({ jobType });
    } catch (error: any) {
      if (error.message?.includes('unique')) {
        return res.status(400).json({ message: 'Job type name already exists' });
      }
      res.status(500).json({ message: 'Failed to update job type' });
    }
  });

  app.delete('/api/job-types/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const jobTypeId = req.params.id;

      const deleted = await storage.deleteJobType(jobTypeId);
      if (!deleted) {
        return res.status(404).json({ message: 'Job type not found' });
      }

      res.json({ message: 'Job type deleted successfully' });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete job type' });
    }
  });

  return httpServer;
}
