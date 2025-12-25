import OpenAI from "openai";
import { tokenTracker } from "../utils/token-tracker";

export async function generateCombatStage(openaiClient: OpenAI, locationName: string, seed?: string) {
  const prompt = `You are generating a JSON combat stage for a location named "${locationName}". Return ONLY valid JSON.
Return an object with: { features: [{type:'cover'|'difficult'|'high_ground'|'hazard', position:{x:number,y:number}, radius:number, properties:{}}], spawns: [{monster:string,count:number, position:{x,y}}], summary: string }
Seed: ${seed || 'none'}
Keep the output concise and strictly JSON.`;

  try {
    const response = await openaiClient.chat.completions.create({
      model: "grok-4-1-fast-reasoning",
      messages: [{ role: 'system', content: 'You generate structured JSON for combat stages.' }, { role: 'user', content: prompt }],
      max_tokens: 300,
      temperature: 0.0,
    });

    tokenTracker.track(seed || locationName, response.usage);
    const raw = response.choices[0]?.message?.content || "";
    // Try to parse JSON from raw text
    const jsonStart = raw.indexOf('{');
    const json = jsonStart !== -1 ? raw.slice(jsonStart) : raw;
    const parsed = JSON.parse(json);
    return parsed;
  } catch (err) {
    console.warn('Stage generator failed or returned invalid JSON:', err);
    // Fallback: simple empty stage
    return { features: [], spawns: [], summary: `Empty stage for ${locationName}` };
  }
}
