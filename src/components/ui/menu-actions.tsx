import type { ComponentType, ReactNode } from "react";

/** Shared shape for one row in a Dropdown- or Context-menu. Rendering it
 * through `renderMenuActions` below means every right-click menu and
 * every "..." kebab menu in the app draws from the exact same list —
 * define the actions for an entity once, offer them both ways. */
export type MenuAction = {
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick: () => void;
  variant?: "default" | "destructive";
  shortcut?: string;
  disabled?: boolean;
};

type ItemComponent = ComponentType<{
  variant?: "default" | "destructive";
  disabled?: boolean;
  onClick?: () => void;
  children?: ReactNode;
}>;
type ShortcutComponent = ComponentType<{ children?: ReactNode }>;

export function renderMenuActions(
  actions: MenuAction[],
  Item: ItemComponent,
  Shortcut: ShortcutComponent,
) {
  return actions.map((action) => (
    <Item
      key={action.label}
      variant={action.variant}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.icon && <action.icon className="size-4" />}
      {action.label}
      {action.shortcut && <Shortcut>{action.shortcut}</Shortcut>}
    </Item>
  ));
}
