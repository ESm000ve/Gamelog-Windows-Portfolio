import { useState, useEffect } from "react";
import {
  useRestoreFocusTarget,
  OverlayDrawer,
  DrawerHeader,
  DrawerHeaderTitle,
  DrawerBody,
} from "@fluentui/react-components";
import { registerDialog } from "../services/overlay";
import { Dismiss20Regular } from "@fluentui/react-icons";
import { NavLink } from "react-router-dom";
import {
  PanelLeft20Regular,
  Library20Regular,
  AppsList20Regular,
  Games20Regular,
  Sparkle20Regular,
  CalendarLtr20Regular,
  People20Regular,
  DataBarVertical20Regular,
  Settings20Regular,
  Add20Regular,
} from "@fluentui/react-icons";
import { Button } from "../components/ui/Button";
import "./Sidebar.css";
const NAV = [
  { to: "/", label: "Library", Icon: Library20Regular },
  { to: "/lists", label: "Lists", Icon: AppsList20Regular },
  { to: "/systems", label: "Systems", Icon: Games20Regular },
  { to: "/recommend", label: "What to play", Icon: Sparkle20Regular },
  { to: "/activity", label: "Activity", Icon: CalendarLtr20Regular },
  { to: "/friends", label: "Friends", Icon: People20Regular },
  { to: "/stats", label: "Statistics", Icon: DataBarVertical20Regular },
];
export function Sidebar({ onAddGame }: { onAddGame: () => void }) {
  const navigationFocusTarget = useRestoreFocusTarget();
  const [expanded, setExpanded] = useState(true);
  const [narrow, setNarrow] = useState(() => window.matchMedia("(max-width: 1000px)").matches);
  const [paneOpen, setPaneOpen] = useState(false);
  useEffect(() => {
    const media = window.matchMedia("(max-width: 1000px)");
    const update = () => {
      setNarrow(media.matches);
      setPaneOpen(false);
    };
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  useEffect(() => {
    if (paneOpen) return registerDialog("navigation-pane", () => setPaneOpen(false));
  }, [paneOpen]);
  const showLabels = expanded && !narrow;
  const links = (
    <>
      {NAV.map(({ to, label, Icon }) => (
        <NavLink
          key={to}
          to={to}
          end={to === "/"}
          aria-label={label}
          title={label}
          onClick={() => setPaneOpen(false)}
          className={({ isActive }) => "sidebar-nav-item " + (isActive ? "active" : "")}
        >
          <Icon />
          <span>{label}</span>
        </NavLink>
      ))}
    </>
  );
  const settingsLink = (
    <NavLink
      to="/settings"
      aria-label="Settings"
      title="Settings"
      onClick={() => setPaneOpen(false)}
      className={({ isActive }) => "sidebar-nav-item " + (isActive ? "active" : "")}
    >
      <Settings20Regular />
      <span>Settings</span>
    </NavLink>
  );
  const addButton = (
    <Button
      variant="primary"
      aria-label="Add game to library"
      onClick={() => {
        setPaneOpen(false);
        onAddGame();
      }}
    >
      <Add20Regular />
      <span>Add game</span>
    </Button>
  );
  return (
    <>
      <aside
        className={"sidebar " + (showLabels ? "expanded" : "compact")}
        aria-label="Application navigation"
      >
        <div className="sidebar-pane-toggle">
          <Button
            {...navigationFocusTarget}
            variant="ghost"
            aria-label={
              narrow ? "Open navigation" : expanded ? "Collapse navigation" : "Expand navigation"
            }
            aria-expanded={narrow ? paneOpen : expanded}
            onClick={() => (narrow ? setPaneOpen(true) : setExpanded(!expanded))}
          >
            <PanelLeft20Regular />
          </Button>
        </div>
        <div className="sidebar-add-game">{addButton}</div>
        <nav className="sidebar-nav" aria-label="Main navigation">
          {links}
        </nav>
        <div className="sidebar-footer">{settingsLink}</div>
      </aside>
      <OverlayDrawer
        open={paneOpen}
        onOpenChange={(_event, data) => setPaneOpen(data.open)}
        position="start"
        className="windows-navigation-drawer"
        style={{ width: 252 }}
      >
        <DrawerHeader>
          <DrawerHeaderTitle
            action={
              <Button
                variant="ghost"
                aria-label="Close navigation"
                onClick={() => setPaneOpen(false)}
              >
                <Dismiss20Regular />
              </Button>
            }
          >
            Navigation
          </DrawerHeaderTitle>
        </DrawerHeader>
        <DrawerBody>
          <div className="sidebar expanded" style={{ width: "100%", height: "100%", padding: 0 }}>
            <div className="sidebar-add-game">{addButton}</div>
            <nav className="sidebar-nav" aria-label="Main navigation">
              {links}
            </nav>
            <div className="sidebar-footer">{settingsLink}</div>
          </div>
        </DrawerBody>
      </OverlayDrawer>
    </>
  );
}
