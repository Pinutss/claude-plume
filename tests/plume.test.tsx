import { expect, test } from 'claude-code/testing'

const BAND = {
  plugin: 'plume',
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 10,
    bodyColumns: 80,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

test('la plume réécrit le brouillon, puis Annuler le remet', async ($, on) => {
  let draft = 'euh alors en fait je voudrais que tu me fasses un script qui renomme les photos'
  const asked: { model: string; effort?: string }[] = []
  let sent = ''

  on('session.root', () => ({ value: '/projets/photos' }))
  on('fs.list', () => ({ value: [{ name: 'rename.py', kind: 'file' }] }))
  on('fs.read', () => ({ value: '# Photos\nScripts de tri de photos.' }))
  on('session.messages', () => ({
    value: [{ role: 'user', text: 'On reprend le script de tri', toolUses: [] }],
  }))
  on('prompt.read', () => ({ value: { text: draft, cursor: draft.length } }))
  on('prompt.fill', (_, e) => {
    draft = e.text
    return { isFilled: true, text: draft }
  })
  on('model.complete', (_, e) => {
    asked.push({ model: e.model, effort: e.effort })
    sent = typeof e.prompt === 'string' ? e.prompt : ''
    return {
      value: {
        isAnswered: true,
        text: 'Objectif: script qui renomme les photos.',
        usage: { input_tokens: 1, output_tokens: 1 },
      },
    }
  })

  for (const surface of ['terminal', 'desktop'] as const) {
    draft = 'euh alors en fait je voudrais un script qui renomme les photos'
    const ui = await $.ui.mount({ ...BAND, surface })

    await ui.press({ key: 'rewrite' })
    expect(draft).toBe('Objectif: script qui renomme les photos.')

    await ui.press({ key: 'undo' })
    expect(draft).toBe('euh alors en fait je voudrais un script qui renomme les photos')
    await ui.unmount()
  }

  expect(asked[0]).toEqual({ model: 'claude-haiku-5-5', effort: 'medium' })
  expect(sent).toContain('Projet : photos')
  expect(sent).toContain('rename.py')
  expect(sent).toContain('Scripts de tri de photos.')
  expect(sent).toContain('On reprend le script de tri')
})

test('les listes choisissent le modèle et l\'effort', async ($, on) => {
  const asked: { model: string; effort?: string }[] = []
  const saved = new Map<string, unknown>()
  on('store.set', (_, e) => {
    saved.set(e.key, e.value)
    return { value: undefined }
  })
  on('prompt.read', () => ({ value: { text: 'test', cursor: 4 } }))
  on('prompt.fill', (_, e) => ({ isFilled: true, text: e.text }))
  on('model.complete', (_, e) => {
    asked.push({ model: e.model, effort: e.effort })
    return { value: { isAnswered: true, text: 'ok', usage: { input_tokens: 1, output_tokens: 1 } } }
  })

  const ui = await $.ui.mount({ ...BAND, surface: 'desktop' })
  await ui.select({ key: 'model', value: 'claude-opus-5-5' })
  await ui.select({ key: 'effort', value: 'high' })
  await ui.press({ key: 'rewrite' })
  expect(asked[0]).toEqual({ model: 'claude-opus-5-5', effort: 'high' })
  expect(saved.get('model')).toBe('claude-opus-5-5')
  expect(saved.get('effort')).toBe('high')
  await ui.unmount()
})
