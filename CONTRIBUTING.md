# Hướng dẫn đóng góp

Cảm ơn bạn muốn giúp đỡ! 🎉

## Welcome

- 🖌️ Vẽ polygon / segmentation
- ↩️ Undo-redo
- 📥 Import YOLO/COCO có sẵn
- 🐛 UX fixes

## Quy trình

1. Fork → `git checkout -b feature/ten`
2. Test local: `python app.py` + vẽ vài box + export
3. Commit `feat:`/`fix:` → **PR**

## Quy ước

- UI tiếng Việt
- Annotation format: bbox `[x, y, w, h]` pixel (YOLO convert lúc export)
- Không phá `annotations.json` schema
