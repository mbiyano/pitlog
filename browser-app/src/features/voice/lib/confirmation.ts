const EXPLICIT_CONFIRMATION_PATTERNS = [
  /(?<![a-z])s[ií][,.]?\s*(guardalo|guardá|guardaló|dale|confirmá|confirmo)(?![a-z])/i,
  /(?<![a-z])confirmo(?![a-z])/i,
  /(?<![a-z])confirmá(?![a-z])/i,
  /(?<![a-z])dale[,.]?\s*(guardá|guardalo|guardaló)?(?![a-z])/i,
  /(?<![a-z])exacto(?![a-z])/i,
  /(?<![a-z])correcto(?![a-z])/i,
  /(?<![a-z])listo[,.]?\s*(guardá|dale)?(?![a-z])/i,
  /(?<![a-z])adelante(?![a-z])/i,
  /(?<![a-z])guardalo(?![a-z])/i,
  /(?<![a-z])guardá(?![a-z])/i,
  /(?<![a-z])de\s+una(?![a-z])/i,
  /(?<![a-z])metele(?![a-z])/i,
  /(?<![a-z])mandale(?![a-z])/i,
  /(?<![a-z])joya(?![a-z])/i,
  /(?<![a-z])perfecto(?![a-z])/i,
  /(?<![a-z])s[ií][,.]?\s*s[ií](?![a-z])/i,
  /^s[ií]\.?$/i,
  /^dale\.?$/i,
  /^listo\.?$/i,
  /^de una\.?$/i,
]

export function hasExplicitWriteConfirmation(transcript: string): boolean {
  const normalized = transcript.trim().toLowerCase()
  return EXPLICIT_CONFIRMATION_PATTERNS.some((pattern) => pattern.test(normalized))
}

/**
 * A generic "sí" only authorizes a write when the assistant's immediately
 * preceding turn explicitly asked to persist data. This prevents a spelling
 * confirmation (for example, a plate read-back) from authorizing a write.
 */
export function isWriteConfirmationPrompt(transcript: string): boolean {
  const normalized = transcript
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return /(guard(ar|e|o|amos)|registr(ar|e|o|amos)|anot(ar|e|o|amos)|actualiz(ar|e|o|amos)|agreg(ar|ue|o|amos))/.test(
    normalized,
  )
}

export function isPlateConfirmationPrompt(transcript: string): boolean {
  const normalized = transcript
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  return normalized.includes('patente') && /(correct|confirm|entendi|escuche)/.test(normalized)
}
