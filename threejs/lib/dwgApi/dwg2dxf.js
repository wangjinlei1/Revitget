try {
    const wasmUrl = new URL("./DwgApi.wasm", self.location.href).href
    self.DwgApi = Object.assign({}, self.DwgApi || {}, {
        locateFile: function (path, prefix) {
            try {
                if (/DwgApi\.wasm$/i.test(String(path))) return wasmUrl
            } catch {}
            return (prefix || "") + path
        },
    })
} catch {}

importScripts("./DwgApi.js")

function postError(err) {
    let msg = ""
    try {
        msg = err && (err.stack || err.message) ? (err.stack || err.message) : String(err || "")
    } catch {
        msg = ""
    }
    self.postMessage({ status: 1, dxfData: msg, error: { message: msg } })
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

function dwg2dxf(input) {
    const url = (input && typeof input === "object" && input.url) ? input.url : input
    if (url && typeof url === "string") {
        fetch(url)
            .then((response) => response.arrayBuffer())
            .then((buffer) => convertBufferToDxf(buffer))
            .catch((e) => postError(e))
        return
    }

    if (input instanceof ArrayBuffer) {
        convertBufferToDxf(input)
        return
    }
    if (input && typeof input === "object" && input.buffer instanceof ArrayBuffer) {
        convertBufferToDxf(input.buffer)
        return
    }

    postError(new Error("dwg2dxf: unsupported input"))
}

function makeTempName() {
    const rand = Math.random().toString(16).slice(2)
    return "./revitget_" + Date.now() + "_" + rand + ".dwg"
}

function convertBufferToDxf(buffer) {
    const tmp = makeTempName()
    try {
        DwgApi.createDataFile(tmp, buffer)
        const dxfData = DwgApi.dwg2dxf(tmp)
        const blob = new Blob([dxfData], { type: "text/plain" })
        const dxfUrl = URL.createObjectURL(blob)
        self.postMessage({ status: 0, url: dxfUrl, revokeAfterMs: 60000 })
    } catch (e) {
        postError(e)
    } finally {
        try {
            DwgApi.deleteFile(tmp)
        } catch {}
    }
}
