-- Update Initial Appointment email subject to prompt intake form completion
UPDATE appointment_types
SET email_subject = 'Appointment Confirmed - Please Complete Your Intake Form Before We Meet'
WHERE LOWER(name) LIKE '%initial%';
