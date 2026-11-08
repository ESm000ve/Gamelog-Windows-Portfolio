// Electron windows use the non-standard `-webkit-app-region` CSS property to
// mark draggable title-bar regions. React's CSSProperties type doesn't know
// about it, so we augment it here rather than sprinkling `as any` at every
// call site (shell/Sidebar.tsx, shell/GlobalSearch.tsx, screens/Library/LibraryScreen.tsx).
import "react";

declare module "react" {
  interface CSSProperties {
    WebkitAppRegion?: "drag" | "no-drag";
  }
}
