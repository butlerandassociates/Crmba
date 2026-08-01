const ALLOWED_ORIGINS = [
  "https://crm.butlerconstruction.co",
  "https://client.butlerconstruction.co",
  "http://localhost:5173",
];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    "Access-Control-Allow-Origin": allowedOrigin,
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-portal-token",
    "Vary": "Origin",
  };
}
