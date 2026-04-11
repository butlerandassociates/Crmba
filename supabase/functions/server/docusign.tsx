/**
 * DocuSign Integration Module
 * JWT Grant authentication — auto-refreshes tokens, never expires
 * Falls back to DOCUSIGN_ACCESS_TOKEN if private key not yet configured
 */

interface DocuSignConfig {
  integrationKey: string;
  secretKey?: string;
  accountId: string;
  userId: string;
  privateKey: string;
  basePath: string;
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
  status: "sent" | "created";
}

// ============================================================
// JWT Grant — RSA signing with Web Crypto API
// ============================================================

function concatBytes(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const arr of arrays) { out.set(arr, offset); offset += arr.length; }
  return out;
}

function encodeLen(len: number): Uint8Array {
  if (len < 128) return new Uint8Array([len]);
  if (len < 256) return new Uint8Array([0x81, len]);
  return new Uint8Array([0x82, (len >> 8) & 0xff, len & 0xff]);
}

// DocuSign generates PKCS#1 keys (BEGIN RSA PRIVATE KEY).
// Deno Web Crypto needs PKCS#8 (BEGIN PRIVATE KEY). Convert automatically.
function pkcs1ToPkcs8(pkcs1: Uint8Array): ArrayBuffer {
  const oid = new Uint8Array([0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]);
  const algorithmId = concatBytes(
    new Uint8Array([0x30]), encodeLen(oid.length + 4),
    new Uint8Array([0x06]), encodeLen(oid.length), oid,
    new Uint8Array([0x05, 0x00])
  );
  const octetString = concatBytes(new Uint8Array([0x04]), encodeLen(pkcs1.length), pkcs1);
  const version = new Uint8Array([0x02, 0x01, 0x00]);
  const inner = concatBytes(version, algorithmId, octetString);
  const outer = concatBytes(new Uint8Array([0x30]), encodeLen(inner.length), inner);
  return outer.buffer as ArrayBuffer;
}

function pemToArrayBuffer(pem: string): ArrayBuffer {
  const b64 = pem.replace(/-----[^-]+-----/g, "").replace(/\s/g, "");
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  // DocuSign private key is PKCS#1 — convert to PKCS#8 for Web Crypto API
  if (pem.includes("BEGIN RSA PRIVATE KEY")) {
    return pkcs1ToPkcs8(bytes);
  }
  return bytes.buffer;
}

function base64url(data: ArrayBuffer | string): string {
  let str: string;
  if (data instanceof ArrayBuffer) {
    str = String.fromCharCode(...new Uint8Array(data));
  } else {
    str = data;
  }
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

async function signRS256(input: string, privateKeyPem: string): Promise<string> {
  const keyData = pemToArrayBuffer(privateKeyPem);
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(input)
  );
  return base64url(signature);
}

async function createJWT(config: DocuSignConfig): Promise<string> {
  const header = { alg: "RS256", typ: "JWT" };
  const now = Math.floor(Date.now() / 1000);
  const aud = config.basePath.includes("demo")
    ? "account-d.docusign.com"
    : "account.docusign.com";

  const payload = {
    iss: config.integrationKey,
    sub: config.userId,
    aud,
    iat: now,
    exp: now + 3600,
    scope: "signature impersonation",
  };

  const headerB64 = base64url(JSON.stringify(header));
  const payloadB64 = base64url(JSON.stringify(payload));
  const signingInput = `${headerB64}.${payloadB64}`;
  const signature = await signRS256(signingInput, config.privateKey);

  return `${signingInput}.${signature}`;
}

