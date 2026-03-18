import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "npm:@supabase/supabase-js@2";
import * as kv from "./kv_store.tsx";
import * as docusign from "./docusign.tsx";

const app = new Hono();

// Initialize Supabase client
const supabase = createClient(
  Deno.env.get("SUPABASE_URL") ?? "",
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
);

// Enable logger
app.use('*', logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  }),
);

// Health check endpoint
app.get("/make-server-9d56a30d/health", (c) => {
  return c.json({ status: "ok" });
});

// ==========================================
// Authentication Middleware
// ==========================================

/**
 * Middleware to verify auth token and extract user
 */
const requireAuth = async (c: any, next: any) => {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ error: "Unauthorized - No token provided" }, 401);
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      console.error("Auth verification failed:", error);
      return c.json({ error: "Unauthorized - Invalid token" }, 401);
    }
    
    // Store user in context for downstream handlers
    c.set("user", user);
    await next();
  } catch (error: any) {
    console.error("Auth middleware error:", error);
    return c.json({ error: "Unauthorized - Auth check failed" }, 401);
  }
};

// ==========================================
// Authentication Routes
// ==========================================

/**
 * User signup - creates new auth user
 */
app.post("/make-server-9d56a30d/auth/signup", async (c) => {
  try {
    const body = await c.req.json();
    const { email, password, name, role } = body;
    
    if (!email || !password) {
      return c.json({ error: "Email and password are required" }, 400);
    }
    
    // Create user with admin privileges (SERVICE_ROLE_KEY)
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      user_metadata: { 
        name: name || email.split("@")[0],
        role: role || "user"
      },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true
    });
    
    if (error) {
      console.error("Signup error:", error);
      return c.json({ error: error.message }, 400);
    }
    
    console.log(`User created successfully: ${email}`);
    return c.json({ 
      success: true,
      user: {
        id: data.user.id,
        email: data.user.email,
        name: data.user.user_metadata.name,
        role: data.user.user_metadata.role
      }
    });
  } catch (error: any) {
    console.error("Signup error:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get current session - checks if user has an active session
 */
app.get("/make-server-9d56a30d/auth/session", async (c) => {
  const authHeader = c.req.header("Authorization");
  
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return c.json({ session: null, user: null });
  }
  
  const token = authHeader.substring(7);
  
  try {
    const { data: { user }, error } = await supabase.auth.getUser(token);
    
    if (error || !user) {
      return c.json({ session: null, user: null });
    }
    
    return c.json({ 
      session: { access_token: token },
      user: {
        id: user.id,
        email: user.email,
        name: user.user_metadata?.name,
        role: user.user_metadata?.role
      }
    });
  } catch (error: any) {
    console.error("Session check error:", error);
    return c.json({ session: null, user: null });
  }
});

// ==========================================
// Photo Upload Routes
// ==========================================

/**
 * Upload client photos to Supabase Storage
 */
app.post("/make-server-9d56a30d/upload-photo/:clientId", requireAuth, async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const formData = await c.req.formData();
    const file = formData.get("file") as File;
    
    if (!file) {
      return c.json({ error: "No file provided" }, 400);
    }
    
    // Create bucket if doesn't exist
    const bucketName = "make-9d56a30d-client-photos";
    const { data: buckets } = await supabase.storage.listBuckets();
    const bucketExists = buckets?.some(bucket => bucket.name === bucketName);
    
    if (!bucketExists) {
      const { error: bucketError } = await supabase.storage.createBucket(bucketName, {
        public: false,
        fileSizeLimit: 10485760 // 10MB
      });
      
      if (bucketError) {
        console.error("Error creating bucket:", bucketError);
        return c.json({ error: "Failed to create storage bucket" }, 500);
      }
    }
    
    // Upload file
    const fileExt = file.name.split('.').pop();
    const fileName = `${clientId}/${Date.now()}.${fileExt}`;
    const fileBuffer = await file.arrayBuffer();
    
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType: file.type,
        upsert: false
      });
    
    if (uploadError) {
      console.error("Error uploading file:", uploadError);
      return c.json({ error: "Failed to upload file" }, 500);
    }
    
    // Generate signed URL (valid for 1 year)
    const { data: urlData } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, 31536000); // 1 year in seconds
    
    console.log(`Photo uploaded for client ${clientId}: ${fileName}`);
    
    return c.json({
      success: true,
      fileName: fileName,
      url: urlData?.signedUrl,
      size: file.size,
      type: file.type
    });
  } catch (error: any) {
    console.error("Error uploading photo:", error);
    return c.json({ error: error.message }, 500);
  }
});

