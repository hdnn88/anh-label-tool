"""anh-label-tool — Web labeling ảnh, export COCO/YOLO."""

import argparse
import json
import math
from pathlib import Path

from flask import Flask, abort, jsonify, request, send_from_directory

app = Flask(__name__, static_folder="static", static_url_path="")

IMAGES_DIR = Path("images")
ANNOTATIONS_FILE = Path("annotations.json")
EXPORT_DIR = Path("export")
IMG_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

annotations = {}  # {filename: [{"label": str, "bbox": [x,y,w,h], "id": int}]}
_labels = set()
_next_id = [0]


def load_annotations():
    global _next_id
    if ANNOTATIONS_FILE.exists():
        data = json.loads(ANNOTATIONS_FILE.read_text(encoding="utf-8"))
        annotations.clear()
        annotations.update(data.get("images", {}))
        _labels.clear()
        _labels.update(data.get("labels", []))
        _next_id[0] = data.get("next_id", 0)


def save_annotations():
    ANNOTATIONS_FILE.write_text(
        json.dumps(
            {"images": annotations, "labels": sorted(_labels), "next_id": _next_id[0]},
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


def list_images():
    if not IMAGES_DIR.is_dir():
        return []
    return sorted(
        p.name for p in IMAGES_DIR.iterdir() if p.suffix.lower() in IMG_EXTS and p.is_file()
    )


@app.route("/")
def index():
    return send_from_directory("static", "index.html")


@app.route("/images/<path:filename>")
def image_file(filename):
    safe = Path(filename).name
    if not (IMAGES_DIR / safe).exists():
        abort(404)
    return send_from_directory(str(IMAGES_DIR), safe)


@app.route("/api/state")
def api_state():
    return jsonify(
        {
            "images": list_images(),
            "annotations": annotations,
            "labels": sorted(_labels),
            "images_dir": str(IMAGES_DIR.resolve()),
        }
    )


def _valid_boxes(boxes):
    """Validate danh sách box — trả về None nếu hợp lệ, ngược lại là lỗi."""
    if not isinstance(boxes, list):
        return "boxes phải là list"
    if len(boxes) > 1000:
        return "quá nhiều box (tối đa 1000)"
    for b in boxes:
        if not isinstance(b, dict):
            return "box phải là object"
        label = b.get("label")
        if not isinstance(label, str) or not label.strip() or len(label) > 100:
            return "label phải là chuỗi 1-100 ký tự"
        bbox = b.get("bbox")
        if not isinstance(bbox, (list, tuple)) or len(bbox) != 4:
            return "bbox phải có 4 số [x,y,w,h]"
        for v in bbox:
            try:
                if not math.isfinite(float(v)):
                    return "bbox chứa số không hữu hạn"
            except (TypeError, ValueError):
                return "bbox phải là số"
    return None


@app.route("/api/annotations", methods=["POST"])
def api_save():
    data = request.get_json(silent=True)
    if not isinstance(data, dict):
        return jsonify({"error": "Body phải là JSON"}), 415
    filename = data.get("filename")
    boxes = data.get("boxes", [])
    if not filename or not isinstance(filename, str):
        return jsonify({"error": "thiếu filename"}), 400
    # chỉ chấp nhận tên file cơ bản (không đường dẫn) và phải có thật trong images/
    if Path(filename).name != filename or filename not in set(list_images()):
        return jsonify({"error": "filename không hợp lệ"}), 400
    err = _valid_boxes(boxes)
    if err:
        return jsonify({"error": err}), 400
    annotations[filename] = boxes
    for b in boxes:
        b["label"] = b["label"].strip()
        _labels.add(b["label"])
        if "id" not in b:
            b["id"] = _next_id[0]
            _next_id[0] += 1
    save_annotations()
    return jsonify({"ok": True, "labels": sorted(_labels)})


@app.route("/api/export/<fmt>", methods=["POST"])
def api_export(fmt):
    imgs = list_images()
    if not imgs:
        return jsonify({"error": "không có ảnh trong " + str(IMAGES_DIR)}), 400

    labels = sorted(_labels)
    label_to_idx = {l: i for i, l in enumerate(labels)}
    EXPORT_DIR.mkdir(exist_ok=True)

    if fmt == "yolo":
        out_dir = EXPORT_DIR / "yolo"
        out_dir.mkdir(exist_ok=True)
        (out_dir / "classes.txt").write_text("\n".join(labels), encoding="utf-8")
        count = 0
        for fname in imgs:
            boxes = annotations.get(fname, [])
            img = IMAGES_DIR / fname
            w = h = 1
            try:
                from PIL import Image

                with Image.open(img) as im:
                    w, h = im.size
            except Exception:
                pass
            lines = []
            for b in boxes:
                if b["label"] not in label_to_idx:
                    continue
                x, y, bw, bh = b["bbox"]
                cx = (x + bw / 2) / w
                cy = (y + bh / 2) / h
                nw = bw / w
                nh = bh / h
                lines.append(f"{label_to_idx[b['label']]} {cx:.6f} {cy:.6f} {nw:.6f} {nh:.6f}")
                count += 1
            out_name = Path(fname).stem + ".txt"
            (out_dir / out_name).write_text("\n".join(lines), encoding="utf-8")
        return jsonify({"ok": True, "format": "yolo", "dir": str(out_dir), "boxes": count, "classes": labels})

    if fmt == "coco":
        import time

        images = []
        anns = []
        for i, fname in enumerate(imgs, 1):
            w = h = 0
            try:
                from PIL import Image

                with Image.open(IMAGES_DIR / fname) as im:
                    w, h = im.size
            except Exception:
                w, h = 640, 480
            images.append({"id": i, "file_name": fname, "width": w, "height": h})
            aid = 1
            for b in annotations.get(fname, []):
                if b["label"] not in label_to_idx:
                    continue
                x, y, bw, bh = b["bbox"]
                anns.append(
                    {
                        "id": len(anns) + 1,
                        "image_id": i,
                        "category_id": label_to_idx[b["label"]] + 1,
                        "bbox": [x, y, bw, bh],
                        "area": bw * bh,
                        "iscrowd": 0,
                    }
                )
                aid += 1
        coco = {
            "info": {"description": "Exported by anh-label-tool", "year": time.gmtime().tm_year},
            "images": images,
            "annotations": anns,
            "categories": [{"id": i + 1, "name": l} for i, l in enumerate(labels)],
        }
        out_file = EXPORT_DIR / "coco.json"
        out_file.write_text(json.dumps(coco, ensure_ascii=False, indent=2), encoding="utf-8")
        return jsonify({"ok": True, "format": "coco", "file": str(out_file), "boxes": len(anns)})

    return jsonify({"error": "format phải là yolo hoặc coco"}), 400


def main():
    global IMAGES_DIR
    try:
        sys_out = __import__("sys").stdout
        sys_out.reconfigure(encoding="utf-8", errors="replace")
    except Exception:
        pass

    parser = argparse.ArgumentParser(description="anh-label-tool — đánh nhãn ảnh, export COCO/YOLO")
    parser.add_argument("--images", default="images", help="Thư mục chứa ảnh")
    parser.add_argument("--port", type=int, default=8081)
    args = parser.parse_args()

    IMAGES_DIR = Path(args.images)
    if not IMAGES_DIR.is_dir():
        print(f"⚠ Không thấy thư mục ảnh '{IMAGES_DIR}' — tạo mới. Copy ảnh vào đó rồi chạy lại.")
        IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    load_annotations()
    print(f"🖼  Ảnh: {IMAGES_DIR.resolve()} ({len(list_images())} ảnh)")
    print(f"🏷  Đã lưu: {ANNOTATIONS_FILE.resolve()}")
    print(f"🌐 Mở: http://localhost:{args.port}")
    app.run(host="127.0.0.1", port=args.port, debug=False)


if __name__ == "__main__":
    main()
