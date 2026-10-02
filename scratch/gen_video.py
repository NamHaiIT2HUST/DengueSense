import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import textwrap

# Setup output path
output_path = os.path.join(os.path.expanduser("~"), "Downloads", "DengueSense_Intro.mp4")

# Video settings
width, height = 1280, 720
fps = 1
duration_per_slide = 15 # seconds
fourcc = cv2.VideoWriter_fourcc(*'mp4v')
out = cv2.VideoWriter(output_path, fourcc, fps, (width, height))

slides = [
    {
        "title": "DENGUESENSE",
        "content": "Nền tảng AI dự báo, tối ưu nguồn lực & điều phối phòng chống sốt xuất huyết\n\nNhóm: MedSentinel\nĐại học Bách khoa Hà Nội\nRND TO STARTUP 2026",
        "bg_color": (32, 12, 59),
        "title_color": (166, 77, 255)
    },
    {
        "title": "01. VẤN ĐỀ - GÁNH NẶNG SỐT XUẤT HUYẾT",
        "content": "- 2023: >172.000 ca mắc, 43 tử vong tại VN.\n- Dịch bất thường, bùng phát mạnh ở Hà Nội.\n- Thiệt hại kinh tế: 95,3 triệu USD/năm.\n- 40% gánh nặng đến từ mất năng suất lao động.",
        "bg_color": (20, 20, 30),
        "title_color": (255, 100, 100)
    },
    {
        "title": "KHOẢNG TRỐNG TRONG PHÒNG CHỐNG DỊCH",
        "content": "- Các giải pháp hiện tại (D-MOSS...) chỉ dừng ở dự báo rủi ro (Bản đồ nhiệt).\n- Thiếu HÀNH ĐỘNG: Cán bộ y tế vẫn tính toán thủ công, phân bổ bị động.\n- Mục tiêu: Chuyển từ 'Phản ứng bị động' sang 'Chủ động phân bổ'.",
        "bg_color": (20, 20, 30),
        "title_color": (255, 200, 50)
    },
    {
        "title": "02. GIẢI PHÁP - DENGUESENSE",
        "content": "Hệ thống khép kín 3 bước:\n1. Dự báo sớm (AI Spatio-Temporal)\n2. Tối ưu phân bổ (Resource Optimization)\n3. Điều phối tự động (GenAI RAG Dispatch)",
        "bg_color": (30, 20, 40),
        "title_color": (100, 255, 150)
    },
    {
        "title": "LỚP 1 - AI SPATIO-TEMPORAL",
        "content": "- Công nghệ: XGBoost + Random Forest.\n- Dữ liệu: Dịch tễ (2001-2024) kết hợp khí hậu ERA5.\n- Kết quả: Đạt độ chính xác 89,5%, cảnh báo sớm từ 1-6 tháng.",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255)
    },
    {
        "title": "LỚP 2 - RESOURCE OPTIMIZATION",
        "content": "- Công nghệ: MILP + Simulated Annealing + Tabu Search.\n- Mục tiêu: Giải bài toán phân bổ giường bệnh, vật tư, nhân lực.\n- Hiệu năng: Tối ưu cho 570 quận/huyện toàn quốc chỉ trong ~1 phút.",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255)
    },
    {
        "title": "LỚP 3 - GENAI RAG DISPATCH",
        "content": "- Nhiệm vụ: Tự động soạn thảo văn bản điều phối chuẩn Bộ Y tế.\n- Gửi thông báo: B2G (Cơ quan quản lý), B2B (Bệnh viện), SMS/Email (Người dân).\n- Cơ chế: Human-in-the-loop (Luôn cần cán bộ y tế phê duyệt).",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255)
    },
    {
        "title": "LỢI THẾ CẠNH TRANH",
        "content": "- Khép kín chuỗi giá trị: Từ dữ liệu đến hành động tức thì.\n- Thiết kế Offline-First: Phù hợp điều kiện y tế tuyến cơ sở.\n- Chuẩn hóa: Đảm bảo quy định hành chính y tế.\n- Hiệu quả kinh tế: Tiết kiệm hàng triệu USD vận hành.",
        "bg_color": (30, 20, 30),
        "title_color": (255, 150, 255)
    },
    {
        "title": "MÔ HÌNH KINH DOANH & THỊ TRƯỜNG",
        "content": "- Khách hàng B2G: Sở Y tế, CDC (34 tỉnh/thành).\n- Khách hàng B2B: 384 bệnh viện tư nhân toàn quốc.\n- Quy mô thị trường (TAM): 11,58 triệu USD.\n- Mở rộng dài hạn: Các nước ASEAN có dịch tễ tương đồng.",
        "bg_color": (40, 20, 20),
        "title_color": (255, 100, 100)
    },
    {
        "title": "TÁC ĐỘNG MÔI TRƯỜNG & XÃ HỘI",
        "content": "- Môi trường: Can thiệp trọng điểm, giảm phun hóa chất diện rộng.\n- Xã hội: Giảm 10-20% ca nhiễm, giảm tải hệ thống y tế công.\n- Vận hành: Rút ngắn 50% thời gian phản ứng dịch (từ 48h -> 24h).",
        "bg_color": (20, 40, 20),
        "title_color": (100, 255, 100)
    },
    {
        "title": "LỘ TRÌNH TRIỂN KHAI",
        "content": "- Q4/2026: Hoàn thiện MVP & Xin tài trợ nghiên cứu.\n- Q1/2027: Chuẩn bị hạ tầng & Đàm phán Pilot B2B/B2G.\n- Q2/2027: Triển khai Pilot tại 2 tỉnh và 2 bệnh viện tư.\n- Q3/2027: Đánh giá KPI & Mở rộng thương mại.",
        "bg_color": (20, 30, 40),
        "title_color": (150, 200, 255)
    },
    {
        "title": "KÊU GỌI ĐẦU TƯ",
        "content": "Nhu cầu: 100.000 USD (Hạt giống)\n- 50%: Hạ tầng Cloud, AI & Dữ liệu.\n- 25%: Nghiên cứu R&D.\n- 15%: Phát triển thị trường.\n- 10%: Dự phòng vận hành.\n=> Đảm bảo runway 12-15 tháng, đạt điểm hòa vốn giữa năm 2.",
        "bg_color": (40, 30, 10),
        "title_color": (255, 215, 0)
    }
]

