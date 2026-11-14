"""Sound Space: download, prepare and document the recorded CC0 instrument samples.

Run with:  python -I scripts/sound-space/prepare_samples.py

Reads sample_sources.json (next to this script), downloads ONLY the listed files
(the first few seconds of each, via HTTP Range) from the CC0 Versilian libraries
into C:/tmp/ss-samples-raw/ (untrusted data: only ever parsed as bytes, never run),
checks each repo's LICENSE says CC0 first, then writes prepared mono 22.05 kHz
16-bit WAVs to assets/apps/sound-space/samples/<instrumentId>/<file>.wav and a
manifest.json with one row per file. Python standard library only.
"""
import array
import json
import math
import os
import struct
import sys
import urllib.parse
import urllib.request
import wave

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.abspath(os.path.join(HERE, "..", ".."))
RAW = "C:/tmp/ss-samples-raw"
OUT = os.path.join(ROOT, "assets", "apps", "sound-space", "samples")
LICENSE_DIR = os.path.join(ROOT, "docs", "sound-space", "licenses")
SOURCES = os.path.join(HERE, "sample_sources.json")

TARGET_RATE = 22050
MAX_SECONDS = 1.8  # brief allows up to 2.0 s; 1.8 keeps samples/ under 25 MB
FADE_SECONDS = 0.120
SILENCE_DB = -50.0
PEAK_DB = -3.0
UA = {"User-Agent": "sound-space-sample-prep"}


# ---------------------------------------------------------------- download
def http_get(url, rng=None):
    headers = dict(UA)
    if rng:
        headers["Range"] = "bytes=%d-%d" % rng
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=120) as r:
        return r.read()


def raw_url(repo, commit, path):
    return "https://raw.githubusercontent.com/sgossner/%s/%s/%s" % (
        repo, commit, urllib.parse.quote(path))


def blob_url(repo, commit, path):
    return "https://github.com/sgossner/%s/blob/%s/%s" % (
        repo, commit, urllib.parse.quote(path))


def parse_chunks(buf):
    """Return (fmt dict or None, data_offset or None, data_size or None)."""
    if len(buf) < 12 or buf[0:4] != b"RIFF" or buf[8:12] != b"WAVE":
        raise ValueError("not a RIFF/WAVE file")
    pos, fmt = 12, None
    while pos + 8 <= len(buf):
        cid = buf[pos:pos + 4]
        size = struct.unpack("<I", buf[pos + 4:pos + 8])[0]
        if cid == b"fmt " and pos + 8 + 16 <= len(buf):
            tag, ch, rate, _, _, bits = struct.unpack("<HHIIHH", buf[pos + 8:pos + 24])
            if tag == 0xFFFE and size >= 26 and pos + 8 + 26 <= len(buf):
                tag = struct.unpack("<H", buf[pos + 32:pos + 34])[0]
            fmt = {"tag": tag, "channels": ch, "rate": rate, "bits": bits}
        elif cid == b"data":
            return fmt, pos + 8, size
        pos += 8 + size + (size & 1)
    return fmt, None, None


