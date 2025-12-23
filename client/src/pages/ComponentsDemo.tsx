import { useState } from "react";
import { InventoryLayout } from "@/components/inventory/InventoryLayout";
import { CharacterSummaryBar } from "@/components/character-sheet/CharacterSummaryBar";
import { AbilityScoresPanel } from "@/components/character-sheet/AbilityScoresPanel";
import { SkillsList } from "@/components/character-sheet/SkillsList";
import { ActionsPanel } from "@/components/character-sheet/ActionsPanel";
import { SpellsPanel } from "@/components/character-sheet/SpellsPanel";
import { ResourcesPanel } from "@/components/character-sheet/ResourcesPanel";
import { ConditionsBadges } from "@/components/character-sheet/ConditionsBadges";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import type { CharacterInventoryItemWithDetails } from "@shared/schema";

// Mock data for demonstration
const mockInventory: CharacterInventoryItemWithDetails[] = [
  {
    id: "1",
    characterId: "char1",
    itemId: "longsword",
    quantity: 1,
    equipped: true,
    notes: null,
    attunementSlot: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    item: {
      id: "longsword",
      name: "Longsword +1",
      category: "weapon",
      type: "Martial Weapon",
      subtype: "Melee",
      rarity: "uncommon",
      cost: 50,
      weight: 3,
      description: "A finely crafted longsword with a +1 bonus to attack and damage rolls.",
      properties: {
        damage: { damage_dice: "1d8", damage_type: { name: "slashing" } },
        properties: [{ name: "Versatile (1d10)" }],
      },
      requiresAttunement: false,
      gameSystem: "dnd",
      source: "PHB",
      createdAt: new Date(),
    },
  },
  {
    id: "2",
    characterId: "char1",
    itemId: "chainmail",
    quantity: 1,
    equipped: true,
    notes: null,
    attunementSlot: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    item: {
      id: "chainmail",
      name: "Chain Mail",
      category: "armor",
      type: "Heavy Armor",
      subtype: null,
      rarity: "common",
      cost: 75,
      weight: 55,
      description: "Made of interlocking metal rings, chain mail includes a layer of quilted fabric worn underneath the mail to prevent chafing and to cushion the impact of blows.",
      properties: {
        armor_class: { base: 16, dex_bonus: false },
      },
      requiresAttunement: false,
      gameSystem: "dnd",
      source: "PHB",
      createdAt: new Date(),
    },
  },
  {
    id: "3",
    characterId: "char1",
    itemId: "potion-healing",
    quantity: 3,
    equipped: false,
    notes: null,
    attunementSlot: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    item: {
      id: "potion-healing",
      name: "Potion of Healing",
      category: "potion",
      type: "Potion",
      subtype: null,
      rarity: "common",
      cost: 50,
      weight: 0.5,
      description: "You regain 2d4 + 2 hit points when you drink this potion.",
      properties: {},
      requiresAttunement: false,
      gameSystem: "dnd",
      source: "DMG",
      createdAt: new Date(),
    },
  },
  {
    id: "4",
    characterId: "char1",
    itemId: "cloak-protection",
    quantity: 1,
    equipped: false,
    notes: null,
    attunementSlot: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    item: {
      id: "cloak-protection",
      name: "Cloak of Protection",
      category: "wondrous_item",
      type: "Wondrous Item",
      subtype: null,
      rarity: "rare",
      cost: 3500,
      weight: 1,
      description: "You gain a +1 bonus to AC and saving throws while you wear this cloak.",
      properties: {},
      requiresAttunement: true,
      gameSystem: "dnd",
      source: "DMG",
      createdAt: new Date(),
    },
  },
];

const mockSkills = [
  { name: "Acrobatics", ability: "dexterity", bonus: 5, isProficient: true, hasExpertise: false, sources: ["Class"] },
  { name: "Athletics", ability: "strength", bonus: 6, isProficient: true, hasExpertise: true, sources: ["Class", "Background"] },
  { name: "Perception", ability: "wisdom", bonus: 3, isProficient: true, hasExpertise: false, sources: ["Race"] },
  { name: "Stealth", ability: "dexterity", bonus: 5, isProficient: true, hasExpertise: false, sources: ["Class"] },
  { name: "Investigation", ability: "intelligence", bonus: 0, isProficient: false, hasExpertise: false },
  { name: "Persuasion", ability: "charisma", bonus: 2, isProficient: false, hasExpertise: false },
];

