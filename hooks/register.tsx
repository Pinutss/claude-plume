import { atom, read, update } from 'claude-code'
import type { EngineInterface as Engine, Register } from 'claude-code'

import type { Effort } from '../types'

const DEFAULT_MODEL = 'claude-haiku-5-5'
const MODELS = [
  { value: DEFAULT_MODEL, label: 'Haiku 5.5' },
  { value: 'claude-sonnet-5-5', label: 'Sonnet 5.5' },
  { value: 'claude-opus-5-5', label: 'Opus 5.5' },
  { value: 'claude-fable-5-1', label: 'Fable 5.1' },
]
const EFFORTS: { value: Effort; label: string }[] = [
  { value: 'low', label: 'Bas' },
  { value: 'medium', label: 'Moyen' },
  { value: 'high', label: 'Élevé' },
  { value: 'xhigh', label: 'Très élevé' },
  { value: 'max', label: 'Max' },
]
const isEffort = (value: unknown): value is Effort =>
  EFFORTS.some(one => one.value === value)

// Plume au trait qui écrit : tuyau, barbes, pointe et une ligne d'écriture.
const QUILL = `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#8b8b8b" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z"/><path d="M16 8 2 22"/><path d="M17.5 15H9"/><path d="M12 21.5c1.2-.9 2.2-.9 3.2 0s2.1.9 3.3 0"/></svg>`

const model = atom({ plugin: 'plume', key: 'model' } as const, DEFAULT_MODEL)
const effort = atom({ plugin: 'plume', key: 'effort' } as const, 'medium' as Effort)
const isBusy = atom({ plugin: 'plume', key: 'isBusy' } as const, false)
const previous = atom({ plugin: 'plume', key: 'previous' } as const, null as string | null)

const SYSTEM = `Tu réécris le brouillon d'un utilisateur en prompt destiné à Claude (assistant de code et de travail).
But : que Claude comprenne la demande du premier coup, avec le moins de tokens possible.

Règles :
- Garde la langue du brouillon.
- Conserve TOUTES les informations utiles : noms, chemins, chiffres, contraintes, exemples, préférences.
- Supprime le remplissage : hésitations, répétitions, politesses, tics de dictée.
- Corrige les erreurs évidentes de dictée vocale (mots mal transcrits) quand le sens est clair.
- N'invente rien, n'ajoute aucune exigence, ne réponds pas à la demande.
- Structure en sections courtes, uniquement celles qui ont du contenu :
  Objectif: (une phrase)
  Contexte:
  Exigences:
  Contraintes:
  Livrable:
  À préciser: (ambiguïtés réelles seulement)
- Puces courtes, style télégraphique, verbes à l'impératif.
- Si le brouillon est déjà court et clair, rends-le simplement plus net, sans sections.

Un bloc <contexte> peut précéder le brouillon (projet, fichiers, derniers échanges). Sers-t'en
seulement pour lever les ambiguïtés : bons noms de fichiers, termes du projet, ce que « ça »
ou « le mode » désigne. N'en recopie rien et n'en tire aucune exigence nouvelle. Ne mets pas en
« À préciser » ce que Claude peut trouver lui-même dans le projet.

Réponds UNIQUEMENT avec le prompt réécrit, sans préambule ni balises.`

// Plafonds du contexte envoyé à chaque réécriture (~1 500 tokens au plus).
const MAX_DOC = 1800
const MAX_FILES = 40
const MAX_MESSAGES = 4
const MAX_MESSAGE = 400

const clip = (text: string, max: number) =>
  text.length > max ? `${text.slice(0, max)}…` : text

// Le contexte du projet change peu : lu une fois par dossier, puis gardé.
const projects = new Map<string, string>()

