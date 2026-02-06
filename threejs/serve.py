import http.server
import mimetypes
import socketserver
import sys

mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("application/javascript", ".mjs")
mimetypes.add_type("application/json", ".json")
mimetypes.add_type("application/wasm", ".wasm")

port = 4173
if len(sys.argv) > 1:
    try:
        port = int(sys.argv[1])
    except Exception:
        port = 4173

class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "application/javascript",
        ".mjs": "application/javascript",
        ".wasm": "application/wasm",
        ".json": "application/json",
        "": "application/octet-stream",
    }

with socketserver.TCPServer(("", port), Handler) as httpd:
    print(f"Serving on http://localhost:{port}/threejs/index.html?model=1")
    httpd.serve_forever()

