using Autodesk.Revit.Attributes;
using Autodesk.Revit.DB;
using Autodesk.Revit.UI;
using Revitget.glTF;
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
                //测量运行时间
                stopWatch.Start();
                var setting = new glTFSetting
                {
                    useDraco = (bool)mainWindow.useDraco.IsChecked,
                    fileName = mainWindow.fileName.Text,
                    exportProperty = (bool)mainWindow.exportProperty.IsChecked
                };
                var context = new glTFExportContext(doc, setting);
                var exporter = new CustomExporter(doc, context)
                {
                    IncludeGeometricObjects = false,
                    ShouldStopOnError = true
                };
                exporter.Export(new List<ElementId>() { doc.ActiveView.Id });
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

                var mainDialog = new TaskDialog("Revitget")
                {
                    MainContent = "导出成功！用时：" + stopWatch.Elapsed.TotalSeconds.ToString("0.00") + " 秒\n\n" +
                                  "文件路径：\n" + outputPath + "\n\n" +
                                  "在线查看链接：（预留）"
                };
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

            }
            return Result.Succeeded;
        }
    }
}

