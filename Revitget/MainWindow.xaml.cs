﻿using Microsoft.Win32;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Documents;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System.Windows.Navigation;
using System.Windows.Shapes;

namespace Revitget
{
    /// <summary>
    /// MainWindow.xaml 的交互逻辑
    /// </summary>
    public partial class MainWindow : Window
    {
        public MainWindow()
        {
            InitializeComponent();
        }


    

        private void Button_Start(object sender, RoutedEventArgs e)
        {
            var path = fileName.Text;
            if (string.IsNullOrWhiteSpace(path))
            {
                MessageBox.Show("请选择导出文件路径（.gltf 或 .glb）。", "提示", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            var ext = System.IO.Path.GetExtension(path);
            if (string.IsNullOrWhiteSpace(ext) || (ext.ToLower() != ".gltf" && ext.ToLower() != ".glb"))
            {
                MessageBox.Show("导出文件扩展名必须是 .gltf 或 .glb。", "提示", MessageBoxButton.OK, MessageBoxImage.Information);
                return;
            }

            try
            {
                var dir = System.IO.Path.GetDirectoryName(path);
                if (!string.IsNullOrWhiteSpace(dir))
                {
                    System.IO.Directory.CreateDirectory(dir);
                }
            }
            catch (Exception ex)
            {
                MessageBox.Show("导出路径不可用：\n" + ex.Message, "提示", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            DialogResult = true;
            Close();
        }

        private void Button_Open(object sender, RoutedEventArgs e)
        {
            SaveFileDialog fd = new SaveFileDialog();
            fd.Title = "导出 glTF";
            //fd.Filter = "gltf文件|*.gltf";
            //fd.Filter = "gltf文件(*.gltf,*.glb)|*.gltf;*.glb";
            fd.Filter = "GLB 文件(*.glb)|*.glb|glTF 文件(*.gltf)|*.gltf";
            fd.FileName = "新建项目";
            if (fd.ShowDialog() == true)
            {
                fileName.Text = fd.FileName;
            }
        }
    }
}
