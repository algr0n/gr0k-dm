// Centralized constants for AI model configuration
// Keep a single source of truth for the Grok model to ensure all code
// and documentation use the same model string. Update only after
// a short review if moving to a newer/better model.
export const DEFAULT_GROK_MODEL = "grok-4-1-fast-reasoning";

// Helper regex for tests and validation
export const GROK_MODEL_REGEX = /grok-[0-9a-zA-Z-_.-]+/g;
