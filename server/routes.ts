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
  // Product type removed - table eliminated
  type ScanSession,
  type ScanEvent,
  type WSMessage,
  type WSAuthenticateMessage,
  type WSScanUpdateMessage,
  type WSJobStatusMessage,
  type WSBoxActionMessage,
  type WSCheckCountMessage,
  type WSPutAsideMessage
} from "@shared/schema";
import { z } from "zod";
import multer from "multer";
import csv from "csv-parser";
import { Readable } from "stream";
import bcrypt from "bcryptjs";
import { db } from "./db"; // Assuming db is imported for direct access
import { eq } from "drizzle-orm"; // Assuming drizzle ORM for queries

// Helper function to get worker performance (placeholder)
async function getWorkerPerformance(userId: string, jobId: string): Promise<any> {
  // This is a placeholder. In a real scenario, this would query performance data.
  // For now, returning dummy data.
  console.log(`[Helper] Fetching performance for user ${userId} on job ${jobId}`);
  return {
    scansCompleted: Math.floor(Math.random() * 100),
    itemsPerHour: Math.floor(Math.random() * 150),
    accuracy: Math.random().toFixed(2),
  };
}

// Setup multer for file uploads
const upload = multer({ storage: multer.memoryStorage() });

interface AuthenticatedRequest extends Request {
  user?: User;
}

