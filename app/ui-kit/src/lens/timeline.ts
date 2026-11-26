// The TIMELINE lens — what happened to this record, in words.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⛔ WHERE THE WORDS ARE TODAY, AND WHY THAT IS THE POINT
//
//   The reference app keeps ~250 event labels in `libs/ui-lens/ui.jsx` — a file
//   in the SHARED layer, holding one application's domain vocabulary:
//
//       'hiring.decisionVerified': 'Trưởng phòng đối chiếu bản ký gốc'
//
//   That is not a rendering decision. It is what the event MEANS, it is the same
//   sentence on every screen and in every export, and it is exactly the class of
//   thing `@dqa-ai-solutions/ontology-view` already moved out of UI code once, for enum
//   values, for the same reason.
//
// ⚠️ The contract does not carry event wording yet, so it is passed in here and
//    `CONTRACT_GAP` says so. This is a seam, not a home: settle the shape in the
//    lens, then promote it into the contract. What must NOT happen is a second
//    table of labels growing inside a renderer while everyone waits.
// ═══════════════════════════════════════════════════════════════════════════

import { surfaceState, type SurfaceState, type EmptyCopy } from '../primitives/index.js'
import type { Formatter } from './format.js'
import type { LensDiagnostic } from './diagnostic.js'

/** `"<entity>.<event>" → the sentence a person reads.` */
export type EventVocabulary = Record<string, string>

export interface RawEvent {
  /** `staffMember.selected` — machine name, never shown. */
  event: string
  at: string
  actor?: string
  /** Anything the renderer may want; the lens does not read it. */
  detail?: Record<string, unknown>
}

export interface TimelineEntry {
  event: string
  label: string
  at: string
  /** Written with the app's locale — never a raw ISO stamp. */
  when: string
  actor?: string
  detail?: Record<string, unknown>
  /** True when no wording existed and the machine name is standing in. */
  unlabelled: boolean
}

export interface TimelineInput {
  events: RawEvent[] | null
  vocabulary: EventVocabulary
  loading: boolean
  error?: string | null
  empty: EmptyCopy
}

export interface TimelineModel {
  state: SurfaceState<TimelineEntry[]>
  diagnostics: LensDiagnostic[]
}

export function timelineModel(input: TimelineInput, format: Formatter): TimelineModel {
  const diagnostics: LensDiagnostic[] = []
  const complained = new Set<string>()

  const entries = input.events?.map((e): TimelineEntry => {
    const label = input.vocabulary[e.event]
    if (!label && !complained.has(e.event)) {
      complained.add(e.event)
      /* ⛔ An event with no wording prints its machine name at a user —
         `hiring.decisionVerified` in a case file. Reported, never
         swallowed: silence here is how a timeline becomes unreadable one
         forgotten label at a time. */
      diagnostics.push({
        severity: 'error',
        code: 'UNLABELLED_EVENT',
        where: e.event,
        message:
          `"${e.event}" has no wording, so the timeline would print the machine name. `
          + `Every event a record can record needs a sentence a person can read.`,
      })
    }
    return {
      event: e.event,
      label: label ?? e.event,
      at: e.at,
      /* ⭐ Through `Intl`, always. The reference app shipped a raw
         `2026-08-04T16:46:51.134Z` to a duty officer by skipping exactly this. */
      when: format.datetime(e.at),
      ...(e.actor ? { actor: e.actor } : {}),
      ...(e.detail ? { detail: e.detail } : {}),
      unlabelled: !label,
    }
  }) ?? null

  /* ⚠️ Newest first, and stable for equal stamps. Two events written in the same
     second — an approval and the record it creates — must not swap places
     between renders, or the file reads differently every time it is opened. */
  const ordered = entries
    ? entries.map((e, i) => ({ e, i }))
      .sort((a, b) => (+new Date(b.e.at) - +new Date(a.e.at)) || (a.i - b.i))
      .map(({ e }) => e)
    : null

  return {
    state: surfaceState<TimelineEntry[]>({
      loading: input.loading,
      error: input.error,
      data: ordered,
      count: ordered?.length,
      empty: input.empty,
      surface: 'list',
    }),
    diagnostics,
  }
}
