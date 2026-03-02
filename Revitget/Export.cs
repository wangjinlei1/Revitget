﻿﻿﻿﻿using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Revitget.glTF;
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;

namespace Revitget
{
    [Transaction(TransactionMode.Manual)]
    [Regeneration(RegenerationOption.Manual)]
    [Journaling(JournalingMode.NoCommandData)]
    public class Export : IExternalCommand
    {
        private static string WriteErrorLog(Exception ex)
        {
            try
            {
                var dir = Path.Combine(Path.GetTempPath(), "Revitget");
                Directory.CreateDirectory(dir);
                var file = Path.Combine(dir, "error_" + DateTime.Now.ToString("yyyyMMdd_HHmmss") + ".txt");
                File.WriteAllText(file, ex.ToString());
                return file;
            }
            catch
            {
                return "";
            }
        }

        public Result Execute(ExternalCommandData commandData, ref string message, ElementSet elements)
        {
            var doc = commandData.Application.ActiveUIDocument.Document;
            if (!(doc.ActiveView is View3D))
            {
                TaskDialog.Show("提示", "当前视图不支持导出，请切换至3D视图");
                return Result.Cancelled;
            }


            var mainWindow = new MainWindow();
            if (mainWindow.ShowDialog() == true)
            {
                var stopWatch = new Stopwatch();
                stopWatch.Start();
                try
                {
                    var setting = new glTFSetting
                    {
                        useDraco = (bool)mainWindow.useDraco.IsChecked,
                        fileName = mainWindow.fileName.Text,
                        exportProperty = (bool)mainWindow.exportProperty.IsChecked,
                        useMepSystemColor = (bool)mainWindow.useMepSystemColor.IsChecked
                    };
                    var context = new glTFExportContext(doc, setting);
                    var exporter = new CustomExporter(doc, context)
                    {
                        IncludeGeometricObjects = true,
                        ShouldStopOnError = false
                    };
                    exporter.Export(new List<ElementId>() { doc.ActiveView.Id });
                    if (context.HasExportError)
                    {
                        throw context.ExportError;
                    }
                    stopWatch.Stop();

                    var outputPath = setting.fileName ?? "";
                    var outputDir = "";
                    try
                    {
                        outputDir = Path.GetDirectoryName(outputPath) ?? "";
                    }
                    catch
                    {
                        outputDir = "";
                    }

                    var viewerUrl = "https://wangjinlei1.github.io/Revitget/index.html";
                    
                    var summary = $"网格数量：{context.MeshCount}\n材质数量：{context.MaterialCount}";
                    if (context.MissingTextureCount > 0)
                    {
                        summary += $"\n贴图缺失：{context.MissingTextureCount} 个";
                    }
                    else
                    {
                        summary += "\n贴图状态：完整";
                    }

                    var mainDialog = new TaskDialog("Revitget")
                    {
                        MainContent = "导出成功！用时：" + stopWatch.Elapsed.TotalSeconds.ToString("0.00") + " 秒\n\n" +
                                      summary + "\n\n" +
                                      "文件路径：\n" + outputPath + "\n\n" +
                                      "在线查看链接：\n" + viewerUrl
                    };
                    if (context.MissingTextureCount > 0)
                    {
                         mainDialog.ExpandedContent = "缺失贴图列表：\n" + string.Join("\n", context.MissingTextures);
                    }
                    mainDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink2, "打开在线查看器");
                    if (!string.IsNullOrWhiteSpace(outputDir) && Directory.Exists(outputDir))
                    {
                        mainDialog.MainContent += "\n\n点击下方按钮可打开文件夹：";
                        mainDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "打开文件夹");
                    }
                    mainDialog.CommonButtons = TaskDialogCommonButtons.Close;

                    var dialogResult = mainDialog.Show();
                    if (dialogResult == TaskDialogResult.CommandLink1)
                    {
                        Process.Start(new ProcessStartInfo("explorer.exe", "\"" + outputDir + "\""));
                    }
                    else if (dialogResult == TaskDialogResult.CommandLink2)
                    {
                        Process.Start(new ProcessStartInfo("explorer.exe", viewerUrl));
                    }
                }
                catch (Exception ex)
                {
                    stopWatch.Stop();
                    message = ex.Message;

                    var logPath = WriteErrorLog(ex);
                    var errDialog = new TaskDialog("Revitget")
                    {
                        MainInstruction = "导出失败",
                        MainContent = ex.Message,
                        ExpandedContent = ex.ToString()
                    };
                    if (!string.IsNullOrWhiteSpace(logPath))
                    {
                        errDialog.FooterText = "错误日志已写入：\n" + logPath;
                        errDialog.AddCommandLink(TaskDialogCommandLinkId.CommandLink1, "打开日志文件");
                    }
                    errDialog.CommonButtons = TaskDialogCommonButtons.Close;

                    var r = errDialog.Show();
                    if (r == TaskDialogResult.CommandLink1 && !string.IsNullOrWhiteSpace(logPath))
                    {
                        Process.Start(new ProcessStartInfo("notepad.exe", "\"" + logPath + "\""));
                    }

                    return Result.Failed;
                }
            }
            return Result.Succeeded;
        }
    }
}