async function getAccessTokenViaJWT(config: DocuSignConfig): Promise<string> {
  const jwt = await createJWT(config);
  const oauthBase = config.basePath.includes("demo")
    ? "https://account-d.docusign.com"
    : "https://account.docusign.com";

  const response = await fetch(`${oauthBase}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(
      `JWT Grant failed (${response.status}): ${error}\n` +
      "If this is the first time, Jonathan needs to grant consent once:\n" +
      `Go to: https://account-d.docusign.com/oauth/auth?response_type=code&scope=signature+impersonation&client_id=${config.integrationKey}&redirect_uri=https://www.docusign.com`
    );
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get DocuSign access token
 * Priority 1: JWT Grant with RSA private key (auto-refresh, never expires)
 * Priority 2: Stored DOCUSIGN_ACCESS_TOKEN (8-hour manual fallback)
 */
async function getAccessToken(config: DocuSignConfig): Promise<string> {
  if (config.privateKey) {
    console.log("DocuSign: using JWT Grant (auto-refresh)");
    return await getAccessTokenViaJWT(config);
  }

  const storedToken = Deno.env.get("DOCUSIGN_ACCESS_TOKEN");
  if (storedToken) {
    console.log("DocuSign: using stored access token (fallback — add DOCUSIGN_PRIVATE_KEY for auto-refresh)");
    return storedToken;
  }

  throw new Error(
    "DocuSign not configured. Set DOCUSIGN_PRIVATE_KEY in Supabase secrets for permanent auth, " +
    "or DOCUSIGN_ACCESS_TOKEN as a temporary fallback."
  );
}

// ============================================================
// API Methods
// ============================================================

export async function listTemplates(config: DocuSignConfig): Promise<any> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/templates`,
    {
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

export async function getTemplate(
  config: DocuSignConfig,
  templateId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/templates/${templateId}`,
    {
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
    throw new Error(`Failed to create DocuSign envelope: ${response.status} - ${error}`);
  }

  return await response.json();
}

export async function getEnvelopeStatus(
  config: DocuSignConfig,
  envelopeId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}`,
    {
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

export async function getEnvelopeDocuments(
  config: DocuSignConfig,
  envelopeId: string
): Promise<any> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/documents/combined`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`DocuSign API error: ${response.status} - ${error}`);
  }

  return await response.arrayBuffer();
}

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

  // Step 1: Create envelope as draft
  // Jonathan (Sender) fills payment schedule fields in the sender view
  // Client receives email to sign (routing order 1 — only recipient)
  const envelopeDefinition = {
    templateId,
    templateRoles: [
      {
        email: clientEmail,
        name: clientName,
        roleName: "Client",
        recipientId: "1",
        routingOrder: "1",
        tabs,
      },
    ],
    emailSubject,
    emailBlurb,
    status: "created",
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
    throw new Error(`Failed to create envelope: ${createResponse.status} - ${error}`);
  }

  const envelopeData = await createResponse.json();
  const envelopeId = envelopeData.envelopeId;

  // Step 2: Get sender view URL
  const senderViewResponse = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/views/sender`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ returnUrl }),
    }
  );

  if (!senderViewResponse.ok) {
    const error = await senderViewResponse.text();
    throw new Error(`Failed to get sender view: ${senderViewResponse.status} - ${error}`);
  }

  const senderViewData = await senderViewResponse.json();

  return {
    envelopeId,
    signingUrl: senderViewData.url,
  };
}

export async function getSenderViewUrl(
  config: DocuSignConfig,
  envelopeId: string,
  returnUrl: string
): Promise<string> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/views/sender`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ returnUrl }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get sender view: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.url;
}

export async function getContractorSigningUrl(
  config: DocuSignConfig,
  envelopeId: string,
  contractorEmail: string,
  contractorName: string,
  returnUrl: string
): Promise<string> {
  const accessToken = await getAccessToken(config);

  const response = await fetch(
    `${config.basePath}/restapi/v2.1/accounts/${config.accountId}/envelopes/${envelopeId}/views/recipient`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: contractorEmail,
        userName: contractorName,
        clientUserId: "contractor-embedded-1",
        authenticationMethod: "none",
        returnUrl,
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get contractor signing URL: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.url;
}

export function getDocuSignConfig(): DocuSignConfig {
  const environment = Deno.env.get("DOCUSIGN_ENVIRONMENT") || "demo";
  const basePath = environment === "production"
    ? "https://na4.docusign.net"
    : "https://demo.docusign.net";

  return {
    integrationKey: Deno.env.get("DOCUSIGN_INTEGRATION_KEY") || "",
    secretKey: Deno.env.get("DOCUSIGN_SECRET_KEY") || "",
    accountId: Deno.env.get("DOCUSIGN_ACCOUNT_ID") || "",
    userId: Deno.env.get("DOCUSIGN_USER_ID") || "",
    privateKey: Deno.env.get("DOCUSIGN_PRIVATE_KEY") || "",
    basePath,
  };
}
