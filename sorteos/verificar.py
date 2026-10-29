#!/usr/bin/env python3
"""
Verificador independiente de los sorteos de Labs Summit 2026.
Solo usa la biblioteca estándar de Python 3.

Uso:
  python3 verificar.py https://labssummit.com/sorteos/datos/<id>.json
  python3 verificar.py <archivo>.json
  python3 verificar.py <archivo>.json --aleatorio <hex>   (sin internet: el "randomness" de la ronda)

Qué comprueba:
  1. Recalcula la huella (SHA-256 del acta) y la compara con la publicada.
  2. Trae la ronda de drand quicknet escrita en el acta desde dos servidores
     distintos y comprueba que randomness == sha256(signature) y que coinciden.
     (La firma BLS la verifica la página web; también se puede revisar con el
     cliente oficial de drand: https://drand.love)
  3. Recalcula los ganadores con la fórmula pública.
"""
import hashlib
import json
import re
import sys
import urllib.request
from datetime import datetime, timedelta, timezone

FORMATO = "labs-summit-sorteo/v1"
QUICKNET_HASH = "52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971"
QUICKNET_GENESIS, QUICKNET_PERIODO = 1692803367, 3
RELEVOS = ["https://api.drand.sh", "https://drand.cloudflare.com", "https://api2.drand.sh", "https://api3.drand.sh"]
COLOMBIA = timezone(timedelta(hours=-5))
HEX64 = re.compile(r"^[0-9a-f]{64}$")


def pedir_json(url):
    req = urllib.request.Request(url, headers={"User-Agent": "verificar-sorteo-labs-summit/1"})
    with urllib.request.urlopen(req, timeout=20) as r:
        return json.load(r)


def leer(fuente):
    if fuente.startswith("https://"):
        return pedir_json(fuente)
    with open(fuente, encoding="utf-8") as f:
        return json.load(f)


def limpio(t):
    return isinstance(t, str) and t != "" and t == t.strip() and not re.search(r"[\x00-\x1f\x7f-\x9f\u2028\u2029|]", t)


def validar(s):
    p = []
    if s.get("formato") != FORMATO:
        p.append("formato desconocido")
    if s.get("azar", {}).get("red") != "quicknet" or s.get("azar", {}).get("hash") != QUICKNET_HASH:
        p.append("el azar no viene de drand quicknet")
    if not isinstance(s.get("azar", {}).get("ronda"), int) or s["azar"]["ronda"] < 1:
        p.append("ronda inválida")
    if not limpio(s.get("titulo")) or not isinstance(s.get("premios"), list) or not s["premios"] or not all(map(limpio, s["premios"])):
        p.append("título o premios inválidos")
    partes = s.get("participantes")
    if not isinstance(partes, list) or not partes:
        p.append("no hay participantes")
    elif not all(isinstance(x, list) and len(x) == 2 and limpio(x[0]) and isinstance(x[1], str) and HEX64.match(x[1]) for x in partes):
        p.append("hay participantes con formato inválido")
    elif len({x[1] for x in partes}) != len(partes):
        p.append("hay compromisos repetidos")
    return p


def texto_acta(s):
    l = [
        "LABS SUMMIT 2026 · ACTA DE SORTEO",
        "formato: " + FORMATO,
        "id: " + s["id"],
        "titulo: " + s["titulo"],
        "ensayo: " + ("si" if s["ensayo"] else "no"),
        "cierre de lista: " + s["cierre"],
        "premios: %d" % len(s["premios"]),
    ]
    l += ["premio %d: %s" % (i + 1, p) for i, p in enumerate(s["premios"])]
    l += ["azar: drand %s %s" % (s["azar"]["red"], s["azar"]["hash"]), "ronda: %d" % s["azar"]["ronda"],
          "participantes: %d" % len(s["participantes"]), "---"]
    l += ["%d|%s|%s" % (i + 1, e, c) for i, (e, c) in enumerate(s["participantes"])]
    return "\n".join(l) + "\n"


