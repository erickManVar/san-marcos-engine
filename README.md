# San Marcos Engine — Dashboard

Dashboard de preparación para el examen de admisión UNMSM.

## Features

- **+2,850 preguntas** reales de exámenes 1990–2024
- **Estadísticas** por año, área y fuente
- **Explorador** con búsqueda y filtros
- **Simulacro** de 100 preguntas con corrección automática

## Stack

- Next.js 16 (App Router)
- TypeScript + Tailwind CSS
- Recharts (gráficos)
- Data estática en `public/data/questions.json`

## Deploy

Conectado a Vercel. Cada push a `main` genera un nuevo deploy.

## Data

Las preguntas viven en `public/data/questions.json` (~1.9MB).
El engine de extracción de PDFs está en el repo `san-marcos-engine`.
