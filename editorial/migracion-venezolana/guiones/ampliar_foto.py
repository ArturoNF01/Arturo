"""Amplía una foto ×4 con Real-ESRGAN (modelo x4plus) en CPU, por mosaicos.

Sirve cuando la foto no llega a 300 ppp al tamaño de impresión. Necesita:
  pip install ncnn numpy pillow
  y los archivos realesrgan-x4plus.param / .bin (carpeta models/ del zip
  realesrgan-ncnn-vulkan de https://github.com/xinntao/Real-ESRGAN/releases).

Uso: python guiones/ampliar_foto.py entrada.jpg salida.png carpeta_modelos
"""
import sys

import ncnn
import numpy as np
from PIL import Image

MOSAICO, MARGEN, ESCALA = 160, 12, 4


def ampliar(img, modelos):
    red = ncnn.Net()
    red.opt.use_vulkan_compute = False
    red.opt.num_threads = 8
    red.load_param(f"{modelos}/realesrgan-x4plus.param")
    red.load_model(f"{modelos}/realesrgan-x4plus.bin")
    a = np.asarray(img.convert("RGB"), dtype=np.float32) / 255.0
    h, w, _ = a.shape
    salida = np.zeros((h * ESCALA, w * ESCALA, 3), dtype=np.float32)
    for y in range(0, h, MOSAICO):
        for x in range(0, w, MOSAICO):
            y0, x0 = max(0, y - MARGEN), max(0, x - MARGEN)
            y1, x1 = min(h, y + MOSAICO + MARGEN), min(w, x + MOSAICO + MARGEN)
            trozo = np.ascontiguousarray(a[y0:y1, x0:x1].transpose(2, 0, 1))
            ex = red.create_extractor()
            ex.input("data", ncnn.Mat(trozo))
            _, res = ex.extract("output")
            res = np.array(res).transpose(1, 2, 0)
            # se conserva solo la parte central (sin el margen de solape)
            cy, cx = (y - y0) * ESCALA, (x - x0) * ESCALA
            alto = (min(h, y + MOSAICO) - y) * ESCALA
            ancho = (min(w, x + MOSAICO) - x) * ESCALA
            salida[y * ESCALA:y * ESCALA + alto, x * ESCALA:x * ESCALA + ancho] = res[cy:cy + alto, cx:cx + ancho]
        print(f"  {min(h, y + MOSAICO)}/{h} filas", flush=True)
    return Image.fromarray((np.clip(salida, 0, 1) * 255).round().astype(np.uint8))


if __name__ == "__main__":
    entrada, destino, modelos = sys.argv[1:4]
    ampliar(Image.open(entrada), modelos).save(destino)
    print("->", destino)
