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

  wss.on('connection', (ws) => {
    const clientId = Math.random().toString(36).substring(7);
    
    ws.on('message', async (message) => {
      try {
        const data = JSON.parse(message.toString()) as WSMessage;
        
        if (data.type === 'authenticate') {
          connectedClients.set(clientId, { 
            ws, 
            userId: data.data.userId,
            jobId: data.data.jobId 
          });
        }
        
        if (data.type === 'scan_event') {
          // Broadcast scan event to all clients monitoring this job
          broadcastToJob(data.jobId!, {
            type: 'scan_update',
            data: data.data
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    ws.on('close', () => {
      connectedClients.delete(clientId);
    });
  });

  function broadcastToJob(jobId: string, message: WSMessage) {
    connectedClients.forEach((client) => {
      if (client.jobId === jobId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(message));
      }
    });
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

  app.get('/api/auth/me', requireAuth, async (req, res) => {
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
  app.post('/api/jobs', requireAuth, requireRole(['manager']), upload.single('csv'), async (req, res) => {
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

      // Create job
      const jobData = {
        name: req.body.name || `Job ${new Date().toISOString().split('T')[0]}`,
        description: req.body.description || '',
        totalProducts: csvData.length,
        totalCustomers: Array.from(new Set(csvData.map(row => row.CustomName))).length,
        csvData,
        createdBy: req.user!.id
      };

      const job = await storage.createJob(jobData);

      // Create products from CSV data
      const products = csvData.map((row, index) => ({
        jobId: job.id,
        barCode: row.BarCode,
        productName: row['Product Name'],
        qty: row.Qty,
        customerName: row.CustomName,
        groupName: row.Group || null,
        boxNumber: Math.floor(index / 8) + 1 // Auto-assign to boxes (8 boxes max)
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

  app.get('/api/auth/me', requireAuth, async (req, res) => {
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
      res.json({ jobs });
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
      
      const products = await storage.getProductsByJobId(job.id);
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

  // Job assignments
  app.post('/api/jobs/:id/assignments', requireAuth, requireRole(['manager']), async (req, res) => {
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

  // Scanning routes
  app.post('/api/scan-sessions', requireAuth, requireRole(['worker']), async (req, res) => {
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

  app.get('/api/scan-sessions/my-active', requireAuth, requireRole(['worker']), async (req, res) => {
    try {
      const session = await storage.getActiveScanSession(req.user!.id);
      res.json({ session });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch active session' });
    }
  });

  app.post('/api/scan-events', requireAuth, requireRole(['worker']), async (req, res) => {
    try {
      const eventData = req.body;
      const scanEvent = await storage.createScanEvent(eventData);
      
      // Update session statistics
      await storage.updateScanSessionStats(eventData.sessionId);
      
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

  app.post('/api/scan-events/undo', requireAuth, requireRole(['worker']), async (req, res) => {
    try {
      const { sessionId, count = 1 } = req.body;
      
      const undoneEvents = await storage.undoScanEvents(sessionId, count);
      await storage.updateScanSessionStats(sessionId);

      // Broadcast undo event
      const session = await storage.getScanSessionById(sessionId);
      if (session) {
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
      const progress = await storage.getJobProgress(req.params.id);
      res.json({ progress });
    } catch (error) {
      res.status(500).json({ message: 'Failed to fetch job progress' });
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

  app.post('/api/users', requireAuth, requireRole(['manager']), async (req, res) => {
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

  app.put('/api/users/:id', requireAuth, requireRole(['manager']), async (req, res) => {
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

  app.delete('/api/users/:id', requireAuth, requireRole(['manager']), async (req, res) => {
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

  return httpServer;
}
