// Base types and utilities for system prompts

export type GameSystem = "dnd" | "cyberpunk";

export interface SystemPromptOptions {
  gameSystem: GameSystem;
}
