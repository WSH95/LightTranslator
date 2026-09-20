# Open questions

Questions an agent could not answer from the repository and must not
guess. Check off with the answer inline once resolved.

- [ ] (example) Which deployment target should CI validate against?

## Yaru Orange fails contrast in both themes — ship as specced, or adjust?

Raised 2026-09-20 during the Ubuntu/Yaru refresh. Of the ten approved accents,
Orange `#E95420` is the only one that fails WCAG AA both ways: white on it is
~3.65:1 (suggested-action buttons) and it as text on `--bg #fafafa` is 3.50:1
(status captions, badges, menu checks). It is also the *default* Yaru accent,
so a user following the system accent on a stock Ubuntu lands on it.

The other nine sit at 4.32–4.39 as text on `#fafafa`, marginally under 4.5,
because Yaru tunes its palette against pure `#ffffff` rather than the `#fafafa`
the design uses for the window.

Shipped as specified — the values are the designer's. Needs a decision on
whether to darken Orange for text use, or accept it.

