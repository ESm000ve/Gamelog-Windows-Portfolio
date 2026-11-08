import { useState } from "react";
import { ProgressBar } from "@fluentui/react-components";
import type { AchievementStatus } from "../../services/achievements";
import { ActivityTabs } from "./ActivityTabs";
import {
  Trophy,
  CheckCircle2,
  Star,
  Award,
  Clock,
  Flame,
  Gamepad2,
  Library,
  Sword,
  Compass,
  Monitor,
  Zap,
  Lock,
} from "../../components/icons";
const icons = {
  Trophy,
  CheckCircle2,
  Star,
  Award,
  Clock,
  Flame,
  Gamepad2,
  Library,
  Sword,
  Compass,
  Monitor,
  Zap,
};
export function AchievementsSection({ achievements }: { achievements: AchievementStatus[] }) {
  const [filter, setFilter] = useState<"all" | "unlocked" | "locked">("all");
  const unlocked = achievements.filter((achievement) => achievement.unlocked).length;
  const percentage = achievements.length ? Math.round((unlocked / achievements.length) * 100) : 0;
  const filtered = achievements.filter(
    (achievement) =>
      filter === "all" || (filter === "unlocked" ? achievement.unlocked : !achievement.unlocked)
  );
  const next = achievements
    .filter((achievement) => !achievement.unlocked && achievement.current > 0)
    .sort((a, b) => b.percentage - a.percentage)[0];
  return (
    <div className="activity-achievements">
      <section
        className="activity-surface activity-achievement-overview"
        aria-label="Library achievement progress"
      >
        <div>
          <h2>Library achievements</h2>
          <p>
            {unlocked} of {achievements.length} unlocked · {percentage}%
          </p>
          <p className="activity-help">
            Badges reflect your current recorded library. They can change when records are corrected
            or removed.
          </p>
        </div>
        <div className="activity-overall-progress">
          {<ProgressBar aria-label="Library achievement progress" value={percentage / 100} />}
        </div>
      </section>
      {next && (
        <p className="activity-next-badge">
          <Trophy size={18} aria-hidden="true" />
          <span>
            Closest milestone: <strong>{next.title}</strong> · {next.current} of {next.target}
          </span>
        </p>
      )}
      <ActivityTabs
        label="Achievement filters"
        value={filter}
        onChange={setFilter}
        options={[
          { value: "all", label: `All (${achievements.length})`, controls: "achievement-results" },
          { value: "unlocked", label: `Unlocked (${unlocked})`, controls: "achievement-results" },
          {
            value: "locked",
            label: `Not unlocked (${achievements.length - unlocked})`,
            controls: "achievement-results",
          },
        ]}
      />
      <div
        id="achievement-results"
        role={"tabpanel"}
        aria-labelledby={`achievement-results-${filter}-tab`}
        className="activity-achievement-grid"
      >
        {!filtered.length && <p>No achievements in this category yet.</p>}
        {filtered.map((achievement) => {
          const Icon = icons[achievement.iconName as keyof typeof icons] ?? Trophy;
          return (
            <article
              key={achievement.id}
              className="activity-surface activity-achievement-card"
              aria-label={achievement.title}
            >
              <div className="activity-section-heading">
                <Icon size={24} aria-hidden="true" />
                <span className="activity-category">{achievement.category}</span>
              </div>
              <h3>{achievement.title}</h3>
              <p>{achievement.description}</p>
              <div className="activity-section-heading">
                <span>
                  {achievement.current} / {achievement.target}
                </span>
                <span className="activity-unlock-status">
                  {achievement.unlocked ? (
                    <CheckCircle2 size={16} aria-hidden="true" />
                  ) : (
                    <Lock size={16} aria-hidden="true" />
                  )}
                  {achievement.unlocked ? "Unlocked" : "Not unlocked"}
                </span>
              </div>
              {
                <ProgressBar
                  aria-label={`${achievement.title} progress`}
                  value={achievement.percentage / 100}
                />
              }
            </article>
          );
        })}
      </div>
    </div>
  );
}
