import { describe, it, expect, vi, beforeEach } from 'vitest';
import { generateStartingScene } from '../../server/generators/scene';

// Mock OpenAI client
const mockOpenAI = {
  chat: {
    completions: {
      create: vi.fn(),
    },
  },
} as any;

beforeEach(() => {
  vi.clearAllMocks();
});

describe('generateStartingScene', () => {
  it('includes adventure chapter context in prompt when provided', async () => {
    // Setup mock response
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Welcome, brave adventurer Jordan, to the Lost Mine of Phandelver!',
          },
        },
      ],
    });

    const character = {
      characterName: 'Jordan',
      class: 'Fighter',
      race: 'Human',
      level: 1,
      background: 'Soldier',
    };

    const chapter = {
      title: 'Lost Mine of Phandelver',
      summary: 'A classic adventure begins',
      description: 'Your adventure starts on the High Road...',
    };

    const result = await generateStartingScene(
      mockOpenAI,
      'dnd',
      'Test Adventure',
      character,
      chapter
    );

    // Verify the function was called
    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();

    // Get the actual prompt sent to the AI
    const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const userMessage = call.messages.find((m: any) => m.role === 'user');

    // Verify the prompt includes character details
    expect(userMessage.content).toContain('Jordan');
    expect(userMessage.content).toContain('level 1');
    expect(userMessage.content).toContain('Human');
    expect(userMessage.content).toContain('Fighter');
    expect(userMessage.content).toContain('Soldier');

    // Verify the prompt includes chapter information
    expect(userMessage.content).toContain('Lost Mine of Phandelver');
    expect(userMessage.content).toContain('A classic adventure begins');
    expect(userMessage.content).toContain('Your adventure starts on the High Road...');

    // Verify it's asking for a blend of both
    expect(userMessage.content).toContain('pre-made adventure');
    expect(userMessage.content).toContain('Blend');

    // Check that result is returned
    expect(result).toBe('Welcome, brave adventurer Jordan, to the Lost Mine of Phandelver!');
  });

  it('generates dynamic adventure prompt without chapter context', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Welcome Jordan! What tone do you prefer for this adventure?',
          },
        },
      ],
    });

    const character = {
      characterName: 'Jordan',
      class: 'Wizard',
      race: 'Elf',
      level: 3,
      background: 'Sage',
    };

    const result = await generateStartingScene(
      mockOpenAI,
      'dnd',
      'Dynamic Adventure',
      character
      // No chapter parameter
    );

    expect(mockOpenAI.chat.completions.create).toHaveBeenCalled();

    const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const userMessage = call.messages.find((m: any) => m.role === 'user');

    // Verify dynamic adventure prompt doesn't mention pre-made adventure
    expect(userMessage.content).not.toContain('pre-made adventure');
    expect(userMessage.content).toContain('Jordan');
    expect(userMessage.content).toContain('tone');

    expect(result).toBe('Welcome Jordan! What tone do you prefer for this adventure?');
  });

  it('handles chapter without summary gracefully', async () => {
    mockOpenAI.chat.completions.create.mockResolvedValue({
      choices: [
        {
          message: {
            content: 'Welcome to the adventure!',
          },
        },
      ],
    });

    const character = {
      characterName: 'TestChar',
      class: 'Rogue',
      race: 'Halfling',
      level: 2,
      background: null,
    };

    const chapter = {
      title: 'Chapter 1',
      summary: null, // No summary
      description: 'The story begins...',
    };

    await generateStartingScene(
      mockOpenAI,
      'dnd',
      'Test',
      character,
      chapter
    );

    const call = mockOpenAI.chat.completions.create.mock.calls[0][0];
    const userMessage = call.messages.find((m: any) => m.role === 'user');

    // Should still include title and description
    expect(userMessage.content).toContain('Chapter 1');
    expect(userMessage.content).toContain('The story begins...');
    // Summary line should be skipped if null
    expect(userMessage.content).toContain('**Chapter 1**');
  });

  it('returns fallback message on error', async () => {
    mockOpenAI.chat.completions.create.mockRejectedValue(new Error('API Error'));

    const result = await generateStartingScene(
      mockOpenAI,
      'dnd',
      'Test Adventure'
    );

    expect(result).toBe('Welcome, adventurers! Tell me about your characters and what kind of adventure you\'re looking for.');
  });
});
