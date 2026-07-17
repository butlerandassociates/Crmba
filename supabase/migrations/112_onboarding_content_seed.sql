-- ============================================================
-- Migration 112: Seed full content — Sales Onboarding Portal
-- Butler & Associates CRM — Jul 16 2026
--
-- All content sourced from Jonathan's Figma Make prototype zip
-- (crmba-onboarding-employee-portal/src/app/components/onboarding/data/)
--
-- Changes:
--   1. ADD key_takeaways jsonb column to onboarding_modules
--   2. UPDATE content for all 24 module sections (body, bullets, callouts)
--   3. UPDATE content for all 7 documents (section_heading + body + bullets + callout + table blocks)
--   4. UPDATE key_takeaways for all 6 modules
-- ============================================================


-- ─── 1. ADD KEY_TAKEAWAYS COLUMN ─────────────────────────────────────────────

ALTER TABLE public.onboarding_modules
  ADD COLUMN IF NOT EXISTS key_takeaways jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.onboarding_modules.key_takeaways IS 'JSONB string array of 3-5 key takeaways shown at end of each module lesson';


-- ─── 2. MODULE SECTION CONTENT ───────────────────────────────────────────────
-- Sections already have headings from migration 111.
-- Here we fill in the content jsonb (body/bullets/callout blocks).
-- Matched by: module title + section heading (both from migration 111 seed).


