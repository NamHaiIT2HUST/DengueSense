import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from gtts import gTTS
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips, vfx
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip

out_dir = os.path.join("scratch", "reel_assets")
os.makedirs(out_dir, exist_ok=True)
output_path = os.path.join(os.path.expanduser("~"), "Downloads", "DengueSense_Reel.mp4")

artifact_dir = r"C:\Users\Nguyen Dao Nam Hai\.gemini\antigravity\brain\4559155c-9724-4e30-9da3-c4869b4fa424"

# 1080x1920 for Reels/TikTok
width, height = 1080, 1920

scenes = [
    {
        "img": "shocked_news_1790594795081.jpg",
        "voice": "Bạn có tin được không? Trong năm 2023, Việt Nam đã có tới hơn 172.000 ca mắc sốt xuất huyết.",
        "sub": "Việt Nam có >172.000\nca mắc sốt xuất huyết"
    },
    {
        "img": "mosquito_dengue_1790594205089.jpg",
        "voice": "Căn bệnh này tưởng chừng quen thuộc, nhưng lại cướp đi sinh mạng của 43 người trong nháy mắt.",
        "sub": "Cướp đi sinh mạng\ncủa 43 người"
    },
    {
        "img": "rain_hanoi_1790594807617.jpg",
        "voice": "Và điều đáng sợ nhất là gì? Dịch bệnh không còn tuân theo quy luật cũ... Thay vì chỉ tập trung ở miền Nam, năm qua Hà Nội đã thất thủ với các ca bệnh bùng phát bất thường.",
        "sub": "Dịch bệnh bùng phát\nbất thường ở Hà Nội"
    },
    {
        "img": "crowded_hospital_1790594218257.jpg",
        "voice": "Gánh nặng kinh tế lên tới 95,3 triệu đô la Mỹ mỗi năm! Hầu hết đến từ việc người lao động phải nghỉ làm, học sinh phải nghỉ học.",
        "sub": "Gánh nặng kinh tế\n95,3 triệu USD/năm!"
    },
    {
        "img": "tired_doctor_1790594818990.jpg",
        "voice": "Hiện tại, chúng ta đang chống dịch như thế nào? Các cán bộ y tế phải gồng mình tính toán thủ công trên những tờ giấy và bảng Excel chằng chịt.",
        "sub": "Cán bộ y tế gồng mình\ntính toán thủ công"
    },
    {
        "img": "hospital_logistics_1790594858399.jpg",
        "voice": "Hậu quả là mọi quyết định phân bổ giường bệnh, thuốc men luôn bị chậm trễ từ 2 đến 4 tuần! Quá muộn để cứu vãn một đợt bùng phát.",
        "sub": "Phân bổ nguồn lực\nbị chậm trễ 2-4 tuần!"
    },
    {
        "img": "ai_brain_glowing_1790594831830.jpg",
        "voice": "Nhưng mọi thứ sắp thay đổi! Hãy thử tưởng tượng, nếu chúng ta có một 'bộ não siêu phàm' có thể dự đoán trước dịch bệnh... trước cả khi nó bùng phát?",
        "sub": "Điều gì xảy ra nếu ta\nDỰ ĐOÁN TRƯỚC dịch bệnh?"
    },
    {
        "img": "doctor_ai_tablet_1790594345930.jpg",
        "voice": "Đó chính là lúc DengueSense xuất hiện! Một siêu nền tảng AI được phát triển bởi nhóm sinh viên tài năng từ Đại học Bách Khoa Hà Nội.",
        "sub": "Giới thiệu DENGUESENSE\nNền tảng AI chống dịch"
    },
    {
        "img": "weather_satellite_1790594848476.jpg",
        "voice": "DengueSense hoạt động như một cỗ máy thời gian với 3 bước. Bước 1: Dự báo sớm. Bằng cách phân tích khối lượng dữ liệu khổng lồ suốt 24 năm cùng dữ liệu thời tiết vệ tinh...",
        "sub": "BƯỚC 1: DỰ BÁO SỚM\nPhân tích 24 năm dữ liệu"
    },
    {
        "img": "futuristic_dashboard_1790594317933.jpg",
        "voice": "...AI của DengueSense có khả năng cảnh báo sớm đỉnh dịch từ 1 đến 6 tháng với độ chính xác lên tới 89,5%!",
        "sub": "Cảnh báo sớm 1-6 tháng\nĐộ chính xác 89,5%!"
    },
    {
        "img": "ai_brain_map_1790594330191.jpg",
        "voice": "Bước 2: Tối ưu nguồn lực. Nó tự động giải bài toán phân bổ hàng ngàn giường bệnh, hóa chất và nhân lực cho 570 quận huyện trên toàn quốc... chỉ trong đúng 1 phút!",
        "sub": "BƯỚC 2: TỐI ƯU NGUỒN LỰC\nPhân bổ toàn quốc trong 1 PHÚT!"
    },
    {
        "img": "ai_writing_1790594869347.jpg",
        "voice": "Bước 3: Điều phối thần tốc. GenAI sẽ lập tức tự động soạn thảo các lệnh điều phối chuẩn của Bộ Y Tế. Các bác sĩ giờ đây chỉ cần một cú click chuột để phê duyệt!",
        "sub": "BƯỚC 3: ĐIỀU PHỐI THẦN TỐC\nTự động soạn thảo văn bản"
    },
    {
        "img": "happy_community_1790594358745.jpg",
        "voice": "Giải pháp này không chỉ giúp giảm 50% thời gian phản ứng, tiết kiệm hàng chục triệu đô la, mà còn giúp giảm đến 20% số ca nhiễm, bảo vệ hàng triệu gia đình.",
        "sub": "Rút ngắn 50% thời gian phản ứng\nBảo vệ hàng triệu gia đình"
    },
    {
        "img": "ai_brain_glowing_1790594831830.jpg",
        "voice": "Với tham vọng vươn tầm Đông Nam Á, DengueSense đang tìm kiếm 100.000 USD vốn hạt giống. DengueSense - từ dữ liệu đến hành động, cứu người sớm hơn một bước!",
        "sub": "DENGUESENSE\nCứu người sớm hơn một bước!"
    }
]

