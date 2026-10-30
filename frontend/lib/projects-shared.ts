import type { ProjectStage } from "@prisma/client";

export const PROJECT_STAGES: ProjectStage[] = ["IDEA", "WRITING", "RECORDING", "REVIEWING", "RELEASED"];
export const STAGE_LABEL: Record<ProjectStage, string> = { IDEA: "Ideas", WRITING: "Writing", RECORDING: "Recording", REVIEWING: "Reviewing", RELEASED: "Released" };