-- MODULE 1: Welcome to Butler & Associates ─────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Butler & Associates Construction was founded with a simple philosophy: do exceptional work, treat clients like family, and build a team that takes pride in every project. What started as a small residential contractor has grown into a full-service construction firm covering residential remodels, outdoor living spaces, commercial tenant improvements, and design-build projects across the region."},
  {"type":"body","text":"Today we manage millions of dollars in annual contracts, employ a team of 15 and growing, and maintain an industry-leading close rate — all because of disciplined sales processes, honest communication, and a genuine commitment to quality."},
  {"type":"callout","callout_type":"info","text":"We operate on a referral-driven model. Over 60% of new business comes from past client referrals. That means every interaction you have — from the first call to the final walkthrough — directly impacts future revenue."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Welcome to Butler & Associates'
  AND s.heading = 'Who We Are';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Everything we do flows from four values that are non-negotiable at every level of the business."},
  {"type":"bullets","items":["Integrity First — We never oversell, underdeliver, or hide problems from clients. If something goes wrong on a job, we own it immediately.","Craftsmanship Over Speed — We do not cut corners to hit a deadline. Quality is our brand.","Radical Transparency — Clients always know where their project stands. No surprises.","Team Before Self — Wins are shared. Struggles are shared. We support each other."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Welcome to Butler & Associates'
  AND s.heading = 'Our Core Values';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"The sales team at Butler & Associates is small and high-performing. We do not operate with aggressive quotas or commission wars. Instead, we run a collaborative pipeline where every team member is expected to contribute to our collective revenue goal and help each other close deals."},
  {"type":"body","text":"You will work closely with project managers, lead estimators, and our operations coordinator. Understanding their roles — and respecting their bandwidth — is part of being a good sales team member."},
  {"type":"callout","callout_type":"tip","text":"Introduce yourself to the estimating team in your first week. Strong relationships with estimators directly improve the quality and turnaround speed of your proposals."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Welcome to Butler & Associates'
  AND s.heading = 'The Team You Are Joining';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"In your first 90 days, success is measured by your ability to learn the process, ask smart questions, and build rapport with clients — not by how much revenue you close. We invest in onboarding because we want you here for the long term."},
  {"type":"body","text":"Beyond 90 days, you will be expected to carry an active pipeline, contribute to our monthly revenue goal, and maintain the Butler & Associates standard of client communication."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Welcome to Butler & Associates'
  AND s.heading = 'What Success Looks Like Here';


-- MODULE 2: Our Sales Process ──────────────────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Our 6-stage pipeline is not bureaucracy — it is the reason we maintain consistent revenue and never lose track of a potential client. Every deal lives in exactly one stage at all times. If you cannot confidently assign a stage to a deal, that is a signal to dig deeper with the client."},
  {"type":"body","text":"The pipeline also drives how we forecast. When a deal is in Selling, our team knows contracted revenue may be landing soon. When multiple deals are stuck in Scheduled too long, leadership knows to investigate."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Our Sales Process'
  AND s.heading = 'Why a Defined Pipeline Matters';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"A Prospect is someone who has expressed interest but has not yet committed to a site visit or discovery call. This could be a web form submission, a referral lead, or a returning client who reached out about a new project."},
  {"type":"body","text":"Your job in this stage: qualify quickly. Is this project realistic? Does the client have budget awareness? Is there a timeline? Move fast — leads get cold within 48 hours."},
  {"type":"callout","callout_type":"warning","text":"Never let a Prospect sit for more than 3 business days without outreach. Log every call attempt in the CRM, even if it goes unanswered."},
  {"type":"bullets","items":["Send an introduction email within 24 hours of the lead coming in.","Make at least 2 call attempts before moving to email-only follow-up.","Qualify budget, timeline, and project scope before scheduling a visit."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Our Sales Process'
  AND s.heading = 'Stage 1 — Prospect';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Once you have a confirmed site visit or discovery meeting on the calendar, the deal moves to Scheduled. This is your preparation stage."},
  {"type":"body","text":"Review comparable past projects. Understand the neighborhood, typical scope of work, and any permitting considerations. Show up prepared — clients notice."},
  {"type":"bullets","items":["Confirm the appointment 24 hours in advance via text or email.","Bring a portfolio of relevant past projects if possible.","Set clear expectations: After this visit, we will prepare a detailed estimate within 5 business days."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Our Sales Process'
  AND s.heading = 'Stage 2 — Scheduled';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"After the site visit, the deal moves to Selling while we prepare and present the proposal. This is the most active sales stage — follow-up cadence and proposal quality determine your close rate here."},
  {"type":"body","text":"Work with the estimating team to build an accurate, professionally formatted proposal. Do not rush this. A sloppy estimate loses trust immediately."},
  {"type":"callout","callout_type":"tip","text":"Always present proposals in person or via live video call when possible. Walking a client through the numbers dramatically increases your close rate versus emailing a PDF."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Our Sales Process'
  AND s.heading = 'Stage 3 — Selling';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Sold means the contract is signed and revenue is contracted. Hand off to project management with a thorough briefing — everything you promised verbally must be documented."},
  {"type":"body","text":"Active means work is underway. Stay in contact with the client at least weekly. You are still their relationship owner even though PM is running the job."},
  {"type":"body","text":"Completed means the project is done and final payment has been collected. This is also when you ask for a review and a referral. Never skip this step."},
  {"type":"bullets","items":["Sold → PM handoff meeting within 48 hours of contract signing.","Active → weekly client check-in, minimum.","Completed → review request + referral ask within 7 days of final invoice."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Our Sales Process'
  AND s.heading = 'Stages 4–6 — Sold, Active, Completed';


-- MODULE 3: Construction Estimating Basics ─────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"You do not have to be an estimator, but you must understand how estimates are built. Clients will ask questions like Why is labor so expensive? or Can you break this out differently? — and if you cannot answer credibly, you lose trust."},
  {"type":"body","text":"More importantly, understanding margins protects the company. Sales reps who overpromise discounts without understanding cost structure have damaged client relationships and company profitability."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Construction Estimating Basics'
  AND s.heading = 'Why Sales Reps Must Understand Estimating';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Labor is priced by role and skill level. Our fully-loaded labor rates (including payroll taxes, workers comp, and benefits) are set annually by our operations team. As a sales rep, you will reference the current Rate Sheet (see Documents) rather than calculating these yourself."},
  {"type":"body","text":"The key principle: never quote labor in isolation. Always frame labor within the full project scope to avoid sticker shock."},
  {"type":"callout","callout_type":"info","text":"Fully-loaded labor rates are typically 1.4–1.6x the base wage. A carpenter earning $28/hr costs the company approximately $40–$45/hr fully loaded."},
  {"type":"bullets","items":["Labor rates are reviewed every January. Always use the current Rate Sheet.","Overtime (>40 hrs/week) is billed at 1.5x. Flag this in estimates for longer projects.","Subcontractor rates are negotiated per job — coordinate with the PM before including sub costs in a proposal."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Construction Estimating Basics'
  AND s.heading = 'How We Price Labor';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Materials are priced at current market cost plus our standard materials markup. Given supply chain volatility, proposals are valid for 30 days only — include this in every proposal you send."},
  {"type":"body","text":"For projects where exact material selections are not yet made (tile, fixtures, countertops), use an allowance — a budgeted placeholder. Define the allowance clearly and note that overages are the client's responsibility."},
  {"type":"callout","callout_type":"warning","text":"Never lock in material prices without confirming current supplier costs. A price quoted 60 days ago may be significantly different today."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Construction Estimating Basics'
  AND s.heading = 'Material Pricing & Allowances';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Overhead & Profit (O&P) is applied to total direct costs to cover company overhead (insurance, facility costs, equipment, admin) and target net profit. Our standard O&P is applied to the combined labor + materials + subcontractor total."},
  {"type":"body","text":"Target gross margin for residential projects is 20–30%. Commercial projects may vary. Never discount below 15% gross margin without written approval from a manager."},
  {"type":"bullets","items":["Gross Margin = (Revenue - Direct Costs) / Revenue","A 25% markup on $10,000 in costs = $12,500 proposal price (20% gross margin)","A 30% markup on $10,000 in costs = $13,000 proposal price (23% gross margin)","Target: 25–35% markup to land in the 20–30% gross margin range"]},
  {"type":"callout","callout_type":"tip","text":"Markup percentage and gross margin percentage are NOT the same number. A 25% markup produces a 20% gross margin. Know the difference when talking to managers."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Construction Estimating Basics'
  AND s.heading = 'Markup, Margin & O&P';


-- MODULE 4: Building a Winning Proposal ────────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Our proposals follow a consistent format that has been refined over years of client feedback. Deviating from this format without approval is not permitted — consistency builds the brand."},
  {"type":"body","text":"Every proposal includes: a cover page with project name and client information, a scope of work narrative, a line-item cost breakdown, project timeline, payment schedule, terms and conditions, and our warranty statement."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Building a Winning Proposal'
  AND s.heading = 'Anatomy of a Proposal';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"The scope of work narrative is the most important section of your proposal. It demonstrates that you listened, understood the project, and can deliver it. Clients make emotional decisions to move forward — the numbers just justify the decision."},
  {"type":"body","text":"Write the scope in plain English. Avoid contractor jargon unless you define it. Describe what the client will experience when the project is complete, not just what we will do."},
  {"type":"callout","callout_type":"tip","text":"Start your scope narrative with a one-sentence vision statement: This project will transform your backyard into a beautiful outdoor living space your family will enjoy for years. Then go into detail."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Building a Winning Proposal'
  AND s.heading = 'Writing a Compelling Scope of Work';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Price anchoring is a proven technique: present the full project value before breaking down costs. If a client sees $45,000 first and then sees what they get for it, the price feels justified. If they see a line-by-line breakdown first, every line becomes a negotiation target."},
  {"type":"body","text":"Group line items into logical categories (Site Prep, Concrete Work, Landscaping, Finishes). Never present a wall of individual line items with no organization."},
  {"type":"bullets","items":["Lead with the vision, follow with the price.","Group costs into 3–5 logical categories.","Include a payment schedule tied to project milestones, not arbitrary dates.","Clearly state what is NOT included to prevent scope creep disputes."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Building a Winning Proposal'
  AND s.heading = 'Presenting the Numbers';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Send the proposal and confirm receipt within the same day. Follow up with a call or personal email within 3–5 business days. Do not wait for the client to come to you."},
  {"type":"body","text":"If a client goes quiet after seeing the proposal, assume it is a pricing objection until proven otherwise. Your follow-up should open a conversation: I want to make sure the proposal reflected everything we discussed. Is there anything you would like to adjust?"},
  {"type":"callout","callout_type":"warning","text":"Do not discount immediately when a client says the price is too high. First, ask what specifically feels out of range. Often the objection is to one component, not the whole project."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Building a Winning Proposal'
  AND s.heading = 'Following Up After Proposal Delivery';


-- MODULE 5: Client Communication Standards ─────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Inconsistent communication is one of the top reasons construction clients leave for a competitor — even when the work is excellent. Our standards exist to ensure that every client, regardless of which team member they interact with, experiences the same level of responsiveness and professionalism."},
  {"type":"body","text":"These are not suggestions. Failing to meet communication standards has direct consequences for client satisfaction scores, reviews, and referral rates."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Client Communication Standards'
  AND s.heading = 'Why Standards Exist';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"We hold ourselves to clear response time commitments. These apply during normal business hours (Mon–Fri, 7am–6pm)."},
  {"type":"bullets","items":["Inbound calls: Return within 2 hours, same business day.","Emails from clients: Reply within 4 hours, same business day.","Text messages: Acknowledge within 1 hour.","New lead inquiries: First outreach within 24 hours.","Proposal requests: Delivered within 5 business days of site visit."]},
  {"type":"callout","callout_type":"info","text":"If you cannot meet an SLA due to circumstances outside your control, send a brief acknowledgment: I received your message and will have a full response to you by [time]. This alone prevents the majority of client frustration."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Client Communication Standards'
  AND s.heading = 'Response Time SLAs';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"All client communication should be warm, professional, and direct. Avoid overly formal language and avoid overly casual language."},
  {"type":"body","text":"The Butler & Associates tone is knowledgeable-neighbor: you speak with expertise, but you make the client feel like they are getting advice from a trusted friend — not being sold to."},
  {"type":"bullets","items":["Use the client's first name after the first exchange.","Always end emails with a clear next step or question.","Never send a proposal via email without a personal note explaining the key highlights.","Proofread every external message before sending."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Client Communication Standards'
  AND s.heading = 'Email & Messaging Tone';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Every client interaction must be logged in the CRM within 24 hours. This includes calls, texts, emails, site visits, and proposal presentations. If it is not in the CRM, it did not happen."},
  {"type":"body","text":"Thorough documentation protects you, the company, and the client. It also ensures that if you are ever unavailable, a colleague can pick up the client relationship without the client feeling dropped."},
  {"type":"callout","callout_type":"warning","text":"Verbal commitments that are not documented carry no weight in a dispute. If you tell a client we will include something, write it down immediately and update the scope of work."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'Client Communication Standards'
  AND s.heading = 'Logging & Documentation';


-- MODULE 6: CRM Mastery ────────────────────────────────────────────────────

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"The CRM is not just a place to store contacts — it is the operational backbone of our sales team. Every deal, every client interaction, every proposal, and every revenue forecast runs through it. Treat it like a professional obligation, not an administrative afterthought."},
  {"type":"body","text":"Leadership reviews the pipeline daily. If your deals are not updated, you will be asked why — and I have been busy is not an acceptable answer."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'CRM Mastery'
  AND s.heading = 'CRM as Source of Truth';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Move a deal to the next stage only when the criteria for that stage are met. Do not advance deals prematurely to make your pipeline look better — this corrupts the forecast and erodes management trust."},
  {"type":"body","text":"Review your entire pipeline at the start of each week and ask: Is every deal in the right stage? Is there anything that has been sitting too long without activity?"},
  {"type":"bullets","items":["Prospect → Scheduled: Site visit confirmed and on the calendar.","Scheduled → Selling: Site visit completed, estimate in progress.","Selling → Sold: Contract signed by both parties.","Sold → Active: Work has physically begun on site.","Active → Completed: Final invoice issued and paid."]},
  {"type":"callout","callout_type":"warning","text":"Deals in Selling for more than 30 days require a manager check-in note. If a client has gone cold, flag it — do not leave the deal in Selling indefinitely."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'CRM Mastery'
  AND s.heading = 'Updating Pipeline Stages';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"Log every meaningful interaction: calls (outcome, next step), emails (summary, client response), site visits (what was discussed, scope changes), and proposal presentations (reactions, objections, next steps)."},
  {"type":"body","text":"The activity log is how you build a defensible timeline of a client relationship. It is also how you get better — reviewing your own activity patterns reveals where deals stall."},
  {"type":"callout","callout_type":"tip","text":"Log within 15 minutes of the interaction while details are fresh. A CRM entry written hours later is significantly less accurate and useful."}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'CRM Mastery'
  AND s.heading = 'Logging Activities';

UPDATE public.onboarding_sections s
SET content = $c$[
  {"type":"body","text":"The Stats page shows your pipeline value, weighted forecast, and where revenue stands across all stages. Review this every Monday morning before your first client interaction."},
  {"type":"body","text":"Use the weighted forecast to prioritize your week: focus the most energy on deals in Selling (highest close probability) and re-engage deals that have been idle in Scheduled too long."},
  {"type":"bullets","items":["Weekly habit: Review Stats every Monday, 8am.","Flag any deal with zero activity in the last 7 days.","Use the pipeline totals to anticipate your commission projections.","Share forecast updates proactively with your manager — never wait to be asked."]}
]$c$::jsonb
FROM public.onboarding_modules m
WHERE s.module_id = m.id
  AND m.title = 'CRM Mastery'
  AND s.heading = 'Using Dashboard & Stats';


-- ─── 3. DOCUMENT CONTENT ─────────────────────────────────────────────────────
-- Each document stores all its sections as a flat jsonb array using
-- section_heading blocks to separate named sections.


-- DOCUMENT 1: Employee Handbook 2026 ──────────────────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"Employment at Will"},
  {"type":"body","text":"Employment at Butler & Associates Construction, Inc. is at-will for all employees unless a separate written employment agreement expressly provides otherwise. This means either the company or the employee may terminate the employment relationship at any time, with or without cause, and with or without notice."},
  {"type":"body","text":"Nothing in this handbook creates a contract of employment. The policies in this handbook may be changed at any time at the company's discretion."},
  {"type":"section_heading","text":"Work Hours & Attendance"},
  {"type":"body","text":"Standard office hours are Monday through Friday, 7:00 AM to 5:00 PM. Sales team members are expected to be available to clients during business hours per the communication SLA policy."},
  {"type":"body","text":"Remote work may be available with manager approval on a case-by-case basis. Absences must be reported to your direct manager before your scheduled start time."},
  {"type":"bullets","items":["PTO: 10 days per year (accrued monthly), eligible after 90-day probation.","Sick leave: 5 days per year, non-accruing.","Holidays: 9 company-observed holidays (see HR calendar).","Unpaid leave: Available with manager and HR approval."]},
  {"type":"section_heading","text":"Code of Conduct"},
  {"type":"body","text":"All employees are expected to conduct themselves professionally in interactions with clients, subcontractors, vendors, and colleagues. Conduct that reflects negatively on Butler & Associates, creates a hostile work environment, or violates client trust will result in disciplinary action up to and including termination."},
  {"type":"bullets","items":["Treat all clients, colleagues, and vendors with respect.","Never share confidential client or company information outside the organization.","Conflicts of interest must be disclosed to management immediately.","Use of company devices and accounts is subject to monitoring.","Social media posts referencing client projects require prior approval."]},
  {"type":"callout","callout_type":"warning","text":"Soliciting clients for personal work outside Butler & Associates while employed here is a violation of your employment agreement and grounds for immediate termination."},
  {"type":"section_heading","text":"Benefits Overview"},
  {"type":"body","text":"Butler & Associates offers the following benefits to full-time employees after the 90-day probationary period. Detailed plan documents are available from HR."},
  {"type":"bullets","items":["Health insurance: Company covers 70% of employee premium (Blue Cross PPO).","Dental & Vision: Optional, employee-paid through payroll deduction.","Simple IRA: Company matches 3% of contributions.","Mileage reimbursement: IRS standard rate for approved business travel.","Cell phone stipend: $50/month for sales team members.","Annual performance review with merit increase consideration."]},
  {"type":"section_heading","text":"Disciplinary Process"},
  {"type":"body","text":"Performance or conduct issues are addressed through a progressive process: verbal warning → written warning → final written warning → termination. The company reserves the right to skip steps in cases of serious misconduct."},
  {"type":"body","text":"All disciplinary actions are documented and placed in the employee file. Employees have the right to respond in writing to any documented warning."}
]$c$::jsonb
WHERE title = 'Employee Handbook 2026';


-- DOCUMENT 2: Sales Commission Structure ──────────────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"Commission Philosophy"},
  {"type":"body","text":"Butler & Associates commissions are designed to reward long-term, high-quality sales behavior — not just volume. We pay on collected revenue, not just on contracts signed, because we believe the sales team should be invested in the quality and completion of every project they sell."},
  {"type":"callout","callout_type":"info","text":"Commissions are earned on collected revenue. If a client does not pay a milestone, the commission on that milestone is not paid until it is collected."},
  {"type":"section_heading","text":"Base Commission Rate"},
  {"type":"body","text":"The standard commission rate for the sales team is 3% of gross contract value, paid as milestones are collected."},
  {"type":"table","cols":["Payment Milestone","% of Contract","Commission Paid"],"rows":[["Contract Signing (deposit)","10%","3% of deposit amount"],["Project Start / Mobilization","25%","3% of milestone amount"],["Mid-Project Progress Payment","40%","3% of milestone amount"],["Final Payment on Completion","25%","3% of milestone amount"]]},
  {"type":"section_heading","text":"Performance Tiers"},
  {"type":"body","text":"Sales team members who exceed quarterly revenue targets earn an accelerated commission rate for all revenue above their target in that quarter."},
  {"type":"table","cols":["Quarterly Revenue Attainment","Commission Rate"],"rows":[["Below 75% of target","2% (reduced rate)"],["75%–99% of target","3% (standard rate)"],["100%–124% of target","3.5% (accelerated)"],["125%+ of target","4% (accelerated)"]]},
  {"type":"callout","callout_type":"tip","text":"Accelerated rates apply only to revenue above the tier threshold, not retroactively to all revenue. Example: If target is $200K and you close $250K, the top $50K earns 4% — not the full $250K."},
  {"type":"section_heading","text":"Clawback Policy"},
  {"type":"body","text":"If a project is cancelled after contract signing due to client fault or scope dispute, commissions paid on collected deposits are retained. If a project is cancelled due to company fault or error, commissions already paid may be subject to recoupment."},
  {"type":"body","text":"Commissions on projects with active dispute resolutions are held until the dispute is resolved."},
  {"type":"section_heading","text":"Payment Schedule"},
  {"type":"body","text":"Commissions are processed on the 15th of the month following the month in which the qualifying payment was collected. Example: a client payment collected on March 10 generates a commission payment on April 15."},
  {"type":"body","text":"Commission statements are emailed to team members by the 10th of each month, showing all qualifying collections, rates applied, and projected payout."}
]$c$::jsonb
WHERE title = 'Sales Commission Structure';


-- DOCUMENT 3: Estimating Rate Sheet — 2026 ────────────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"How to Use This Rate Sheet"},
  {"type":"body","text":"This rate sheet is for internal reference only and must not be shared with clients. It reflects fully-loaded labor costs (base wage + payroll taxes + workers compensation + benefits burden) and standard material pricing guidelines."},
  {"type":"body","text":"All rates are reviewed and updated annually. The rates in this document supersede any previously shared rates. If you are unsure whether you have the current version, check with the estimating team."},
  {"type":"callout","callout_type":"warning","text":"Do not quote labor rates from memory or from a previous year's sheet. Always reference this document."},
  {"type":"section_heading","text":"Fully-Loaded Labor Rates (2026)"},
  {"type":"body","text":"The following rates are used to calculate direct labor costs in all estimates."},
  {"type":"table","cols":["Role","Base Wage (est.)","Fully Loaded Rate","OT Rate (>40 hrs)"],"rows":[["Project Manager","$38–$45/hr","$55–$65/hr","$82–$97/hr"],["Lead Carpenter","$30–$36/hr","$44–$52/hr","$66–$78/hr"],["Journeyman Carpenter","$24–$30/hr","$35–$44/hr","$52–$66/hr"],["Concrete Finisher","$26–$32/hr","$38–$46/hr","$57–$69/hr"],["Laborer / Helper","$18–$22/hr","$26–$32/hr","$39–$48/hr"],["Lead Electrician (Sub)","Quoted per job","Sub + 15% markup","N/A"],["Plumber (Sub)","Quoted per job","Sub + 15% markup","N/A"]]},
  {"type":"section_heading","text":"Material Markup Guidelines"},
  {"type":"body","text":"Material costs are based on current supplier pricing plus the following standard markups. These markups cover procurement overhead, storage, delivery coordination, and warranty risk."},
  {"type":"table","cols":["Material Category","Standard Markup"],"rows":[["Concrete & Masonry","18%"],["Lumber & Framing","20%"],["Finish Carpentry & Millwork","22%"],["Tile, Stone & Flooring","25%"],["Fixtures & Hardware","20%"],["Landscaping Materials","22%"],["Specialty / Custom Items","28%"]]},
  {"type":"callout","callout_type":"info","text":"Material markups may be adjusted for large-volume projects (>$50K in materials) with prior manager approval. Do not negotiate markups directly with clients."},
  {"type":"section_heading","text":"Standard Production Rates"},
  {"type":"body","text":"These are benchmark production rates for common scope items. Actual rates may vary based on site conditions, access, and crew composition."},
  {"type":"table","cols":["Work Item","Production Rate","Notes"],"rows":[["Concrete flatwork (pour & finish)","150–200 sq ft / day / crew","Assumes standard 4-inch slab"],["Stamped concrete","80–120 sq ft / day / crew","Pattern complexity varies"],["Framing (wood frame walls)","150–200 LF / day / crew","Standard 2x6, 16-inch OC"],["Hardwood floor installation","300–400 sq ft / day / installer","Nail-down method"],["Tile installation","80–120 sq ft / day / installer","12x24 or smaller"],["Painting (interior)","400–600 sq ft / day / painter","2 coats, standard prep"],["Excavation (mini-excavator)","50–80 CY / day","Depends on soil type"]]}
]$c$::jsonb
WHERE title = 'Estimating Rate Sheet — 2026';


-- DOCUMENT 4: Proposal Template & Brand Guidelines ────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"Brand Standards Overview"},
  {"type":"body","text":"Every document that leaves Butler & Associates and reaches a client's hands is a reflection of our brand. This includes proposals, invoices, emails, and any printed materials. Consistent branding builds professionalism and trust."},
  {"type":"body","text":"The following standards apply to all client-facing documents. Deviations require approval from management."},
  {"type":"bullets","items":["Primary typeface: All documents use our standard approved fonts — do not use script, novelty, or non-approved fonts.","Company logo: Always use the approved logo file. Never stretch, recolor, or modify the logo.","Color palette: Proposals use our approved color scheme. Do not add new colors.","Document margins: 1-inch margins on all sides, standard header/footer included."]},
  {"type":"section_heading","text":"Proposal Structure (Required Order)"},
  {"type":"body","text":"All proposals must follow this section order. Additional sections may be added after Section 6 if needed."},
  {"type":"table","cols":["Section #","Section Name","Purpose"],"rows":[["1","Cover Page","Project name, client info, date, valid-through date"],["2","Project Overview","Brief narrative — what we are building and why it matters"],["3","Scope of Work","Detailed description of all work included"],["4","Exclusions","Explicit list of what is NOT included"],["5","Cost Breakdown","Line items grouped by category"],["6","Payment Schedule","Milestone-based payment plan"],["7","Terms & Conditions","Standard legal language — do not modify"],["8","Warranty Statement","Standard 1-year workmanship warranty language"]]},
  {"type":"callout","callout_type":"warning","text":"Never remove or modify the Terms & Conditions or Warranty Statement sections. These are reviewed by our insurance carrier. Any changes require written approval from ownership."},
  {"type":"section_heading","text":"Writing the Scope of Work"},
  {"type":"body","text":"The scope of work is the heart of your proposal. Write it in clear, plain English that a non-construction client can understand. Avoid all acronyms and technical jargon unless it is defined on first use."},
  {"type":"body","text":"The scope should describe what the completed project will look like and function as — not just a list of tasks. Start with the end state, then describe the process."},
  {"type":"bullets","items":["Open with a project vision sentence.","Organize work chronologically (site prep → structural → finishes → cleanup).","Be specific about materials: name the exact product, finish, and color.","Note all client-supplied materials or allowances explicitly."]},
  {"type":"section_heading","text":"Presenting & Delivering the Proposal"},
  {"type":"body","text":"Proposals are delivered via our CRM's proposal system, which generates a branded PDF and sends a tracked link to the client. Do not email raw PDF files from your personal email — use only the CRM system."},
  {"type":"body","text":"The system will notify you when the client opens the proposal. Use this as your trigger to follow up with a call within 2 hours of their first view."},
  {"type":"callout","callout_type":"tip","text":"Clients who open proposals within the first 24 hours have a 40% higher close rate. When you see that open notification come in, call immediately."}
]$c$::jsonb
WHERE title = 'Proposal Template & Brand Guidelines';


-- DOCUMENT 5: Non-Disclosure Agreement ───────────────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"Purpose & Scope"},
  {"type":"body","text":"This Non-Disclosure Agreement (NDA) governs the confidentiality obligations of all Butler & Associates employees with respect to company and client information. By beginning employment, you acknowledge and agree to the terms outlined here."},
  {"type":"body","text":"This agreement remains in effect for 2 years following the termination of employment, regardless of the reason for termination."},
  {"type":"callout","callout_type":"warning","text":"This is a legally binding document. Review it carefully. If you have questions, contact management before signing your employment acknowledgment form."},
  {"type":"section_heading","text":"What Is Considered Confidential"},
  {"type":"body","text":"The following categories of information are considered confidential and proprietary to Butler & Associates:"},
  {"type":"bullets","items":["Client names, contact information, project details, and communication history.","Pricing, cost structures, markup rates, and margin targets.","Vendor, subcontractor, and supplier agreements and pricing.","Employee compensation, performance data, and personnel records.","CRM data, pipeline reports, and revenue forecasts.","Internal processes, systems, training materials, and methodologies.","Any information marked Confidential or shared in a context where confidentiality is implied."]},
  {"type":"section_heading","text":"Prohibited Disclosures"},
  {"type":"body","text":"You may not share confidential information with any third party, including family members, former colleagues, competitors, or prospective employers, without prior written consent from company ownership."},
  {"type":"body","text":"Sharing client contact information with a competing company, or using client relationships developed during your employment to solicit business after leaving, is a violation of this agreement and may result in legal action."},
  {"type":"section_heading","text":"Permitted Uses"},
  {"type":"body","text":"Confidential information may only be used in the performance of your job duties at Butler & Associates. You may share confidential information internally on a need-to-know basis."},
  {"type":"body","text":"Information that is publicly available, or that was independently known to you prior to employment, is not subject to this agreement."},
  {"type":"section_heading","text":"Consequences of Breach"},
  {"type":"body","text":"A breach of this agreement may result in immediate termination, civil litigation for damages, and injunctive relief preventing further disclosure. Butler & Associates reserves all legal remedies available."},
  {"type":"body","text":"If you become aware of an actual or potential breach by any colleague, you are obligated to report it to management immediately."}
]$c$::jsonb
WHERE title = 'Non-Disclosure Agreement';


-- DOCUMENT 6: Safety & Jobsite Protocols ─────────────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"Safety Is Everyone's Responsibility"},
  {"type":"body","text":"While the sales team is not on-site for construction activities, you will visit active jobsites for client check-ins, walk-throughs, and progress reviews. Jobsite safety rules apply to everyone on site, regardless of role."},
  {"type":"body","text":"Ignorance of safety rules is not an acceptable defense for a violation. Review this document and ask the site PM if you have any questions before your first site visit."},
  {"type":"section_heading","text":"Personal Protective Equipment (PPE)"},
  {"type":"body","text":"The following PPE is required on all active construction sites:"},
  {"type":"bullets","items":["Hard hat: Required at all times within the active work zone.","High-visibility vest: Required whenever heavy equipment is operating nearby.","Closed-toe shoes: Required on all site visits. No exceptions.","Safety glasses: Required in areas where cutting, grinding, or debris is present.","Hearing protection: Available and recommended near loud power equipment."]},
  {"type":"callout","callout_type":"info","text":"A PPE kit (hard hat + vest) is available in every company vehicle and at the main office. Keep one in your personal vehicle if you conduct frequent site visits."},
  {"type":"section_heading","text":"Client Visit Protocols"},
  {"type":"body","text":"Always notify the project manager before arriving at an active jobsite — do not arrive unannounced. The PM needs to know who is on site for safety and liability tracking."},
  {"type":"body","text":"Do not bring clients onto an active site without prior PM approval and without providing PPE. If PPE is not available, the site visit must be rescheduled or conducted from the site perimeter."},
  {"type":"bullets","items":["Notify PM at least 2 hours before arriving on an active site.","Sign the site visitor log upon arrival and departure.","Stay out of active work areas unless accompanied by the PM.","Do not instruct workers directly — all direction goes through the PM.","Report any unsafe conditions to the PM immediately."]},
  {"type":"section_heading","text":"Incident Reporting"},
  {"type":"body","text":"Any injury, near-miss, or property damage occurring on or near a Butler & Associates jobsite must be reported to the PM and office manager within 1 hour of the incident, regardless of severity."},
  {"type":"body","text":"Do not discuss incidents with the client beyond acknowledgment. Refer all client questions to management."},
  {"type":"callout","callout_type":"warning","text":"Never admit fault or make statements about insurance or liability to a client or third party following an incident. Direct all such inquiries to ownership immediately."}
]$c$::jsonb
WHERE title = 'Safety & Jobsite Protocols';


-- DOCUMENT 7: Vendor & Subcontractor Directory ───────────────────────────

UPDATE public.onboarding_documents
SET content = $c$[
  {"type":"section_heading","text":"How to Use This Directory"},
  {"type":"body","text":"This directory lists approved vendors and subcontractors who have been vetted by our operations team. All subcontractors on this list carry valid licenses and insurance on file with our office."},
  {"type":"body","text":"Do not engage any subcontractor or vendor NOT on this list without prior approval from operations management. Unapproved subs create liability, insurance gaps, and quality risk."},
  {"type":"callout","callout_type":"info","text":"Subcontractor certificates of insurance expire annually. Always confirm with the operations team that a sub's COI is current before including them in a proposal timeline."},
  {"type":"section_heading","text":"Concrete & Masonry"},
  {"type":"table","cols":["Company","Contact","Specialty","Lead Time"],"rows":[["Valley Concrete Co.","Mike T. — (555) 210-4400","Flatwork, stamped, colored","3–5 business days"],["Summit Masonry","Carlos R. — (555) 318-7721","Block, stone, retaining walls","5–7 business days"],["Precision Pour LLC","Dana K. — (555) 409-2233","Structural slabs, foundations","7–10 business days"]]},
  {"type":"section_heading","text":"Electrical & Plumbing"},
  {"type":"table","cols":["Company","Contact","Specialty","Lead Time"],"rows":[["Brightline Electric","James P. — (555) 512-8800","Residential & light commercial","5 business days"],["Apex Plumbing Solutions","Sandra M. — (555) 607-3344","Residential remodel, rough & finish","3–5 business days"],["Mountain State Electric","Ryan B. — (555) 714-9900","Panel upgrades, outdoor lighting","7 business days"]]},
  {"type":"section_heading","text":"Landscaping & Outdoor Living"},
  {"type":"table","cols":["Company","Contact","Specialty","Lead Time"],"rows":[["Green Thumb Landscapes","Olivia T. — (555) 815-2211","Planting, irrigation, sod","5–7 business days"],["Rocky Mountain Hardscapes","Travis N. — (555) 901-5577","Pavers, retaining walls, fire pits","5 business days"],["Outdoor Oasis Design","Lin C. — (555) 1003-8844","Pergolas, outdoor kitchens, shade structures","10–14 business days"]]},
  {"type":"section_heading","text":"Preferred Material Suppliers"},
  {"type":"table","cols":["Supplier","Account Rep","Materials","Account #"],"rows":[["Builders Supply Co.","Tom A. — (555) 220-3300","Lumber, framing, hardware","BSC-8847"],["Pacific Stone & Tile","Mia R. — (555) 331-4410","Tile, stone, countertops","PST-2291"],["Western Ready Mix","Joe H. — (555) 442-5521","Concrete, grout, mortar","WRM-1134"],["Pella Windows & Doors","Karen L. — (555) 553-6632","Windows, exterior doors","PW-3345"]]}
]$c$::jsonb
WHERE title = 'Vendor & Subcontractor Directory';


-- ─── 4. KEY TAKEAWAYS ────────────────────────────────────────────────────────

UPDATE public.onboarding_modules SET key_takeaways = '["We are a referral-driven business — every client interaction matters.","Quality and integrity are non-negotiable. Never overpromise.","Sales is a team sport here. Collaborate early and often.","Your first 90 days are about learning the process, not closing volume."]'::jsonb WHERE title = 'Welcome to Butler & Associates';

UPDATE public.onboarding_modules SET key_takeaways = '["Every deal belongs in exactly one pipeline stage at all times.","No Prospect should go more than 3 days without outreach.","Present proposals live whenever possible — it significantly improves close rates.","Your relationship with the client does not end at contract signing."]'::jsonb WHERE title = 'Our Sales Process';

UPDATE public.onboarding_modules SET key_takeaways = '["Always use the current Rate Sheet — never quote labor from memory.","Proposals are valid for 30 days due to material price volatility.","Target gross margin is 20–30%. Never go below 15% without manager approval.","Markup % and Gross Margin % are different calculations — know both."]'::jsonb WHERE title = 'Construction Estimating Basics';

UPDATE public.onboarding_modules SET key_takeaways = '["Always follow the standard proposal format — it builds brand trust.","Lead with vision before numbers to anchor value in the client''s mind.","Follow up within 3–5 business days of proposal delivery.","Do not discount immediately — ask what specifically feels out of range first."]'::jsonb WHERE title = 'Building a Winning Proposal';

UPDATE public.onboarding_modules SET key_takeaways = '["Return calls within 2 hours, emails within 4 hours during business hours.","Use a warm, knowledgeable-neighbor tone — never overly formal or too casual.","Always end every message with a clear next step.","Log every client interaction in the CRM within 24 hours."]'::jsonb WHERE title = 'Client Communication Standards';

UPDATE public.onboarding_modules SET key_takeaways = '["The CRM is your professional obligation — leadership reviews it daily.","Only advance deals when the stage criteria are genuinely met.","Log every interaction within 15 minutes while details are fresh.","Review the Stats dashboard every Monday morning before client calls."]'::jsonb WHERE title = 'CRM Mastery';
