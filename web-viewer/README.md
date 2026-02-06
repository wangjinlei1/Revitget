# Revitget Web Viewer 复刻版

这是一个基于 Three.js 构建的 Revitget 3D 网页查看器的完整模块化复刻版本。

## 功能特性

- **3D 模型加载**：使用 Three.js 和 Draco 压缩高效加载 GLTF/GLB 模型。
- **交互控制**：支持 360° 轨道控制（旋转、缩放、平移）。
- **高性能**：优化的渲染循环，确保在桌面和移动端均能达到 >30 FPS 的帧率。
- **现代 UI**：整洁、响应式的用户界面，复刻了原版的视觉风格。
- **环境光照**：支持 HDR 环境贴图，提供逼真的渲染效果。
- **错误处理**：提供健壮的加载界面和错误提示通知。

## 目录结构

```
Revitget_Replica/
├── assets/             # 静态资源
│   ├── env/            # HDR 环境贴图
│   ├── lib/            # 第三方库 (Draco 解码器)
│   └── models/         # 3D 模型文件 (GLB)
├── css/                # 样式表
│   └── style.css       # 主样式文件
├── js/                 # JavaScript 源代码
│   ├── main.js         # 程序入口
│   └── Viewer.js       # 核心 3D 查看器类
├── index.html          # 主 HTML 文件
└── README.md           # 项目文档
```

## 如何运行

由于浏览器安全策略（CORS），通常无法直接通过双击 `index.html`（即 `file://` 协议）加载 3D 模型资源。请选择以下任意一种方式运行：

### 方法 1：使用 VS Code Live Server（推荐）
1. 在 VS Code 中打开本文件夹。
2. 安装 "Live Server" 扩展插件。
3. 在 `index.html` 文件上右键点击，选择 "Open with Live Server"。

### 方法 2：使用 Python 启动本地服务
如果您已安装 Python，可以在当前目录下运行以下命令：

```bash
# Python 3
python -m http.server 8000
```
然后在浏览器中访问 `http://localhost:8000`。

### 方法 3：本地文件访问（仅限 Firefox 或特殊配置）
- **Firefox**：通常默认支持直接双击打开查看。
- **Chrome/Edge**：默认会拦截本地资源加载。如需强制使用，需要通过 `--allow-file-access-from-files` 参数启动浏览器（出于安全考虑，不建议日常使用）。

## 开发指南

- **Viewer.js**：包含 `Viewer` 类，封装了所有 Three.js 逻辑。修改 `init()` 方法可调整光照或相机设置。
- **main.js**：处理应用程序流程、UI 事件绑定，并配置模型路径。
- **style.css**：调整 `:root` 中的变量即可更改主题颜色。

## 许可证

MIT
