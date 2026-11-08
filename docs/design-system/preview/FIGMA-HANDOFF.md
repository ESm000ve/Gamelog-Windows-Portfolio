# Gamelog Windows design system — Figma handoff

Design-system snapshot created November 6, 2026. The Figma library and exported reference boards document the Windows app.

- [Open the design system](https://www.figma.com/design/PFC9DSki5Eyil4oRWc0x7k?node-id=12-2)
- [Portfolio presentation boards](https://www.figma.com/design/PFC9DSki5Eyil4oRWc0x7k?node-id=13-11)
- [Browse-to-save prototype](https://www.figma.com/proto/PFC9DSki5Eyil4oRWc0x7k?node-id=10-40&starting-point-node-id=10%3A40)

## What is in the file

10 pages, 16 review/presentation frames and four linked prototype frames. The library contains 133 variables (75 primitives, 47 semantic colors, 11 dimensions), Light/Dark semantic modes, 10 text styles, four effect styles and 17 UI families. There are 131 component masters including 14 original Microsoft Fluent icons; the UI families use 12 component sets plus standalone components.

The pages cover getting started, foundations, actions, input/selection, navigation, content/status, overlays/feedback, UX patterns, accessibility/governance/source mapping and four portfolio boards.

Review frames use linked instances. Masters are arranged separately to the right. Colors, applicable padding/gap and radii are bound to variables. Text content and icon swaps use component properties where applicable. Size/state variant matrices remain separate from arbitrary content choices.

## Font decision

The connected editor did not expose Segoe UI. The user approved Inter as a clearly labelled Figma-only substitute. The Windows app still uses Segoe UI Variable. No font was downloaded, redistributed or changed in the application.

## Scope and evidence

- Source: Windows CSS, PlatformProvider, shared controls, navigation, metadata, overlays and feedback modules in this checkout. Source mappings and known representation gaps are documented on page 08.
- Visual review covered all 16 review/presentation boards and four prototype frames. Repairs corrected label alignment, busy indicators, filled values, selection marks, example form values, status variants and the distinction between catalog preview and a saved library record.
- Structural checks found no invalid geometry, layout overflow, duplicate variants or unstyled text. All checked text uses the approved Inter family. Variable scopes and code syntax are present; selected semantic alias and component binding/property checks passed.
- The prototype has a starting point and six checked navigation links. It demonstrates preview, Add, review, Save, Cancel and return paths with fictional content. Fields are illustrative; this is not a copy of the full working app, nor does it save personal data.
- Selected foreground/background contrast pairs were computed from source values. Full Narrator, forced-color, zoom/reflow and all-accent/state verification remains separate. Low-contrast quaternary labels are documented for nonessential use only.
- Prior application verification (147 unit/API tests, 116 production browser cases and isolated native restart checks) is explicitly identified as the Windows-cleanup checkpoint, not a new user study or an accessibility certification.

The library is editable in the file and has not been published as a team library. Code Connect is not enabled/published: the connected team is on a student plan and the components are local. A manual source/API map is provided instead. No research participants, conversion improvement, adoption or efficiency metrics were invented.

## Portfolio use

Start on page 09 for the narrative: context, four design decisions and their tradeoffs, system architecture, evidence and recommended validation. Use page 00 as the system introduction. The narrative credits Microsoft Fluent UI for the base design language and identifies the work as AI-assisted. Describe personal ownership accurately when publishing the portfolio.

`figma-manifest.json` records stable file/node links and counts. `boards/` contains reviewed Figma exports; these screenshots are references, not flattened substitutes for the editable library.

## References

- [Windows typography](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/typography)
- [Windows geometry](https://learn.microsoft.com/en-us/windows/apps/design/signature-experiences/geometry)
- [Fluent dialog guidance](https://fluent2.microsoft.design/components/web/react/core/dialog/usage)
- [Keyboard interactions](https://learn.microsoft.com/en-us/windows/apps/develop/input/keyboard-interactions)
- [WCAG contrast minimum](https://www.w3.org/WAI/WCAG21/Understanding/contrast-minimum.html)
- [WCAG non-text contrast](https://www.w3.org/WAI/WCAG21/Understanding/non-text-contrast.html)
