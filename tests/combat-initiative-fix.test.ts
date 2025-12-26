import { describe, it, expect } from "vitest";
import { rollInitiativesForCombat } from "../server/combat";

describe("Combat initiative fix", () => {
  it("rolls initiatives and creates proper InitiativeEntry objects", () => {
    // Test 1: Mock data with character and monster
    
    const mockChars = [{
      id: "char-123",
      userId: "user-456",
      name: "Test Wizard",
      initMod: 2
    }];
    
    const mockPlayers = [{
      id: "player-789",
      userId: "user-456",
      name: "TestPlayer"
    }];
    
    const mockMonsters = [{
      id: "monster-001",
      name: "Goblin",
      statsBlock: {
        name: "Goblin",
        ac: 15,
        hp: 7,
        maxHp: 7,
        initiativeModifier: 2
      }
    }];
    
    const initiatives = rollInitiativesForCombat(mockChars, mockPlayers, mockMonsters);
    
    expect(initiatives.length).toBeGreaterThan(0);
    expect(initiatives.length).toBe(2);
  });

  it("initiatives have correct structure matching InitiativeEntry interface", () => {
    const mockChars = [{
      id: "char-123",
      userId: "user-456",
      name: "Test Wizard",
      initMod: 2
    }];
    
    const mockPlayers = [{
      id: "player-789",
      userId: "user-456",
      name: "TestPlayer"
    }];
    
    const mockMonsters = [{
      id: "monster-001",
      name: "Goblin",
      statsBlock: {
        name: "Goblin",
        ac: 15,
        hp: 7,
        maxHp: 7,
        initiativeModifier: 2
      }
    }];
    
    const initiatives = rollInitiativesForCombat(mockChars, mockPlayers, mockMonsters);
    
    const firstInit = initiatives[0];
    const requiredFields = ['id', 'controller', 'name', 'roll', 'modifier', 'total'];
    
    requiredFields.forEach(field => {
      expect(firstInit).toHaveProperty(field);
    });
    
    expect(['player', 'monster', 'dm']).toContain(firstInit.controller);
  });

  it("combat state can be populated with initiatives (simulates the fix)", () => {
    const mockChars = [{
      id: "char-123",
      userId: "user-456",
      name: "Test Wizard",
      initMod: 2
    }];
    
    const mockPlayers = [{
      id: "player-789",
      userId: "user-456",
      name: "TestPlayer"
    }];
    
    const mockMonsters = [{
      id: "monster-001",
      name: "Goblin",
      statsBlock: {
        name: "Goblin",
        ac: 15,
        hp: 7,
        maxHp: 7,
        initiativeModifier: 2
      }
    }];
    
    const initiatives = rollInitiativesForCombat(mockChars, mockPlayers, mockMonsters);
    const mockCombatState = {
      isActive: true,
      roomCode: "TEST",
      roundNumber: 1,
      currentTurnIndex: 0,
      initiatives: [] as any[],
      actionHistory: []
    };
    
    // This is what the fixed code now does
    mockCombatState.initiatives = initiatives;
    
    expect(mockCombatState.initiatives.length).toBeGreaterThan(0);
    expect(mockCombatState.initiatives).toBe(initiatives);
    expect(mockCombatState.initiatives[mockCombatState.currentTurnIndex]).toBeDefined();
    expect(mockCombatState.initiatives[mockCombatState.currentTurnIndex].name).toBeTruthy();
  });
});
