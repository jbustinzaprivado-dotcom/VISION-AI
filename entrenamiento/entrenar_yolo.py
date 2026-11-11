"""Entrena el detector YOLO de VISION AI con el dataset de escenas generadas (DT-9).

Uso (Colab, Kaggle o una computadora con Python 3.10+):
    pip install ultralytics onnx onnxslim
    python entrenar_yolo.py dataset.zip --epocas 40

Pasos:
  1. Descomprime el dataset que exporta la pantalla Entrenamiento (images/, labels/, data.yaml).
  2. Ajusta YOLOv8n (preentrenado en COCO) a las 7 clases de la simulación.
  3. Evalúa con las sesiones de validación (escenas que el modelo nunca vio).
  4. Exporta a ONNX con entrada 288 x 480 (la cámara es 480 x 270, con relleno) y
     escribe resultados.json con las métricas reales para la aplicación.

Copia modelo.onnx y resultados.json a src/vision/yolo/modelo/ y vuelve a publicar.
"""
import argparse
import csv
import json
import shutil
import zipfile
from datetime import date
from pathlib import Path

from ultralytics import YOLO

AQUI = Path(__file__).resolve().parent
ENTRADA = (288, 480)  # alto x ancho que recibe el modelo en el navegador


def descomprimir(zip_path: Path, destino: Path) -> Path:
    if destino.exists():
        shutil.rmtree(destino)
    with zipfile.ZipFile(zip_path) as z:
        z.extractall(destino)
    yaml = destino / "data.yaml"
    # Ultralytics necesita la ruta absoluta del dataset.
    yaml.write_text(yaml.read_text(encoding="utf-8").replace("path: .", f"path: {destino.as_posix()}"), encoding="utf-8")
    return yaml


def contar(destino: Path, particion: str):
    imagenes = len(list((destino / "images" / particion).glob("*.jpg")))
    por_clase = {}
    for etiqueta in (destino / "labels" / particion).glob("*.txt"):
        for linea in etiqueta.read_text().splitlines():
            if linea.strip():
                c = int(linea.split()[0])
                por_clase[c] = por_clase.get(c, 0) + 1
    return imagenes, por_clase


def historial(carpeta: Path):
    filas = []
    with open(carpeta / "results.csv", newline="") as f:
        for fila in csv.DictReader(f):
            fila = {k.strip(): v for k, v in fila.items()}
            filas.append({
                "epoca": int(float(fila["epoch"])),
                "mAP50": round(float(fila["metrics/mAP50(B)"]), 4),
                "mAP50_95": round(float(fila["metrics/mAP50-95(B)"]), 4),
                "precision": round(float(fila["metrics/precision(B)"]), 4),
                "recall": round(float(fila["metrics/recall(B)"]), 4),
                "perdidaCaja": round(float(fila["train/box_loss"]), 4),
                "perdidaClase": round(float(fila["train/cls_loss"]), 4),
            })
    return filas


def main():
    p = argparse.ArgumentParser()
    p.add_argument("dataset", type=Path, help="dataset.zip exportado desde la aplicación")
    p.add_argument("--epocas", type=int, default=40)
    p.add_argument("--lote", type=int, default=16)
    p.add_argument("--dispositivo", default=None, help="cpu, 0 (GPU)... por defecto, el que haya")
    p.add_argument("--congelar", type=int, default=0, help="capas iniciales que no se reentrenan (10 = toda la base; más rápido en CPU)")
    p.add_argument("--salida", type=Path, default=AQUI.parent / "src" / "vision" / "yolo" / "modelo")
    p.add_argument("--reanudar", action="store_true", help="continúa un entrenamiento interrumpido desde su última época")
    a = p.parse_args()

    destino = AQUI / "dataset"
    carpeta = AQUI / "runs" / "vision-ai"
    if a.reanudar:
        # Mismo dataset ya descomprimido; Ultralytics retoma con las opciones guardadas.
        yaml = destino / "data.yaml"
        YOLO(carpeta / "weights" / "last.pt").train(resume=True)
    else:
        yaml = descomprimir(a.dataset, destino)
        # Pesos preentrenados: los de esta carpeta si ya se descargaron; si no, Ultralytics los baja.
        local = AQUI / "yolov8n.pt"
        modelo = YOLO(local if local.exists() else "yolov8n.pt")
        modelo.train(
            data=str(yaml), epochs=a.epocas, imgsz=480, batch=a.lote, device=a.dispositivo,
            project=str(AQUI / "runs"), name="vision-ai", exist_ok=True, seed=7, deterministic=True,
            patience=15, plots=False, workers=2, freeze=a.congelar or None,
        )
    mejor = YOLO(carpeta / "weights" / "best.pt")
    nombres = mejor.names

    # Evaluación final con la validación (sesiones que no estaban en el entrenamiento).
    m = mejor.val(data=str(yaml), imgsz=480, batch=a.lote, device=a.dispositivo, plots=False, split="val")
    _, instancias = contar(destino, "val")
    clases = []
    for i, c in enumerate(m.box.ap_class_index):
        clases.append({
            "clase": nombres[int(c)],
            "instancias": instancias.get(int(c), 0),
            "mAP50": round(float(m.box.ap50[i]), 4),
            "mAP50_95": round(float(m.box.ap[i]), 4),
        })

    onnx = Path(mejor.export(format="onnx", imgsz=list(ENTRADA), opset=17, simplify=True, dynamic=False))
    a.salida.mkdir(parents=True, exist_ok=True)
    shutil.copy(onnx, a.salida / "modelo.onnx")

    n_train, _ = contar(destino, "train")
    n_val, _ = contar(destino, "val")
    import torch
    equipo = f"GPU {torch.cuda.get_device_name(0)}" if torch.cuda.is_available() and a.dispositivo != "cpu" else "solo CPU"
    resultados = {
        "modelo": "YOLOv8n",
        "capasCongeladas": a.congelar,
        "epocas": len(historial(carpeta)),
        "imagenes": {"train": n_train, "val": n_val},
        "equipo": equipo,
        "entrada": list(ENTRADA),
        "clases_modelo": [nombres[i] for i in sorted(nombres)],
        "tamanoMB": round((a.salida / "modelo.onnx").stat().st_size / 1048576, 2),
        "final": {
            "mAP50": round(float(m.box.map50), 4),
            "mAP50_95": round(float(m.box.map), 4),
            "precision": round(float(m.box.mp), 4),
            "recall": round(float(m.box.mr), 4),
        },
        "clases": clases,
        "historial": historial(carpeta),
        "fecha": date.today().isoformat(),
    }
    (a.salida / "resultados.json").write_text(json.dumps(resultados, ensure_ascii=False, indent=1), encoding="utf-8")
    print(json.dumps(resultados["final"], indent=1))
    print(f"Listo: {a.salida / 'modelo.onnx'} y resultados.json")


if __name__ == "__main__":
    main()
