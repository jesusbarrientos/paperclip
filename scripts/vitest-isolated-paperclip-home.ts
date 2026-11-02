import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

// Code under test resolves the instance root from PAPERCLIP_HOME, falling back
// to the developer's real ~/.paperclip. Point every run at a throwaway home so
// tests never write locks, caches or agent homes into a real instance.
export function isolatedPaperclipHome(): string {
  return process.env.PAPERCLIP_TEST_HOME ?? mkdtempSync(path.join(tmpdir(), "paperclip-test-home-"));
}
