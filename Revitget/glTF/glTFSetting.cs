using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace Revitget.glTF
{
    internal class glTFSetting
    {
        public glTFSetting()
        {
            useDraco = false;
            exportProperty = false;
            useMepSystemColor = false;
        }

        public bool useDraco { get; set; }
        public string fileName { get; set; }

        public bool exportProperty { get; set; }

        public bool useMepSystemColor { get; set; }
    }
}
