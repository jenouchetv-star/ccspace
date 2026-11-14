"""Builds sample_sources.json (instrument -> source recordings) for prepare_samples.py.

Run with:  python -I scripts/sound-space/build_sample_sources.py

Inputs: the GitHub file listings of the two CC0 repos (saved as
C:/tmp/ss-samples-raw/list-<repo>.txt, "path<TAB>size" per line, from the GitHub
git-trees API) and C:/tmp/ssw/rec.json (the recorded part of the Sound Space catalog,
dumped from assets/apps/sound-space/instruments.js). Nothing here touches audio.

Pitched instruments: for every target MIDI note the nearest source recording is chosen
(the spec's "shift" converts the library's note names to true sounding MIDI; it was
checked against measured pitch). Medium velocity layer and first round robin are
preferred. The prepare script then pitch-shifts by resampling to land exactly on the
target note.
"""
import json
import os
import re
import statistics

RAW = "C:/tmp/ss-samples-raw"
CATALOG = "C:/tmp/ssw/rec.json"
HERE = os.path.dirname(os.path.abspath(__file__))
COMMITS = {
    "VSCO-2-CE": "440300901dfe9275fd84e0b7763af1f8443ae62e",
    "VCSL": "c1ea7bcc3c7309650ab0da9d15c9cd1fbc4a4c7e",
}
CREATOR = "Versilian Studios (Sam Gossner)"

NOTE_RX = re.compile(r"(?<![A-Za-z])([A-G])([#b]?)(-?\d)(?!\d)")
SEMI = {"C": 0, "D": 2, "E": 4, "F": 5, "G": 7, "A": 9, "B": 11}
DYN = {"ppp": 1, "pp": 2, "p": 3, "mp": 4, "mf": 5, "f": 6, "ff": 7, "fff": 8}


def listing(repo):
    out = []
    for line in open("%s/list-%s.txt" % (RAW, repo), encoding="utf-8"):
        p, _ = line.rstrip("\n").split("\t")
        if p.lower().endswith(".wav"):
            out.append(p)
    return out


FILES = {r: listing(r) for r in COMMITS}


def note_of(fname):
    m = NOTE_RX.search(fname)
    if not m:
        return None
    n = SEMI[m.group(1)] + (1 if m.group(2) == "#" else -1 if m.group(2) == "b" else 0)
    return n + 12 * (int(m.group(3)) + 1)


def level_of(fname):
    m = re.search(r"_vl?(\d)(?!\d)", fname)
    if m:
        return int(m.group(1))
    m = re.search(r"_(ppp|pp|p|mp|mf|fff|ff|f)(?=[_.\d])", fname)
    if m:
        return DYN[m.group(1)]
    return None


def rank(fname, target_level):
    """Lower is better: medium velocity, first round robin."""
    s = 0.0
    lv = level_of(fname)
    if lv is not None and target_level is not None:
        s += abs(lv - target_level) * 10
    m = re.search(r"rr(\d+)", fname, re.I)
    if m:
        s += int(m.group(1))
    return s


def pick_pitched(repo, dir_rx, targets, shift, name_rx=None):
    cands = []
    for p in FILES[repo]:
        d, _, f = p.rpartition("/")
        if not re.search(dir_rx, d):
            continue
        if name_rx and not re.search(name_rx, f):
            continue
        n = note_of(f)
        if n is None:
            continue
        cands.append((n + shift, p, f))
    if not cands:
        raise SystemExit("no candidates for %s %s" % (repo, dir_rx))
    levels = [level_of(f) for _, _, f in cands if level_of(f) is not None]
    target_level = statistics.median_low(levels) if levels else None
    files = []
    for t in targets:
        best = min(cands, key=lambda c: (abs(c[0] - t), c[0] > t, rank(c[2], target_level), c[2]))
        files.append({"out": "%d.wav" % t, "repo": repo, "path": best[1], "root": best[0]})
    return files


def pick_one(repo, rx):
    c = [p for p in FILES[repo] if re.search(rx, p)]
    if not c:
        raise SystemExit("no match: %s %s" % (repo, rx))
    levels = [level_of(p.rsplit("/", 1)[1]) for p in c if level_of(p.rsplit("/", 1)[1]) is not None]
    tl = statistics.median_low(levels) if levels else None
    return min(c, key=lambda p: (rank(p.rsplit("/", 1)[1], tl), p))


def kit(repo_rx_list, slots):
    files = []
    for i, (repo, rx) in enumerate(repo_rx_list):
        files.append({"out": "%d.wav" % i, "repo": repo, "path": pick_one(repo, rx), "slot": slots[i]})
    return files


V, C = "VSCO-2-CE", "VCSL"