def ganadores(huella, aleatorio, total, cantidad):
    """Misma fórmula que la página: sha256 → entero de 256 bits, se descartan los valores que darían ventaja."""
    quedan, res = list(range(total)), []
    for j in range(cantidad):
        c = 0
        while True:
            semilla = hashlib.sha256(("%s|%s|%s|%d|%d" % (FORMATO, huella, aleatorio, j, c)).encode()).hexdigest()
            x, m = int(semilla, 16), len(quedan)
            if x < (2 ** 256 // m) * m:
                res.append((j, quedan.pop(x % m), semilla))
                break
            c += 1
    return res


def ronda_drand(ronda):
    vistas = {}
    for relevo in RELEVOS:
        try:
            d = pedir_json("%s/%s/public/%d" % (relevo, QUICKNET_HASH, ronda))
            ok = d.get("round") == ronda and hashlib.sha256(bytes.fromhex(d["signature"])).hexdigest() == d["randomness"].lower()
        except Exception as e:  # sin conexión, ronda aún no disponible o respuesta rota
            print("  · %s: sin respuesta válida (%s)" % (relevo, e.__class__.__name__))
            continue
        print("  · %s: %s" % (relevo, "ok" if ok else "RESPUESTA INVÁLIDA"))
        if ok:
            vistas[relevo] = d["randomness"].lower()
        if len(vistas) >= 2:
            break
    valores = set(vistas.values())
    if not valores:
        sys.exit("No se pudo obtener la ronda %d de drand (¿ya salió? ¿hay internet?)." % ronda)
    if len(valores) > 1:
        sys.exit("¡Los servidores de drand no coinciden! %r" % vistas)
    return valores.pop()


def main(args):
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(errors="replace")
    if not args or args[0] in ("-h", "--help"):
        print(__doc__)
        return 0
    s = leer(args[0])
    problemas = validar(s)
    if problemas:
        print("✕ El archivo no es válido: " + "; ".join(problemas))
        return 1
    print("Sorteo: %s%s" % (s["titulo"], "  [ENSAYO]" if s["ensayo"] else ""))
    print("Participan %d boletas · cierre de lista %s" % (len(s["participantes"]), s["cierre"]))

    huella = hashlib.sha256(texto_acta(s).encode("utf-8")).hexdigest()
    coincide = s.get("huella") in (None, huella)
    print("1. Huella del acta: %s  %s" % (huella, "✓ coincide con la publicada" if coincide else "✕ NO coincide con la publicada: " + str(s.get("huella"))))
    if not coincide:
        return 1

    ronda = s["azar"]["ronda"]
    sale = datetime.fromtimestamp(QUICKNET_GENESIS + (ronda - 1) * QUICKNET_PERIODO, COLOMBIA)
    print("2. Azar: ronda %d de drand quicknet (sale %s, hora de Colombia)" % (ronda, sale.strftime("%Y-%m-%d %H:%M:%S")))
    if "--aleatorio" in args:
        aleatorio = args[args.index("--aleatorio") + 1].lower()
        print("  · número aleatorio dado a mano")
    else:
        aleatorio = ronda_drand(ronda)
    print("  número aleatorio: " + aleatorio)

    print("3. Ganadores:")
    for j, i, semilla in ganadores(huella, aleatorio, len(s["participantes"]), len(s["premios"])):
        print("  Premio %d (%s): boleta n.º %d · %s   [semilla %s…]" % (j + 1, s["premios"][j], i + 1, s["participantes"][i][0], semilla[:16]))

    for rv in s.get("revelaciones") or []:
        try:
            c = hashlib.sha256(("LS-SORTEO|entrada|%s|%s" % (rv["sal"], rv["id"])).encode("utf-8")).hexdigest()
            ok = c == s["participantes"][rv["posicion"] - 1][1]
        except (KeyError, IndexError, TypeError):
            ok = False
        print("  Revelación de la boleta n.º %s: %s" % (rv.get("posicion"), "✓ " + str(rv.get("id")) if ok else "✕ no coincide"))
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
