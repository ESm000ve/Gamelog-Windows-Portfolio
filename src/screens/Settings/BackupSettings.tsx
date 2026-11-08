import { Surface } from "../../components/ui/PageLayout";
import { notify, notifyRemoval, operationError } from "../../services/feedback";
import { TextInput } from "../../components/ui/Controls";
import { useRef, useState } from "react";
import {
  Download,
  Upload,
  AlertTriangle,
  CheckCircle2,
  Trash2,
  Database,
} from "../../components/icons";
import { exportData, importData } from "../../services/backup";
import { Button } from "../../components/ui/Button";

export function BackupSettings() {
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [confirmFile, setConfirmFile] = useState<File | null>(null);

  const handleExport = async () => {
    if (exporting || importing) return;
    setExporting(true);
    setError("");
    try {
      await exportData();
      notify("Backup download started", { intent: "success" });
    } catch (err: any) {
      setError(operationError(err, "Could not export your backup. Please try again."));
    } finally {
      setExporting(false);
    }
  };

  const onFileSelected = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setConfirmFile(file);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleImport = async (mode: "merge" | "replace") => {
    if (!confirmFile || importing || exporting) return;
    setImporting(true);
    setProgress(0);
    setError("");
    setSuccess(false);

    try {
      const text = await confirmFile.text();
      const recoveryId = await importData(text, mode, (pct, msg) => {
        setProgress(pct);
        setStatusMsg(msg);
      });
      notifyRemoval("Backup imported", recoveryId);
      setSuccess(true);
      setStatusMsg("Import completed successfully!");
      setConfirmFile(null);
    } catch (err: any) {
      setError(
        "Could not import this backup. Your library was not changed. " +
          operationError(err, "Check the file and try again.")
      );
    } finally {
      setImporting(false);
    }
  };

  return (
    <Surface className="settings-card">
      <div
        style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: "var(--space-4)" }}
      >
        <Database size={24} color="var(--app-accent)" />
        <h2 style={{ fontSize: "var(--font-size-xl)", fontWeight: 600 }}>Backup and restore</h2>
      </div>

      <p style={{ color: "var(--app-secondary-label)", marginBottom: 30, lineHeight: 1.5 }}>
        Your data is stored locally in your browser's IndexedDB. Export your games, logs, lists, and
        tags to a portable JSON file. New backups include catalog metadata and can be restored
        offline. Older backups may need an internet connection to retrieve missing game details.
        Recovery copies in Recently removed stay on this device and are not included in exports.
      </p>

      <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
        <Button variant="secondary" loading={exporting} disabled={importing} onClick={handleExport}>
          <Download size={18} />
          Export backup
        </Button>

        <Button
          variant="primary"
          disabled={importing || exporting}
          onClick={() => fileInputRef.current?.click()}
        >
          <Upload size={18} />
          Import backup...
        </Button>
        <TextInput
          type="file"
          accept=".json"
          ref={fileInputRef}
          onChange={onFileSelected}
          style={{ display: "none" }}
        />
      </div>

      {confirmFile && !importing && (
        <div
          style={{
            marginTop: 30,
            padding: "var(--space-5)",
            background: "rgba(255, 150, 0, 0.1)",
            border: "1px solid rgba(255, 150, 0, 0.3)",
            borderRadius: "var(--radius-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              color: "var(--app-orange)",
              marginBottom: "var(--space-3)",
            }}
          >
            <AlertTriangle size={20} />
            <strong style={{ fontSize: "var(--font-size-lg)" }}>Import Confirmation</strong>
          </div>
          <p
            style={{
              color: "var(--app-secondary-label)",
              marginBottom: "var(--space-5)",
              fontSize: 14,
            }}
          >
            You selected <strong>{confirmFile.name}</strong>. How would you like to apply this data?
          </p>
          <div style={{ display: "flex", gap: 12 }}>
            <Button variant="secondary" onClick={() => handleImport("merge")}>
              Merge (Add & Update)
            </Button>
            <Button variant="danger" onClick={() => handleImport("replace")}>
              <Trash2 size={16} />
              Wipe & Replace
            </Button>
            <Button variant="ghost" onClick={() => setConfirmFile(null)}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {importing && (
        <div role="status" style={{ marginTop: 30 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "var(--space-2)",
              fontSize: 14,
              color: "var(--app-secondary-label)",
            }}
          >
            <span>{statusMsg}</span>
            <span>{progress}%</span>
          </div>
          <div
            style={{
              height: 6,
              background: "var(--app-separator)",
              borderRadius: 3,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                background: "var(--app-accent)",
                width: `${progress}%`,
                transition: "width 0.2s ease-out",
              }}
            />
          </div>
        </div>
      )}

      {error && (
        <div
          role="alert"
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-3)",
            background: "rgba(255,50,50,0.1)",
            color: "var(--app-red)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <AlertTriangle size={18} />
          {error}
        </div>
      )}
      {success && (
        <div
          role="status"
          style={{
            marginTop: "var(--space-5)",
            padding: "var(--space-3)",
            background: "rgba(50,200,50,0.1)",
            color: "var(--app-green)",
            borderRadius: "var(--radius-md)",
            display: "flex",
            gap: 8,
            alignItems: "center",
          }}
        >
          <CheckCircle2 size={18} />
          {statusMsg}
        </div>
      )}
    </Surface>
  );
}
