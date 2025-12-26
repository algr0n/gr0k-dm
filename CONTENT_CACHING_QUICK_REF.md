# Custom Content Caching - Quick Reference

## 🎯 What's New

**Custom items created by the AI are now globally reusable** - when the AI creates an item like "Shadowstrike Dagger" or "Potion of Dragon's Breath", it's saved permanently and can be used in any future game without regenerating.

## 🎮 How It Works

### For Players
- When you receive a custom item as a quest reward, it's created once
- The same item in other campaigns will have identical stats
- No waiting for AI to regenerate items that already exist

### For DMs
Use `[ITEM: ItemName]` tags to give items - the system automatically:
1. Checks if item exists in database
2. Reuses it if found
3. Generates with AI only if new
4. Saves for future use

## 📊 Content Caching Status

### ✅ Monsters (Already Implemented)
- **150+ common D&D monsters** automatically cached
- Examples: wolf, goblin, skeleton, orc, dragon, beholder
- First encounter → AI generates → saves to cache
- Later encounters → instant reuse

**Cacheable Monster Types**:
- Beasts: ape, bear, boar, wolf, spider, hawk, owl, rat, snake
- Humanoids: goblin, orc, kobold, gnoll, hobgoblin, bandit, cultist
- Undead: skeleton, zombie, ghoul, wight, wraith, vampire spawn
- Dragons: wyrmling, young, adult, ancient (all colors)
- Giants: ogre, troll, hill/stone/frost/fire/cloud/storm giant
- Elementals: air/earth/fire/water elemental, mephits
- Fiends: imp, quasit, hell hound, nightmare, devils
- Monstrosities: basilisk, chimera, hydra, owlbear, minotaur
- [See full list in `server/routes.ts` lines 76-130]

### ✅ Items (Just Implemented)
- **All custom AI-generated items** automatically cached
- Works for: weapons, armor, potions, scrolls, wondrous items
- Examples: "Shadowstrike Dagger", "Cloak of Whispers", "Potion of Giant Strength"

### 🔜 Future Caching Opportunities
- Spells (custom homebrew spells)
- Locations (taverns, shops, dungeons)
- NPCs (recurring characters across campaigns)

## 🛠️ Technical Details

### Monster Caching
```
File: server/routes.ts
Function: isCacheableNpcType()
Table: npcStatsCache
Whitelist: CACHEABLE_NPC_TYPES (150+ monsters)
```

### Item Caching
```
File: server/utils/item-creation.ts
Function: createItemFromReward()
Table: items
Lookup: By item name (exact match, case-insensitive)
```

### Lookup Flow
```
Request → Memory Cache → Database → AI Generation → Save
          (instant)     (5-20ms)   (1-3 seconds)    (persistent)
```

## 📝 Examples

### Monster Spawning
```
DM: "Three wolves emerge from the forest"
System: 
  → Detects "wolf" (cacheable type)
  → Checks cache → Found!
  → Creates 3 wolf spawns with cached stats
  → No AI call needed
```

### Custom Item Creation
```
DM: [ITEM: Shadowstrike Dagger]
System:
  → Checks items table → Not found
  → Generates with AI (magic dagger, +1d6 shadow damage)
  → Saves to database
  → Player receives item

Later game in different room:
DM: [ITEM: Shadowstrike Dagger]
System:
  → Checks items table → Found!
  → Reuses exact same stats
  → Instant delivery
```

### Standard D&D Items
```
DM: [ITEM: Longsword +1]
System:
  → Checks items table → Found (from initial seed)
  → Instant delivery
  → No AI call
```

## 🚀 Performance Impact

### Before
- Every custom item: 1-3 seconds (AI generation)
- Every generic monster: 1-3 seconds (AI generation)

### After
- Cached items: 5-20ms (database lookup)
- Cached monsters: 5-20ms (database lookup)
- **100-600x faster** for repeated content

## 🎯 Best Practices

### For Custom Items
- ✅ Use consistent naming: "Potion of Healing" not "healing potion"
- ✅ Be specific: "Shadowstrike Dagger" not "a dagger"
- ✅ Creative names work: "Grimjaw's Greataxe", "Starlight Bow"
- ❌ Avoid generic terms: "sword", "potion", "weapon"

### For Monsters
- ✅ Generic types auto-cache: "wolf", "goblin", "dragon"
- ✅ Named characters DON'T cache: "Grimjaw the Orc" (unique)
- ✅ Use [SPAWN:] tags for explicit control: `[SPAWN: Wolf | 3]`
- ❌ Avoid relying on auto-detection for complex encounters

## 📋 Testing Checklist

### Verify Monster Caching
```bash
# Start game, spawn wolf
[SPAWN: Wolf | 1]

# Check logs
[Monster Cache] Found cached wolf stats
[Combat] Created wolf spawn
```

### Verify Item Caching
```bash
# Give custom item first time
[ITEM: ElvenBow +2]

# Check logs
[Item Creation] Generating AI stats for item: "ElvenBow +2"
[Item Creation] Successfully created item "ElvenBow +2"

# Give same item again (same or different room)
[ITEM: ElvenBow +2]

# Check logs
[Item Creation] Found existing item in database: "ElvenBow +2"
```

## 🔍 Troubleshooting

### Items Not Caching
**Check**: Item name spelling must be identical
- "Healing Potion" ≠ "healing potion" ❌
- "Sword +1" ≠ "Sword+1" ❌

**Solution**: Use exact same string

### Monsters Not Caching
**Check**: Is it a whitelisted type?
- "wolf" → ✅ Cached
- "Dire Wolf" → ✅ Cached  
- "Grimjaw the Wolf Lord" → ❌ Not cached (named character)

**Solution**: Generic types cache, named NPCs don't

### AI Generation Failing
**Check**: API credentials
```bash
echo $XAI_API_KEY
```

**Solution**: System falls back to generic template if AI fails

## 📚 Related Documentation

- [ITEM_CACHING_SUMMARY.md](./ITEM_CACHING_SUMMARY.md) - Full technical details
- [MONSTER_CACHE_SUMMARY.md](./MONSTER_CACHE_SUMMARY.md) - Monster caching system
- [docs/bestiary.md](./docs/bestiary.md) - Monster database reference
- [server/routes.ts](./server/routes.ts) - Implementation code

---

**Status**: ✅ Live and Tested  
**Version**: 1.0  
**Last Updated**: December 24, 2024
