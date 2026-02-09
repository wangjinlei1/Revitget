# EdgeOne Pages 一键部署

本项目的网页部分是静态文件，可直接打包上传到 EdgeOne Pages。

## 生成上传包

在仓库根目录运行：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\build_edgeone_pages.ps1
```

或双击运行：

- [scripts/build_edgeone_pages.bat](file:///d:/1工作文件夹/Revitget/Revit2GLTF-main/Revitget-main/scripts/build_edgeone_pages.bat)

生成文件：

- `dist/edgeone-pages.zip`

默认生成的是精简版包（仅保留在线查看器运行所需文件），避免示例资源导致上传包体积超限。

## 上传并发布

打开控制台页面：

- https://console.cloud.tencent.com/edgeone/pages/upload?from=eo

按页面流程选择 “上传/导入” 并上传 `dist/edgeone-pages.zip`，入口文件为 `index.html`。

## 可选：包含全部示例资源（可能会超平台体积限制）

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\build_edgeone_pages.ps1 -IncludeSamples
```

## 可选：同时发布 web-viewer

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\\scripts\\build_edgeone_pages.ps1 -IncludeWebViewer
```