// WebSocket message types now imported from schema

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
          const authData = data as WSAuthenticateMessage;
          connectedClients.set(clientId, {
            ws,
            userId: authData.data.userId,
            jobId: authData.data.jobId
          });
          console.log(`[WebSocket Server] Client ${clientId} authenticated as user ${authData.data.userId}${authData.data.jobId ? ` for job ${authData.data.jobId}` : ''}`);

          // Send authentication confirmation
          ws.send(JSON.stringify({
            type: 'authenticated',
            data: {
              clientId,
              userId: authData.data.userId,
              jobId: authData.data.jobId
            }
          }));
        }

        // Handle Put Aside specific WebSocket events
        if (data.type === 'put_aside_event') {
          const putAsideData = data as WSPutAsideMessage;
          console.log(`[WebSocket Server] Received PutAside event:`, putAsideData);

          // Trigger a re-fetch or update for Put Aside counts/items
          // This might involve invalidating a cache or directly querying the DB
          // For now, we'll just log and assume downstream handlers will react
          // A more robust solution might involve directly broadcasting the payload
          // or having a dedicated handler for put_aside_event
        }

        // Note: scan_event broadcasting is handled by the API route, no need to re-broadcast here
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

  function broadcastToJob(jobId: string, message: WSMessage | WSJobStatusMessage | WSBoxActionMessage | WSCheckCountMessage | WSPutAsideMessage) {
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

  function broadcastToUser(userId: string, message: WSMessage | WSJobStatusMessage) {
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
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const validPin = await bcrypt.compare(pin, user.pin);
      if (!validPin) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      if (!user.isActive) {
        return res.status(401).json({ error: 'Account is deactivated' });
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
        role: req.user!.role,
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

      // Validate barcode/product name consistency
      const barcodeProductMap = new Map<string, string>();
      const consistencyErrors: string[] = [];

      csvData.forEach((row, index) => {
        const barcode = row.BarCode;
        const productName = row['Product Name'];

        if (barcodeProductMap.has(barcode)) {
          const existingProductName = barcodeProductMap.get(barcode)!;
          if (existingProductName !== productName) {
            // Case-sensitive exact match failed - report the mismatch
            consistencyErrors.push(
              `Row ${index + 1}: Barcode "${barcode}" maps to "${productName}" but was previously mapped to "${existingProductName}"`
            );
          }
        } else {
          barcodeProductMap.set(barcode, productName);
        }
      });

      // Check if Group validation should run
      const shouldValidateGroup = jobType.requireGroupField || csvData.some(row => row.Group && row.Group.trim() !== '');

      let groupConsistencyErrors: string[] = [];
      let groupRequiredErrors: string[] = [];

      if (shouldValidateGroup) {
        // Validate Group field population (if required by job type OR present in CSV)
        csvData.forEach((row, index) => {
          if (!row.Group || row.Group.trim() === '') {
            groupRequiredErrors.push(`Row ${index + 1}: Group field is empty but Group data is required`);
          }
        });

        // Validate customer/group consistency
        const customerGroupMap = new Map<string, string>();

        csvData.forEach((row, index) => {
          const customerName = row.CustomName;
          const groupName = row.Group;

          if (groupName && groupName.trim() !== '') {
            if (customerGroupMap.has(customerName)) {
              const existingGroupName = customerGroupMap.get(customerName)!;
              if (existingGroupName !== groupName) {
                // Case-sensitive exact match failed - report the mismatch
                groupConsistencyErrors.push(
                  `Row ${index + 1}: Customer "${customerName}" maps to Group "${groupName}" but was previously mapped to Group "${existingGroupName}"`
                );
              }
            } else {
              customerGroupMap.set(customerName, groupName);
            }
          }
        });
      }

      // Combine all validation errors and return comprehensive error response
      const allErrors: string[] = [];

      if (consistencyErrors.length > 0) {
        const errorCount = consistencyErrors.length;
        const displayedErrors = consistencyErrors.slice(0, 10);
        const moreErrorsText = errorCount > 10 ? ` (and ${errorCount - 10} more)` : '';
        allErrors.push(`Barcode/Product errors:\nFound ${errorCount} barcode/product name inconsistencies${moreErrorsText}:\n${displayedErrors.join('\n')}`);
      }

      if (groupRequiredErrors.length > 0) {
        const errorCount = groupRequiredErrors.length;
        const displayedErrors = groupRequiredErrors.slice(0, 10);
        const moreErrorsText = errorCount > 10 ? ` (and ${errorCount - 10} more)` : '';
        allErrors.push(`Group Required errors:\nFound ${errorCount} missing Group values${moreErrorsText}:\n${displayedErrors.join('\n')}`);
      }

      if (groupConsistencyErrors.length > 0) {
        const errorCount = groupConsistencyErrors.length;
        const displayedErrors = groupConsistencyErrors.slice(0, 10);
        const moreErrorsText = errorCount > 10 ? ` (and ${errorCount - 10} more)` : '';
        allErrors.push(`Customer/Group errors:\nFound ${errorCount} customer/group inconsistencies${moreErrorsText}:\n${displayedErrors.join('\n')}`);
      }

      // If any errors found, reject the entire CSV upload
      if (allErrors.length > 0) {
        const message = allErrors.length === 1
          ? (groupConsistencyErrors.length > 0 ? 'Customer / Group mismatch - Check your group assignments are consistent' : 'Barcode / Product mismatch - Check your product names are consistent')
          : 'Multiple validation errors found';

        return res.status(400).json({
          message,
          details: allErrors.join('\n\n')
        });
      }

      // Extract and parse box limit
      const boxLimitStr = req.body.boxLimit;
      const boxLimit = boxLimitStr && boxLimitStr.trim() ? parseInt(boxLimitStr.trim()) : null;

      // Create job
      const jobData = {
        name: req.body.name || `Job ${new Date().toISOString().split('T')[0]}`,
        description: req.body.description || '',
        jobTypeId: jobTypeId,
        totalProducts: csvData.reduce((sum, row) => sum + row.Qty, 0), // Sum all quantities, not just count rows
        totalCustomers: Array.from(new Set(csvData.map(row => row.CustomName))).length,
        csvData,
        boxLimit: boxLimit, // BOX LIMIT FOUNDATION: Add box limit to job data
        createdBy: req.user!.id
      };

      const job = await storage.createJob(jobData);

      // BOX LIMIT FOUNDATION: Enhanced Box Assignment with optional limit
      const uniqueCustomers = Array.from(new Set(csvData.map(row => row.CustomName)));
      const totalCustomers = uniqueCustomers.length;

      // Check for box limit warning (< 80% of customers)
      let warningMessage = null;
      if (boxLimit && boxLimit < Math.ceil(totalCustomers * 0.8)) {
        warningMessage = `Warning: Box limit (${boxLimit}) is less than 80% of unique customers (${totalCustomers}). ${totalCustomers - boxLimit} customers will be unallocated and be assigned to a box when made available.`;
      }

      const customerToBoxMap = new Map<string, number | null>();
      let nextBoxNumber = 1;

      // Build customer-to-box mapping: assign boxes up to limit, then NULL
      uniqueCustomers.forEach((customerName, index) => {
        if (!boxLimit || nextBoxNumber <= boxLimit) {
          customerToBoxMap.set(customerName, nextBoxNumber);
          nextBoxNumber++;
        } else {
          // BOX LIMIT: Set to NULL for customers beyond the limit
          customerToBoxMap.set(customerName, null);
        }
      });

      // BARCODE FIX: Normalize barcodes during CSV import to prevent scientific notation issues
      const normalizeBarcodeFormat = (barCode: string): string => {
        // Check if the barcode is in scientific notation format
        if (/^\d+\.\d+[eE][+-]?\d+$/.test(barCode)) {
          try {
            // Convert scientific notation to full numeric string
            const numericValue = parseFloat(barCode);
            return numericValue.toString();
          } catch (error) {
            console.warn(`Failed to normalize barcode during import: ${barCode}`, error);
            return barCode;
          }
        }
        return barCode;
      };

      // Create products with BOX LIMIT box assignments (may be NULL)
      const products = csvData.map((row) => ({
        jobId: job.id,
        barCode: normalizeBarcodeFormat(row.BarCode), // Normalize barcode format
        productName: row['Product Name'],
        qty: row.Qty,
        customerName: row.CustomName,
        groupName: row.Group || null,
        boxNumber: customerToBoxMap.get(row.CustomName) || null // May be NULL for unallocated customers
      }));

      // Create box requirements directly (products table eliminated)
      const boxRequirements = products.map(product => ({
        jobId: product.jobId,
        barCode: product.barCode,
        productName: product.productName,
        requiredQty: product.qty,
        customerName: product.customerName,
        groupName: product.groupName,
        boxNumber: product.boxNumber,
        scannedQty: 0,
        isComplete: false
      }));

      await storage.createBoxRequirements(boxRequirements);

      res.status(201).json({
        job,
        products: products,
        productsCount: jobData.totalProducts, // Use total quantity sum, not CSV row count
        customersCount: jobData.totalCustomers,
        warning: warningMessage, // BOX LIMIT WARNING: Send warning if limit < 80% of customers
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

      // Calculate correct worker index based on assignment order
      const correctWorkerIndex = currentAssignments.length;

      // Create assignment with allocation pattern
      const assignment = await storage.createJobAssignment({
        jobId,
        userId,
        assignedBy: req.user!.id,
        assignedColor: assignedColor || '#3B82F6',
        allocationPattern: allocationPattern || 'ascending',
        workerIndex: correctWorkerIndex, // Use calculated worker index, not frontend provided
        isActive: true,
      });

      console.log(`[Job Assignment] Worker ${userId} assigned to job ${jobId} with ${allocationPattern || 'ascending'} pattern, workerIndex: ${correctWorkerIndex}`);

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

  // Duplicate /api/auth/me endpoint removed - see line 226 for the main implementation

  app.get('/api/jobs', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      let jobs: any[];

      // Apply job visibility filtering based on user role
      if (req.user!.role === 'manager') {
        // Managers see all jobs (including locked ones)
        jobs = await storage.getActiveJobs();
      } else if (req.user!.role === 'supervisor') {
        // Supervisors cannot see locked jobs
        jobs = await storage.getVisibleJobsForSupervisors();
      } else if (req.user!.role === 'worker') {
        // Workers cannot see locked jobs
        jobs = await storage.getVisibleJobsForWorkers();
      } else {
        jobs = [];
      }

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
      console.error('Failed to fetch jobs:', error);
      res.status(500).json({ error: 'Failed to fetch jobs' });
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
        const workerIds = new Set<string>();

        // Collect all worker IDs for batch lookup
        boxRequirements.forEach(req => {
          if (req.lastWorkerUserId) {
            workerIds.add(req.lastWorkerUserId);
          }
        });

        // Get worker info (staffId) for all workers
        const workers = new Map();
        if (workerIds.size > 0) {
          const workerList = await Promise.all(
            Array.from(workerIds).map(id => storage.getUserById(id))
          );
          workerList.forEach(worker => {
            if (worker) {
              workers.set(worker.id, worker);
            }
          });
        }

        for (const req of boxRequirements) {
          const key = `${req.customerName}-${req.boxNumber}`;
          if (!productMap.has(key)) {
            const worker = req.lastWorkerUserId ? workers.get(req.lastWorkerUserId) : null;
            productMap.set(key, {
              id: `${req.customerName}-${req.boxNumber}`, // Synthetic ID for UI
              customerName: req.customerName,
              qty: 0,
              scannedQty: 0,
              boxNumber: req.boxNumber,
              isComplete: true,
              lastWorkerUserId: req.lastWorkerUserId,
              lastWorkerColor: req.lastWorkerColor,
              lastWorkerStaffId: worker?.staffId // Add staffId for UI display
            });
          }

          const product = productMap.get(key);
          product.qty += req.requiredQty;
          product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
          product.isComplete = product.isComplete && req.isComplete;

          // Update worker info if this requirement has more recent worker data
          if (req.lastWorkerUserId) {
            const worker = workers.get(req.lastWorkerUserId);
            product.lastWorkerUserId = req.lastWorkerUserId;
            product.lastWorkerColor = req.lastWorkerColor;
            product.lastWorkerStaffId = worker?.staffId;
          }
        }

        products = Array.from(productMap.values());
      } else {
        // All jobs should have box requirements - empty fallback
        products = [];
      }

      const sessions = await storage.getScanSessionsByJobId(job.id);

      res.json({ job, products, sessions });
    } catch (error) {
      console.error('Failed to fetch job:', error);
      res.status(500).json({ error: 'Failed to fetch job' });
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
      console.error('Failed to update job status:', error);
      res.status(500).json({ message: 'Failed to update job status' });
    }
  });

  // Update job active status for scanning control (includes job locking)
  app.patch('/api/jobs/:id/active', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const { isActive } = req.body;
      const jobId = req.params.id;

      // Get job before updating to check completion status
      const jobBefore = await storage.getJobById(jobId);
      if (!jobBefore) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Update the job status
      const job = await storage.updateJobActiveStatus(jobId, isActive);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Determine if this is a locking/unlocking action for completed jobs
      const isCompleted = job.status === 'completed';
      const isLocking = isCompleted && !isActive; // Locking: completed + isActive=false
      const isUnlocking = isCompleted && isActive; // Unlocking: completed + isActive=true

      if (isLocking) {
        // Job is being locked - terminate worker sessions immediately
        console.log(`[Job Locking] Job ${jobId} is being locked - terminating worker sessions`);

        // Get all assignments for this job to notify assigned workers
        const assignments = await storage.getJobAssignmentsWithUsers(jobId);

        // Send termination messages to all assigned workers
        assignments.forEach((assignment) => {
          broadcastToUser(assignment.userId, {
            type: 'job_locked_session_terminated',
            data: {
              jobId,
              jobName: job.name,
              message: 'Job has been locked by a manager. Your scanning session has been terminated.',
              reason: 'job_locked'
            }
          });
        });

        // Broadcast job locked notification to all supervisors and managers
        broadcastToJob(jobId, {
          type: 'job_locked',
          data: {
            jobId,
            jobName: job.name,
            isActive: false,
            message: 'Job has been locked and is no longer accessible to workers and supervisors'
          }
        });

        console.log(`[Job Locking] Successfully locked job ${jobId}, notified ${assignments.length} workers`);

      } else if (isUnlocking) {
        // Job is being unlocked
        console.log(`[Job Unlocking] Job ${jobId} is being unlocked`);

        broadcastToJob(jobId, {
          type: 'job_unlocked',
          data: {
            jobId,
            jobName: job.name,
            isActive: true,
            message: 'Job has been unlocked and is now accessible'
          }
        });

        console.log(`[Job Unlocking] Successfully unlocked job ${jobId}`);

      } else {
        // Regular scanning control (not locking/unlocking)
        broadcastToJob(job.id, {
          type: 'job_scanning_update',
          data: { jobId: job.id, isActive }
        });
      }

      res.json({
        job,
        action: isLocking ? 'locked' : isUnlocking ? 'unlocked' : (isActive ? 'scanning_activated' : 'scanning_paused')
      });
    } catch (error) {
      console.error('Error updating job active status:', error);
      res.status(500).json({ message: 'Failed to update job scanning status' });
    }
  });

  // REMOVED: Duplicate endpoint - functionality consolidated into the first /active endpoint above

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

      // Filter out assignments with null jobs (deleted jobs) and locked jobs (for workers)
      let validAssignments = assignmentsWithJobs.filter(assignment => assignment.job !== null);

      // Workers cannot see locked jobs in their assignments
      if (req.user!.role === 'worker') {
        validAssignments = validAssignments.filter(assignment => {
          const job = assignment.job;
          // Show job if it's not completed, or if it's completed but not locked (isActive = true)
          return job && (job.status !== 'completed' || job.isActive === true);
        });
      }

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
      const { jobId, sessionId, ...scanEventData } = req.body; // Destructure to get jobId and sessionId

      const eventData = {
        ...scanEventData,
        jobId: jobId,
        sessionId: sessionId,
        userId: req.user!.id, // Assuming worker context
        workerColor: req.body.workerColor || '#3B82F6', // Default color if not provided
        workerStaffId: req.user!.staffId
      };

      // Check for Put Aside items for this barcode and job (using scanEvents approach)
      // This is handled automatically in storage.createScanEvent() - no need to manually check here
      let insertEvent: ScanEvent = eventData as ScanEvent; // Explicitly type as ScanEvent

      const scanEvent = await storage.createScanEvent(insertEvent);

      // Update session statistics
      await storage.updateScanSessionStats(sessionId);

      // Auto-update job status based on scan progress
      await storage.updateJobStatusBasedOnProgress(jobId);

      // Get worker's assigned color from job assignments
      const workerAssignment = await storage.checkExistingAssignment(jobId, req.user!.id);

      // PHASE 1 OPTIMIZATION: Get complete updated data for WebSocket broadcast
      // This eliminates the need for clients to make additional API calls

      // Get updated box requirements (replaces products query)
      const updatedBoxRequirements = await storage.getBoxRequirementsByJobId(jobId);

      // Transform box requirements to product format for UI compatibility
      const updatedProducts: any[] = []; // Explicitly type
      const productMap = new Map();

      // PERFORMANCE FIX: Batch fetch all unique workers to eliminate N+1 queries
      const uniqueWorkerIds = [...new Set(updatedBoxRequirements
        .map(req => req.lastWorkerUserId)
        .filter(id => id !== null))];
      
      const workerMap = new Map();
      if (uniqueWorkerIds.length > 0) {
        const workers = await storage.getUsersByIds(uniqueWorkerIds);
        workers.forEach(worker => workerMap.set(worker.id, worker));
      }

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        if (!productMap.has(key)) {
          const worker = req.lastWorkerUserId ? workerMap.get(req.lastWorkerUserId) : null;
          productMap.set(key, {
            id: `${req.customerName}-${req.boxNumber}`,
            customerName: req.customerName,
            qty: 0,
            scannedQty: 0,
            boxNumber: req.boxNumber,
            isComplete: true,
            lastWorkerUserId: req.lastWorkerUserId,
            lastWorkerColor: req.lastWorkerColor,
            lastWorkerStaffId: worker?.staffId
          });
        }
      }

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        const product = productMap.get(key);
        product.qty += req.requiredQty;
        product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
        product.isComplete = product.isComplete && req.isComplete;

        if (req.lastWorkerUserId) {
          product.lastWorkerUserId = req.lastWorkerUserId;
          product.lastWorkerColor = req.lastWorkerColor;
        }
      }

      const transformedProducts = Array.from(productMap.values());

      // Get worker performance data
      const workerPerformance = await storage.getJobWorkerPerformance(jobId, req.user!.id);

      // PERFORMANCE OPTIMIZATION: Send minimal delta update instead of complete product list
      const affectedBoxes = transformedProducts.filter(product => 
        product.boxNumber === scanEvent.boxNumber || product.lastWorkerUserId === req.user!.id
      );

      // Send optimized update with minimal data payload
      broadcastToJob(String(jobId), {
        type: "scan_update",
        data: {
          scanEvent: {
            id: scanEvent.id,
            barCode: scanEvent.barCode,
            boxNumber: scanEvent.boxNumber,
            eventType: scanEvent.eventType,
            userId: req.user!.id,
            workerColor: workerAssignment?.assignedColor || '#3B82F6',
            workerStaffId: req.user!.staffId,
            consumedPutAside: (insertEvent as any).consumedPutAside || false,
            scanTime: scanEvent.scanTime
          },
          // Only send affected boxes instead of all products (reduces payload ~90%)
          affectedBoxes: affectedBoxes.map(box => ({
            id: box.id,
            boxNumber: box.boxNumber,
            customerName: box.customerName,
            scannedQty: box.scannedQty,
            qty: box.qty,
            isComplete: box.isComplete,
            lastWorkerUserId: box.lastWorkerUserId,
            lastWorkerColor: box.lastWorkerColor,
            lastWorkerStaffId: box.lastWorkerStaffId
          })),
          performance: {
            totalScans: workerPerformance.totalScans,
            scansPerHour: workerPerformance.scansPerHour,
            score: workerPerformance.score
          },
          boxNumber: scanEvent.boxNumber,
          jobId: String(jobId)
        },
        jobId: String(jobId)
      });

      res.json({ scanEvent });
    } catch (error) {
      console.error('Failed to record scan event:', error);
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

      // Enhanced response with event type information for better UI feedback
      const undoneEventsWithTypes = undoneEvents.map((event: any) => ({
        ...event,
        originalEventType: event.eventType === 'undo' ? 'unknown' : event.eventType // Store original type before undo
      }));

      res.json({
        undoneEvents: undoneEventsWithTypes,
        summary: {
          totalUndone: undoneEvents.length,
          scanUndone: undoneEvents.filter((e: any) => e.eventType === 'scan').length,
          extraItemsUndone: undoneEvents.filter((e: any) => e.eventType === 'extra_item').length
        }
      });
    } catch (error) {
      res.status(500).json({ message: 'Failed to undo scan events' });
    }
  });

  // NEW BOX REQUIREMENTS API ENDPOINTS
  app.get('/api/jobs/:id/box-requirements', requireAuth, async (req, res) => {
    try {
      const boxRequirements = await storage.getBoxRequirementsByJobId(req.params.id);

      // Get unique worker IDs from box requirements
      const workerIds = new Set<string>();
      boxRequirements.forEach(req => {
        if (req.lastWorkerUserId) {
          workerIds.add(req.lastWorkerUserId);
        }
      });

      // Fetch worker details for those IDs
      const workers = new Map();
      if (workerIds.size > 0) {
        const workerList = await Promise.all(
          Array.from(workerIds).map(id => storage.getUserById(id))
        );
        workerList.forEach(worker => {
          if (worker) {
            workers.set(worker.id, {
              id: worker.id,
              name: worker.name,
              staffId: worker.staffId
            });
          }
        });
      }

      res.json({ boxRequirements, workers: Object.fromEntries(workers) });
    } catch (error) {
      console.error('Failed to fetch box requirements:', error);
      res.status(500).json({ error: 'Failed to fetch box requirements' });
    }
  });

  // Migration endpoint removed - all jobs now use box requirements system

  app.post('/api/jobs/:id/find-target-box', requireAuth, requireRole(['worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const { barCode } = req.body;
      const targetBox = await storage.findNextTargetBox(barCode, req.params.id, req.user!.id);

      if (targetBox === null) {
        return res.status(404).json({ message: 'No available target box found for this item' });
      }

      res.json({ targetBox });
    } catch (error) {
      console.error('Failed to find target box:', error);
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

  // CheckCount API Routes
  // Check session management
  app.post('/api/check-sessions', requireAuth, requireRole(['manager', 'supervisor', 'worker']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, boxNumber, totalItemsExpected } = req.body;

      // Verify user has permission to perform checks
      if (req.user!.role === 'worker') {
        const preferences = await storage.getUserPreferences(req.user!.id);
        if (!preferences?.checkBoxEnabled) {
          return res.status(403).json({ message: 'Check box permission not enabled for this worker' });
        }
      }

      const sessionData = {
        jobId,
        boxNumber: parseInt(boxNumber),
        userId: req.user!.id,
        totalItemsExpected: parseInt(totalItemsExpected),
        status: 'active'
      };

      const session = await storage.createCheckSession(sessionData);
      res.status(201).json({ session });
    } catch (error) {
      console.error('Failed to create check session:', error);
      res.status(500).json({ message: 'Failed to create check session' });
    }
  });

  app.get('/api/check-sessions/:id', requireAuth, async (req, res) => {
    try {
      const session = await storage.getCheckSessionById(req.params.id);

      if (!session) {
        return res.status(404).json({ message: 'Check session not found' });
      }

      res.json({ session });
    } catch (error) {
      console.error('Failed to fetch check session:', error);
      res.status(500).json({ error: 'Failed to fetch check session' });
    }
  });

  app.get('/api/check-sessions', requireAuth, async (req, res) => {
    try {
      const { jobId } = req.query;
      if (!jobId) {
        return res.status(400).json({ message: 'jobId query parameter required' });
      }

      const sessions = await storage.getCheckSessionsByJobId(jobId as string);
      res.json({ sessions });
    } catch (error) {
      console.error('Failed to fetch check sessions:', error);
      res.status(500).json({ error: 'Failed to fetch check sessions' });
    }
  });

  app.patch('/api/check-sessions/:id', requireAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const session = await storage.updateCheckSessionStatus(req.params.id, status);

      if (!session) {
        return res.status(404).json({ message: 'Check session not found' });
      }

      res.json({ session });
    } catch (error) {
      console.error('Failed to update check session:', error);
      res.status(500).json({ message: 'Failed to update check session' });
    }
  });

  app.post('/api/check-sessions/:id/complete', requireAuth, async (req, res) => {
    try {
      const { discrepanciesFound, applyCorrections, corrections, extraItems } = req.body;
      const session = await storage.completeCheckSession(
        req.params.id,
        new Date(),
        parseInt(discrepanciesFound) || 0,
        applyCorrections
      );

      if (!session) {
        return res.status(404).json({ message: 'Check session not found' });
      }

      // Create check results for ALL discrepancies (whether applied or rejected)
      if (corrections && corrections.length > 0) {
        if (applyCorrections) {
          // Apply corrections and update box requirements
          await storage.applyCheckCorrections(session.jobId, session.boxNumber, corrections, session.userId, (req as AuthenticatedRequest).user!.id);
        } else {
          // Create check results for rejected corrections
          await storage.createRejectedCheckResults(session.id, corrections, (req as AuthenticatedRequest).user!.id);
        }
      } else if (discrepanciesFound === 0) {
        // No discrepancies found - create success check result for this box
        const boxReqs = await storage.getBoxRequirementsByBoxNumber(session.jobId, session.boxNumber);
        for (const boxReq of boxReqs) {
          await storage.createCheckResult({
            checkSessionId: session.id,
            boxRequirementId: boxReq.id,
            finalQty: boxReq.scannedQty || 0,
            discrepancyNotes: 'No discrepancies found - verified successfully',
            resolutionAction: 'verified_complete',
            resolvedBy: (req as AuthenticatedRequest).user!.id
          });
        }
      }

      // If extra items found, create them as scan events for the job
      if (extraItems && extraItems.length > 0) {
        await storage.createExtraItemsFromCheck(session.jobId, extraItems, session.userId);
      }

      // Broadcast CheckCount completion with corrections to all monitoring interfaces
      if (applyCorrections && corrections && corrections.length > 0) {
        // Get updated job progress for real-time updates
        const updatedProgress = await storage.getJobProgress(session.jobId);

        broadcastToJob(session.jobId, {
          type: 'check_count_update',
          data: {
            sessionId: session.id,
            boxNumber: session.boxNumber,
            applyCorrections,
            corrections,
            extraItems: extraItems || [],
            extraItemsCount: extraItems ? extraItems.length : 0,
            progress: updatedProgress,
            timestamp: new Date().toISOString(),
            userId: session.userId,
            userName: (req as AuthenticatedRequest).user!.name
          }
        });
      }

      res.json({ session });
    } catch (error) {
      console.error('Failed to complete check session:', error);
      res.status(500).json({ message: 'Failed to complete check session' });
    }
  });

  // Check events
  app.post('/api/check-events', requireAuth, async (req, res) => {
    try {
      const eventData = req.body;
      const checkEvent = await storage.createCheckEvent(eventData);

      res.status(201).json({ checkEvent });
    } catch (error) {
      console.error('Failed to create check event:', error);
      res.status(500).json({ message: 'Failed to create check event' });
    }
  });

  app.get('/api/check-sessions/:id/events', requireAuth, async (req, res) => {
    try {
      const events = await storage.getCheckEventsBySessionId(req.params.id);
      res.json({ events });
    } catch (error) {
      console.error('Failed to fetch check events:', error);
      res.status(500).json({ error: 'Failed to fetch check events' });
    }
  });

  // Check results
  app.post('/api/check-results', requireAuth, async (req, res) => {
    try {
      const resultData = req.body;
      const checkResult = await storage.createCheckResult(resultData);

      res.status(201).json({ checkResult });
    } catch (error) {
      console.error('Failed to create check result:', error);
      res.status(500).json({ message: 'Failed to create check result' });
    }
  });

  app.get('/api/check-sessions/:id/results', requireAuth, async (req, res) => {
    try {
      const results = await storage.getCheckResultsBySessionId(req.params.id);
      res.json({ results });
    } catch (error) {
      console.error('Failed to fetch check results:', error);
      res.status(500).json({ error: 'Failed to fetch check results' });
    }
  });

  // QA Reporting endpoints
  app.get('/api/qa/summary', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const summary = await storage.getQASummary();
      res.json(summary);
    } catch (error) {
      console.error('Failed to generate QA summary:', error);
      res.status(500).json({ message: 'Failed to generate QA summary' });
    }
  });

  app.get('/api/jobs/:id/qa-report', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const report = await storage.getJobQAReport(req.params.id);
      res.json({ report });
    } catch (error) {
      console.error('Failed to generate QA report:', error);
      res.status(500).json({ message: 'Failed to generate QA report' });
    }
  });

  app.get('/api/jobs/:id/check-sessions', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const sessions = await storage.getCheckSessionsByJobId(req.params.id);
      res.json({ sessions });
    } catch (error) {
      console.error('Failed to fetch check sessions:', error);
      res.status(500).json({ error: 'Failed to fetch check sessions' });
    }
  });

  app.get('/api/jobs/:id/discrepancy-report', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const report = await storage.getDiscrepancyReport(req.params.id);
      res.json({ report });
    } catch (error) {
      console.error('Failed to generate discrepancy report:', error);
      res.status(500).json({ message: 'Failed to generate discrepancy report' });
    }
  });

  // User preferences update for checkBoxEnabled
  app.patch('/api/users/:id/preferences', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const { checkBoxEnabled, canEmptyAndTransfer } = req.body; // Added canEmptyAndTransfer
      const updates: any = {};

      if (checkBoxEnabled !== undefined) updates.checkBoxEnabled = checkBoxEnabled;
      if (canEmptyAndTransfer !== undefined) updates.canEmptyAndTransfer = canEmptyAndTransfer;

      const preferences = await storage.updateUserPreferences(req.params.id, updates);

      if (!preferences) {
        return res.status(404).json({ message: 'User preferences not found' });
      }

      res.json({ preferences });
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      res.status(500).json({ message: 'Failed to update user preferences' });
    }
  });

  // Performance and reporting
  app.get('/api/scan-sessions/:id/performance', requireAuth, async (req, res) => {
    try {
      const performance = await storage.getSessionPerformance(req.params.id);
      res.json({ performance });
    } catch (error) {
      console.error('Failed to fetch performance data:', error);
      res.status(500).json({ message: 'Failed to fetch performance data' });
    }
  });

  // Job-specific worker performance endpoint
  app.get('/api/jobs/:jobId/worker-performance/:userId', requireAuth, async (req, res) => {
    try {
      const { jobId, userId } = req.params;
      const performance = await storage.getJobWorkerPerformance(jobId, userId);
      res.json({ performance });
    } catch (error) {
      console.error('Failed to fetch job worker performance:', error);
      res.status(500).json({ message: 'Failed to fetch job worker performance' });
    }
  });

  app.get('/api/jobs/:id/progress', requireAuth, async (req, res) => {
    try {
      const progressData = await storage.getJobProgress(req.params.id);
      res.json(progressData);
    } catch (error) {
      console.error('Failed to fetch job progress:', error);
      res.status(500).json({ message: 'Failed to fetch job progress' });
    }
  });

  // BOX LIMIT: Get unallocated customers for Customer Queue
  app.get('/api/jobs/:id/unallocated-customers', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const unallocatedCustomers = await storage.getUnallocatedCustomers(req.params.id);
      res.json({ customers: unallocatedCustomers });
    } catch (error) {
      console.error('Failed to fetch unallocated customers:', error);
      res.status(500).json({ message: 'Failed to fetch unallocated customers' });
    }
  });

  // BOX LIMIT: Get product details for a specific unallocated customer
  app.get('/api/jobs/:id/customers/:customerName/products', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const products = await storage.getCustomerProductDetails(req.params.id, req.params.customerName);
      res.json({ products });
    } catch (error) {
      console.error('Failed to fetch customer product details:', error);
      res.status(500).json({ message: 'Failed to fetch customer product details' });
    }
  });

  // Get customer progress data for Customer Progress modal
  app.get('/api/jobs/:id/customer-progress', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const progressData = await storage.getCustomerProgressData(req.params.id);
      res.json(progressData);
    } catch (error) {
      console.error('Failed to fetch customer progress data:', error);
      res.status(500).json({ message: 'Failed to fetch customer progress data' });
    }
  });

  // Get non-scanned items data for Non Scanned Report modal
  app.get('/api/jobs/:id/non-scanned-report', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const nonScannedData = await storage.getNonScannedItems(req.params.id);
      res.json(nonScannedData);
    } catch (error) {
      console.error('Failed to fetch non-scanned items data:', error);
      res.status(500).json({ message: 'Failed to fetch non-scanned items data' });
    }
  });

  // Extra Items endpoints (NEW)
  app.get('/api/jobs/:id/extra-items', requireAuth, requireRole(['manager', 'supervisor']), async (req, res) => {
    try {
      const extraItems = await storage.getExtraItemsDetails(req.params.id);
      res.json({ extraItems });
    } catch (error) {
      console.error('Failed to fetch extra items:', error);
      res.status(500).json({ message: 'Failed to fetch extra items' });
    }
  });

  // User preferences update for checkBoxEnabled
  app.patch('/api/users/:id/preferences', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const { checkBoxEnabled, canEmptyAndTransfer } = req.body;
      const updates: any = {};

      if (checkBoxEnabled !== undefined) updates.checkBoxEnabled = checkBoxEnabled;
      if (canEmptyAndTransfer !== undefined) updates.canEmptyAndTransfer = canEmptyAndTransfer;

      const preferences = await storage.updateUserPreferences(req.params.id, updates);

      if (!preferences) {
        return res.status(404).json({ message: 'User preferences not found' });
      }

      res.json({ preferences });
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      res.status(500).json({ message: 'Failed to update user preferences' });
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
          canEmptyAndTransfer: false // Default value for the new preference
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
      console.log('[API] Updating preferences for user:', req.user.id, 'with data:', updates);

      const updatedPreferences = await storage.updateUserPreferences(req.user.id, updates);

      if (!updatedPreferences) {
        return res.status(404).json({ error: "User preferences not found" });
      }

      console.log('[API] Updated preferences result:', updatedPreferences);
      res.json({ preferences: updatedPreferences });
    } catch (error) {
      console.error('Error updating user preferences:', error);
      res.status(500).json({ error: "Failed to update preferences" });
    }
  });

  // User management - consolidated endpoint with optional role filtering
  app.get('/api/users', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const { role } = req.query;

      if (role && typeof role === 'string') {
        // Filter by role if specified
        const users = await storage.getUsersByRole(role);
        // Always return consistent format: {users: [...]}
        res.json({ users });
      } else {
        // Return all users with preferences for management interface
        const users = await storage.getAllUsersWithPreferences();
        res.json({ users });
      }
    } catch (error) {
      console.error('Failed to fetch users:', error);
      res.status(500).json({ message: 'Failed to fetch users' });
    }
  });

  // REMOVED: Duplicate /api/users endpoint - consolidated with the one above

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
      console.error('Failed to create user:', error);
      res.status(500).json({ message: 'Failed to create user' });
    }
  });

  app.put('/api/users/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { staffId, name, role, pin, checkBoxEnabled } = req.body;
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

      // Update user preferences if checkBoxEnabled is provided (only for workers)
      if (role === 'worker' && checkBoxEnabled !== undefined) {
        await storage.updateUserPreferences(userId, { checkBoxEnabled });
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
      console.error('Failed to update user:', error);
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
      console.error('Failed to delete user:', error);
      res.status(500).json({ message: 'Failed to delete user' });
    }
  });

  // Job Types API routes (Manager only)
  app.get('/api/job-types', requireAuth, async (req, res) => {
    try {
      const jobTypes = await storage.getJobTypes();
      res.json({ jobTypes });
    } catch (error) {
      console.error('Failed to fetch job types:', error);
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
      console.error('Failed to create job type:', error);
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
      console.error('Failed to update job type:', error);
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
      console.error('Failed to delete job type:', error);
      res.status(500).json({ message: 'Failed to delete job type' });
    }
  });

  // ========================
  // BOX EMPTY/TRANSFER ROUTES
  // ========================

  // Permission check helper for box management
  const canEmptyAndTransfer = (user: any, userPreferences: any) => {
    // Managers and supervisors always have access
    if (user.role === 'manager' || user.role === 'supervisor') return true;
    // Workers need explicit permission
    return user.role === 'worker' && userPreferences?.canEmptyAndTransfer === true;
  };

  // Empty box endpoint
  app.post('/api/jobs/:jobId/boxes/:boxNumber/empty', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, boxNumber } = req.params;

      // Check permissions
      const userPreferences = await storage.getUserPreferences(req.user!.id);
      if (!canEmptyAndTransfer(req.user!, userPreferences)) {
        return res.status(403).json({ message: 'Insufficient permissions to empty boxes' });
      }

      // Validate job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Validate box number
      const boxNum = parseInt(boxNumber);
      if (isNaN(boxNum) || boxNum <= 0) {
        return res.status(400).json({ message: 'Invalid box number' });
      }

      // Check if box has content to empty
      const boxRequirements = await storage.getBoxRequirementsByBoxNumber(jobId, boxNum);
      if (boxRequirements.length === 0) {
        return res.status(404).json({ message: 'Box not found or empty' });
      }

      // Perform empty operation with automatic reallocation
      const emptyResult = await storage.emptyBox(jobId, boxNum, req.user!.id);

      // PHASE 1 OPTIMIZATION: Get complete updated data for WebSocket broadcast
      // This follows the proven scan_update pattern for instant UI updates
      const updatedBoxRequirements = await storage.getBoxRequirementsByJobId(jobId);

      // Transform box requirements to product format for UI compatibility
      const updatedProducts: any[] = []; // Explicitly type
      const productMap = new Map();

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        if (!productMap.has(key)) {
          const worker = req.lastWorkerUserId ? await storage.getUserById(req.lastWorkerUserId) : null;
          productMap.set(key, {
            id: `${req.customerName}-${req.boxNumber}`,
            customerName: req.customerName,
            qty: 0,
            scannedQty: 0,
            boxNumber: req.boxNumber,
            isComplete: true,
            lastWorkerUserId: req.lastWorkerUserId,
            lastWorkerColor: req.lastWorkerColor,
            lastWorkerStaffId: worker?.staffId
          });
        }
      }

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        const product = productMap.get(key);
        product.qty += req.requiredQty;
        product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
        product.isComplete = product.isComplete && req.isComplete;

        if (req.lastWorkerUserId) {
          product.lastWorkerUserId = req.lastWorkerUserId;
          product.lastWorkerColor = req.lastWorkerColor;
        }
      }

      const transformedProducts = Array.from(productMap.values());

      // Broadcast real-time update with complete data (like scan_update)
      broadcastToJob(jobId, {
        type: 'box_emptied',
        data: {
          boxNumber: boxNum,
          performedBy: req.user!.name,
          timestamp: new Date().toISOString(),
          jobId,
          products: transformedProducts // NEW: Include products data for instant UI updates
        }
      });

      res.json({
        success: true,
        message: emptyResult.message,
        history: emptyResult.history,
        reallocation: emptyResult.reallocation
      });
    } catch (error: any) {
      console.error('Box empty error:', error);
      res.status(500).json({
        message: error.message || 'Failed to empty box'
      });
    }
  });

  // Transfer box to group endpoint
  app.post('/api/jobs/:jobId/boxes/:boxNumber/transfer', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, boxNumber } = req.params;

      // Check permissions
      const userPreferences = await storage.getUserPreferences(req.user!.id);
      console.log(`[Transfer Permission Debug] User: ${req.user!.id}, Role: ${req.user!.role}, canEmptyAndTransfer: ${userPreferences?.canEmptyAndTransfer}`);

      if (!canEmptyAndTransfer(req.user!, userPreferences)) {
        console.log(`[Transfer Permission Debug] Permission denied for user ${req.user!.id} with role ${req.user!.role}`);
        return res.status(403).json({
          message: 'Insufficient permissions to transfer boxes',
          debug: {
            userId: req.user!.id,
            role: req.user!.role,
            canEmptyAndTransfer: userPreferences?.canEmptyAndTransfer
          }
        });
      }
      console.log(`[Transfer Permission Debug] Permission granted for user ${req.user!.id}`);

      // Auto-detect customer's group from database - no manual selection required

      // Validate job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Validate box number
      const boxNum = parseInt(boxNumber);
      if (isNaN(boxNum) || boxNum <= 0) {
        return res.status(400).json({ message: 'Invalid box number' });
      }

      // Check if box has content to transfer
      const boxRequirements = await storage.getBoxRequirementsByBoxNumber(jobId, boxNum);
      if (boxRequirements.length === 0) {
        return res.status(404).json({ message: 'Box not found or empty' });
      }

      // Auto-detect customer's group from existing data
      const customerGroup = boxRequirements[0]?.groupName;
      if (!customerGroup) {
        return res.status(400).json({ message: 'Customer has no group assigned from CSV data. Cannot transfer.' });
      }

      // Perform transfer operation with automatic reallocation
      const transferResult = await storage.transferBoxToGroup(jobId, boxNum, customerGroup, req.user!.id);

      // PHASE 1 OPTIMIZATION: Get complete updated data for WebSocket broadcast
      // This follows the proven scan_update pattern for instant UI updates
      const updatedBoxRequirements = await storage.getBoxRequirementsByJobId(jobId);

      // Transform box requirements to product format for UI compatibility
      const updatedProducts: any[] = []; // Explicitly type
      const productMap = new Map();

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        if (!productMap.has(key)) {
          const worker = req.lastWorkerUserId ? await storage.getUserById(req.lastWorkerUserId) : null;
          productMap.set(key, {
            id: `${req.customerName}-${req.boxNumber}`,
            customerName: req.customerName,
            qty: 0,
            scannedQty: 0,
            boxNumber: req.boxNumber,
            isComplete: true,
            lastWorkerUserId: req.lastWorkerUserId,
            lastWorkerColor: req.lastWorkerColor,
            lastWorkerStaffId: worker?.staffId
          });
        }
      }

      for (const req of updatedBoxRequirements) {
        const key = `${req.customerName}-${req.boxNumber}`;
        const product = productMap.get(key);
        product.qty += req.requiredQty;
        product.scannedQty += Math.min(req.scannedQty || 0, req.requiredQty);
        product.isComplete = product.isComplete && req.isComplete;

        if (req.lastWorkerUserId) {
          product.lastWorkerUserId = req.lastWorkerUserId;
          product.lastWorkerColor = req.lastWorkerColor;
        }
      }

      const transformedProducts = Array.from(productMap.values());

      // Broadcast real-time update with complete data (like scan_update)
      broadcastToJob(jobId, {
        type: 'box_transferred',
        data: {
          boxNumber: boxNum,
          targetGroup: customerGroup,
          performedBy: req.user!.name,
          timestamp: new Date().toISOString(),
          jobId,
          products: transformedProducts // NEW: Include products data for instant UI updates
        }
      });

      res.json({
        success: true,
        message: transferResult.message,
        history: transferResult.history,
        reallocation: transferResult.reallocation
      });
    } catch (error: any) {
      console.error('Box transfer error:', error);
      res.status(500).json({
        message: error.message || 'Failed to transfer box'
      });
    }
  });

  // Get box history endpoint
  app.get('/api/jobs/:jobId/boxes/:boxNumber/history', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, boxNumber } = req.params;

      // Validate job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Validate box number
      const boxNum = parseInt(boxNumber);
      if (isNaN(boxNum) || boxNum <= 0) {
        return res.status(400).json({ message: 'Invalid box number' });
      }

      // Get box history
      const history = await storage.getBoxHistoryByBoxNumber(jobId, boxNum);

      res.json({
        success: true,
        boxNumber: boxNum,
        history
      });
    } catch (error: any) {
      console.error('Box history fetch error:', error);
      res.status(500).json({
        message: error.message || 'Failed to fetch box history'
      });
    }
  });

  // Update user preferences to include canEmptyAndTransfer
  app.patch('/api/users/:id/preferences', requireAuth, requireRole(['manager']), async (req, res) => {
    try {
      const { checkBoxEnabled, canEmptyAndTransfer } = req.body;
      const updates: any = {};

      if (checkBoxEnabled !== undefined) updates.checkBoxEnabled = checkBoxEnabled;
      if (canEmptyAndTransfer !== undefined) updates.canEmptyAndTransfer = canEmptyAndTransfer;

      const preferences = await storage.updateUserPreferences(req.params.id, updates);

      if (!preferences) {
        return res.status(404).json({ message: 'User preferences not found' });
      }

      res.json({ preferences });
    } catch (error) {
      console.error('Failed to update user preferences:', error);
      res.status(500).json({ message: 'Failed to update user preferences' });
    }
  });

  // ========================
  // JOB ARCHIVE ROUTES
  // ========================

  // Get all job archives
  app.get('/api/archives', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const archives = await storage.getJobArchives();

      // Include worker stats for each archive
      const archivesWithStats = await Promise.all(
        archives.map(async (archive) => {
          const workerStats = await storage.getArchiveWorkerStatsByArchiveId(archive.id);
          return {
            ...archive,
            workerStats
          };
        })
      );

      res.json({ archives: archivesWithStats });
    } catch (error) {
      console.error('Failed to fetch job archives:', error);
      res.status(500).json({ message: 'Failed to fetch job archives' });
    }
  });

  // Get single job archive with details
  app.get('/api/archives/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const archive = await storage.getJobArchiveById(req.params.id);
      if (!archive) {
        return res.status(404).json({ message: 'Archive not found' });
      }

      const workerStats = await storage.getArchiveWorkerStatsByArchiveId(archive.id);

      res.json({
        archive: {
          ...archive,
          workerStats
        }
      });
    } catch (error) {
      console.error('Failed to fetch job archive:', error);
      res.status(500).json({ message: 'Failed to fetch job archive' });
    }
  });

  // Archive a job manually
  app.post('/api/jobs/:jobId/archive', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;

      // Check if job exists
      const job = await storage.getJobById(jobId);
      if (!job) {
        return res.status(404).json({ message: 'Job not found' });
      }

      // Create archive with comprehensive data
      const archive = await storage.archiveJob(jobId, req.user!.id);

      res.status(201).json({
        archive,
        message: 'Job archived successfully'
      });
    } catch (error: any) {
      console.error('Failed to archive job:', error);
      res.status(500).json({
        message: error.message || 'Failed to archive job'
      });
    }
  });

  // Unarchive a job (restore to active jobs)
  app.post('/api/archives/:id/unarchive', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const archiveId = req.params.id;

      const success = await storage.unarchiveJob(archiveId);

      if (!success) {
        return res.status(400).json({ message: 'Failed to unarchive job. Archive may be purged or missing snapshot data.' });
      }

      res.json({ message: 'Job unarchived successfully' });
    } catch (error: any) {
      console.error('Failed to unarchive job:', error);
      res.status(500).json({
        message: error.message || 'Failed to unarchive job'
      });
    }
  });

  // Purge job data (remove snapshot, keep summary)
  app.delete('/api/archives/:id/purge', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const archiveId = req.params.id;

      const success = await storage.purgeJobData(archiveId);

      if (!success) {
        return res.status(404).json({ message: 'Archive not found' });
      }

      res.json({ message: 'Job data purged successfully. Summary retained.' });
    } catch (error) {
      console.error('Failed to purge job data:', error);
      res.status(500).json({ message: 'Failed to purge job data' });
    }
  });

  // Delete archive completely
  app.delete('/api/archives/:id', requireAuth, requireRole(['manager']), async (req: AuthenticatedRequest, res) => {
    try {
      const archiveId = req.params.id;

      const success = await storage.deleteJobArchive(archiveId);

      if (!success) {
        return res.status(404).json({ message: 'Archive not found' });
      }

      res.json({ message: 'Archive deleted successfully' });
    } catch (error) {
      console.error('Failed to delete archive:', error);
      res.status(500).json({ message: 'Failed to delete archive' });
    }
  });

  // ============== DUPLICATE ENDPOINTS REMOVED ==============
  // Box Empty/Transfer endpoints are defined above with automatic reallocation

  // Get box history for a specific box
  app.get('/api/jobs/:jobId/boxes/:boxNumber/history', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, boxNumber } = req.params;
      const history = await storage.getBoxHistoryByBoxNumber(jobId, parseInt(boxNumber));
      res.json({ history });
    } catch (error) {
      console.error('Failed to fetch box history:', error);
      res.status(500).json({ message: 'Failed to fetch box history' });
    }
  });

  // ============== PUT ASIDE API ENDPOINTS (NEW scan_events approach) ==============

  // Get put aside items for a job
  app.get('/api/jobs/:jobId/put-aside', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const items = await storage.getPutAsideItemsForJob(jobId);
      res.json({ items });
    } catch (error) {
      console.error('Failed to fetch put aside items:', error);
      res.status(500).json({ message: 'Failed to fetch put aside items' });
    }
  });

  // Get put aside count for a job
  app.get('/api/jobs/:jobId/put-aside/count', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const count = await storage.getPutAsideCount(jobId);
      res.json({ count });
    } catch (error) {
      console.error('Failed to fetch put aside count:', error);
      res.status(500).json({ message: 'Failed to fetch put aside count' });
    }
  });

  // Check if a barcode requires put aside (for unallocated customers)
  app.post('/api/jobs/:jobId/check-put-aside', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const { barCode } = req.body;

      if (!barCode) {
        return res.status(400).json({ message: 'Barcode is required' });
      }

      const requiresPutAside = await storage.checkUnallocatedCustomerRequirements(jobId, barCode);
      res.json({ requiresPutAside });
    } catch (error) {
      console.error('Failed to check put aside requirement:', error);
      res.status(500).json({ message: 'Failed to check put aside requirement' });
    }
  });

  // Mark put aside item as allocated to a box
  app.post('/api/put-aside/:eventId/allocate', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { eventId } = req.params;
      const { boxNumber } = req.body;

      if (!boxNumber) {
        return res.status(400).json({ message: 'Box number is required' });
      }

      const allocatedEvent = await storage.markPutAsideAllocated(eventId, parseInt(boxNumber));

      if (!allocatedEvent) {
        return res.status(404).json({ message: 'Put aside item not found' });
      }

      // Broadcast allocation event
      broadcastToJob(allocatedEvent.jobId!, {
        type: 'put_aside_allocated',
        data: {
          allocatedEvent,
          boxNumber: parseInt(boxNumber),
          performedBy: req.user!.name,
          timestamp: new Date().toISOString()
        }
      });

      res.json({
        success: true,
        allocatedEvent,
        message: `Put aside item allocated to box ${boxNumber}`
      });
    } catch (error) {
      console.error('Failed to reallocate put aside item:', error);
      res.status(500).json({ message: 'Failed to reallocate put aside item' });
    }
  });

  // Get job groups
  app.get('/api/jobs/:jobId/groups', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId } = req.params;
      const groups = await storage.getJobGroups(jobId);
      res.json({ groups });
    } catch (error) {
      console.error('Failed to fetch job groups:', error);
      res.status(500).json({ message: 'Failed to fetch job groups' });
    }
  });

  // Get customers in a group
  app.get('/api/jobs/:jobId/groups/:groupName/customers', requireAuth, async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, groupName } = req.params;
      const customers = await storage.getGroupCustomers(jobId, groupName);
      res.json({ customers });
    } catch (error) {
      console.error('Failed to fetch group customers:', error);
      res.status(500).json({ message: 'Failed to fetch group customers' });
    }
  });

  // Export group data to Excel
  app.get('/api/jobs/:jobId/groups/:groupName/export', requireAuth, requireRole(['manager', 'supervisor']), async (req: AuthenticatedRequest, res) => {
    try {
      const { jobId, groupName } = req.params;

      // Get all customers in the group
      const customers = await storage.getGroupCustomers(jobId, groupName);

      if (customers.length === 0) {
        return res.status(404).json({ message: 'No customers found in this group' });
      }

      // Group customers by CustomName
      const groupedCustomers = customers.reduce((acc: any, customer) => {
        const key = customer.customerName;
        if (!acc[key]) {
          acc[key] = [];
        }
        acc[key].push({
          BarCode: customer.barCode,
          ProductName: customer.productName,
          Qty: customer.requiredQty,
          ScannedQty: customer.scannedQty || 0,
          BoxNumber: customer.boxNumber
        });
        return acc;
      }, {});

      // Format for Excel export
      const exportData = Object.entries(groupedCustomers).map(([customName, items]) => ({
        GroupName: groupName,
        CustomName: customName,
        Items: items,
        TotalQty: (items as any[]).reduce((sum, item) => sum + item.Qty, 0),
        TotalScanned: (items as any[]).reduce((sum, item) => sum + item.ScannedQty, 0)
      }));

      res.json({
        groupName,
        exportData,
        summary: {
          totalCustomers: Object.keys(groupedCustomers).length,
          totalItems: customers.length,
          totalQty: customers.reduce((sum, c) => sum + c.requiredQty, 0),
          totalScanned: customers.reduce((sum, c) => sum + (c.scannedQty || 0), 0)
        }
      });
    } catch (error) {
      console.error('Failed to export group data:', error);
      res.status(500).json({ message: 'Failed to export group data' });
    }
  });

  return httpServer;
}