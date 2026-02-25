
importScripts("./DwgApi.js")

function postError(err) {
    let msg = ""
    try {
        msg = err && (err.stack || err.message) ? (err.stack || err.message) : String(err || "")
    } catch {
        msg = ""
    }
    self.postMessage({ status: 1, dxfData: msg })
}

self.onmessage = function (event) {
    try {
        if (DwgApi.dwg2dxf) {
            dwg2dxf(event.data)
        } else {
            DwgApi.onRuntimeInitialized = () => {
                try {
                    dwg2dxf(event.data)
                } catch (e) {
                    postError(e)
                }
            }
        }
    } catch (e) {
        postError(e)
    }
};

function dwg2dxf(url){
    fetch(url)
        .then((response) => response.arrayBuffer())
        .then((buffer) => {
            try {
                DwgApi.createDataFile("./test.dwg", buffer);
                let dxfData = DwgApi.dwg2dxf("./test.dwg");
                DwgApi.deleteFile("./test.dwg");
                const blob = new Blob([dxfData], { type: "text/plain" });
                const dxfUrl = URL.createObjectURL(blob);
                self.postMessage({ status: 0, url: dxfUrl });
            } catch (e) {
                postError(e)
            }
        })
        .catch((e) => {
            postError(e)
        });
}
