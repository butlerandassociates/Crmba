/**
 * API Index
 * Single entry point — import any API from here.
 *
 * Usage:
 *   import { clientsAPI, projectsAPI } from "@/app/api";
 */

export { clientsAPI }                                    from "./clients";
export { projectsAPI }                                   from "./projects";
export { appointmentsAPI }                               from "./appointments";
export { estimatesAPI }                                  from "./estimates";
export { usersAPI }                                      from "./team";
export { pipelineStagesAPI, leadSourcesAPI }             from "./pipeline";
export { productsAPI }                                   from "./products";
export { companySettingsAPI, emailTemplatesAPI, rolesAPI, permissionsAPI } from "./settings";
export { filesAPI, photosAPI }                           from "./files";
export { notesAPI, actionLogsAPI }                       from "./notes";
