// System prompt registry

import { DND_SYSTEM_PROMPT } from "./dnd";
import { CYBERPUNK_SYSTEM_PROMPT } from "./cyberpunk";
import type { GameSystem } from "./base";

const SYSTEM_PROMPTS: Record<string, string> = {
  dnd: DND_SYSTEM_PROMPT,
  cyberpunk: CYBERPUNK_SYSTEM_PROMPT,
};

export function getSystemPrompt(gameSystem: string): string {
  return SYSTEM_PROMPTS[gameSystem] || SYSTEM_PROMPTS.dnd;
}

export { DND_SYSTEM_PROMPT, CYBERPUNK_SYSTEM_PROMPT };
export type { GameSystem };