def draw_text(draw, text, position, font, color, max_width):
    lines = []
    for paragraph in text.split('\n'):
        if not paragraph:
            lines.append("")
            continue
        words = paragraph.split(' ')
        current_line = []
        for word in words:
            current_line.append(word)
            bbox = draw.textbbox((0,0), " ".join(current_line), font=font)
            if bbox[2] - bbox[0] > max_width:
                current_line.pop()
                lines.append(" ".join(current_line))
                current_line = [word]
        lines.append(" ".join(current_line))
    
    y = position[1]
    for line in lines:
        if line:
            bbox = draw.textbbox((0,0), line, font=font)
            # Center the text
            x = (width - (bbox[2] - bbox[0])) / 2
            draw.text((x, y), line, font=font, fill=color)
        # Approximate line height
        y += font.size * 1.5

for slide in slides:
    img = Image.new('RGB', (width, height), color=slide['bg_color'])
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 55)
        font_content = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 36)
    except:
        try:
            font_title = ImageFont.truetype("arialbd.ttf", 55)
            font_content = ImageFont.truetype("arial.ttf", 36)
        except:
            font_title = ImageFont.load_default()
            font_content = ImageFont.load_default()

    # Draw Title
    title = slide["title"]
    # We don't wrap title for simplicity, assuming it fits
    bbox = draw.textbbox((0,0), title, font=font_title)
    x = (width - (bbox[2] - bbox[0])) / 2
    draw.text((x, 100), title, font=font_title, fill=slide["title_color"])
    
    # Draw line separator
    draw.line((100, 180, width-100, 180), fill=(255,255,255,100), width=3)
    
    # Draw Content
    draw_text(draw, slide["content"], (100, 240), font_content, (255, 255, 255), width - 200)

    # Draw footer
    footer = "DengueSense - Từ dữ liệu đến hành động | Đại học Bách khoa Hà Nội"
    bbox = draw.textbbox((0,0), footer, font=font_content)
    x = (width - (bbox[2] - bbox[0])) / 2
    draw.text((x, height - 80), footer, font=font_content, fill=(150, 150, 150))

    # Convert to BGR for OpenCV
    frame = cv2.cvtColor(np.array(img), cv2.COLOR_RGB2BGR)
    
    # Fade in transition (1 second)
    # Actually just write static frames to be simple and robust
    for _ in range(duration_per_slide * fps):
        out.write(frame)

out.release()
print(f"Video saved to: {output_path}")
