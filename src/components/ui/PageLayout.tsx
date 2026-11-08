import type { ReactNode, ComponentPropsWithRef, ButtonHTMLAttributes } from "react";
import "./PageLayout.css";

interface PageHeaderProps {
  title: ReactNode;
  description?: ReactNode;
  count?: ReactNode;
  leading?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  embedded?: boolean;
}
/** One title hierarchy and spacing rule for every top-level screen. */
export function PageHeader({
  title,
  description,
  count,
  leading,
  actions,
  children,
  embedded,
}: PageHeaderProps) {
  return (
    <header className={`app-page-header${embedded ? " app-page-header-embedded" : ""}`}>
      <div className="app-page-heading-row">
        {leading && <div className="app-page-leading">{leading}</div>}
        <div className="app-page-heading">
          <div className="app-page-title-row">
            <h1>{title}</h1>
            {count !== undefined && <span className="app-page-count">{count}</span>}
          </div>
          {description && <p className="app-page-description">{description}</p>}
        </div>
        {actions && <div className="app-page-actions">{actions}</div>}
      </div>
      {children}
    </header>
  );
}
/** A labeled control group; each control retains its normal Tab stop. */
export function PageControls({
  label,
  children,
  className = "",
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div role="group" aria-label={label} className={`app-page-controls ${className}`}>
      {children}
    </div>
  );
}
export function EmptyState({
  icon,
  title,
  description,
  actions,
  alert = false,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  actions?: ReactNode;
  alert?: boolean;
}) {
  return (
    <div className="app-empty-state" role={alert ? "alert" : undefined}>
      {icon && (
        <div className="app-empty-icon" aria-hidden="true">
          {icon}
        </div>
      )}
      <h2>{title}</h2>
      <p>{description}</p>
      {actions && <div className="app-empty-actions">{actions}</div>}
    </div>
  );
}
export function Surface({ className = "", ...props }: ComponentPropsWithRef<"section">) {
  return <section className={`app-surface ${className}`} {...props} />;
}
export function CollectionCard({
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`app-surface app-collection-card ${className}`} {...props} />
  );
}
