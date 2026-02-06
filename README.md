# Revitget

#### 介绍

这是一个复刻前人基础上做的一个revit导出gltf的开源库，支持revit2020~revit2023。

**在线查看案例：** [打开在线查看](https://lei112.gitcode.host/Revitget/)

![image](https://github.com/cowboy1997/Revitget/blob/main/test.png)

#### 支持

1、支持revit带材质导出GLTF

2、支持导出revit法向量、UV

3、支持draco多线程压缩

4、支持相同构件合并

5、支持导出gltf/glb

6、支持导出revit属性



#### Web 查看器 

包含一个完整复刻的 Web 查看器，位于 `web-viewer` 目录下。

- **功能**：支持加载 GLB 模型、360度旋转、缩放、HDR 环境光照。
- **使用**：将导出的 GLB 模型放入 `web-viewer/assets/models/`，然后在 GitCode Pages 中将 Source 设为仓库根目录或 `web-viewer` 目录，即可在线预览。
- **本地预览**：运行 `web-viewer/start_preview.bat` 即可在本地 Edge 浏览器中预览。