# (repo, dir regex, name regex or None, shift from library note names to true sounding MIDI)
PITCHED = {
    "grand-piano": (C, r"Grand Piano, Kawai/Sustains", None, 12),
    "upright-piano": (C, r"Upright Piano, Knight/Sustains", None, 12),
    "harpsichord": (C, r"Harpsichord, English/Sustains/Normal", None, 12),
    "pipe-organ": (C, r"Pipe Organ/Quiet$", None, 12),
    "marimba": (C, r"Struck Idiophones/Marimba$", r"loud", 12),
    "xylophone": (C, r"Xylophone/Medium Mallets", None, 12),
    "vibraphone": (C, r"Vibraphone/Hard Mallets", None, 12),
    "glockenspiel": (C, r"Struck Idiophones/Glockenspiel$", None, 12),
    "kalimba": (C, r"Kalimba, Tanzania", None, 12),
    "triangles-and-bells": (C, r"Struck Idiophones/Hand Chimes", None, 12),
    "tubular-bells": (C, r"Tubular Bells 2", None, 0),
    "violin": (V, r"Solo Violin/Arco Vib", None, 0),
    "viola": (V, r"Viola Section/susvib", None, 12),
    "cello": (V, r"Cello Section/spic", None, 12),
    "violin-section": (V, r"Violin Section/susVib", None, 12),
    "cello-section": (V, r"Cello Section/susvib", None, 12),
    "concert-harp": (C, r"Concert Harp", None, 0),
    "folk-harp": (C, r"Folk Harp", None, 12),
    "psaltery": (C, r"Psaltery, Bowed and Plucked/Pluck", None, 12),
    "dan-tranh": (C, r"Dan Tranh/Normal", None, 12),
    "strumstick": (C, r"Strumstick/Finger", None, 12),
    "trumpet": (V, r"Trumpet/sus$", None, 12),
    "french-horn": (V, r"F Horn/sus", None, 12),
    "trombone": (V, r"Tenor Trombone/sus", None, 12),
    "tuba": (V, r"Tuba/sus", None, 12),
    "flute": (V, r"Flute/susNV", None, 12),
    "piccolo": (V, r"Piccolo/Sus", None, 12),
    "clarinet": (V, r"Clarinet/susLong", None, 12),
    "oboe": (V, r"Oboe/Sus", None, 12),
    "bassoon": (V, r"Bassoon/sus", None, 12),
    "tenor-saxophone": (C, r"Tenor Saxophone/Non-Vibrato", None, 12),
    "recorder": (C, r"Baroque Soprano Recorder/Sustain", None, 12),
    "harmonica": (C, r"Harmonica-Hohner-Special20-C/Sustains/Normal", None, 12),
    "ocarina": (C, r"Ocarina, Typical/Sustains/Sus$", None, 12),
    "double-bass": (V, r"Solo Contrabass/SusNV", None, 12),
    "plucked-double-bass": (V, r"Solo Contrabass/Pizz", None, 12),
    "tuba-bass": (V, r"Tuba/stac", None, 12),
    "bassoon-bass": (V, r"Bassoon/stac", None, 12),
    "low-marimba": (C, r"Struck Idiophones/Marimba$", r"soft", 12),
}


def f(repo, path, out, **kw):
    d = {"out": out, "repo": repo, "path": path}
    d.update(kw)
    return d


T1 = "Membranophones/Struck Membranophones/Timpani 1/Hit/"
T2 = "Membranophones/Struck Membranophones/Timpani 2/Hit/"
DID = "Aerophones/Lip Aerophones/Didgeridoo/"
# Roots below are MEASURED sounding pitches (autocorrelation, median of several windows),
# because these libraries name the drums / drone files by number, not by note.
EXPLICIT = {
    "timpani": [
        f(C, T2 + "Timpani6C_hit_v3_rr1_main.wav", "40.wav", root=39.4),
        f(C, T2 + "Timpani4A_hit_v3_rr1_main.wav", "45.wav", root=41.1),
        f(C, T2 + "Timpani6A_hit_v3_rr1_main.wav", "50.wav", root=53.1),
        f(C, T2 + "Timpani6A_hit_v3_rr1_main.wav", "54.wav", root=53.1),
        f(C, T2 + "Timpani6A_hit_v3_rr1_main.wav", "59.wav", root=53.1),
        f(C, T2 + "Timpani6A_hit_v3_rr1_main.wav", "64.wav", root=53.1),
    ],
    "timpani-bass": [
        f(C, T1 + "Timpani3_Hit_v3_rr1_Sum.wav", "36.wav", root=37.3),
        f(C, T1 + "Timpani4_Hit_v3_rr1_Sum.wav", "41.wav", root=40.0),
        f(C, T1 + "Timpani5_Hit_v3_rr1_Sum.wav", "46.wav", root=42.0),
        f(C, T1 + "Timpani5_Hit_v3_rr1_Sum.wav", "50.wav", root=42.0),
        f(C, T2 + "Timpani6A_hit_v3_rr1_main.wav", "55.wav", root=53.1),
    ],
    "didgeridoo": [
        f(C, DID + "Didgeridoo1_Sus3_Main.wav", "24.wav", root=36.0),
        f(C, DID + "Didgeridoo1_Sus3_Main.wav", "29.wav", root=36.0),
        f(C, DID + "Didgeridoo1_Sus2_Main.wav", "34.wav", root=36.9),
        f(C, DID + "Didgeridoo1_Sus8_Main.wav", "38.wav", root=37.4),
        f(C, DID + "Didgeridoo1_Sus8_Main.wav", "43.wav", root=37.4),
        f(C, DID + "Didgeridoo1_Sus8_Main.wav", "48.wav", root=37.4),
    ],
}

