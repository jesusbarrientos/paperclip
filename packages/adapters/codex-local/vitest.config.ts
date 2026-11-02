import { defineConfig } from "vitest/config";
import { isolatedPaperclipHome } from "../../../scripts/vitest-isolated-paperclip-home.ts";

export default defineConfig({
  test: {
    environment: "node",
    env: { PAPERCLIP_HOME: isolatedPaperclipHome() },
  },
});
