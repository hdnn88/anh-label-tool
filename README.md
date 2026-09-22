# 🖼 anh-label-tool

> Web tool **đánh nhãn ảnh** (bounding box) cho CV/ML — vẽ box trên canvas, lưu JSON, export **YOLO** & **COCO**. Chạy local, tiếng Việt.

![Python](https://img.shields.io/badge/Python-3.8%2B-blue) ![License](https://img.shields.io/badge/license-MIT-green) ![FLask](https://img.shields.io/badge/UI-Flask%20%2B%20Canvas-orange)

## ✨ Tính năng

- 🖌️ Vẽ **bounding box** bằng canvas (kéo chuột)
- 🏷️ Quản lý nhãn (thêm nhanh, chọn từ list)
- 💾 Lưu tự động → `annotations.json`
- ⬇️ Export **YOLO** (`classes.txt` + `.txt/img`) và **COCO** (`coco.json`)
- ⌨️ Phím tắt: `←/→` đổi ảnh, `Del` xóa box, `Ctrl+S` lưu
- 📱 Giao diện tiếng Việt, tối giản

## 🚀 Cài đặt

```bash
git clone https://github.com/hdnn88/anh-label-tool.git
cd anh-label-tool
pip install -r requirements.txt

mkdir images          # copy ảnh vào đây (.jpg/.png/.webp...)
python app.py --images images
```

Mở **http://localhost:8081**

## 🖥️ Cách dùng

1. Chọn/nhập **nhãn** (VD: `ô tô`, `người`)
2. **Kéo chuột** trên ảnh để vẽ box
3. `→` sang ảnh tiếp, `Ctrl+S` lưu
4. Bấm **⬇ YOLO** hoặc **⬇ COCO** → file trong `export/`

### Cấu trúc export YOLO

```
export/yolo/
├── classes.txt      # danh sách nhãn
├── img1.txt         # class cx cy w h (tỷ lệ 0-1)
└── img2.txt
```

## 🗺️ Lộ trình

- [ ] Vẽ polygon (segmentation)
- [ ] Phân bổ ảnh train/val
- [ ] Undo/redo box
- [ ] Đọc annotation có sẵn (YOLO label dir)
- [ ] Export segmentation (COCO RLE)

## 🤝 Đóng góp

Xem [CONTRIBUTING.md](CONTRIBUTING.md).

## 📄 License

[MIT](LICENSE)