/**
 * Get all photos for a client
 */
app.get("/make-server-9d56a30d/photos/:clientId", requireAuth, async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const bucketName = "make-9d56a30d-client-photos";
    
    const { data: files, error } = await supabase.storage
      .from(bucketName)
      .list(clientId);
    
    if (error) {
      console.error("Error listing photos:", error);
      return c.json({ photos: [] });
    }
    
    // Generate signed URLs for all files
    const photosWithUrls = await Promise.all(
      (files || []).map(async (file) => {
        const filePath = `${clientId}/${file.name}`;
        const { data: urlData } = await supabase.storage
          .from(bucketName)
          .createSignedUrl(filePath, 31536000);
        
        return {
          name: file.name,
          path: filePath,
          url: urlData?.signedUrl,
          size: file.metadata?.size,
          createdAt: file.created_at
        };
      })
    );
    
    return c.json({ photos: photosWithUrls });
  } catch (error: any) {
    console.error("Error fetching photos:", error);
    return c.json({ photos: [] });
  }
});

/**
 * Delete a photo
 */
app.delete("/make-server-9d56a30d/photos/:clientId/:fileName", requireAuth, async (c) => {
  try {
    const clientId = c.req.param("clientId");
    const fileName = c.req.param("fileName");
    const bucketName = "make-9d56a30d-client-photos";
    const filePath = `${clientId}/${fileName}`;
    
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([filePath]);
    
    if (error) {
      console.error("Error deleting photo:", error);
      return c.json({ error: "Failed to delete photo" }, 500);
    }
    
    console.log(`Photo deleted: ${filePath}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting photo:", error);
    return c.json({ error: error.message }, 500);
  }
});

// ==========================================
// CRM Data Routes (Protected)
// ==========================================

/**
 * Get all clients
 */
app.get("/make-server-9d56a30d/clients", requireAuth, async (c) => {
  try {
    const clients = await kv.getByPrefix("client:");
    return c.json(clients || []);
  } catch (error: any) {
    console.error("Error fetching clients:", error);
    return c.json(
      { error: "Failed to fetch clients", details: error.message },
      500
    );
  }
});

/**
 * Get single client by ID
 */
app.get("/make-server-9d56a30d/clients/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const client = await kv.get(`client:${id}`);
    
    if (!client) {
      return c.json({ error: "Client not found" }, 404);
    }
    
    return c.json(client);
  } catch (error: any) {
    console.error("Error fetching client:", error);
    return c.json(
      { error: "Failed to fetch client", details: error.message },
      500
    );
  }
});

/**
 * Create new client
 */
app.post("/make-server-9d56a30d/clients", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    // Generate ID if not provided
    const id = body.id || `c${Date.now()}`;
    const client = {
      ...body,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`client:${id}`, client);
    
    console.log(`Client created successfully: ${id}`);
    return c.json(client);
  } catch (error: any) {
    console.error("Error creating client:", error);
    return c.json(
      { error: "Failed to create client", details: error.message },
      500
    );
  }
});

/**
 * Update existing client
 */
app.put("/make-server-9d56a30d/clients/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existingClient = await kv.get(`client:${id}`);
    if (!existingClient) {
      return c.json({ error: "Client not found" }, 404);
    }
    
    const updatedClient = {
      ...existingClient,
      ...body,
      id, // Ensure ID doesn't change
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`client:${id}`, updatedClient);
    
    console.log(`Client updated successfully: ${id}`);
    return c.json(updatedClient);
  } catch (error: any) {
    console.error("Error updating client:", error);
    return c.json(
      { error: "Failed to update client", details: error.message },
      500
    );
  }
});

/**
 * Delete client
 */
app.delete("/make-server-9d56a30d/clients/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`client:${id}`);
    
    console.log(`Client deleted successfully: ${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting client:", error);
    return c.json(
      { error: "Failed to delete client", details: error.message },
      500
    );
  }
});

/**
 * Get all projects
 */
app.get("/make-server-9d56a30d/projects", requireAuth, async (c) => {
  try {
    const projects = await kv.getByPrefix("project:");
    return c.json(projects || []);
  } catch (error: any) {
    console.error("Error fetching projects:", error);
    return c.json(
      { error: "Failed to fetch projects", details: error.message },
      500
    );
  }
});

/**
 * Get single project by ID
 */
app.get("/make-server-9d56a30d/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const project = await kv.get(`project:${id}`);
    
    if (!project) {
      return c.json({ error: "Project not found" }, 404);
    }
    
    return c.json(project);
  } catch (error: any) {
    console.error("Error fetching project:", error);
    return c.json(
      { error: "Failed to fetch project", details: error.message },
      500
    );
  }
});

