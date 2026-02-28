let __revitget_baseUrl = ""
let __revitget_loaded = false
let __revitget_quiet = false

function setBaseUrl(url) {
    if (!url || typeof url !== "string") return
    __revitget_baseUrl = url.endsWith("/") ? url : (url + "/")
}

function ensureLoaded() {
    if (__revitget_loaded) return

    try {
        let wasmUrl = ""
        if (__revitget_baseUrl) {
            wasmUrl = new URL("DwgApi.wasm", __revitget_baseUrl).href
        } else {
            wasmUrl = new URL("./DwgApi.wasm", self.location.href).href
        }

        self.DwgApi = Object.assign({}, self.DwgApi || {}, {
            locateFile: function (path, prefix) {
                try {
                    if (/DwgApi\.wasm$/i.test(String(path))) return wasmUrl
                } catch {}
                try {
                    if (prefix) return new URL(path, prefix).href
                } catch {}
                return (prefix || "") + path
            },
        })
    } catch {}

    try {
        const apiUrl = __revitget_baseUrl ? new URL("DwgApi.js", __revitget_baseUrl).href : "./DwgApi.js"
        importScripts(apiUrl)
        __revitget_loaded = true
    } catch (e) {
        __revitget_loaded = false
        throw e
    }
}

function postError(err) {
    let msg = ""
    try {
        msg = err && (err.stack || err.message) ? (err.stack || err.message) : String(err || "")
    } catch {
        msg = ""
    }
    self.postMessage({ status: 1, dxfData: msg, error: { message: msg } })
}

function setupQuietMode() {
    try {
        if (__revitget_quiet) return
        __revitget_quiet = true
        const params = new URLSearchParams(String(self.location && self.location.search ? self.location.search : ""))
        const quiet = params.get("revitget_quiet")
        if (quiet !== "1") return
        const noop = function () {}
        try { self.console && (self.console.log = noop) } catch {}
        try { self.console && (self.console.info = noop) } catch {}
        try { self.console && (self.console.debug = noop) } catch {}
        try { self.console && (self.console.warn = noop) } catch {}
    } catch {}
}

self.onmessage = function (event) {
    try {
        setupQuietMode()
        const data = event.data
        if (data && typeof data === "object" && data.__revitget_init) {
            setBaseUrl(data.baseUrl || data.__revitget_baseUrl || "")
            return
        }

        if (data && typeof data === "object") {
            setBaseUrl(data.baseUrl || data.__revitget_baseUrl || "")
        }

        ensureLoaded()

        if (DwgApi.dwg2dxf) {
            dwg2dxf(data)
        } else {
            DwgApi.onRuntimeInitialized = () => {
                try {
                    dwg2dxf(data)
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
            .then((buffer) => convertBufferToDxf(buffer, { url }))
            .catch((e) => postError(e))
        return
    }

    if (input instanceof ArrayBuffer) {
        convertBufferToDxf(input, { kind: "ArrayBuffer" })
        return
    }
    if (input && typeof input === "object" && input.buffer instanceof ArrayBuffer) {
        convertBufferToDxf(input.buffer, { kind: "buffer" })
        return
    }

    if (input && typeof input === "object" && input.file) {
        try {
            const file = input.file
            if (file instanceof ArrayBuffer) {
                convertBufferToDxf(file, { kind: "file:ArrayBuffer" })
                return
            }
            if (file && typeof FileReaderSync !== "undefined" && (typeof Blob !== "undefined" && file instanceof Blob)) {
                const reader = new FileReaderSync()
                const buf = reader.readAsArrayBuffer(file)
                convertBufferToDxf(buf, { kind: "file:Blob", name: file.name, size: file.size, type: file.type })
                return
            }
        } catch (e) {
            postError(e)
            return
        }
    }

    try {
        if (typeof FileReaderSync !== "undefined" && (typeof Blob !== "undefined" && input instanceof Blob)) {
            const reader = new FileReaderSync()
            const buf = reader.readAsArrayBuffer(input)
            convertBufferToDxf(buf, { kind: "Blob", size: input.size, type: input.type })
            return
        }
    } catch (e) {
        postError(e)
        return
    }

    postError(new Error("dwg2dxf: unsupported input"))
}

function makeTempName() {
    const rand = Math.random().toString(16).slice(2)
    return "./revitget_" + Date.now() + "_" + rand + ".dwg"
}

function convertBufferToDxf(buffer, meta) {
    try {
        const u8 = new Uint8Array(buffer)
        const head = u8.subarray(0, Math.min(16, u8.length))
        let ascii = ""
        for (let i = 0; i < head.length; i++) {
            const c = head[i]
            ascii += (c >= 32 && c <= 126) ? String.fromCharCode(c) : "."
        }
        const isDwg = ascii.startsWith("AC10")
        if (!isDwg) {
            const hint = "Not a DWG header. headAscii=" + ascii + " size=" + u8.length + " meta=" + safeJson(meta)
            postError(new Error(hint))
            return
        }
    } catch {}

    const tmp = makeTempName()
    try {
        DwgApi.createDataFile(tmp, buffer)
        const dxfData = DwgApi.dwg2dxf(tmp)
        let dxfText = dxfData
        try {
            dxfText = String(dxfData || "")
        } catch {
            dxfText = ""
        }
        try {
            dxfText = dxfText.replace(/\0/g, "")
        } catch {}
        const blob = new Blob([dxfData], { type: "text/plain" })
        const dxfUrl = URL.createObjectURL(blob)
        self.postMessage({ status: 0, url: dxfUrl, dxfText, revokeAfterMs: 60000 })
    } catch (e) {
        postError(e)
    } finally {
        try {
            DwgApi.deleteFile(tmp)
        } catch {}
    }
}

function safeJson(v) {
    try {
        return JSON.stringify(v)
    } catch {
        return ""
    }
}
