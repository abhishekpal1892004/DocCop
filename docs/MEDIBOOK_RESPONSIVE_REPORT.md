# MediBook – Responsive Report

- **Breakpoints:** Mobile-first Tailwind CSS (`sm`, `md`, `lg`) with `overflow-x: hidden` on `body`.
- **Navigation:** Desktop horizontal bar collapses cleanly into a keyboard-dismissible mobile drawer (`Escape` + backdrop close).
- **Editorial Grids & Tables:** Multi-column hero/split layouts stack vertically on `< lg`; operational `Table.jsx` switches from `<table>` on `>= md` to structured cards on `< md`.
- **Interactive Browser Viewport Matrix:** **NOT TESTED** in automated browser viewports; verified via responsive CSS rules and production build.
