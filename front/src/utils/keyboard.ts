// Un raccourci clavier global se tait pendant une saisie dans un champ et tant qu'une fenêtre
// (saisie, confirmation) est ouverte : Entrée et Échap lui appartiennent alors.
export const shortcutAllowed = (
  e: KeyboardEvent,
  fields = 'input, textarea, select',
): boolean =>
  !e.defaultPrevented &&
  !document.querySelector('dialog[open]') &&
  !(e.target as HTMLElement | null)?.closest?.(fields)
