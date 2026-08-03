import { ChevronDownIcon, ChevronUpIcon } from '@heroicons/react/24/outline';
import { ReactNode } from 'react';

import { Button } from '~/components/ui/button';
import { CardContent, CardHeader, CardTitle } from '~/components/ui/card';

export const Section = ({
  actions = null,
  children,
  title,
  collapsible = false,
  collapsed = false,
  onToggle,
  summary,
}: {
  actions?: ReactNode;
  children: ReactNode;
  title?: string;
  collapsible?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
  summary?: ReactNode;
}) => {
  const showCollapsed = collapsible && collapsed;

  return (
    <>
      <CardHeader>
        <div className="flex w-full items-center justify-between gap-x-1">
          {showCollapsed ? (
            <button
              type="button"
              onClick={onToggle}
              className="min-w-0 flex-1 text-left"
              aria-expanded={false}
              aria-label={`Expand ${title}`}
            >
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {summary != null && (
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  {summary}
                </div>
              )}
            </button>
          ) : (
            <>
              <CardTitle className="text-sm font-medium">{title}</CardTitle>
              {actions}
            </>
          )}
          {collapsible && (
            <Button
              variant="ghost"
              size="icon"
              className="shrink-0"
              aria-label={collapsed ? `Expand ${title}` : `Collapse ${title}`}
              aria-expanded={!collapsed}
              onClick={onToggle}
            >
              {collapsed ? (
                <ChevronDownIcon className="h-2.5 w-2.5" />
              ) : (
                <ChevronUpIcon className="h-2.5 w-2.5" />
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      {!showCollapsed && (
        <CardContent className="flex flex-col gap-y-2">{children}</CardContent>
      )}
    </>
  );
};
