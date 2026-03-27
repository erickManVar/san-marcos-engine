'use client'

import { useEffect, useState, useMemo } from 'react'
import { getAllQuestions, getStats, getTemaStats, AREAS, TEMAS, type Question } from '@/lib/questions'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts'
import { Search, BookOpen, Filter, ChevronLeft, ChevronRight, X, BarChart2, List, Layers } from 'lucide-react'

const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#ddd6fe']
const AREA_COLORS: Record<string, string> = {
  A: '#ef4444', B: '#f97316', C: '#eab308', D: '#22c55e', E: '#3b82f6'
}

const PAGE_SIZE = 20

// ── Per-session topic progress ────────────────────────────────────────────────
interface TemaProgress {
  correct: number
  incorrect: number
  practiced: Set<number>
}

export default function Dashboard() {
  const [data, setData] = useState<{ total: number; questions: Question[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [view, setView] = useState<'stats' | 'questions' | 'simulacro' | 'temas'>('stats')

  // Filters
  const [search, setSearch] = useState('')
  const [filterYear, setFilterYear] = useState('')
  const [filterArea, setFilterArea] = useState('')
  const [filterFuente, setFilterFuente] = useState('')
  const [page, setPage] = useState(1)

  // Simulacro
  const [simArea, setSimArea] = useState('A')
  const [simYear, setSimYear] = useState('')
  const [simQuestions, setSimQuestions] = useState<Question[]>([])
  const [simAnswers, setSimAnswers] = useState<Record<number, string>>({})
  const [simSubmitted, setSimSubmitted] = useState(false)
  const [simIdx, setSimIdx] = useState(0)

  // Por Tema
  const [selectedTema, setSelectedTema] = useState<string | null>(null)
  const [temaQuestions, setTemaQuestions] = useState<Question[]>([])
  const [temaIdx, setTemaIdx] = useState(0)
  const [temaAnswers, setTemaAnswers] = useState<Record<number, string>>({})
  const [temaRevealed, setTemaRevealed] = useState<Record<number, boolean>>({})
  const [temaProgress, setTemaProgress] = useState<Record<string, TemaProgress>>({})

  useEffect(() => {
    getAllQuestions().then(d => { setData(d); setLoading(false) })
  }, [])

  const questions = data?.questions ?? []

  // Unique filter values
  const years = useMemo(() => [...new Set(questions.map(q => q.year).filter(Boolean))].sort((a, b) => (b ?? 0) - (a ?? 0)), [questions])
  const areas = useMemo(() => [...new Set(questions.map(q => q.area).filter(Boolean))].sort(), [questions])
  const fuentes = useMemo(() => [...new Set(questions.map(q => q.fuente))].sort(), [questions])

  // Filtered
  const filtered = useMemo(() => {
    return questions.filter(q => {
      if (filterYear && q.year?.toString() !== filterYear) return false
      if (filterArea && q.area !== filterArea) return false
      if (filterFuente && q.fuente !== filterFuente) return false
      if (search) {
        const s = search.toLowerCase()
        if (!q.enunciado.toLowerCase().includes(s)) return false
      }
      return true
    })
  }, [questions, filterYear, filterArea, filterFuente, search])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const paged = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // Stats
  const stats = useMemo(() => getStats(questions), [questions])
  const temaStats = useMemo(() => getTemaStats(questions), [questions])

  const yearChartData = Object.entries(stats.byYear)
    .filter(([y]) => !isNaN(Number(y)))
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([year, count]) => ({ year, count }))

  const areaChartData = Object.entries(stats.byArea).map(([name, value]) => ({
    name: `Área ${name}`, value, color: AREA_COLORS[name] ?? '#94a3b8'
  }))

  const fuenteData = Object.entries(stats.byFuente).map(([name, value]) => ({ name, value }))

  // Simulacro logic
  function startSimulacro() {
    let pool = questions.filter(q => q.area === simArea && Object.keys(q.opciones).length >= 3)
    if (simYear) pool = pool.filter(q => q.year?.toString() === simYear)
    const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, 100)
    setSimQuestions(shuffled)
    setSimAnswers({})
    setSimSubmitted(false)
    setSimIdx(0)
  }

  function simScore() {
    return simQuestions.filter(q => q.respuesta && simAnswers[q.id] === q.respuesta).length
  }

  const clearFilters = () => {
    setSearch(''); setFilterYear(''); setFilterArea(''); setFilterFuente(''); setPage(1)
  }

  // ── Por Tema logic ───────────────────────────────────────────────────────
  function startTema(tema: string) {
    const pool = questions
      .filter(q => (q.tema || 'General') === tema && Object.keys(q.opciones).length >= 3)
      .sort(() => Math.random() - 0.5)
    setSelectedTema(tema)
    setTemaQuestions(pool)
    setTemaIdx(0)
    setTemaAnswers({})
    setTemaRevealed({})
  }

  function answerTema(qid: number, key: string, correctKey: string | null) {
    if (temaRevealed[qid]) return
    setTemaAnswers(prev => ({ ...prev, [qid]: key }))
    setTemaRevealed(prev => ({ ...prev, [qid]: true }))
    if (selectedTema) {
      setTemaProgress(prev => {
        const curr = prev[selectedTema] ?? { correct: 0, incorrect: 0, practiced: new Set() }
        const isCorrect = correctKey !== null && key === correctKey
        return {
          ...prev,
          [selectedTema]: {
            correct: curr.correct + (isCorrect ? 1 : 0),
            incorrect: curr.incorrect + (isCorrect ? 0 : 1),
            practiced: new Set([...curr.practiced, qid]),
          }
        }
      })
    }
  }

  function temaCorrectCount() {
    return temaProgress[selectedTema!]?.correct ?? 0
  }
  function temaIncorrectCount() {
    return temaProgress[selectedTema!]?.incorrect ?? 0
  }

  function getTemaCardColor(tema: string) {
    const prog = temaProgress[tema]
    if (!prog || prog.practiced.size === 0) return 'border-gray-700 bg-gray-900'
    const total = prog.correct + prog.incorrect
    const pct = total > 0 ? (prog.correct / total) * 100 : 0
    if (pct >= 70) return 'border-green-600 bg-green-950'
    if (pct >= 40) return 'border-yellow-600 bg-yellow-950'
    return 'border-red-600 bg-red-950'
  }

  function getTemaPercentage(tema: string) {
    const prog = temaProgress[tema]
    if (!prog || prog.practiced.size === 0) return null
    const total = prog.correct + prog.incorrect
    return total > 0 ? Math.round((prog.correct / total) * 100) : 0
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center">
        <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-gray-400 text-sm">Cargando {data?.total ?? '...'} preguntas</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <header className="border-b border-gray-800 bg-gray-900 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-white">San Marcos Engine</h1>
              <p className="text-xs text-gray-400">{data?.total.toLocaleString()} preguntas · UNMSM</p>
            </div>
          </div>
          <nav className="flex gap-1">
            {([
              ['stats',     BarChart2, 'Estadísticas'],
              ['questions', List,      'Preguntas'],
              ['simulacro', BookOpen,  'Simulacro'],
              ['temas',     Layers,    'Por Tema'],
            ] as const).map(([v, Icon, label]) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${view === v ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}
              >
                <Icon className="w-4 h-4" />
                <span className="hidden sm:inline">{label}</span>
              </button>
            ))}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">

        {/* === STATS VIEW === */}
        {view === 'stats' && (
          <div className="space-y-8">
            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                { label: 'Total preguntas', value: data?.total.toLocaleString() },
                { label: 'Años cubiertos', value: years.length },
                { label: 'Áreas', value: areas.length },
                { label: 'Fuentes', value: fuentes.length },
              ].map(kpi => (
                <div key={kpi.label} className="bg-gray-900 border border-gray-800 rounded-xl p-5">
                  <p className="text-3xl font-bold text-indigo-400">{kpi.value}</p>
                  <p className="text-sm text-gray-400 mt-1">{kpi.label}</p>
                </div>
              ))}
            </div>

            {/* Year chart */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
              <h2 className="font-semibold text-white mb-4">Preguntas por año</h2>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={yearChartData}>
                  <XAxis dataKey="year" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#9ca3af', fontSize: 11 }} />
                  <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} labelStyle={{ color: '#fff' }} />
                  <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Area + Fuente */}
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="font-semibold text-white mb-4">Por área</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <PieChart>
                    <Pie data={areaChartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={false} labelLine={false}>
                      {areaChartData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="mt-3 space-y-1">
                  {areaChartData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ background: d.color }} />
                        <span className="text-gray-300">{d.name}</span>
                      </div>
                      <span className="text-gray-400">{d.value.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                <h2 className="font-semibold text-white mb-4">Por fuente</h2>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={fuenteData} layout="vertical">
                    <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <YAxis dataKey="name" type="category" width={110} tick={{ fill: '#9ca3af', fontSize: 11 }} />
                    <Tooltip contentStyle={{ background: '#1f2937', border: '1px solid #374151', borderRadius: 8 }} />
                    <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                      {fuenteData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* === QUESTIONS VIEW === */}
        {view === 'questions' && (
          <div className="space-y-4">
            {/* Search + Filters */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                  <input
                    type="text"
                    placeholder="Buscar en enunciados..."
                    value={search}
                    onChange={e => { setSearch(e.target.value); setPage(1) }}
                    className="w-full bg-gray-800 border border-gray-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-100 placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <div className="flex gap-2 flex-wrap">
                  <select value={filterYear} onChange={e => { setFilterYear(e.target.value); setPage(1) }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                    <option value="">Todos los años</option>
                    {years.map(y => <option key={y} value={y!}>{y}</option>)}
                  </select>
                  <select value={filterArea} onChange={e => { setFilterArea(e.target.value); setPage(1) }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                    <option value="">Todas las áreas</option>
                    {areas.map(a => <option key={a} value={a!}>Área {a}</option>)}
                  </select>
                  <select value={filterFuente} onChange={e => { setFilterFuente(e.target.value); setPage(1) }}
                    className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-300 focus:outline-none focus:border-indigo-500">
                    <option value="">Todas las fuentes</option>
                    {fuentes.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                  {(filterYear || filterArea || filterFuente || search) && (
                    <button onClick={clearFilters} className="flex items-center gap-1 text-sm text-red-400 hover:text-red-300 px-2">
                      <X className="w-3 h-3" /> Limpiar
                    </button>
                  )}
                </div>
              </div>
              <p className="text-xs text-gray-500 mt-2">{filtered.length.toLocaleString()} preguntas · página {page} de {totalPages}</p>
            </div>

            {/* Questions list */}
            <div className="space-y-3">
              {paged.map(q => (
                <div key={q.id} className="bg-gray-900 border border-gray-800 rounded-xl p-5 hover:border-indigo-800 transition-colors">
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex flex-wrap gap-2">
                      {q.year && <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">{q.year}{q.semestre ? `-${q.semestre}` : ''}</span>}
                      {q.area && <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: `${AREA_COLORS[q.area]}22`, color: AREA_COLORS[q.area] }}>Área {q.area}</span>}
                      <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{q.fuente}</span>
                      {q.tema && <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full">{q.tema}</span>}
                    </div>
                    <span className="text-xs text-gray-600 shrink-0">#{q.numero}</span>
                  </div>
                  <p className="text-sm text-gray-200 leading-relaxed mb-3">{q.enunciado}</p>
                  {Object.keys(q.opciones).length > 0 && (
                    <div className="grid sm:grid-cols-2 gap-1.5">
                      {Object.entries(q.opciones).sort().map(([key, val]) => (
                        <div key={key} className={`flex items-start gap-2 text-xs px-3 py-1.5 rounded-lg ${q.respuesta === key ? 'bg-green-900/40 text-green-300 border border-green-800/50' : 'bg-gray-800/50 text-gray-400'}`}>
                          <span className="font-bold shrink-0">{key})</span>
                          <span>{val}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex items-center justify-center gap-3 pt-4">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-gray-400">Pág {page} de {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-2 rounded-lg bg-gray-800 text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* === SIMULACRO VIEW === */}
        {view === 'simulacro' && (
          <div className="max-w-3xl mx-auto space-y-6">
            {simQuestions.length === 0 ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8">
                <h2 className="text-xl font-bold text-white mb-2">Simulacro UNMSM</h2>
                <p className="text-gray-400 text-sm mb-6">Genera un examen de práctica con preguntas reales del banco de admisión.</p>
                <div className="grid sm:grid-cols-2 gap-4 mb-6">
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Área</label>
                    <select value={simArea} onChange={e => setSimArea(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                      {areas.map(a => <option key={a} value={a!}>Área {a} — {AREAS[a!] ?? ''}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-400 mb-1 block">Año (opcional)</label>
                    <select value={simYear} onChange={e => setSimYear(e.target.value)}
                      className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-indigo-500">
                      <option value="">Todos los años</option>
                      {years.map(y => <option key={y} value={y!}>{y}</option>)}
                    </select>
                  </div>
                </div>
                <button onClick={startSimulacro}
                  className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-3 rounded-xl transition-colors">
                  Iniciar simulacro (100 preguntas)
                </button>
              </div>
            ) : simSubmitted ? (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                <div className="text-6xl font-black text-indigo-400 mb-2">{simScore()}<span className="text-2xl text-gray-500">/{simQuestions.length}</span></div>
                <p className="text-gray-300 mb-1">{((simScore() / simQuestions.length) * 100).toFixed(1)}% de respuestas correctas</p>
                <p className="text-sm text-gray-500 mb-6">{simQuestions.filter(q => q.respuesta).length} preguntas con clave de respuesta disponible</p>
                <button onClick={() => setSimQuestions([])}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-6 py-2 rounded-lg transition-colors text-sm">
                  Nuevo simulacro
                </button>
              </div>
            ) : (
              <div>
                {/* Progress */}
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex-1 bg-gray-800 rounded-full h-2">
                    <div className="bg-indigo-500 h-2 rounded-full transition-all" style={{ width: `${((simIdx + 1) / simQuestions.length) * 100}%` }} />
                  </div>
                  <span className="text-xs text-gray-400 shrink-0">{simIdx + 1}/{simQuestions.length}</span>
                </div>

                {/* Question card */}
                {(() => {
                  const q = simQuestions[simIdx]
                  const selected = simAnswers[q.id]
                  return (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                      <div className="flex gap-2 mb-4">
                        {q.year && <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">{q.year}{q.semestre ? `-${q.semestre}` : ''}</span>}
                        {q.area && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${AREA_COLORS[q.area]}22`, color: AREA_COLORS[q.area] }}>Área {q.area}</span>}
                      </div>
                      <p className="text-gray-100 leading-relaxed mb-6">{q.enunciado}</p>
                      <div className="space-y-2">
                        {Object.entries(q.opciones).sort().map(([key, val]) => (
                          <button key={key} onClick={() => setSimAnswers(prev => ({ ...prev, [q.id]: key }))}
                            className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-colors
                              ${selected === key
                                ? 'border-indigo-500 bg-indigo-900/30 text-indigo-200'
                                : 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'}`}>
                            <span className="font-bold shrink-0 text-indigo-400">{key}</span>
                            <span>{val}</span>
                          </button>
                        ))}
                      </div>
                      <div className="flex justify-between mt-6">
                        <button onClick={() => setSimIdx(i => Math.max(0, i - 1))} disabled={simIdx === 0}
                          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors">
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        {simIdx < simQuestions.length - 1 ? (
                          <button onClick={() => setSimIdx(i => i + 1)}
                            className="flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300 transition-colors">
                            Siguiente <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button onClick={() => setSimSubmitted(true)}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white text-sm px-4 py-2 rounded-lg transition-colors">
                            Finalizar
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

        {/* === POR TEMA VIEW === */}
        {view === 'temas' && (
          <div>
            {/* ── A. Subject grid ── */}
            {!selectedTema && (
              <div>
                <div className="mb-6">
                  <h2 className="text-xl font-bold text-white mb-1">Práctica por Tema</h2>
                  <p className="text-gray-400 text-sm">Selecciona una materia para practicar preguntas clasificadas automáticamente.</p>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                  {TEMAS.map(t => {
                    const total = temaStats[t.id]?.total ?? 0
                    const pct = getTemaPercentage(t.id)
                    const prog = temaProgress[t.id]
                    const cardClass = getTemaCardColor(t.id)
                    return (
                      <button
                        key={t.id}
                        onClick={() => startTema(t.id)}
                        disabled={total === 0}
                        className={`relative text-left p-5 rounded-xl border transition-all hover:scale-105 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed ${cardClass}`}
                      >
                        <div className="text-3xl mb-2">{t.emoji}</div>
                        <p className="font-semibold text-white text-sm leading-tight mb-1">{t.id}</p>
                        <p className="text-xs text-gray-400">{total.toLocaleString()} preguntas</p>
                        {prog && prog.practiced.size > 0 && (
                          <div className="mt-2">
                            <div className="w-full bg-gray-700 rounded-full h-1.5 mb-1">
                              <div
                                className={`h-1.5 rounded-full transition-all ${pct! >= 70 ? 'bg-green-400' : pct! >= 40 ? 'bg-yellow-400' : 'bg-red-400'}`}
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <p className="text-xs text-gray-400">{pct}% · {prog.practiced.size} practicadas</p>
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── B. Practice mode ── */}
            {selectedTema && (
              <div className="max-w-3xl mx-auto space-y-4">
                {/* Top bar */}
                <div className="flex items-center justify-between">
                  <button
                    onClick={() => setSelectedTema(null)}
                    className="flex items-center gap-1 text-sm text-gray-400 hover:text-white transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" /> Volver a temas
                  </button>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400 font-semibold">✓ {temaCorrectCount()}</span>
                    <span className="text-red-400 font-semibold">✗ {temaIncorrectCount()}</span>
                  </div>
                </div>

                {/* Progress bar */}
                {temaQuestions.length > 0 && (
                  <div className="flex items-center gap-3">
                    <div className="flex-1 bg-gray-800 rounded-full h-2">
                      <div
                        className="bg-indigo-500 h-2 rounded-full transition-all"
                        style={{ width: `${((temaIdx + 1) / temaQuestions.length) * 100}%` }}
                      />
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      Pregunta {temaIdx + 1} de {temaQuestions.length} — {selectedTema}
                    </span>
                  </div>
                )}

                {temaQuestions.length === 0 ? (
                  <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
                    <p className="text-gray-400">No hay preguntas disponibles para este tema.</p>
                    <button onClick={() => setSelectedTema(null)} className="mt-4 text-indigo-400 hover:text-indigo-300 text-sm">
                      ← Volver
                    </button>
                  </div>
                ) : (() => {
                  const q = temaQuestions[temaIdx]
                  const selected = temaAnswers[q.id]
                  const revealed = temaRevealed[q.id]
                  return (
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                      <div className="flex gap-2 mb-4">
                        {q.year && <span className="text-xs bg-indigo-900/50 text-indigo-300 px-2 py-0.5 rounded-full">{q.year}{q.semestre ? `-${q.semestre}` : ''}</span>}
                        {q.area && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: `${AREA_COLORS[q.area!]}22`, color: AREA_COLORS[q.area!] }}>Área {q.area}</span>}
                        <span className="text-xs bg-indigo-950 text-indigo-300 px-2 py-0.5 rounded-full">{selectedTema}</span>
                      </div>
                      <p className="text-gray-100 leading-relaxed mb-6">{q.enunciado}</p>

                      <div className="space-y-2">
                        {Object.entries(q.opciones).sort().map(([key, val]) => {
                          let cls = 'border-gray-700 bg-gray-800/50 text-gray-300 hover:border-gray-600 hover:bg-gray-800'
                          if (revealed) {
                            if (key === q.respuesta) {
                              cls = 'border-green-500 bg-green-900/40 text-green-200'
                            } else if (key === selected && key !== q.respuesta) {
                              cls = 'border-red-500 bg-red-900/30 text-red-300'
                            } else {
                              cls = 'border-gray-700 bg-gray-800/30 text-gray-500'
                            }
                          } else if (selected === key) {
                            cls = 'border-indigo-500 bg-indigo-900/30 text-indigo-200'
                          }
                          return (
                            <button
                              key={key}
                              onClick={() => answerTema(q.id, key, q.respuesta)}
                              disabled={revealed}
                              className={`w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-colors disabled:cursor-default ${cls}`}
                            >
                              <span className="font-bold shrink-0 text-indigo-400">{key}</span>
                              <span>{val}</span>
                              {revealed && key === q.respuesta && <span className="ml-auto text-green-400 text-xs font-bold">✓ Correcta</span>}
                              {revealed && key === selected && key !== q.respuesta && <span className="ml-auto text-red-400 text-xs font-bold">✗</span>}
                            </button>
                          )
                        })}
                      </div>

                      {/* Feedback + Next */}
                      {revealed && (
                        <div className={`mt-4 px-4 py-3 rounded-lg text-sm font-medium ${selected === q.respuesta ? 'bg-green-900/30 text-green-300 border border-green-800' : 'bg-red-900/20 text-red-300 border border-red-900'}`}>
                          {selected === q.respuesta
                            ? '¡Correcto! 🎉'
                            : `Incorrecto. La respuesta correcta es ${q.respuesta ?? 'desconocida'}.`}
                        </div>
                      )}

                      <div className="flex justify-between mt-6">
                        <button
                          onClick={() => setTemaIdx(i => Math.max(0, i - 1))}
                          disabled={temaIdx === 0}
                          className="flex items-center gap-1 text-sm text-gray-400 hover:text-white disabled:opacity-30 transition-colors"
                        >
                          <ChevronLeft className="w-4 h-4" /> Anterior
                        </button>
                        {temaIdx < temaQuestions.length - 1 ? (
                          <button
                            onClick={() => setTemaIdx(i => i + 1)}
                            className="flex items-center gap-1 text-sm bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg transition-colors"
                          >
                            Siguiente <ChevronRight className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => setSelectedTema(null)}
                            className="bg-green-700 hover:bg-green-600 text-white text-sm px-4 py-2 rounded-lg transition-colors"
                          >
                            Finalizar tema ✓
                          </button>
                        )}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </div>
        )}

      </main>
    </div>
  )
}
