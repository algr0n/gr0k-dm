/**
 * Shared type definitions for character sheet components
 */

export interface Skill {
  name: string;
  ability: string;
  bonus: number;
  isProficient: boolean;
  hasExpertise: boolean;
  sources?: string[];
}
