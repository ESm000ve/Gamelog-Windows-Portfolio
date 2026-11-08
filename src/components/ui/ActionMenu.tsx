import { useEffect, type ReactElement, type ReactNode } from "react";
import {
  Menu,
  MenuTrigger,
  MenuPopover,
  MenuList,
  MenuItem,
  MenuItemRadio,
  MenuDivider,
} from "@fluentui/react-components";
import { useFlyout } from "../../services/overlay";
export interface ActionMenuItem {
  key: string;
  label: string;
  icon?: ReactElement;
  onClick?: () => void;
  children?: ActionMenuItem[];
  checked?: boolean;
  danger?: boolean;
  disabled?: boolean;
  divider?: boolean;
}
export function ActionMenu({
  trigger,
  items,
  label,
  onOpenChange,
}: {
  trigger: ReactElement;
  items: ActionMenuItem[];
  label: string;
  onOpenChange?: (open: boolean) => void;
}) {
  const [open, setOpen] = useFlyout();
  useEffect(() => {
    onOpenChange?.(open);
  }, [open, onOpenChange]);
  return (
    <Menu
      checkedValues={{ selection: items.filter((item) => item.checked).map((item) => item.key) }}
      open={open}
      onOpenChange={(_event, data) => setOpen(data.open)}
      positioning={{
        position: "below",
        align: "end",
        offset: 4,
        autoSize: "height",
        overflowBoundaryPadding: 8,
      }}
      closeOnScroll
    >
      <MenuTrigger disableButtonEnhancement>{trigger}</MenuTrigger>
      <MenuPopover className="app-menu-surface">
        <MenuList aria-label={label} aria-labelledby={undefined}>
          {items.map((item) => (
            <MenuEntry key={item.key} item={item} />
          ))}
        </MenuList>
      </MenuPopover>
    </Menu>
  );
}
function MenuEntry({ item }: { item: ActionMenuItem }) {
  if (item.children)
    return (
      <Menu
        positioning={{ position: "after", align: "start" }}
        checkedValues={{
          selection: item.children.filter((child) => child.checked).map((child) => child.key),
        }}
      >
        <MenuTrigger disableButtonEnhancement>
          <MenuItem icon={item.icon}>{item.label}</MenuItem>
        </MenuTrigger>
        <MenuPopover className="app-menu-surface">
          <MenuList aria-label={item.label} aria-labelledby={undefined}>
            {item.children.map((child) => (
              <MenuEntry key={child.key} item={child} />
            ))}
          </MenuList>
        </MenuPopover>
      </Menu>
    );
  const content: ReactNode =
    item.checked !== undefined ? (
      <MenuItemRadio
        name="selection"
        value={item.key}
        icon={item.icon}
        disabled={item.disabled}
        onClick={item.onClick}
      >
        {item.label}
      </MenuItemRadio>
    ) : (
      <MenuItem
        icon={item.icon}
        disabled={item.disabled}
        onClick={item.onClick}
        style={item.danger ? { color: "var(--app-red)" } : undefined}
      >
        {item.label}
      </MenuItem>
    );
  return (
    <>
      {item.divider && <MenuDivider />}
      {content}
    </>
  );
}