const mockAttacks = [
  { name: "Longsword +1", toHit: 7, damage: "1d8+5", damageType: "slashing", range: "5 ft." },
  { name: "Longbow", toHit: 5, damage: "1d8+3", damageType: "piercing", range: "150/600 ft." },
];

const mockFeatures = [
  { name: "Second Wind", description: "Regain 1d10 + fighter level HP", uses: { current: 1, max: 1 } },
  { name: "Action Surge", description: "Take an additional action", uses: { current: 1, max: 1 } },
];

const mockSpells = [
  {
    name: "Fire Bolt",
    level: 0,
    school: "Evocation",
    castingTime: "1 action",
    range: "120 feet",
    duration: "Instantaneous",
    concentration: false,
    ritual: false,
    description: "You hurl a mote of fire at a creature or object within range. Make a ranged spell attack. On a hit, the target takes 1d10 fire damage.",
  },
  {
    name: "Shield",
    level: 1,
    school: "Abjuration",
    castingTime: "1 reaction",
    range: "Self",
    duration: "1 round",
    concentration: false,
    ritual: false,
    description: "An invisible barrier of magical force appears and protects you. Until the start of your next turn, you have a +5 bonus to AC.",
  },
];

export default function ComponentsDemo() {
  return (
    <div className="min-h-screen bg-background p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        <div className="text-center space-y-2">
          <h1 className="font-serif text-4xl font-bold">UI Components Demo</h1>
          <p className="text-muted-foreground">
            Showcase of the new inventory and character sheet components
          </p>
        </div>

        <Tabs defaultValue="inventory" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="inventory">Inventory</TabsTrigger>
            <TabsTrigger value="character">Character Sheet</TabsTrigger>
            <TabsTrigger value="spells">Spells & Actions</TabsTrigger>
            <TabsTrigger value="resources">Resources</TabsTrigger>
          </TabsList>

          <TabsContent value="inventory" className="space-y-4">
            <Card className="p-6">
              <h2 className="font-serif text-2xl font-semibold mb-4">Enhanced Inventory System</h2>
              <InventoryLayout
                items={mockInventory}
                gold={150}
                armorClass={18}
                currentWeight={59.5}
                maxWeight={180}
                attunedCount={0}
                maxAttunement={3}
              />
            </Card>
          </TabsContent>

          <TabsContent value="character" className="space-y-4">
            <CharacterSummaryBar
              characterName="Thorin Ironforge"
              race="Mountain Dwarf"
              characterClass="Fighter"
              level={5}
              currentHp={42}
              maxHp={52}
              tempHp={5}
              armorClass={18}
              initiative={1}
              speed={25}
              proficiencyBonus={3}
            />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <AbilityScoresPanel
                  strength={{ score: 18, modifier: 4 }}
                  dexterity={{ score: 12, modifier: 1 }}
                  constitution={{ score: 16, modifier: 3 }}
                  intelligence={{ score: 10, modifier: 0 }}
                  wisdom={{ score: 13, modifier: 1 }}
                  charisma={{ score: 8, modifier: -1 }}
                />
              </Card>

              <Card className="p-6">
                <SkillsList
                  skills={mockSkills}
                  proficiencyBonus={3}
                  hasReliableTalent={false}
                />
              </Card>
            </div>

            <Card className="p-6">
              <div className="mb-4">
                <h3 className="font-serif text-lg font-semibold mb-2">Status Effects</h3>
                <ConditionsBadges
                  conditions={[
                    { name: "Blessed", description: "Add 1d4 to attack rolls and saving throws" },
                    { name: "Concentration", description: "Maintaining a spell" },
                  ]}
                />
              </div>
            </Card>
          </TabsContent>

          <TabsContent value="spells" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card className="p-6">
                <ActionsPanel attacks={mockAttacks} features={mockFeatures} />
              </Card>

              <Card className="p-6">
                <SpellsPanel
                  spells={mockSpells}
                  spellSlots={{
                    current: [0, 3, 2, 0, 0, 0, 0, 0, 0, 0],
                    max: [0, 4, 3, 0, 0, 0, 0, 0, 0, 0],
                  }}
                />
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="resources" className="space-y-4">
            <Card className="p-6 max-w-md mx-auto">
              <ResourcesPanel
                hitDice={[
                  { diceType: "d10", current: 3, max: 5 },
                ]}
                deathSaves={{ successes: 1, failures: 0 }}
              />
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
