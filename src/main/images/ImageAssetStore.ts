import { app } from "electron";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, stat, unlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { ImageAssetRef, ImageContent } from "../../shared/types";

/**
 * renderer 侧不应长期把大块 base64 常驻在 React state 中；
 * 这里把图片落到用户数据目录，用稳定 asset 引用替代内存里的原始数据。
 */
export class ImageAssetStore {
  private readonly root = join(app.getPath("userData"), "image-assets");
  private initialized = false;

  private async ensureRoot() {
    if (this.initialized) return;
    await mkdir(this.root, { recursive: true });
    this.initialized = true;
  }

  async createFromBase64(image: ImageContent): Promise<ImageAssetRef> {
    await this.ensureRoot();
    const ext = this.extensionForMime(image.mimeType);
    const hash = createHash("sha1").update(image.data).digest("hex").slice(0, 16);
    const assetId = `${Date.now()}-${hash}-${randomUUID()}`;
    const assetPath = join(this.root, `${assetId}.${ext}`);
    await writeFile(assetPath, Buffer.from(image.data, "base64"));
    return {
      type: "image-asset",
      assetId,
      assetPath,
      mimeType: image.mimeType,
      size: Buffer.byteLength(image.data, "base64"),
    };
  }

  async readAsImageContent(image: ImageAssetRef): Promise<ImageContent> {
    const buffer = await readFile(image.assetPath);
    return {
      type: "image",
      data: buffer.toString("base64"),
      mimeType: image.mimeType,
    };
  }

  async getFileUrl(image: ImageAssetRef): Promise<string> {
    await this.ensureRoot();
    return `file:///${image.assetPath.replace(/\\/g, "/")}`;
  }

  async exists(image: ImageAssetRef): Promise<boolean> {
    try {
      await stat(image.assetPath);
      return true;
    } catch {
      return false;
    }
  }

  async remove(image: ImageAssetRef): Promise<void> {
    try {
      await unlink(image.assetPath);
    } catch {
      // 资产可能已被用户清理或不存在，不阻塞主流程。
    }
  }

  private extensionForMime(mimeType: string) {
    switch (mimeType) {
      case "image/jpeg":
        return "jpg";
      case "image/gif":
        return "gif";
      case "image/webp":
        return "webp";
      case "image/png":
      default:
        return "png";
    }
  }
}
