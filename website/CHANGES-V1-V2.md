# Lumi Lane V2 handoff

## Recovered Claude Code work

- Next.js 16 App Router, React 19, TypeScript, Tailwind, GSAP and a working static-export pipeline.
- Home, Menu, About, Visit Us and Book a Table routes, the original venue and menu data, booking validation, menu tab deep links, legacy hash routing, and original photography and fonts.
- A five-dish GSAP tabletop prototype with a full-table entry, rotation, copy and colour transitions, navigation controls, reduced motion and geometry tests.
- Playwright specs for routing, menu data, form validation, assets and carousel behavior. The homepage consisted of the tabletop and shared footer. Interior pages, the floating gradient navigation and footer still used the V1 styling.

## Codex continuation

- Reworked the tabletop placement, caption treatment, palette, shadows and controls while retaining the existing GSAP controller and geometry model.
- Replaced the floating navigation with a top masthead and restyled the category overview. Rebuilt the shared footer around the original brand, venue details, links and policies.
- Added homepage sections for the four menu categories, venue story and visit details.
- Applied one editorial system to the Menu, About, Visit Us, booking and 404 pages. Reflowed the menu as a printed menu, with aligned prices and no repeated placeholder thumbnails.
- Kept booking validation and the local summary. Updated the booking introduction so visitors know to call to reserve.
- Added a homepage route regression test and browser captures for the full pages and intermediate carousel poses.

The recovered archive’s menu data, business data, booking validator and V1 reference HTML match the corresponding workspace files byte for byte.
