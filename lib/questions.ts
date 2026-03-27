export interface Question {
  id: number
  numero: number
  enunciado: string
  opciones: Record<string, string>
  respuesta: string | null
  year: number | null
  semestre: string | null
  area: string | null
  fuente: string
  tipo: string
  archivo: string
  tema?: string
}

export interface QuestionsData {
  total: number
  questions: Question[]
}

let cachedData: QuestionsData | null = null

export async function getAllQuestions(): Promise<QuestionsData> {
  if (cachedData) return cachedData
  const res = await fetch('/data/questions.json')
  cachedData = await res.json()
  return cachedData!
}

export function getStats(questions: Question[]) {
  const byYear: Record<string, number> = {}
  const byArea: Record<string, number> = {}
  const byFuente: Record<string, number> = {}
  const byTipo: Record<string, number> = {}

  for (const q of questions) {
    const y = q.year?.toString() ?? 'Sin año'
    byYear[y] = (byYear[y] ?? 0) + 1

    const a = q.area ?? 'Sin área'
    byArea[a] = (byArea[a] ?? 0) + 1

    byFuente[q.fuente] = (byFuente[q.fuente] ?? 0) + 1
    byTipo[q.tipo] = (byTipo[q.tipo] ?? 0) + 1
  }

  return { byYear, byArea, byFuente, byTipo }
}

export const AREAS: Record<string, string> = {
  A: 'Ciencias de la Salud',
  B: 'Ingenierías',
  C: 'Sociales y Humanidades',
  D: 'Económico-Empresariales',
  E: 'Educación y Letras',
}

export const TEMAS = [
  { id: 'Álgebra',                emoji: '📐', color: 'blue' },
  { id: 'Aritmética',             emoji: '🔢', color: 'green' },
  { id: 'Geometría',              emoji: '📏', color: 'purple' },
  { id: 'Trigonometría',          emoji: '📐', color: 'indigo' },
  { id: 'Física',                 emoji: '⚡', color: 'yellow' },
  { id: 'Química',                emoji: '⚗️', color: 'orange' },
  { id: 'Razonamiento Verbal',    emoji: '📚', color: 'pink' },
  { id: 'Razonamiento Matemático',emoji: '🧩', color: 'cyan' },
  { id: 'Lenguaje',               emoji: '✍️', color: 'teal' },
  { id: 'Historia del Perú',      emoji: '🏛️', color: 'amber' },
  { id: 'Geografía',              emoji: '🗺️', color: 'emerald' },
  { id: 'Biología',               emoji: '🧬', color: 'lime' },
  { id: 'Filosofía',              emoji: '🤔', color: 'violet' },
  { id: 'Economía',               emoji: '📊', color: 'sky' },
  { id: 'Psicología',             emoji: '🧠', color: 'rose' },
  { id: 'General',                emoji: '❓', color: 'gray' },
]

export function getTemaStats(questions: Question[]) {
  const stats: Record<string, { total: number }> = {}
  for (const q of questions) {
    const t = q.tema || 'General'
    if (!stats[t]) stats[t] = { total: 0 }
    stats[t].total++
  }
  return stats
}
