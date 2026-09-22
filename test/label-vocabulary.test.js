import test from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLabel, LABELS } from '../lib/label-vocabulary.ts'

test('the new vocabulary passes through unchanged', () => {
  for (const label of ['focused', 'supportive', 'neutral', 'drift', 'unknown']) {
    assert.equal(normalizeLabel(label), label)
  }
})

test('the tap-era vocabulary is accepted and normalised', () => {
  // An installed extension keeps sending these until Chrome ships the update. Rejecting
  // them 400s the whole batch, and because nothing is then marked sent, every attention
  // and away event for that session requeues and retries forever with the same payload.
  assert.equal(normalizeLabel('work'), 'focused')
  assert.equal(normalizeLabel('distract'), 'drift')
})

test('anything else is rejected', () => {
  assert.equal(normalizeLabel('productive'), null)
  assert.equal(normalizeLabel(''), null)
  assert.equal(normalizeLabel(undefined), null)
})

test('LABELS is the accepted wire set, old and new', () => {
  assert.deepEqual(
    [...LABELS].sort(),
    ['distract', 'drift', 'focused', 'neutral', 'supportive', 'unknown', 'work'],
  )
})
