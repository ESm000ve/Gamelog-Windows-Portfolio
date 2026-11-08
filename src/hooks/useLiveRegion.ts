import { useEffect, useRef, useCallback } from "react";

export type Politeness = "polite" | "assertive";

/**
 * A hook that provides a function to announce messages to screen readers
 * using an aria-live region. It injects a visually hidden region into the DOM
 * if it doesn't already exist.
 */
export function useLiveRegion() {
  const liveRegionRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    // Create live region on mount if it doesn't exist
    let region = document.getElementById("a11y-live-region") as HTMLDivElement | null;

    if (!region) {
      region = document.createElement("div");
      region.id = "a11y-live-region";

      // Visually hide the region
      region.style.position = "absolute";
      region.style.width = "1px";
      region.style.height = "1px";
      region.style.padding = "0";
      region.style.margin = "-1px";
      region.style.overflow = "hidden";
      region.style.clip = "rect(0, 0, 0, 0)";
      region.style.whiteSpace = "nowrap";
      region.style.border = "0";

      // Setup assertive/polite containers inside
      region.innerHTML = `
        <div id="a11y-live-polite" aria-live="polite" aria-atomic="true"></div>
        <div id="a11y-live-assertive" aria-live="assertive" aria-atomic="true"></div>
      `;

      document.body.appendChild(region);
    }

    liveRegionRef.current = region;

    // We don't remove it on unmount because multiple components might use it
  }, []);

  const announce = useCallback((message: string, politeness: Politeness = "polite") => {
    if (!liveRegionRef.current) return;

    const targetId = politeness === "polite" ? "a11y-live-polite" : "a11y-live-assertive";
    const targetNode = liveRegionRef.current.querySelector(`#${targetId}`);

    if (targetNode) {
      // Clear first to ensure screen readers announce identical sequential messages
      targetNode.textContent = "";
      setTimeout(() => {
        targetNode.textContent = message;
      }, 50);
    }
  }, []);

  return { announce };
}