/**
 * Create new project
 */
app.post("/make-server-9d56a30d/projects", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    const id = body.id || `p${Date.now()}`;
    const project = {
      ...body,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`project:${id}`, project);
    
    console.log(`Project created successfully: ${id}`);
    return c.json(project);
  } catch (error: any) {
    console.error("Error creating project:", error);
    return c.json(
      { error: "Failed to create project", details: error.message },
      500
    );
  }
});

/**
 * Update existing project
 */
app.put("/make-server-9d56a30d/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await c.req.json();
    
    const existingProject = await kv.get(`project:${id}`);
    if (!existingProject) {
      return c.json({ error: "Project not found" }, 404);
    }
    
    const updatedProject = {
      ...existingProject,
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`project:${id}`, updatedProject);
    
    console.log(`Project updated successfully: ${id}`);
    return c.json(updatedProject);
  } catch (error: any) {
    console.error("Error updating project:", error);
    return c.json(
      { error: "Failed to update project", details: error.message },
      500
    );
  }
});

/**
 * Delete project
 */
app.delete("/make-server-9d56a30d/projects/:id", requireAuth, async (c) => {
  try {
    const id = c.req.param("id");
    await kv.del(`project:${id}`);
    
    console.log(`Project deleted successfully: ${id}`);
    return c.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting project:", error);
    return c.json(
      { error: "Failed to delete project", details: error.message },
      500
    );
  }
});

/**
 * Get all products
 */
app.get("/make-server-9d56a30d/products", requireAuth, async (c) => {
  try {
    const products = await kv.getByPrefix("product:");
    return c.json(products || []);
  } catch (error: any) {
    console.error("Error fetching products:", error);
    return c.json(
      { error: "Failed to fetch products", details: error.message },
      500
    );
  }
});

/**
 * Create/Update product
 */
app.post("/make-server-9d56a30d/products", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    const id = body.id || `prod${Date.now()}`;
    const product = {
      ...body,
      id,
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`product:${id}`, product);
    
    console.log(`Product saved successfully: ${id}`);
    return c.json(product);
  } catch (error: any) {
    console.error("Error saving product:", error);
    return c.json(
      { error: "Failed to save product", details: error.message },
      500
    );
  }
});

/**
 * Get all team members/users
 */
app.get("/make-server-9d56a30d/users", requireAuth, async (c) => {
  try {
    const users = await kv.getByPrefix("user:");
    return c.json(users || []);
  } catch (error: any) {
    console.error("Error fetching users:", error);
    return c.json(
      { error: "Failed to fetch users", details: error.message },
      500
    );
  }
});

/**
 * Create/Update user
 */
app.post("/make-server-9d56a30d/users", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    
    const id = body.id || `u${Date.now()}`;
    const user = {
      ...body,
      id,
      createdAt: body.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    
    await kv.set(`user:${id}`, user);
    
    console.log(`User saved successfully: ${id}`);
    return c.json(user);
  } catch (error: any) {
    console.error("Error saving user:", error);
    return c.json(
      { error: "Failed to save user", details: error.message },
      500
    );
  }
});

/**
 * Migrate mock data to Supabase (one-time setup helper)
 */
app.post("/make-server-9d56a30d/migrate-data", requireAuth, async (c) => {
  try {
    const body = await c.req.json();
    const { clients, projects, products, users } = body;
    
    let migrated = {
      clients: 0,
      projects: 0,
      products: 0,
      users: 0,
    };
    
    // Migrate clients
    if (clients && Array.isArray(clients)) {
      for (const client of clients) {
        await kv.set(`client:${client.id}`, client);
        migrated.clients++;
      }
    }
    
    // Migrate projects
    if (projects && Array.isArray(projects)) {
      for (const project of projects) {
        await kv.set(`project:${project.id}`, project);
        migrated.projects++;
      }
    }
    
    // Migrate products
    if (products && Array.isArray(products)) {
      for (const product of products) {
        await kv.set(`product:${product.id}`, product);
        migrated.products++;
      }
    }
    
    // Migrate users
    if (users && Array.isArray(users)) {
      for (const user of users) {
        await kv.set(`user:${user.id}`, user);
        migrated.users++;
      }
    }
    
    console.log("Data migration completed:", migrated);
    return c.json({ 
      success: true, 
      message: "Data migrated successfully",
      migrated 
    });
  } catch (error: any) {
    console.error("Error migrating data:", error);
    return c.json(
      { error: "Failed to migrate data", details: error.message },
      500
    );
  }
});

