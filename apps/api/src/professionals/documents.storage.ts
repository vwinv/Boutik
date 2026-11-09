import { createReadStream } from "node:fs";
import { mkdir, unlink, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { Injectable } from "@nestjs/common";

const UPLOAD_ROOT = resolve(process.cwd(), "uploads");

@Injectable()
export class DocumentsStorage {
  key(tenantId: string, documentId: string, originalName: string) {
    return `${tenantId}/${documentId}/${sanitizeFileName(originalName)}`;
  }

  absolutePath(storageKey: string) {
    const full = resolve(UPLOAD_ROOT, storageKey);
    if (!full.startsWith(UPLOAD_ROOT)) {
      throw new Error("Chemin de stockage invalide");
    }
    return full;
  }

  async save(storageKey: string, buffer: Buffer) {
    const full = this.absolutePath(storageKey);
    await mkdir(dirname(full), { recursive: true });
    await writeFile(full, buffer);
  }

  stream(storageKey: string) {
    return createReadStream(this.absolutePath(storageKey));
  }

  async remove(storageKey: string) {
    await unlink(this.absolutePath(storageKey)).catch(() => undefined);
  }
}

function sanitizeFileName(name: string) {
  const base = name.replaceAll("\\", "/").split("/").pop() ?? "document";
  const cleaned = base.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^\.+/, "");
  return cleaned.slice(0, 80) || "document";
}
