import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'
import { globSync } from 'glob'
import path from 'path'

// Files to scan (exclude node_modules, .git, dist, build)
const patterns = ['**/*.{md,ts,js,tsx,jsx,json}']
const IGNORE = ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/coverage/**']

const MODEL_CANONICAL = 'grok-4-1-fast-reasoning'
const MODEL_REGEX = /grok-[0-9][0-9A-Za-z._-]*/gi

describe('AI model consistency', () => {
  it('only uses the canonical Grok model across the repo', () => {
    const files = patterns.flatMap(p => globSync(p, { ignore: IGNORE }))

    const offenders: Array<{ file: string; match: string }> = []

    for (const file of files) {
      try {
        const abs = path.resolve(file)
        const content = readFileSync(abs, 'utf8')
        let m: RegExpExecArray | null
        while ((m = MODEL_REGEX.exec(content)) !== null) {
          const found = m[0]
          if (found.toLowerCase() !== MODEL_CANONICAL.toLowerCase()) {
            offenders.push({ file, match: found })
          }
        }
      } catch (err) {
        // ignore binary or unreadable files
      }
    }

    if (offenders.length > 0) {
      const examples = offenders.slice(0, 10).map(o => `${o.file}: ${o.match}`).join('\n')
      throw new Error(`Found non-canonical Grok model strings in the repo:\n${examples}\n\nPlease replace them with '${MODEL_CANONICAL}' or update 'server/constants.ts' to change the canonical model.`)
    }

    expect(offenders.length).toBe(0)
  })
})