// ==========================================
// DocuSign Routes
// ==========================================

/**
 * Test DocuSign connection and list templates
 */
app.get("/make-server-9d56a30d/docusign/test-connection", async (c) => {
  try {
    const config = docusign.getDocuSignConfig();
    
    // Validate configuration
    if (!config.accountId || !config.integrationKey || !config.userId) {
      return c.json(
        { 
          success: false,
          error: "DocuSign not configured",
          message: "Missing required credentials: Integration Key, Account ID, or User ID" 
        },
        400
      );
    }

    console.log("Testing DocuSign connection with config:", {
      integrationKey: config.integrationKey.substring(0, 8) + "...",
      accountId: config.accountId.substring(0, 8) + "...",
      userId: config.userId.substring(0, 8) + "...",
      basePath: config.basePath
    });

    // Try to fetch templates to verify connection
    const templates = await docusign.listTemplates(config);
    
    return c.json({
      success: true,
      message: "Connection successful!",
      environment: config.basePath.includes("demo") ? "Sandbox" : "Production",
      accountId: config.accountId,
      templatesFound: templates.envelopeTemplates?.length || 0,
      templates: templates.envelopeTemplates?.map((t: any) => ({
        id: t.templateId,
        name: t.name,
        description: t.description,
        created: t.created,
        lastModified: t.lastModified
      })) || []
    });
  } catch (error: any) {
    console.error("DocuSign connection test failed:", error);
    return c.json(
      { 
        success: false,
        error: "Connection failed",
        details: error.message,
        hint: error.message.includes("401") 
          ? "Authentication failed. Please verify your Integration Key, Secret Key, and User ID are correct."
          : error.message.includes("404")
          ? "Account not found. Please verify your Account ID is correct."
          : "Check your credentials and try again."
      },
      500
    );
  }
});

/**
 * Get list of DocuSign templates
 */
app.get("/make-server-9d56a30d/docusign/templates", async (c) => {
  try {
    const config = docusign.getDocuSignConfig();
    
    // Validate configuration
    if (!config.accountId || !config.integrationKey) {
      return c.json(
        { 
          error: "DocuSign not configured",
          message: "Please configure DocuSign API credentials in settings" 
        },
        400
      );
    }

    const templates = await docusign.listTemplates(config);
    return c.json(templates);
  } catch (error: any) {
    console.error("Error fetching DocuSign templates:", error);
    return c.json(
      { error: "Failed to fetch templates", details: error.message },
      500
    );
  }
});

/**
 * Get template details
 */
app.get("/make-server-9d56a30d/docusign/template/:templateId", async (c) => {
  try {
    const templateId = c.req.param("templateId");
    const config = docusign.getDocuSignConfig();

    const template = await docusign.getTemplate(config, templateId);
    return c.json(template);
  } catch (error: any) {
    console.error("Error fetching template details:", error);
    return c.json(
      { error: "Failed to fetch template", details: error.message },
      500
    );
  }
});

/**
 * Send envelope from template with auto-filled fields
 */
app.post("/make-server-9d56a30d/docusign/send-envelope", async (c) => {
  try {
    const body = await c.req.json();
    const config = docusign.getDocuSignConfig();

    console.log("Creating DocuSign envelope with request:", JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.templateId || !body.recipients || body.recipients.length === 0) {
      return c.json(
        { error: "Missing required fields: templateId and recipients" },
        400
      );
    }

    const result = await docusign.createEnvelopeFromTemplate(config, body);
    
    console.log("DocuSign envelope created successfully:", result);

    return c.json({
      envelopeId: result.envelopeId,
      status: result.status,
      statusDateTime: result.statusDateTime,
    });
  } catch (error: any) {
    console.error("Error creating DocuSign envelope:", error);
    return c.json(
      { error: "Failed to create envelope", details: error.message },
      500
    );
  }
});

/**
 * Create embedded envelope with sender signing URL
 */
