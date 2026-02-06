# Revitget

#### 介绍

这是一个基于MIT开源协议的revit导出gltf的开源库，支持revit2020~revit2023，项目依赖于revit，通用构件的合并以及C#对draco算法库的封装，拥有极快的导出速度和极高的压缩率。

在线查看案例：https://cowboy1997.github.io/Revitget/threejs/main

![image](https://github.com/cowboy1997/Revitget/blob/main/test.png)



#### 支持

1、支持revit带材质导出GLTF

2、支持导出revit法向量、UV

3、支持draco多线程压缩

4、支持相同构件合并

5、支持导出gltf/glb

6、支持导出revit属性

#### 安装教程

1、直接下载编译好的安装包https://github.com/cowboy1997/Revitget/releases/download/Revitget/Setup.msi

2、或者打开sln编译Revitget模块（依赖RevitAPI、RevitAPIUI、Newtonsoft）。如果你想重新编译修改DracoNet需要重新引入draco的文件头和静态库

#### 新增功能：Web 查看器 (Replica)

本项目现已包含一个完整复刻的 Web 查看器，位于 `web-viewer` 目录下。

- **功能**：支持加载 GLB 模型、360度旋转、缩放、HDR 环境光照。
- **使用**：将导出的 GLB 模型放入 `web-viewer/assets/models/`，然后部署该文件夹到 GitHub Pages 即可在线预览。
- **本地预览**：运行 `web-viewer/start_preview.bat` 即可在本地 Edge 浏览器中预览。

#### 关于

如果不懂，欢迎加入QQ群：835368069

包括BIM开发，Cad开发，threejs开发，python，webAssembly等等的。

大家喜欢可以加群一起卷起来！！卷卷卷卷！！！
