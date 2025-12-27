// Conversation summarization for long adventures

import OpenAI from "openai";
import type { Message } from "@shared/schema";
import { DEFAULT_GROK_MODEL } from "../constants";

// Context window management for long adventures
interface ConversationSummary {
  summary: string;
  messageCount: number;
  lastSummaryAt: number;
}

// Conversation summaries per room (in-memory cache)
const conversationSummaries = new Map<string, ConversationSummary>();

// Summarize old conversation to maintain context without hitting token limits
export async function summarizeConversation(
  openaiClient: OpenAI,
  messages: Message[],
  gameSystem: string
): Promise<string> {
  try {
    const messageSummary = messages
      .map(m => `${m.playerName}: ${m.content.slice(0, 100)}${m.content.length > 100 ? '...' : ''}`)
      .join('\n');

    const response = await openaiClient.chat.completions.create({
      model: DEFAULT_GROK_MODEL,
      messages: [
        {
          role: "system",
          content: "Summarize this D&D session conversation in 2-3 paragraphs. Focus on: key story events, character decisions, important NPCs met, items found, and current objectives. Be concise but preserve critical details."
        },
        {
          role: "user",
          content: `Summarize this session:\n\n${messageSummary}`
        }
      ],
      max_tokens: 400,
      temperature: 0.5,
    });

    return response.choices[0]?.message?.content || "Previous session summary unavailable.";
  } catch (error) {
    console.error("Error summarizing conversation:", error);
    return "Previous session summary unavailable.";
  }
}

export async function getOrCreateConversationSummary(
  openaiClient: OpenAI,
  roomId: string,
  messages: Message[],
  gameSystem: string
): Promise<string | null> {
  // Only summarize if we have more than 30 messages
  if (messages.length <= 30) {
    return null;
  }

  const existing = conversationSummaries.get(roomId);
  const now = Date.now();
  
  // Re-summarize every 20 new messages or if no summary exists
  if (!existing || messages.length - existing.messageCount >= 20) {
    // Summarize messages 10-30 from the end (keep recent context fresh)
    const messagesToSummarize = messages.slice(0, -10);
    const summary = await summarizeConversation(openaiClient, messagesToSummarize, gameSystem);
    
    conversationSummaries.set(roomId, {
      summary,
      messageCount: messages.length,
      lastSummaryAt: now,
    });
    
    console.log(`[Context Management] Summarized ${messagesToSummarize.length} messages for room ${roomId}`);
    return summary;
  }
  
  return existing.summary;
}
