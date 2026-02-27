import http.server
import mimetypes
import socketserver
import sys
import os
import functools

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

    def guess_type(self, path):
        lowered = path.lower()
        if lowered.endswith(".js") or lowered.endswith(".mjs"):
            return "application/javascript"
        if lowered.endswith(".wasm"):
            return "application/wasm"
        if lowered.endswith(".json"):
            return "application/json"
        guessed, _ = mimetypes.guess_type(path)
        return guessed or "application/octet-stream"

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

host = "127.0.0.1"
base_dir = os.path.dirname(os.path.abspath(__file__))
HandlerWithDir = functools.partial(Handler, directory=base_dir)

with ReusableTCPServer((host, port), HandlerWithDir) as httpd:
    print(f"Serving on http://{host}:{port}/index.html")
    httpd.serve_forever()