# Kits: one (repo, path regex) per slot, in slot order. Slot names come from the catalog.
SM = "Struck Membranophones/"
SI = "Struck Idiophones/"
KITS = {
    "classic-kit": [
        (C, SM + r"Bass Drum 3 - Legacy/bdrum_f_rr1"), (C, SM + r"Snare Drum, Modern 1/Snare2_HitNS"),
        (C, SI + r"Hi-Hat Cymbal/HiHat_HitC"), (C, SI + r"Hi-Hat Cymbal/HiHat_HitO_"),
        (C, SI + r"Claps/Clap_rr1"), (C, SM + r"Tom 2/Mallet/TomL_HitM"),
        (C, SM + r"Tom 1/Mallet/TomH_HitM"), (C, SI + r"Suspended Cymbal 2/susCymb2_hit_mf1")],
    "rock-kit": [
        (C, SM + r"Bass Drum 2/bassdrum_hit_ff"), (C, SM + r"Snare Drum, Modern 3/Snare4_rimshot"),
        (C, SI + r"Hi-Hat Cymbal/HiHat_Close"), (C, SI + r"Hi-Hat Cymbal/HiHat_HitLoose"),
        (C, SI + r"Claps/SoloClap_vl3"), (C, SM + r"Tom 2/Stick/TomL_HitS"),
        (C, SM + r"Tom 1/Stick/TomH_HitS"), (C, SI + r"Clash Cymbals 1/cymbal_crash1_ff2")],
    "marching-drums": [
        (C, SM + r"Bass Drum 1/BDrumNew_hit"), (C, SM + r"Legacy Snares/drum3_marching/snare3_f_rr1"),
        (C, SM + r"Snare Drum, Modern 3/Snare4_Xstick"), (C, SM + r"Snare Drum, Modern 2/Snare3M_rollSN"),
        (C, SI + r"Claps/SoloClap_vl2"), (C, SM + r"Legacy Toms/tenor_lower/tenor_mf"),
        (C, SM + r"Legacy Toms/tenor_higher/tenorH_mf"), (C, SI + r"Clash Cymbals 2/cymbal_crash2_fff1")],
    "hand-drums": [
        (C, SM + r"Conga/Tumba_HitN"), (C, SM + r"Conga/Conga_HitN"),
        (C, SM + r"Bongos/BongoH_HitMuted1"), (C, SM + r"Bongos/BongoH_Hit1"),
        (C, SM + r"Conga/Quinto_HitFM1"), (C, SM + r"Darbuka/Darbuka_1_hit_vl2_rr1"),
        (C, SM + r"Darbuka/Darbuka_2_hit_vl2_rr1"), (C, SM + r"Bongos/BongoH_Roll")],
    "cajon": [
        (C, SI + r"Cajon/Cajon_hit2_f_rr1"), (C, SI + r"Cajon/Cajon_hit1_f_rr1"),
        (C, SI + r"Cajon/Cajon_hit1_mp_rr1"), (C, SI + r"Cajon/Cajon_hit3_p_rr1"),
        (C, SI + r"Cajon/Cajon_hit3_f_rr1"), (C, SI + r"Cajon/Cajon_hit2_mp_rr1"),
        (C, SI + r"Cajon/Cajon_hit3_mp_rr1"), (C, SI + r"Cajon/Cajon_hit1_fff_rr1")],
    "latin-percussion": [
        (C, SI + r"Cowbells/Cowbell1_Hit"), (C, SI + r"Guiro/Guiro_Slow"),
        (C, SI + r"Claves/Claves1_Hit"), (C, SI + r"Guiro/Guiro_Hit"),
        (C, SI + r"Agogo Bells/Agogo_Low"), (C, SI + r"Agogo Bells/Agogo_High"),
        (V, r"varWood/maraca1\.wav"), (C, SI + r"Cabasa/Cabasa1_Hit")],
    "tambourines-and-shakers": [
        (C, SI + r"Tambourine 1/Tamb1_Hit"), (C, SI + r"Tambourine 1/Tamb1_Shake"),
        (V, r"Camo's Shaker/shake1\.wav"), (C, SI + r"Shaker, Large/LShaker_Shake1D"),
        (C, SI + r"Tambourine 2/Tamb2_Hit"), (C, SI + r"Shaker, Small/Mid_ShakerLowFaster_Down"),
        (C, SI + r"Shaker, Small/Mid_ShakerHighFaster_Down"), (C, SI + r"Sleigh Bells/Sleighbells_Hit")],
    "woodblocks-and-claps": [
        (C, SI + r"Woodblock/wood_click_mp"), (C, SI + r"Woodblock/wood_click2_mp"),
        (C, SI + r"Slit Drum/LogDrumHi_MedM"), (C, SI + r"Slapstick/slapstick_rr1"),
        (C, SI + r"Claps/SoloClap_vl3"), (C, SI + r"Claves/Claves1_Hit"),
        (C, SI + r"Claves/Claves2_Hit"), (C, SI + r"Claps/Clap_rr3")],
    "gongs-and-cymbals": [
        (C, SI + r"Gong 1/gong_mf"), (C, SI + r"Gong 1/gong_2_f"),
        (V, r"VSCO 1 Percussion/varMetal/Gong/gong_hit_f\.wav"),
        (V, r"VSCO 1 Percussion/varMetal/Gong/gong_roll_medium_f\.wav"),
        (C, SI + r"Clash Cymbals 2/cymbal_crash2_f1"), (C, SI + r"Suspended Cymbal 2/susCymb2_hit_stick_mf1"),
        (C, SI + r"Clash Cymbals 1/cymbal_crash1_short1"), (C, SI + r"Suspended Cymbal 1/susCymb1_roll_f1_nloop")],
    "frame-drum": [
        (C, SM + r"Frame Drum/HDrumL_Hit_v2_rr1"), (C, SM + r"Frame Drum/HDrumS_HitMuted_v3_rr1"),
        (C, SM + r"Frame Drum/HDrumL_HitMuted_v2_rr1"), (C, SM + r"Frame Drum/HDrumS_Hit_v2_rr1"),
        (C, SM + r"Frame Drum/HDrumS_Hit_v3_rr1"), (C, SM + r"Frame Drum/HDrumL_HitMuted_v3_rr1"),
        (C, SM + r"Frame Drum/HDrumS_HitMuted_v2_rr1"), (C, SM + r"Frame Drum/HDrumL_Hand")],
}
FX = {
    "siren": (C, r"Free Aerophones/Siren/Main_SirenWhistle-002"),
    "train-whistle": (C, r"Train Whistle, Toy/Main_TrainLow_Med"),
    "ratchet": (C, SI + r"Ratchet/Ratchet1_Crank_rr1"),
    "slapstick": (C, SI + r"Slapstick/slapstick_rr1"),
    "vibraslap": (C, SI + r"Vibraslap/Legacy/vibraslap_rr1"),
    "thunder-sheet-style-gong-scrape": (V, r"Percussion/gongscrape_mf"),
    "bell-tree": (C, SI + r"Bell Tree/Stroke/BellTree_Stroke_3"),
}


