import type { PluginWidgetProps } from "@paperclipai/plugin-sdk/ui";

const WIDGET_LABEL = "Hello world plugin widget";

/**
 * Example dashboard widget showing the smallest possible UI contribution.
 */
export function HelloWorldDashboardWidget({ context }: PluginWidgetProps) {
  return (
    <section aria-label={WIDGET_LABEL}>
      <strong>Hello world</strong>
      <div>This widget was added by @paperclipai/plugin-hello-world-example.</div>
      <div>Viewing as user: {context.userId ?? "unknown"}</div>
    </section>
  );
}