const projectContext = async ($: Engine) => {
  let root: string
  try {
    root = await $.session.root()
  } catch {
    return ''
  }
  const known = projects.get(root)
  if (known !== undefined) return known

  const parts = [`Projet : ${root.split(/[\\/]/).filter(Boolean).at(-1) ?? root}`]
  try {
    const entries = await $.fs.list(root)
    const names = entries
      .map(one => one.name)
      .filter(name => !name.startsWith('.') && name !== 'node_modules')
      .slice(0, MAX_FILES)
    if (names.length > 0) parts.push(`Fichiers : ${names.join(', ')}`)
  } catch {}

  for (const doc of ['CLAUDE.md', 'README.md']) {
    try {
      const text = await $.fs.read(`${root}/${doc}`)
      parts.push(`${doc} :\n${clip(text.trim(), MAX_DOC)}`)
      break
    } catch {}
  }

  const context = parts.join('\n')
  projects.set(root, context)

  return context
}

const recentExchanges = async ($: Engine) => {
  try {
    const messages = await $.session.messages()
    const lines = messages
      .filter(one => one.text.trim() !== '')
      .slice(-MAX_MESSAGES)
      .map(one => `${one.role === 'user' ? 'Utilisateur' : 'Claude'} : ${clip(one.text.trim(), MAX_MESSAGE)}`)

    return lines.length > 0 ? `Derniers échanges :\n${lines.join('\n')}` : ''
  } catch {
    return ''
  }
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const savedModel = await $.store.get('model')
    const savedEffort = await $.store.get('effort')
    if (MODELS.some(one => one.value === savedModel)) {
      await update($, model, () => savedModel as string)
    }
    if (isEffort(savedEffort)) {
      await update($, effort, () => savedEffort)
    }

    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    void update($, previous, () => null).catch(() => {})

    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) {
      return next(e)
    }

    const elements = $.ui.resolve(e)
    if (!('Select' in elements)) {
      return next(e)
    }

    const { Box, Button, Select, Text } = elements
    const Svg = 'Svg' in elements ? elements.Svg : undefined
    const currentModel = await read($, model)
    const currentEffort = await read($, effort)
    const busy = await read($, isBusy)
    const undo = await read($, previous)

    const rewrite = async () => {
      const { text } = await $.prompt.read()
      if (text.trim() === '') {
        $.ui.toast('✎ Écris ou dicte d\'abord ta demande')
        return
      }

      await update($, isBusy, () => true)
      try {
        const [project, exchanges] = await Promise.all([
          projectContext($),
          recentExchanges($),
        ])
        const context = [project, exchanges].filter(Boolean).join('\n\n')
        const r = await $.model.complete({
          model: await read($, model),
          effort: await read($, effort),
          system: SYSTEM,
          prompt: `<contexte>\n${context}\n</contexte>\n\nBrouillon :\n${text}`,
          maxTokens: 2048,
          timeoutMs: 90000,
        })
        if (!r.isAnswered) {
          $.ui.toast(`✎ Réécriture impossible (${r.reason})`)
          return
        }

        const filled = await $.prompt.fill({ text: r.text.trim(), mode: 'replace' })
        if (filled.isFilled) {
          await update($, previous, () => text)
        }
      } finally {
        await update($, isBusy, () => false)
      }
    }

    const restore = async () => {
      const original = await read($, previous)
      if (original === null) return
      await $.prompt.fill({ text: original, mode: 'replace' })
      await update($, previous, () => null)
    }

    const pickModel = async (value: string) => {
      await update($, model, () => value)
      await $.store.set('model', value)
    }

    const pickEffort = async (value: string) => {
      if (!isEffort(value)) return
      await update($, effort, () => value)
      await $.store.set('effort', value)
    }

    return (
      <Box flexDirection="row" alignItems="center" gap={1}>
        {Svg && <Svg source={QUILL} alt="Plume" width={18} height={18} />}
        {busy ? (
          <Text dimColor>Réécriture…</Text>
        ) : (
          <Button key="rewrite" plain onPress={rewrite}>
            {Svg ? 'Réécrire' : '✎ Réécrire'}
          </Button>
        )}
        {undo !== null && !busy && (
          <Button key="undo" label="↩ Annuler" dimColor plain onPress={restore} />
        )}
        <Select key="model" options={MODELS} value={currentModel} onSelect={pickModel} />
        <Select key="effort" options={EFFORTS} value={currentEffort} onSelect={pickEffort} />
      </Box>
    )
  })
}