def build(shifts=None, explicit=None):
    cat = json.load(open(CATALOG, encoding="utf-8"))
    explicit = explicit or {}
    shifts = shifts or {}
    out = {}
    for inst in cat:
        iid = inst["id"]
        entry = {"name": inst["name"], "category": inst["category"]}
        s = inst["samples"]
        if iid in explicit:
            files = explicit[iid]
        elif iid in KITS:
            files = kit(KITS[iid], inst["slots"])
        elif iid in FX:
            repo, rx = FX[iid]
            files = [f(repo, pick_one(repo, rx), "0.wav")]
        elif "notes" in s:
            repo, drx, nrx, shift = PITCHED[iid]
            files = pick_pitched(repo, drx, s["notes"], shifts.get(iid, shift), nrx)
        else:
            raise SystemExit("no spec for " + iid)
        entry["files"] = files
        out[iid] = entry
    return out


if __name__ == "__main__":
    spec = {
        "downloadDate": "2026-11-14",
        "repos": {r: {"commit": c, "creator": CREATOR} for r, c in COMMITS.items()},
        "instruments": build(None, EXPLICIT),
    }
    with open(os.path.join(HERE, "sample_sources.json"), "w", encoding="utf-8", newline="\n") as f:
        json.dump(spec, f, ensure_ascii=False, indent=1)
        f.write("\n")
    print("instruments:", len(spec["instruments"]))
