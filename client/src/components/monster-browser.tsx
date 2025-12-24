import React, { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Input } from "./ui/input"
import { Button } from "./ui/button"

// Minimal monster browser for bestiary
export function MonsterBrowser({ monsters }: { monsters: Array<{ name: string; type: string; cr: string; hp: string; ac: number }> }) {
  const [query, setQuery] = useState("")
  const filtered = monsters.filter(m => m.name.toLowerCase().includes(query.toLowerCase()) || m.type.toLowerCase().includes(query.toLowerCase()))
  return (
    <Card className="w-full max-w-2xl mx-auto my-8">
      <CardHeader>
        <CardTitle>Monster Bestiary</CardTitle>
        <Input placeholder="Search monsters..." value={query} onChange={e => setQuery(e.target.value)} className="mt-2" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filtered.length === 0 && <div className="text-muted-foreground">No monsters found.</div>}
          {filtered.map(monster => (
            <div key={monster.name} className="border rounded p-2 flex flex-col gap-1 bg-card/50">
              <div className="font-semibold">{monster.name}</div>
              <div className="text-xs">Type: {monster.type} | CR: {monster.cr} | HP: {monster.hp} | AC: {monster.ac}</div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}
