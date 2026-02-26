# Revitget 安装包（MSI）

本目录包含用于构建 Revitget **MSI 安装包**的 WiX Toolset 配置与脚本。

## 前置条件

1. 安装 **WiX Toolset v3.11** 或更高版本  
   - 下载地址：https://wixtoolset.org/releases/
2. 安装 **Visual Studio** 或 **Build Tools**（可选，但建议；用于编译插件与编辑/验证 `.wxs`）

## 构建 MSI

1. 安装 **WiX Toolset v3.11**  
   - 建议安装时勾选将 WiX 加入 PATH（若安装器提供该选项）
2. 确保以下插件产物已存在（MSI 会直接打包这些文件）：
   - `..\Revitget\bin\Release2018\Revitget.dll`
   - `..\Revitget\bin\Release2018\DracoNet.dll`
   - `..\Revitget\bin\Release2018\Newtonsoft.Json.dll`
   - `..\Revitget\bin\Release2020\Revitget.dll`
   - `..\Revitget\bin\Release2020\DracoNet.dll`
   - `..\Revitget\bin\Release2020\Newtonsoft.Json.dll`
3. 运行 `build_msi.bat`（双击即可）
4. 生成的 `RevitgetSetup_2018-2020.msi` 会输出到 `Setup/bin` 目录

也可以使用 PowerShell 脚本一键构建（支持自动下载 WiX binaries）：

```
powershell -ExecutionPolicy Bypass -File .\Setup\build_msi.ps1 -Revit2018Dir "C:\Program Files\Autodesk\Revit 2018" -Revit2020Dir "C:\Program Files\Autodesk\Revit 2020"
```

如果上述二进制目录缺失或不完整，请先用 Visual Studio/MSBuild 编译插件（按 Revit 版本分别编译），并将 `RevitInstallDir` 设置为对应 Revit 的安装目录。

## 支持版本

当前 MSI 目标为 **Revit 2018** 与 **Revit 2020**。

其他版本说明：
- `RevitAPI.dll / RevitAPIUI.dll` 为强命名且随 Revit 版本变化，因此插件通常需要 **按 Revit 版本分别编译**。
- 若要支持 Revit 2019/2021/2022/2023/2024，需要先准备对应版本的编译产物，并更新安装包配置（`Product.wxs`）以部署匹配的文件。
