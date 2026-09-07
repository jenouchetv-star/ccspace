# Small threaded static server for local preview.
#
# Two jobs beyond serving files:
#   * Python's default http.server is single-threaded and resets connections
#     when a page requests several images at once.
#   * The site uses real paths (/about/vision), so any address that is not a
#     file on disk has to fall back to index.html, the way a production host
#     would be configured to. Without that, refreshing a deep link 404s.
import functools
import os
import posixpath
import sys
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlsplit

PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 4321
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


class Handler(SimpleHTTPRequestHandler):
    # HTTP/1.0 closes the socket after every response, which truncates large
    # images on Windows when a page requests many of them at once.
    protocol_version = "HTTP/1.1"

    def send_head(self):
        self.path = self._resolve(self.path)
        return super().send_head()

    def _resolve(self, path):
        """Serve index.html for app routes; leave real files alone."""
        split = urlsplit(path)
        clean = posixpath.normpath(split.path)
        candidate = self.translate_path(split.path)

        if os.path.isfile(candidate):
            return path
        if os.path.isdir(candidate) and os.path.isfile(os.path.join(candidate, "index.html")):
            return path
        # Anything with a file extension that does not exist is a genuine 404.
        if os.path.splitext(clean)[1]:
            return path
        return "/index.html"

    def end_headers(self):
        # Never cache during development, so a reload always shows the edit.
        self.send_header("Cache-Control", "no-store, max-age=0")
        super().end_headers()

    def log_message(self, fmt, *args):
        pass


if __name__ == "__main__":
    handler = functools.partial(Handler, directory=ROOT)
    # 0.0.0.0 rather than 127.0.0.1, so another device on the same network
    # (a phone on the same Wi-Fi, say) can reach this by IP address. Anyone
    # on that network can reach it too, for as long as this process runs.
    server = ThreadingHTTPServer(("0.0.0.0", PORT), handler)
    server.daemon_threads = True
    print("Serving %s at http://localhost:%d" % (ROOT, PORT))
    print("App routes fall back to index.html, so deep links work on refresh.")
    server.serve_forever()
