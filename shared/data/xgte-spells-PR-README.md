# Xanathar's Guide to Everything (XGtE) Spells - Addition Summary

## Overview
This PR adds spells from Xanathar's Guide to Everything to the master spells data file.

## Statistics
- **Total XGtE spells processed**: 78
- **Spells added**: 78
- **Spells skipped (duplicates)**: 0
- **Total spells after merge**: 127

## Files Changed
- `shared/data/spells.json` - Updated with XGtE spells (sorted alphabetically by id)
- `shared/data/xgte-spells-PR-README.md` - This changelog file

## Technical Details
- All XGtE spells follow the project's spell schema
- Deduplication performed by spell `id` field (kebab-case)
- Existing spells were preserved (not overwritten)
- Spells sorted alphabetically by `id` for maintainability
- Source field set to "XGtE p.XXX" for attribution

## Seeding Compatibility
The existing seeding code in `server/seed-spells.ts` already uses `onConflictDoNothing()`, 
so it will safely handle these additions without creating duplicates in the database.

## Spells Added (78 total)
1. Abi-Dalzim’s Horrid Wilting
2. Absorb Elements
3. Aganazzar’s Scorcher
4. Animate Objects
5. Beast Bond
6. Catapult
7. Catnap
8. Cause Fear
9. Ceremony
10. Chaos Bolt
11. Charm Monster
12. Control Flames
13. Control Winds
14. Create Bonfire
15. Create Homunculus
16. Crown of Stars
17. Danse Macabre
18. Dawn
19. Dragon’s Breath
20. Dust Devil
21. Earth Tremor
22. Earthbind
23. Elemental Bane
24. Enemies Abound
25. Enervation
26. Erupting Earth
27. Find Greater Steed
28. Flame Arrows
29. Frostbite
30. Guardian of Faith
31. Guardian of Nature
32. Gust
33. Healing Spirit
34. Holy Weapon
35. Ice Knife
36. Immolation
37. Infestation
38. Investiture of Flame
39. Investiture of Ice
40. Investiture of Stone
41. Investiture of Wind
42. Invulnerability
43. Life Transference
44. Maddening Darkness
45. Maelstrom
46. Maximilian’s Earthen Grasp
47. Melf’s Minute Meteors
48. Mental Prison
49. Mind Whip
50. Mold Earth
51. Power Word Pain
52. Psychic Scream
53. Pyrotechnics
54. Scatter
55. Shadow Blade
56. Shape Water
57. Sickening Radiance
58. Skill Empowerment
59. Skywrite
60. Snilloc’s Snowball Swarm
61. Soul Cage
62. Storm Sphere
63. Synaptic Static
64. Tenser’s Floating Disk
65. Thunder Step
66. Thunderclap
67. Tidal Wave
68. Tiny Servant
69. Toll the Dead
70. Transmute Rock
71. Vitriolic Sphere
72. Wall of Light
73. Wall of Water
74. Warding Wind
75. Watery Sphere
76. Word of Recall
77. Wrath of Nature
78. Zephyr Strike



## Next Steps
The spells will be automatically seeded into the database when the server starts if the 
spells table is empty, or can be manually seeded using the appropriate seed command.
