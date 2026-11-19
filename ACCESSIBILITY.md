# Accessibility

AirWise targets **WCAG 2.1 AA**. Families on smoggy days include grandparents, people with low vision, people who read Hindi more easily than English, and people using only a keyboard or a screen reader, so accessibility is tested on every change, not checked once.

## How it is enforced
- **Automated:** Playwright runs **axe-core** (WCAG 2.0/2.1 A and AA rules) on **9 pages in light and dark mode** (18 scans) in CI. Any serious or critical violation fails the build (`tests/e2e/app.spec.ts`).
- **Keyboard journey test:**
  1. reach the skip link;
  2. search for a city and pick it with the arrow keys and Enter;
  3. open and close the alerts menu with Enter and Escape;
  4. tick a plan step with Space.

## What we do
| Area | Practice |
|---|---|
| Structure | One `h1` per page (`PageHeader`), landmarks (`nav`, `main`, `aside`), a skip link, `lang` set from the chosen language. |
| Keyboard | Every control is a real `button`, `a`, `input` or `label`. The location search is an ARIA combobox (arrow keys, Enter, Escape). Menus close on Escape and outside click. The setup wizard moves focus to each new step. Chart bars are focusable buttons that announce their value. |
| Screen readers | Charts have text alternatives (`role="img"` with a summary, or labelled bars). Status changes (location set, copied, refresh, plan progress, streaming chat) use `role="status"` / `aria-live`. The countdown announces minutes rather than every second. |
| Colour | AQI colours always come with words: the category name, a legend, or a number. Every text and background pair is checked in both themes. |
| Plain language | Units are spelled out ("micrograms per cubic metre"), pollutants have plain names ("Fine smoke (PM2.5)"), there is a "What do these numbers mean?" glossary, and chat answers are plain text. |
| Motion | `prefers-reduced-motion` turns off all animation; counters jump straight to their final value. |
| Touch and zoom | Main controls are at least 40 px, the layout has no horizontal scroll from phone width up to 80% browser zoom, and text wraps instead of overflowing. |
| Language | Interface, plan and chat in English or Hindi; the share message follows the chosen language. |

## Known gaps
- Some newer component text is English-only in the Hindi interface.
- Browser notifications depend on the operating system's own accessibility support.
