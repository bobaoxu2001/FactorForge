import type { ResearchProjectConfig } from "../types";
import { FREIGHT_PROJECT } from "./freight";

/** Registry of research projects. Each needs a snapshot under src/__fixtures__/research/<id>/. */
export const RESEARCH_PROJECTS: ResearchProjectConfig[] = [FREIGHT_PROJECT];

export const FEATURED_PROJECT_ID = FREIGHT_PROJECT.id;