app.post("/make-server-9d56a30d/docusign/create-embedded-envelope", async (c) => {
  try {
    const body = await c.req.json();
    const config = docusign.getDocuSignConfig();

    console.log("Creating embedded DocuSign envelope with request:", JSON.stringify(body, null, 2));

    // Validate required fields
    if (!body.templateId || !body.clientEmail || !body.clientName || !body.returnUrl) {
      return c.json(
        { error: "Missing required fields: templateId, clientEmail, clientName, returnUrl" },
        400
      );
    }

    const result = await docusign.createEmbeddedEnvelope(
      config,
      body.templateId,
      body.clientEmail,
      body.clientName,
      body.emailSubject || "Please sign this document",
      body.emailBlurb || "",
      body.returnUrl,
      body.tabs || {}
    );
    
    console.log("DocuSign embedded envelope created successfully with signing URL");

    return c.json({
      envelopeId: result.envelopeId,
      signingUrl: result.signingUrl,
    });
  } catch (error: any) {
    console.error("Error creating embedded DocuSign envelope:", error);
    return c.json(
      { error: "Failed to create embedded envelope", details: error.message },
      500
    );
  }
});

/**
 * Get envelope status
 */
app.get("/make-server-9d56a30d/docusign/status/:envelopeId", async (c) => {
  try {
    const envelopeId = c.req.param("envelopeId");
    const config = docusign.getDocuSignConfig();

    const status = await docusign.getEnvelopeStatus(config, envelopeId);
    return c.json(status);
  } catch (error: any) {
    console.error("Error fetching envelope status:", error);
    return c.json(
      { error: "Failed to fetch envelope status", details: error.message },
      500
    );
  }
});

/**
 * Initiate DocuSign OAuth flow
 */
app.get("/make-server-9d56a30d/docusign/oauth/authorize", async (c) => {
  try {
    const config = docusign.getDocuSignConfig();
    
    // Build the OAuth authorization URL
    const authUrl = new URL(`${config.basePath}/oauth/auth`);
    authUrl.searchParams.append("response_type", "code");
    authUrl.searchParams.append("scope", "signature impersonation");
    authUrl.searchParams.append("client_id", config.integrationKey);
    authUrl.searchParams.append("redirect_uri", `${c.req.header("origin")}/docusign-callback`);
    
    console.log("Redirecting to DocuSign OAuth:", authUrl.toString());
    
    return c.redirect(authUrl.toString());
  } catch (error: any) {
    console.error("Error initiating OAuth:", error);
    return c.json(
      { error: "Failed to initiate OAuth", details: error.message },
      500
    );
  }
});

/**
 * Exchange OAuth code for access token
 */
app.post("/make-server-9d56a30d/docusign/oauth/token", async (c) => {
  try {
    const body = await c.req.json();
    const { code, redirectUri } = body;
    
    if (!code) {
      return c.json({ error: "Missing authorization code" }, 400);
    }
    
    const config = docusign.getDocuSignConfig();
    
    // Exchange code for token
    const tokenUrl = `${config.basePath}/oauth/token`;
    const credentials = btoa(`${config.integrationKey}:${config.secretKey}`);
    
    const tokenResponse = await fetch(tokenUrl, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code,
        redirect_uri: redirectUri,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error("Token exchange failed:", error);
      throw new Error(`Failed to exchange code for token: ${tokenResponse.status} - ${error}`);
    }
    
    const tokenData = await tokenResponse.json();
    
    console.log("Successfully obtained access token");
    
    return c.json({
      success: true,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresIn: tokenData.expires_in,
      tokenType: tokenData.token_type,
    });
  } catch (error: any) {
    console.error("Error exchanging OAuth code for token:", error);
    return c.json(
      { error: "Failed to exchange code for token", details: error.message },
      500
    );
  }
});

/**
 * Download signed documents
 */
app.get("/make-server-9d56a30d/docusign/documents/:envelopeId", async (c) => {
  try {
    const envelopeId = c.req.param("envelopeId");
    const config = docusign.getDocuSignConfig();

    const pdfBuffer = await docusign.getEnvelopeDocuments(config, envelopeId);
    
    // Return PDF as download
    return new Response(pdfBuffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="contract-${envelopeId}.pdf"`,
      },
    });
  } catch (error: any) {
    console.error("Error downloading documents:", error);
    return c.json(
      { error: "Failed to download documents", details: error.message },
      500
    );
  }
});

Deno.serve(app.fetch);