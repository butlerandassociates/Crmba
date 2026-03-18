/**
 * DocuSign Integration Module
 * Handles envelope creation from templates with auto-filled fields
 * Uses JWT authentication for automatic token management
 */

interface DocuSignConfig {
  integrationKey: string;
  secretKey?: string;
  accountId: string;
  userId: string;
  privateKey: string;
  basePath: string; // https://demo.docusign.net for sandbox, https://na4.docusign.net for production
}

interface TemplateField {
  tabLabel: string;
  value: string;
}

interface EnvelopeRecipient {
  email: string;
  name: string;
  recipientId: string;
  roleName: string;
  tabs?: {
    textTabs?: TemplateField[];
    dateSignedTabs?: TemplateField[];
    numberTabs?: TemplateField[];
  };
}

interface CreateEnvelopeRequest {
  templateId: string;
  recipients: EnvelopeRecipient[];
  emailSubject: string;
  emailBlurb?: string;
  status: "sent" | "created"; // "sent" sends immediately, "created" saves as draft
}

/**
 * Generate JWT for DocuSign authentication
 */
function generateJWT(config: DocuSignConfig): string {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud: config.basePath.includes("demo") ? "account-d.docusign.com" : "account.docusign.com",
    iat: now,
    exp: now + 3600, // 1 hour expiration
    scope: "signature impersonation"
  };

  // Note: Full JWT implementation requires crypto libraries
  // For now, we'll use a simpler approach with the jose library
  const encoder = new TextEncoder();
  const headerB64 = btoa(JSON.stringify(header)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  const payloadB64 = btoa(JSON.stringify(payload)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
  
  return `${headerB64}.${payloadB64}`;
}

/**
 * Get DocuSign access token
 * For now, uses a manually generated token stored in environment variables
 * TODO: Implement full JWT Grant flow with RSA signing for production
 */
async function getAccessToken(config: DocuSignConfig): Promise<string> {
  // Check if there's a stored access token first
  const storedToken = Deno.env.get("DOCUSIGN_ACCESS_TOKEN");
  
  if (storedToken) {
    console.log("Using stored DocuSign access token");
    return storedToken;
  }

  // If no stored token, provide clear instructions
  throw new Error(
    "DocuSign access token not found. Please generate a token:\n" +
    "1. Go to https://developers.docusign.com/\n" +
    "2. Navigate to Settings → Apps and Keys\n" +
    "3. Click your Integration Key\n" +
    "4. Scroll to 'Generate Token' and click it\n" +
    "5. Copy the token and add it as DOCUSIGN_ACCESS_TOKEN in Supabase secrets\n\n" +
    "Note: Tokens expire after 8 hours. For production, we'll implement automatic token refresh."
  );
}

/**
 * Get list of available templates
 */
export async function listTemplates(config: DocuSignConfig): Promise<any> {
  const accessToken = await getAccessToken(config);
  
  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/templates`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Get template details including custom fields
 */
export async function getTemplate(
  config: DocuSignConfig,
  templateId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);
  
  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/templates/${templateId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Create and send envelope from template with pre-filled fields
 */
export async function createEnvelopeFromTemplate(
  config: DocuSignConfig,
  request: CreateEnvelopeRequest
): Promise<any> {
  const accessToken = await getAccessToken(config);

  const envelopeDefinition = {
    templateId: request.templateId,
    templateRoles: request.recipients,
    emailSubject: request.emailSubject,
    emailBlurb: request.emailBlurb || "",
    status: request.status,
  };

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeDefinition),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error("DocuSign envelope creation error:", error);
    throw new Error(`Failed to create DocuSign envelope: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Get envelope status
 */
export async function getEnvelopeStatus(
  config: DocuSignConfig,
  envelopeId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);
  
  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

/**
 * Get envelope documents (signed PDFs)
 */
export async function getEnvelopeDocuments(
  config: DocuSignConfig,
  envelopeId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);
  
  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error: ${response.status} - ${error}`);
  }

  return await response.arrayBuffer();
}

/**
 * Create embedded envelope with signing URL for sender
 */
export async function createEmbeddedEnvelope(
  config: DocuSignConfig,
  templateId: string,
  clientEmail: string,
  clientName: string,
  emailSubject: string,
  emailBlurb: string,
  returnUrl: string,
  tabs: any
): Promise<{ envelopeId: string; signingUrl: string }> {
  const accessToken = await getAccessToken(config);

  // Step 1: Create the envelope as a draft
  const envelopeDefinition = {
    templateId: templateId,
    templateRoles: [
      {
        email: clientEmail,
        name: clientName,
        roleName: "Client",
        recipientId: "1",
        tabs: tabs,
      },
    ],
    emailSubject: emailSubject,
    emailBlurb: emailBlurb,
    status: "created", // Create as draft first
  };

  const createResponse = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(envelopeDefinition),
    }
  );

  if (!createResponse.ok) {
    const error = await createResponse.text();
    console.error("DocuSign envelope creation error:", error);
    throw new Error(`Failed to create envelope: ${createResponse.status} - ${error}`);
  }

  const envelopeData = await createResponse.json();
  const envelopeId = envelopeData.envelopeId;

  // Step 2: Get sender view URL (embedded signing for sender)
  const senderViewRequest = {
    returnUrl: returnUrl,
  };

  const senderViewResponse = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/views/sender`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(senderViewRequest),
    }
  );

  if (!senderViewResponse.ok) {
    const error = await senderViewResponse.text();
    console.error("DocuSign sender view error:", error);
    throw new Error(`Failed to get sender view: ${senderViewResponse.status} - ${error}`);
  }

  const senderViewData = await senderViewResponse.json();

  return {
    envelopeId: envelopeId,
    signingUrl: senderViewData.url,
  };
}

/**
 * Helper: Build DocuSign config from environment variables
 */
export function getDocuSignConfig(): DocuSignConfig {
  const integrationKey = Deno.env.get("DOCUSIGN_INTEGRATION_KEY") || "";
  const secretKey = Deno.env.get("DOCUSIGN_SECRET_KEY") || "";
  const accountId = Deno.env.get("DOCUSIGN_ACCOUNT_ID") || "";
  const userId = Deno.env.get("DOCUSIGN_USER_ID") || "";
  const privateKey = Deno.env.get("DOCUSIGN_PRIVATE_KEY") || "";
  const environment = Deno.env.get("DOCUSIGN_ENVIRONMENT") || "demo"; // "demo" or "production"
  
  const basePath = environment === "production" 
    ? "https://na4.docusign.net" 
    : "https://demo.docusign.net";

  return {
    integrationKey,
    secretKey,
    accountId,
    userId,
    privateKey,
    basePath,
  };
}