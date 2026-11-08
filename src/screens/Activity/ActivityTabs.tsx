import type { ReactElement } from "react";
import { Tab, TabList } from "@fluentui/react-components";
export function ActivityTabs<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: string; icon?: ReactElement; controls: string }[];
}) {
  return (
    <TabList
      aria-label={label}
      selectedValue={value}
      onTabSelect={(_event, data) => onChange(data.value as T)}
    >
      {options.map((option) => (
        <Tab
          key={option.value}
          id={`${option.controls}-${option.value}-tab`}
          aria-controls={option.controls}
          value={option.value}
          icon={option.icon}
        >
          {option.label}
        </Tab>
      ))}
    </TabList>
  );
}
