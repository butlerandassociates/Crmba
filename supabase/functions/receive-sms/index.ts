import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

// Twilio sends inbound SMS as application/x-www-form-urlencoded POST.
// We reply with TwiML so Twilio sends our custom auto-reply instead of the default message.

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" },
    });
  }

  // Respond with TwiML — Twilio reads this and sends the message back to the client
  const twiml = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Message>Thank you for reaching out to Butler &amp; Associates Construction, Inc.! To speak with our team, please call us at (256) 617-4691. Reply STOP to unsubscribe.</Message>
</Response>`;

  return new Response(twiml, {
    headers: { "Content-Type": "text/xml" },
  });
});
