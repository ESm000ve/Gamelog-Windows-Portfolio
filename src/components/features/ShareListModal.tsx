import { useState, useEffect, useRef, useId } from "react";
import { Tab, TabList } from "@fluentui/react-components";
import { TextArea } from "../ui/Controls";
import { Copy, Download, Check, Calendar, FileText, Image as ImageIcon } from "../icons";
import type { Game, Log } from "../../types";
import {
  generateMarkdownList,
  generateShareCardCanvas,
  downloadCanvasImage,
  copyCanvasImageToClipboard,
} from "../../services/listShare";
import { downloadCalendarICS } from "../../services/calendarSync";
import { operationError } from "../../services/feedback";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { OperationFeedback } from "../ui/Feedback";
import "./ShareListModal.css";

interface ShareListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  entries: { game: Game; log?: Log }[];
}
const formats = [
  { value: "markdown", label: "Markdown Text", icon: <FileText size={16} /> },
  { value: "image", label: "Visual Card", icon: <ImageIcon size={16} /> },
  { value: "calendar", label: "Calendar (.ics)", icon: <Calendar size={16} /> },
] as const;
type Format = (typeof formats)[number]["value"];

export function ShareListModal({ isOpen, onClose, title, entries }: ShareListModalProps) {
  const id = useId();
  const activeFormat = useRef<Format>("markdown");
  const [tab, setTab] = useState<Format>("markdown");
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [error, setError] = useState("");
  const [imageError, setImageError] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [retry, setRetry] = useState(0);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!isOpen || tab !== "image") return;
    let active = true;
    canvasRef.current = null;
    setImageUrl(null);
    setImageError("");
    setGenerating(true);
    void generateShareCardCanvas(title, entries)
      .then((canvas) => {
        if (!active) return;
        const url = canvas.toDataURL("image/png");
        canvasRef.current = canvas;
        setImageUrl(url);
      })
      .catch((failure) => {
        if (active)
          setImageError(operationError(failure, "Could not generate the card. Try again."));
      })
      .finally(() => {
        if (active) setGenerating(false);
      });
    return () => {
      active = false;
    };
  }, [isOpen, tab, title, entries, retry]);
  if (!isOpen) return null;

  const changeTab = (value: Format) => {
    activeFormat.current = value;
    setTab(value);
    setError("");
    setCopied(false);
  };
  const copy = async () => {
    if (copying) return;
    setCopying(true);
    setCopied(false);
    setError("");
    try {
      if (tab === "markdown") {
        if (!navigator.clipboard?.writeText)
          throw new Error("Clipboard access is unavailable. Select and copy the text below.");
        await navigator.clipboard.writeText(generateMarkdownList(title, entries));
      } else {
        if (!canvasRef.current || !(await copyCanvasImageToClipboard(canvasRef.current)))
          throw new Error("Could not copy the image. Use Download PNG instead.");
      }
      if (mounted.current && activeFormat.current === tab) setCopied(true);
    } catch (failure) {
      if (mounted.current && activeFormat.current === tab)
        setError(operationError(failure, "Could not copy. Please try again."));
    } finally {
      if (mounted.current) setCopying(false);
    }
  };
  const filename =
    title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "game-library";
  const download = () => {
    setError("");
    try {
      if (tab === "image" && canvasRef.current)
        downloadCanvasImage(canvasRef.current, filename + ".png");
      else if (tab === "calendar") downloadCalendarICS(entries, filename + ".ics", title);
    } catch (failure) {
      setError(operationError(failure, "Could not export. Please try again."));
    }
  };
  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Share and export: ${title}`} width={600}>
      <div className="share-export">
        {
          <TabList
            aria-label="Export format"
            selectedValue={tab}
            onTabSelect={(_event, data) => changeTab(data.value as Format)}
          >
            {formats.map((format) => (
              <Tab
                key={format.value}
                id={id + format.value}
                value={format.value}
                icon={format.icon}
                aria-controls={id + "panel"}
              >
                {format.label}
              </Tab>
            ))}
          </TabList>
        }
        <div
          id={id + "panel"}
          role={"tabpanel"}
          aria-labelledby={id + tab}
          className="share-export-panel"
        >
          <OperationFeedback error={error} />
          {tab === "markdown" && (
            <>
              <p>Copy a checklist with your recorded ratings, outcomes and platforms.</p>
              <TextArea
                aria-label="Markdown export"
                readOnly
                value={generateMarkdownList(title, entries)}
                rows={10}
              />
              <Button variant="primary" loading={copying} onClick={copy}>
                {copied ? <Check size={18} /> : <Copy size={18} />}
                {copied ? "Copied Markdown to Clipboard!" : "Copy Markdown Text"}
              </Button>
            </>
          )}
          {tab === "image" && (
            <>
              <p>A card with up to five game covers and a summary of this collection.</p>
              <OperationFeedback
                busy={generating}
                message={generating ? "Generating collage card…" : undefined}
                error={imageError}
              />
              {imageError && (
                <Button onClick={() => setRetry((value) => value + 1)}>Try generating again</Button>
              )}
              {imageUrl && (
                <img className="share-export-preview" src={imageUrl} alt="Share card preview" />
              )}
              <div className="share-export-actions">
                <Button
                  variant="primary"
                  loading={copying}
                  disabled={!imageUrl || generating}
                  onClick={copy}
                >
                  {copied ? <Check size={18} /> : <Copy size={18} />}
                  {copied ? "Copied Image!" : "Copy Image"}
                </Button>
                <Button disabled={!imageUrl || generating} onClick={download}>
                  <Download size={18} />
                  Download PNG
                </Button>
              </div>
            </>
          )}
          {tab === "calendar" && (
            <>
              <p>
                Export dates and status notes to an iCalendar file for Outlook, Apple Calendar or
                Google Calendar.
              </p>
              <p>
                Dates use recorded start dates or release dates. Year-only releases use a July 1
                estimate.
              </p>
              <Button variant="primary" onClick={download}>
                <Download size={18} />
                Download Calendar (.ics)
              </Button>
            </>
          )}
          {copied && (
            <span role="status" className="share-export-status">
              Copied to clipboard.
            </span>
          )}
        </div>
      </div>
    </Modal>
  );
}
