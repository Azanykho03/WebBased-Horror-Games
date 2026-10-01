"""Loopback-only asset review server, with consistent glTF/ES-module MIME types.

Windows' system MIME registry may classify .mjs as text/plain; browsers correctly
refuse that as a module. This generic server avoids relying on those associations.
"""
import argparse
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

class AssetHandler(SimpleHTTPRequestHandler):
    extensions_map = {**SimpleHTTPRequestHandler.extensions_map,
                      '.js':'text/javascript', '.mjs':'text/javascript',
                      '.glb':'model/gltf-binary', '.gltf':'model/gltf+json'}

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('--directory',default='public/assets/models/environments/haunted-house')
    parser.add_argument('--port',type=int,default=8769)
    args=parser.parse_args()
    directory=Path(args.directory).resolve()
    if not directory.is_dir():parser.error('Asset directory does not exist')
    handler=functools.partial(AssetHandler,directory=str(directory))
    server=ThreadingHTTPServer(('127.0.0.1',args.port),handler)
    print(f'Asset preview: http://127.0.0.1:{args.port}/',flush=True)
    try:server.serve_forever()
    except KeyboardInterrupt:pass
    finally:server.server_close()

if __name__=='__main__':main()
