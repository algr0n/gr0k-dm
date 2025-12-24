import { useQuery } from "@tanstack/react-query"
import { MonsterBrowser } from "@/components/monster-browser"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

export default function BestiaryPage() {
  // Fetch monsters from API
  const { data: monsters = [], isLoading, error } = useQuery<any[]>({
    queryKey: ["/api/monsters"],
  })

  if (isLoading) return <Card className="max-w-2xl mx-auto my-8"><CardHeader><CardTitle>Monster Bestiary</CardTitle></CardHeader><CardContent>Loading...</CardContent></Card>
  if (error) return <Card className="max-w-2xl mx-auto my-8"><CardHeader><CardTitle>Monster Bestiary</CardTitle></CardHeader><CardContent>Error loading monsters.</CardContent></Card>

  // Map API data to MonsterBrowser props
  const mapped = monsters.map(m => ({
    name: m.name,
    type: m.type,
    cr: m.challenge_rating,
    hp: m.hit_points || m.hp_avg,
    ac: m.armor_class,
  }))

  return <MonsterBrowser monsters={mapped} />
}