def fetch_head_of_wav(url, need_seconds):
    """Download the header plus roughly need_seconds of audio."""
    head = http_get(url, (0, 16383))
    fmt, off, size = parse_chunks(head)
    if fmt is None or off is None:
        raise ValueError("WAV header not found in first 16 KB: " + url)
    byte_rate = fmt["rate"] * fmt["channels"] * (fmt["bits"] // 8)
    want = int(need_seconds * byte_rate)
    want -= want % (fmt["channels"] * (fmt["bits"] // 8))
    want = min(want, size)
    have = len(head) - off
    if have >= want:
        return head[:off + want]
    more = http_get(url, (len(head), off + want - 1))
    return head + more


def ensure_license(repo):
    """Verify the repo LICENSE is CC0, save evidence to the raw dir, return text."""
    os.makedirs(RAW, exist_ok=True)
    p = os.path.join(RAW, "LICENSE-%s.txt" % repo)
    if not os.path.exists(p):
        data = http_get("https://raw.githubusercontent.com/sgossner/%s/HEAD/LICENSE" % repo)
        with open(p, "wb") as f:
            f.write(data)
    text = open(p, "rb").read().decode("utf-8", "replace")
    if "CC0 1.0 Universal" not in text:
        raise SystemExit("BLOCKED: %s LICENSE is not CC0 1.0" % repo)
    os.makedirs(LICENSE_DIR, exist_ok=True)
    with open(os.path.join(LICENSE_DIR, "%s-LICENSE.txt" % repo), "wb") as f:
        f.write(text.replace("\r\n", "\n").encode("utf-8"))
    return text


def cached_raw(repo, commit, path, need_seconds):
    local = os.path.join(RAW, repo, *path.split("/"))
    meta = local + ".need"
    prior = 0.0
    if os.path.exists(local) and os.path.exists(meta):
        prior = float(open(meta).read())
    if prior >= need_seconds:
        return local
    os.makedirs(os.path.dirname(local), exist_ok=True)
    data = fetch_head_of_wav(raw_url(repo, commit, path), need_seconds)
    with open(local, "wb") as f:
        f.write(data)
    with open(meta, "w") as f:
        f.write(repr(need_seconds))
    return local


# ----------------------------------------------------------------- decode
def read_wav_mono(path):
    """Return (samples as list of floats in [-1,1], source rate). Truncation is fine."""
    buf = open(path, "rb").read()
    fmt, off, size = parse_chunks(buf)
    if fmt is None or off is None:
        raise ValueError("bad WAV: " + path)
    ch, bits, tag = fmt["channels"], fmt["bits"], fmt["tag"]
    bps = bits // 8
    frame = ch * bps
    n = min(size, len(buf) - off) // frame
    raw = buf[off:off + n * frame]
    if tag == 1 and bits == 16:
        vals = array.array("h")
        vals.frombytes(raw)
        if sys.byteorder == "big":
            vals.byteswap()
        flat = [v / 32768.0 for v in vals]
    elif tag == 1 and bits == 24:
        flat = []
        for i in range(0, len(raw), 3):
            v = raw[i] | (raw[i + 1] << 8) | (raw[i + 2] << 16)
            if v & 0x800000:
                v -= 0x1000000
            flat.append(v / 8388608.0)
    elif tag == 1 and bits == 32:
        vals = array.array("i")
        vals.frombytes(raw)
        flat = [v / 2147483648.0 for v in vals]
    elif tag == 3 and bits == 32:
        vals = array.array("f")
        vals.frombytes(raw)
        flat = list(vals)
    elif tag == 1 and bits == 8:
        flat = [(b - 128) / 128.0 for b in raw]
    else:
        raise ValueError("unsupported WAV format tag=%s bits=%s: %s" % (tag, bits, path))
    if ch == 1:
        return flat, fmt["rate"]
    mono = [sum(flat[i:i + ch]) / ch for i in range(0, len(flat), ch)]
    return mono, fmt["rate"]


# ---------------------------------------------------------------- process
def resample(x, src_rate, step_ratio):
    """Read x at (src_rate/TARGET_RATE)*step_ratio source samples per output sample.

    step_ratio = 2 ** (semitones/12) pitches up (1.0 = no change). Linear
    interpolation; when stepping more than one source sample per output sample the
    values are first averaged over the step (a box filter) so bright sounds do not
    alias. Returns a list of floats.
    """
    step = src_rate / TARGET_RATE * step_ratio
    n_out = int(len(x) / step)
    if step <= 1.0:
        out = []
        last = len(x) - 1
        for i in range(n_out):
            p = i * step
            j = int(p)
            fr = p - j
            a = x[j]
            b = x[j + 1] if j < last else a
            out.append(a + (b - a) * fr)
        return out
    cs = [0.0] * (len(x) + 1)
    acc = 0.0
    for i, v in enumerate(x):
        acc += v
        cs[i + 1] = acc

    def cum(p):
        j = int(p)
        if j >= len(x):
            return cs[len(x)]
        return cs[j] + (cs[j + 1] - cs[j]) * (p - j)

    return [(cum((i + 1) * step) - cum(i * step)) / step for i in range(n_out)]


def prepare(x, src_rate, semitones):
    """Return int16 list: shifted, trimmed, cut, faded, normalized."""
    y = resample(x, src_rate, 2.0 ** (semitones / 12.0))
    file_peak = max((abs(v) for v in y), default=0.0)
    if file_peak <= 0.0:
        raise ValueError("silent source")
    # -50 dBFS, or 20 dB under the file's own peak when the recording is very quiet
    thr = min(10.0 ** (SILENCE_DB / 20.0), file_peak * 0.1)
    start = 0
    while start < len(y) and abs(y[start]) < thr:
        start += 1
    if start >= len(y):
        raise ValueError("silent source")
    y = y[start:]
    n_max = int(MAX_SECONDS * TARGET_RATE)
    y = y[:n_max]
    # drop trailing near-silence so short sounds stay short
    end = len(y)
    tail_thr = min(10.0 ** (-66.0 / 20.0), file_peak * 0.0005)
    while end > 1 and abs(y[end - 1]) < tail_thr:
        end -= 1
    y = y[:end]
    nf = min(int(FADE_SECONDS * TARGET_RATE), len(y))
    for i in range(nf):
        y[len(y) - nf + i] *= 1.0 - (i + 1) / nf
    peak = max(abs(v) for v in y)
    gain = (10.0 ** (PEAK_DB / 20.0)) / peak
    return [max(-32768, min(32767, int(round(v * gain * 32767.0)))) for v in y]


def write_wav(path, pcm):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with wave.open(path, "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(TARGET_RATE)
        w.writeframes(array.array("h", pcm).tobytes() if sys.byteorder == "little"
                      else struct.pack("<%dh" % len(pcm), *pcm))
    return os.path.getsize(path)


def need_seconds_for(semitones):
    ratio = 2.0 ** (semitones / 12.0)
    return max(4.0, MAX_SECONDS * ratio + 2.0)


# ------------------------------------------------------------------- main
def main():
    spec = json.load(open(SOURCES, encoding="utf-8"))
    repos = spec["repos"]
    for repo in repos:
        ensure_license(repo)
    manifest = []
    total_bytes = 0
    downloaded = 0
    for inst_id, inst in spec["instruments"].items():
        for f in inst["files"]:
            repo = f["repo"]
            commit = repos[repo]["commit"]
            stem = f["out"][:-4]
            semis = 0.0
            if "root" in f:
                semis = int(stem) - f["root"]
            local = cached_raw(repo, commit, f["path"], need_seconds_for(semis))
            downloaded += os.path.getsize(local)
            x, rate = read_wav_mono(local)
            try:
                pcm = prepare(x, rate, semis)
            except ValueError as e:
                raise SystemExit("%s: %s/%s (%s)" % (e, inst_id, f["out"], f["path"]))
            out_path = os.path.join(OUT, inst_id, f["out"])
            total_bytes += write_wav(out_path, pcm)
            dur = len(pcm) / TARGET_RATE
            mods = "mono, 22.05 kHz, trimmed to %.2f s, faded, normalized to \u22123 dBFS" % dur
            if semis:
                mods += "; pitch-shifted %+.1f semitones by resampling (source root MIDI %s)" % (
                    semis, ("%d" % f["root"]) if float(f["root"]).is_integer() else ("%.1f" % f["root"]))
            manifest.append({
                "soundId": "%s/%s" % (inst_id, stem),
                "version": 1,
                "displayName": inst["name"] + (" - " + f["slot"] if "slot" in f else
                                               " - MIDI %s" % stem if "root" in f else ""),
                "category": inst["category"],
                "localUrl": "%s/%s" % (inst_id, f["out"]),
                "durationSeconds": round(dur, 3),
                "format": "wav",
                "sourceUrl": blob_url(repo, commit, f["path"]),
                "creator": repos[repo]["creator"],
                "license": "CC0-1.0",
                "licenseEvidencePath": "docs/sound-space/licenses/%s-LICENSE.txt" % repo,
                "downloadDate": spec["downloadDate"],
                "modifications": mods,
                "approved": True,
                "peakLevel": PEAK_DB,
                "loopAllowed": False,
            })
    with open(os.path.join(OUT, "manifest.json"), "w", encoding="utf-8", newline="\n") as fh:
        json.dump(manifest, fh, ensure_ascii=False, indent=1)
        fh.write("\n")
    print("files: %d  prepared bytes: %.2f MB  raw downloaded (cached partials): %.1f MB" % (
        len(manifest), total_bytes / 1e6, downloaded / 1e6))


if __name__ == "__main__":
    main()
