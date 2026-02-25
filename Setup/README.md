# Revitget Installer Setup

This folder contains the WiX Toolset configuration files to build an MSI installer for Revitget.

## Prerequisites

1.  **WiX Toolset v3.11** or later must be installed.
    - Download from: https://wixtoolset.org/releases/
2.  **Visual Studio** (optional, but recommended for editing .wxs files).

## Building the MSI

1.  Install **WiX Toolset v3.11**.
    - Recommended: during setup, enable adding WiX to PATH if the installer provides the option.
2.  Ensure the add-in binaries exist in `..\Revitget\bin\Release\`:
    - `Release2018\Revitget.dll`
    - `Release2018\DracoNet.dll`
    - `Release2018\Newtonsoft.Json.dll`
    - `Release2020\Revitget.dll`
    - `Release2020\DracoNet.dll`
    - `Release2020\Newtonsoft.Json.dll`
3.  Run `build_msi.bat` (double-click).
4.  The generated `RevitgetSetup_2018-2020.msi` will be in the `bin` folder.

If `..\Revitget\bin\Release\` is missing or incomplete, build the add-in first. For example, you can use `install_revit2018.ps1` to build with a local Revit 2018 installation directory.

## Supported Versions

This MSI targets Revit 2018 and Revit 2020.

**Note on other versions**:
RevitAPI/RevitAPIUI are strong-named and versioned per Revit release, so the add-in needs to be built per Revit version. This MSI includes binaries for 2018 and 2020 only.

To support Revit 2019/2021/2022/2023/2024, you need additional per-version builds, then update the installer to deploy the matching ones.
