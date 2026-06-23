import { app, BrowserWindow, Menu } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { AppSettings, AppWindowState } from "../../shared/types";

const defaultSettings: AppSettings = {
  useNativeTitleBar: false,
  showNativeMenu: false,
  sendShortcut: "enter-send",
  theme: "system",
  language: "system",
  piEnvironmentChecked: false,
  closeToTray: true,
  enableNotifications: true,
  showThinking: true,
  showDevTools: false,
  piProxyEnabled: false,
  piProxyUrl: "http://127.0.0.1:7890",
  piProxyBypass: "localhost,127.0.0.1,::1",
  desktopProxyEnabled: false,
  desktopProxyUrl: "http://127.0.0.1:7890",
  desktopProxyBypass: "localhost,127.0.0.1,::1",
  customPiPath: "",
  webServiceEnabled: false,
  webServiceHost: "0.0.0.0",
  webServicePort: 8765,
  rpcTimeout: 600_000,
  linkOpenMode: "external",
  maxEditorFileSizeMB: 5,
};

export class SettingsStore {
  private readonly filePath = join(app.getPath("userData"), "settings.json");
  private settings: AppSettings = { ...defaultSettings };

  async load() {
    try {
      const raw = await readFile(this.filePath, "utf8");
      const persisted = JSON.parse(raw) as Partial<AppSettings> & Record<string, unknown>;
      // 历史版本会留下 telemetry / installationType 等本地采集字段；这里在加载阶段显式剔除，
      // 避免后续任意设置保存时又把这些已废弃字段原样写回磁盘。
      const {
        telemetryEnabled: _telemetryEnabled,
        telemetryInstallId: _telemetryInstallId,
        telemetryLastHeartbeatDate: _telemetryLastHeartbeatDate,
        installationType: _installationType,
        ...rest
      } = persisted;
      this.settings = { ...defaultSettings, ...(rest as Partial<AppSettings>) };
    } catch {
      this.settings = { ...defaultSettings };
    }
    this.applyMenu();
    return this.get();
  }

  get() {
    return { ...this.settings };
  }

  async update(patch: Partial<AppSettings>) {
    this.settings = { ...this.settings, ...patch };
    await this.save();
    this.applyMenu();
    return this.get();
  }

  /**
   * 只持久化窗口状态（位置、尺寸、最大化），不触发菜单重设或 IPC 通知。
   * 窗口的 resize/move 事件频率较高，不宜引入额外副作用。
   * 采用 merge 模式保留未来可能新增的子字段。
   */
  async updateWindowState(windowState: AppWindowState): Promise<void> {
    this.settings = {
      ...this.settings,
      windowState: {
        ...this.settings.windowState,
        ...windowState,
      },
    };
    await this.save();
  }

  applyMenu() {
    // 菜单属于 Electron 外壳设置，不影响 pi agent；始终保持隐藏以获得更接近独立工具的观感。
    Menu.setApplicationMenu(null);
  }

  createWindowOptions() {
    const useNative = this.settings.useNativeTitleBar;
    const isMac = process.platform === "darwin";
    return {
      frame: useNative,
      titleBarStyle: useNative
        ? "default" as const
        : isMac
          ? "hiddenInset" as const
          : "hidden" as const,
      trafficLightPosition: { x: 14, y: 14 },
    };
  }

  notifyTitleBarChange(window: BrowserWindow | null) {
    if (!window || window.isDestroyed()) return;
    // Electron 的 frame 不能运行时无刷新切换；设置页保存后提示用户重启生效。
    window.webContents.send("settings:apply-window", this.get());
  }

  private async save() {
    await mkdir(app.getPath("userData"), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(this.settings, null, 2), "utf8");
  }
}
