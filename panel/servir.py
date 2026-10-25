"""Sirve el panel en http://localhost:8770 sin caché.

`python -m http.server` no manda Cache-Control y el navegador guarda los módulos JS por su cuenta:
después de editar un archivo seguía corriendo la versión vieja. Aquí cada respuesta va con no-store.
Uso: python panel/servir.py [puerto]
"""
import functools
import http.server
import pathlib
import sys


class SinCache(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()


if __name__ == '__main__':
    puerto = int(sys.argv[1]) if len(sys.argv) > 1 else 8770
    manejador = functools.partial(SinCache, directory=str(pathlib.Path(__file__).parent))
    with http.server.ThreadingHTTPServer(('', puerto), manejador) as srv:
        print(f'Panel en http://localhost:{puerto}')
        srv.serve_forever()
