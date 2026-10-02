import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
import os
import textwrap
from gtts import gTTS
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips

# Setup paths
out_dir = os.path.join("scratch", "video_assets")
os.makedirs(out_dir, exist_ok=True)
output_path = os.path.join(os.path.expanduser("~"), "Downloads", "DengueSense_Presentation.mp4")

width, height = 1280, 720

slides = [
    {
        "title": "DENGUESENSE",
        "content": "Nền tảng AI dự báo, tối ưu nguồn lực & điều phối phòng chống sốt xuất huyết\n\nNhóm: MedSentinel\nĐại học Bách khoa Hà Nội",
        "bg_color": (32, 12, 59),
        "title_color": (166, 77, 255),
        "voice": "Xin chào ban giám khảo, chúng tôi là nhóm MedSentinel đến từ Đại học Bách khoa Hà Nội. Hôm nay, chúng tôi xin giới thiệu DengueSense - Nền tảng AI dự báo, tối ưu nguồn lực và điều phối phòng chống sốt xuất huyết."
    },
    {
        "title": "01. VẤN ĐỀ - GÁNH NẶNG SỐT XUẤT HUYẾT",
        "content": "- 2023: >172.000 ca mắc, 43 tử vong tại VN.\n- Dịch bất thường, bùng phát mạnh ở Hà Nội.\n- Thiệt hại kinh tế: 95,3 triệu USD/năm.\n- 40% gánh nặng đến từ mất năng suất lao động.",
        "bg_color": (20, 20, 30),
        "title_color": (255, 100, 100),
        "voice": "Năm 2023, Việt Nam ghi nhận hơn 172.000 ca mắc. Đáng chú ý, dịch không còn tập trung ở miền Nam mà bùng phát bất thường tại Hà Nội. Thiệt hại kinh tế ước tính 95,3 triệu USD mỗi năm, với 40 phần trăm là do mất năng suất lao động."
    },
    {
        "title": "KHOẢNG TRỐNG TRONG PHÒNG CHỐNG DỊCH",
        "content": "- Các giải pháp hiện tại chỉ dừng ở dự báo rủi ro (Bản đồ nhiệt).\n- Thiếu HÀNH ĐỘNG: Cán bộ y tế vẫn tính toán thủ công, phân bổ bị động.\n- Mục tiêu: Chuyển từ 'Phản ứng bị động' sang 'Chủ động phân bổ'.",
        "bg_color": (20, 20, 30),
        "title_color": (255, 200, 50),
        "voice": "Hiện tại, các giải pháp công nghệ chỉ dừng lại ở việc dự báo rủi ro. Vẫn tồn tại khoảng trống lớn khi cán bộ y tế phải tính toán phân bổ thủ công. Chúng ta cần chuyển từ phản ứng bị động sang chủ động phân bổ nguồn lực."
    },
    {
        "title": "02. GIẢI PHÁP - DENGUESENSE",
        "content": "Hệ thống khép kín 3 bước:\n1. Dự báo sớm (AI Spatio-Temporal)\n2. Tối ưu phân bổ (Resource Optimization)\n3. Điều phối tự động (GenAI RAG Dispatch)",
        "bg_color": (30, 20, 40),
        "title_color": (100, 255, 150),
        "voice": "DengueSense giải quyết vấn đề này qua hệ thống khép kín 3 bước: Dự báo sớm AI, Tối ưu phân bổ nguồn lực và Điều phối bằng AI tạo sinh."
    },
    {
        "title": "LỚP 1 - AI SPATIO-TEMPORAL",
        "content": "- Công nghệ: XGBoost + Random Forest.\n- Dữ liệu: Dịch tễ (2001-2024) kết hợp khí hậu ERA5.\n- Kết quả: Đạt độ chính xác 89,5%, cảnh báo sớm từ 1-6 tháng.",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255),
        "voice": "Bước 1, chúng tôi sử dụng AI học trên 24 năm dữ liệu dịch tễ và khí hậu ERA5, đạt độ chính xác thực nghiệm 89,5 phần trăm, có khả năng cảnh báo sớm từ 1 đến 6 tháng trước đỉnh dịch."
    },
    {
        "title": "LỚP 2 - RESOURCE OPTIMIZATION",
        "content": "- Công nghệ: MILP + Simulated Annealing + Tabu Search.\n- Mục tiêu: Giải bài toán phân bổ giường bệnh, vật tư, nhân lực.\n- Hiệu năng: Tối ưu cho 570 quận/huyện toàn quốc chỉ trong ~1 phút.",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255),
        "voice": "Bước 2, thuật toán Tối ưu hóa sẽ tự động giải bài toán phân bổ giường bệnh, vật tư, và nhân lực cho toàn bộ 570 quận, huyện trên toàn quốc chỉ trong khoảng 1 phút."
    },
    {
        "title": "LỚP 3 - GENAI RAG DISPATCH",
        "content": "- Nhiệm vụ: Tự động soạn thảo văn bản điều phối chuẩn Bộ Y tế.\n- Gửi thông báo: B2G (Cơ quan), B2B (Bệnh viện), SMS (Người dân).\n- Cơ chế: Human-in-the-loop (Luôn cần cán bộ y tế phê duyệt).",
        "bg_color": (20, 30, 40),
        "title_color": (100, 200, 255),
        "voice": "Bước 3, Gen AI sẽ tự động soạn thảo văn bản điều phối chuẩn Bộ Y tế gửi đến cơ quan quản lý và bệnh viện, kết hợp cảnh báo tới người dân. Cán bộ y tế duyệt lệnh bằng một click."
    },
    {
        "title": "LỢI THẾ CẠNH TRANH",
        "content": "- Khép kín chuỗi giá trị: Từ dữ liệu đến hành động tức thì.\n- Thiết kế Offline-First: Phù hợp điều kiện y tế tuyến cơ sở.\n- Chuẩn hóa: Đảm bảo quy định hành chính y tế.\n- Hiệu quả kinh tế: Tiết kiệm hàng triệu USD vận hành.",
        "bg_color": (30, 20, 30),
        "title_color": (255, 150, 255),
        "voice": "Lợi thế của chúng tôi là quy trình khép kín, mang lại hiệu quả kinh tế cao và thiết kế Offline-First, đảm bảo hoạt động liên tục ngay cả khi mất kết nối mạng tại các trạm y tế."
    },
    {
        "title": "MÔ HÌNH KINH DOANH & THỊ TRƯỜNG",
        "content": "- Khách hàng B2G: Sở Y tế, CDC (34 tỉnh/thành).\n- Khách hàng B2B: 384 bệnh viện tư nhân toàn quốc.\n- Quy mô thị trường (TAM): 11,58 triệu USD.\n- Mở rộng dài hạn: Các nước ASEAN có dịch tễ tương đồng.",
        "bg_color": (40, 20, 20),
        "title_color": (255, 100, 100),
        "voice": "Dự án áp dụng mô hình cho 34 Sở Y tế và 384 bệnh viện tư nhân, với quy mô thị trường mục tiêu đạt 11,58 triệu USD và tương lai mở rộng sang các nước ASEAN."
    },
    {
        "title": "TÁC ĐỘNG MÔI TRƯỜNG & XÃ HỘI",
        "content": "- Môi trường: Can thiệp trọng điểm, giảm phun hóa chất diện rộng.\n- Xã hội: Giảm 10-20% ca nhiễm, giảm tải hệ thống y tế công.\n- Vận hành: Rút ngắn 50% thời gian phản ứng dịch (từ 48h -> 24h).",
        "bg_color": (20, 40, 20),
        "title_color": (100, 255, 100),
        "voice": "Giải pháp sẽ giúp rút ngắn 50 phần trăm thời gian phản ứng, giảm tải hệ thống y tế công, hạn chế việc phun hóa chất diện rộng, và mục tiêu giảm 10 đến 20 phần trăm số ca nhiễm bệnh."
    },
    {
        "title": "LỘ TRÌNH TRIỂN KHAI",
        "content": "- Q4/2026: Hoàn thiện MVP & Xin tài trợ nghiên cứu.\n- Q1/2027: Chuẩn bị hạ tầng & Đàm phán Pilot.\n- Q2/2027: Triển khai Pilot tại 2 tỉnh và 2 bệnh viện tư.\n- Q3/2027: Đánh giá KPI & Mở rộng thương mại.",
        "bg_color": (20, 30, 40),
        "title_color": (150, 200, 255),
        "voice": "Đầu năm 2027, dự án sẽ tiến hành chạy Pilot thực tế tại 2 tỉnh thành và 2 bệnh viện tư trước khi chính thức mở rộng thương mại."
    },
    {
        "title": "KÊU GỌI ĐẦU TƯ",
        "content": "Nhu cầu: 100.000 USD (Hạt giống)\n- 50%: Hạ tầng Cloud, AI & Dữ liệu.\n- 25%: Nghiên cứu R&D.\n- 15%: Phát triển thị trường.\n- 10%: Dự phòng vận hành.\n=> Đạt điểm hòa vốn giữa năm 2.",
        "bg_color": (40, 30, 10),
        "title_color": (255, 215, 0),
        "voice": "Để đạt được điều này, chúng tôi kêu gọi 100.000 USD vốn hạt giống, tập trung vào hạ tầng AI, nghiên cứu và thị trường, đảm bảo dự án đạt điểm hòa vốn vào giữa năm thứ 2. Cảm ơn ban giám khảo đã lắng nghe!"
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
            x = (width - (bbox[2] - bbox[0])) / 2
            draw.text((x, y), line, font=font, fill=color)
        y += font.size * 1.5

clips = []

for i, slide in enumerate(slides):
    # 1. Generate Image
    img = Image.new('RGB', (width, height), color=slide['bg_color'])
    draw = ImageDraw.Draw(img)
    
    try:
        font_title = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 55)
        font_content = ImageFont.truetype("C:\\Windows\\Fonts\\arial.ttf", 36)
    except:
        font_title = ImageFont.load_default()
        font_content = ImageFont.load_default()

    title = slide["title"]
    bbox = draw.textbbox((0,0), title, font=font_title)
    x = (width - (bbox[2] - bbox[0])) / 2
    draw.text((x, 100), title, font=font_title, fill=slide["title_color"])
    
    draw.line((100, 180, width-100, 180), fill=(255,255,255,100), width=3)
    
    draw_text(draw, slide["content"], (100, 240), font_content, (255, 255, 255), width - 200)

    footer = "DengueSense - Từ dữ liệu đến hành động | Đại học Bách khoa Hà Nội"
    bbox = draw.textbbox((0,0), footer, font=font_content)
    x = (width - (bbox[2] - bbox[0])) / 2
    draw.text((x, height - 80), footer, font=font_content, fill=(150, 150, 150))

    img_path = os.path.join(out_dir, f"slide_{i}.jpg")
    img.save(img_path)

    # 2. Generate Audio
    audio_path = os.path.join(out_dir, f"audio_{i}.mp3")
    tts = gTTS(text=slide["voice"], lang='vi')
    tts.save(audio_path)

    # 3. Create Video Clip
    audio_clip = AudioFileClip(audio_path)
    # Add 0.5s padding to each slide
    img_clip = ImageClip(img_path).with_duration(audio_clip.duration + 0.5)
    img_clip = img_clip.with_audio(audio_clip)
    
    clips.append(img_clip)

# Concatenate all clips
final_video = concatenate_videoclips(clips, method="compose")

# Write final video
final_video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
print(f"Final video with voiceover saved to: {output_path}")
