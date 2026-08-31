# 发布与 Zotero 自动更新

## 版本规则

- `package.json` 的 `version` 是唯一版本源，使用 SemVer，例如 `1.2.3`。
- 正式版使用 `v1.2.3` 标签；测试版使用 `v1.2.3-beta.1` 标签。
- 日常提交不改版本。准备发布时运行 `npm run release`，按提示选择版本类型；该命令会更新版本、提交并推送 `v*` 标签。
- GitHub Actions 只接受 `v*` 标签，并校验标签版本与 `package.json` 完全一致，因此不会发布错版本。

## 自动发布链路

推送 `v*` 标签后，`.github/workflows/release.yml` 会：

1. 安装依赖并运行现有测试；
2. 构建 XPI；
3. 在 `v<version>` GitHub Release 上传 XPI；
4. 更新名为 `release` 的固定 Release，并上传 `update.json`（测试版则为
   `update-beta.json`）。

仓库需要在 **Settings -> Actions -> General** 中允许 Actions 使用
`Read and write permissions`。工作流使用内置 `GITHUB_TOKEN`，不需要额外个人令牌。

## Zotero 本地自动更新

插件的 `addon/manifest.json` 已通过 `zotero-plugin.config.ts` 注入：

```text
https://github.com/zjysnow/paperpilot/releases/download/release/update.json
```

因此 Zotero 会通过原生 Add-on Manager 检查更新，下载 XPI 并在重启时安装。GitHub
Actions 无法主动访问用户电脑；“自动在本地更新”必须由本地 Zotero 主动拉取，这是
更安全、也符合 Zotero 更新机制的方式。

首次安装仍需手动安装一次 XPI。之后在 Zotero 的 **Add-ons** 页面点击检查更新，
或等待 Zotero 的周期性检查即可。测试版用户使用 `update-beta.json`，不会被正式版
自动升级。

## Zotero 升级后的插件迁移

Zotero 升级时会保留插件目录和插件偏好；如果 Add-on Manager 因兼容性检查将
Paper Pilot 标记为禁用，插件会在下一次启动时自动重新启用，不需要再次选择 XPI
文件。插件的旧版偏好也会在启动阶段迁移到当前版本的偏好命名空间。

如果插件在 Add-ons 页面中完全不存在，说明 Zotero 没有保留该插件的安装记录。此时
仍需从 Releases 页面手动安装一次；安装完成后，后续 Zotero 升级会走上述自动迁移
路径。

## 发布前检查

```bash
npm run typecheck
npm test
npm run release
```

如果只想验证工作流而不发布，可在 GitHub Actions 中手动运行 **Release Zotero
plugin**，输入已经存在的 `v*` 标签。