def create_subtitle_image(text, w, h):
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 60)
    except:
        font = ImageFont.load_default()
    
    lines = text.split('\n')
    y_offset = h - 400
    for line in lines:
        bbox = draw.textbbox((0,0), line, font=font)
        x = (w - (bbox[2] - bbox[0])) / 2
        
        # Stroke
        stroke_color = (0,0,0,255)
        for adj in range(-4, 5):
            for adj2 in range(-4, 5):
                draw.text((x+adj, y_offset+adj2), line, font=font, fill=stroke_color)
        
        # Main text
        draw.text((x, y_offset), line, font=font, fill=(255, 235, 59, 255))
        y_offset += font.size + 15
    return np.array(img)

def crop_to_aspect(pil_img, aspect=9/16):
    w, h = pil_img.size
    target_w = int(h * aspect)
    if target_w <= w:
        left = (w - target_w) / 2
        return pil_img.crop((left, 0, left + target_w, h))
    else:
        target_h = int(w / aspect)
        top = (h - target_h) / 2
        return pil_img.crop((0, top, w, top + target_h))

clips = []

for i, scene in enumerate(scenes):
    audio_path = os.path.join(out_dir, f"reel_voice_{i}.mp3")
    tts = gTTS(text=scene["voice"], lang='vi')
    tts.save(audio_path)
    audio_clip = AudioFileClip(audio_path)
    dur = audio_clip.duration + 0.3 # Add slight padding
    
    img_path = os.path.join(artifact_dir, scene["img"])
    if not os.path.exists(img_path):
        # Fallback to black if image missing for some reason
        pil_img = Image.new('RGB', (width, height), (0,0,0))
    else:
        pil_img = Image.open(img_path)
        # Crop to 9:16 and resize to 1080x1920
        pil_img = crop_to_aspect(pil_img, 9/16)
        pil_img = pil_img.resize((width, height), Image.Resampling.LANCZOS)
        
    temp_img_path = os.path.join(out_dir, f"reel_temp_{i}.jpg")
    pil_img.save(temp_img_path)
    
    img_clip = ImageClip(temp_img_path).with_duration(dur)
    
    # Add simple crossfade between scenes
    if i > 0:
        img_clip = img_clip.with_effects([vfx.CrossFadeIn(0.3)])
        
    sub_np = create_subtitle_image(scene["sub"], width, height)
    sub_clip = ImageClip(sub_np).with_duration(dur)
    
    comp = CompositeVideoClip([img_clip, sub_clip])
    comp = comp.with_audio(audio_clip)
    clips.append(comp)

final_video = concatenate_videoclips(clips, method="compose")

print(f"Writing Facebook Reel to {output_path}...")
final_video.write_videofile(output_path, fps=30, codec="libx264", audio_codec="aac")
print(f"Reel saved to: {output_path}")
