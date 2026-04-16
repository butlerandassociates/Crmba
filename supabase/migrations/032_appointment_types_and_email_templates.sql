-- ============================================================
-- Migration 032: Separate appointment types from email templates
-- 1. Move Jonathan's real email content → email_templates
-- 2. Replace appointment_types with Jonathan's 4 correct values
-- ============================================================

-- 1. Clear existing generic email templates
DELETE FROM public.email_templates;

-- 2. Insert Jonathan's real email content into email_templates
INSERT INTO public.email_templates (name, subject, body_html, is_active)
VALUES
  ('Initial Follow Up',
   'Following Up - Butler & Associates Construction',
   'Hi {client_name},

I hope this email finds you well! I wanted to reach out and follow up regarding the project we discussed.

At Butler & Associates Construction, we''re committed to delivering exceptional quality and service. I''d love to schedule a time to go over the details of your project and answer any questions you might have!

Are you available for a brief call this week? I''m flexible and happy to work around your schedule.

Looking forward to hearing from you!

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com',
   true),

  ('Second Follow Up',
   'Checking In - Your Project with Butler & Associates',
   'Hi {client_name},

I wanted to circle back with you regarding your upcoming project. I know you''re probably busy, but I wanted to make sure I didn''t miss you.

We''re excited about the opportunity to work with you and bring your vision to life. Our team has extensive experience with projects like yours, and we''re confident we can deliver exceptional results.

If you have any questions or concerns, please don''t hesitate to reach out. Would next week work for a quick conversation?

Best regards,
Butler & Associates Construction Team
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com',
   true),

  ('Appointment Confirmation',
   'Appointment Confirmed - Butler & Associates Construction',
   'Hi {client_name},

This email confirms your appointment with Butler & Associates Construction!

During our meeting, we''ll:
- Discuss your project goals and vision
- Review the scope of work in detail
- Answer any questions you may have
- Provide an accurate timeline and estimate

Please bring any inspiration photos, plans, or materials you''d like to discuss. If you need to reschedule, just let us know as soon as possible.

Looking forward to meeting with you!

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com',
   true),

  ('Proposal Sent',
   'Your Project Proposal - Butler & Associates Construction',
   'Hi {client_name},

Thank you for the opportunity to provide a proposal for your project. Please find your detailed proposal which outlines our approach, timeline, and investment.

Our proposal includes:
- Detailed scope of work
- Itemized pricing breakdown
- Project timeline and milestones
- Our quality guarantee and warranty information

Please take your time reviewing the proposal, and feel free to reach out with any questions. This proposal is valid for 30 days.

Best regards,
Butler & Associates Construction Team
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com',
   true),

  ('Thank You - Project Awarded',
   'Thank You for Choosing Butler & Associates Construction!',
   'Hi {client_name},

Thank you for choosing Butler & Associates Construction for your project! We''re thrilled to have the opportunity to work with you.

Here''s what happens next:
- You''ll receive your signed contract and project timeline within 24 hours
- Your dedicated Project Manager will reach out to schedule a kickoff meeting
- We''ll provide you with access to our client portal for real-time project updates

We''re excited to get started!

Best regards,
Butler & Associates Construction Team
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com',
   true);

-- 3. Clear existing appointment_types
DELETE FROM public.appointment_types;

-- 4. Insert Jonathan's 4 correct appointment types (no location, no meet link)
INSERT INTO public.appointment_types (name, is_active, sort_order, email_subject, email_body)
VALUES
  ('Initial Appointment', true, 1,
   'Appointment Confirmed - Butler & Associates Construction',
   'Hi {client_name},

This confirms your Initial Appointment with Butler & Associates Construction.

Date: {date}
Time: {time}

We look forward to meeting with you and discussing your project in detail. Please bring any inspiration photos or plans you''d like to share.

If you need to reschedule, please let us know as soon as possible.

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com'),

  ('Followup Appointment', true, 2,
   'Follow-Up Appointment Confirmed - Butler & Associates Construction',
   'Hi {client_name},

This confirms your Follow-Up Appointment with Butler & Associates Construction.

Date: {date}
Time: {time}

We''re looking forward to continuing our conversation and moving your project forward.

If you need to reschedule, please let us know as soon as possible.

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com'),

  ('PreWalk Appointment', true, 3,
   'Pre-Walk Appointment Confirmed - Butler & Associates Construction',
   'Hi {client_name},

This confirms your Pre-Walk Appointment with Butler & Associates Construction.

Date: {date}
Time: {time}

During the pre-walk we''ll review the site, confirm scope of work, and address any final questions before we get started.

If you need to reschedule, please let us know as soon as possible.

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com'),

  ('Final Walk Appointment', true, 4,
   'Final Walk Appointment Confirmed - Butler & Associates Construction',
   'Hi {client_name},

This confirms your Final Walk Appointment with Butler & Associates Construction.

Date: {date}
Time: {time}

We''ll walk the completed project together to make sure everything meets your expectations before final sign-off.

If you need to reschedule, please let us know as soon as possible.

Best regards,
Jonathan Butler | General Manager / Owner
Phone: (256) 617-4691
Email: jonathan@butlerassociates.com');
