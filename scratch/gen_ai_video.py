import os
import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from gtts import gTTS
from moviepy import ImageClip, AudioFileClip, concatenate_videoclips, vfx
from moviepy.video.VideoClip import TextClip
from moviepy.video.compositing.CompositeVideoClip import CompositeVideoClip

out_dir = os.path.join("scratch", "ai_video_assets")
os.makedirs(out_dir, exist_ok=True)
output_path = os.path.join(os.path.expanduser("~"), "Downloads", "DengueSense_GenAI_Trailer.mp4")

# Paths to the AI generated images
artifact_dir = r"C:\Users\Nguyen Dao Nam Hai\.gemini\antigravity\brain\4559155c-9724-4e30-9da3-c4869b4fa424"
images = [
    "mosquito_dengue_1790594205089.jpg",
    "crowded_hospital_1790594218257.jpg",
    "futuristic_dashboard_1790594317933.jpg",
    "ai_brain_map_1790594330191.jpg",
    "doctor_ai_tablet_1790594345930.jpg",
    "happy_community_1790594358745.jpg"
]

scenes = [
    {
        "img": images[0],
        "voice": "Bạn có biết, năm 2023, Việt Nam đã có hơn 172.000 người mắc sốt xuất huyết...",
        "subtitle": "Bạn có biết, năm 2023\nViệt Nam có >172.000 ca sốt xuất huyết..."
    },
    {
        "img": images[1],
        "voice": "...và các bệnh viện luôn trong tình trạng quá tải? Căn bệnh này tàn phá sức khỏe và cướp đi sinh mạng một cách bất ngờ.",
        "subtitle": "...các bệnh viện luôn trong tình trạng quá tải?\nCăn bệnh cướp đi sinh mạng bất ngờ."
    },
    {
        "img": images[2],
        "voice": "Nhưng hãy tưởng tượng, nếu chúng ta có thể dự đoán trước dịch bệnh... trước khi nó xảy ra? Giới thiệu DengueSense - nền tảng AI dự báo và điều phối y tế.",
        "subtitle": "Hãy tưởng tượng, nếu ta có thể DỰ ĐOÁN TRƯỚC?\nGiới thiệu: DENGUESENSE"
    },
    {
        "img": images[3],
        "voice": "Bằng cách phân tích hàng chục năm dữ liệu dịch tễ, AI của DengueSense có thể cảnh báo sớm đỉnh dịch từ 1 đến 6 tháng.",
        "subtitle": "AI phân tích hàng chục năm dữ liệu.\nCảnh báo sớm đỉnh dịch 1 - 6 tháng."
    },
    {
        "img": images[4],
        "voice": "Không chỉ dự báo, hệ thống còn tự động tính toán phân bổ giường bệnh, vật tư y tế trong nháy mắt. Giúp các bác sĩ chủ động cứu người.",
        "subtitle": "Tự động phân bổ giường bệnh, vật tư.\nGiúp bác sĩ chủ động cứu người!"
    },
    {
        "img": images[5],
        "voice": "DengueSense - công nghệ từ Đại học Bách Khoa Hà Nội, biến dữ liệu thành hành động, bảo vệ sức khỏe cộng đồng!",
        "subtitle": "DENGUESENSE - Bách Khoa Hà Nội\nBiến dữ liệu thành hành động!"
    }
]

# Create clips
clips = []

def create_subtitle_image(text, w, h):
    # Create transparent image with subtitle text
    img = Image.new('RGBA', (w, h), (0,0,0,0))
    draw = ImageDraw.Draw(img)
    try:
        font = ImageFont.truetype("C:\\Windows\\Fonts\\arialbd.ttf", 55)
    except:
        font = ImageFont.load_default()
    
    # Text with outline
    lines = text.split('\n')
    y_offset = h - 200
    for line in lines:
        bbox = draw.textbbox((0,0), line, font=font)
        x = (w - (bbox[2] - bbox[0])) / 2
        
        # Draw outline (stroke)
        stroke_color = (0,0,0,255)
        for adj in range(-3, 4):
            for adj2 in range(-3, 4):
                draw.text((x+adj, y_offset+adj2), line, font=font, fill=stroke_color)
        
        # Draw text
        draw.text((x, y_offset), line, font=font, fill=(255, 235, 59, 255)) # Yellow text
        y_offset += font.size + 10
    
    return np.array(img)

for i, scene in enumerate(scenes):
    # 1. Generate Voice
    audio_path = os.path.join(out_dir, f"voice_{i}.mp3")
    tts = gTTS(text=scene["voice"], lang='vi')
    tts.save(audio_path)
    audio_clip = AudioFileClip(audio_path)
    
    dur = audio_clip.duration + 0.5 # Add padding
    
    # 2. Image Clip with Zoom effect (Ken Burns)
    img_path = os.path.join(artifact_dir, scene["img"])
    if not os.path.exists(img_path):
        print(f"Error: {img_path} not found!")
        continue
    
    # Load and resize image to fit 1280x720 precisely to avoid ratio issues
    pil_img = Image.open(img_path).resize((1280, 720), Image.Resampling.LANCZOS)
    temp_img_path = os.path.join(out_dir, f"temp_{i}.jpg")
    pil_img.save(temp_img_path)
    
    img_clip = ImageClip(temp_img_path).with_duration(dur)
    
    # Zoom effect: scale from 1.0 to 1.15 over the duration
    # Since moviepy 2.x, resize can take a function
    # Wait, simple resize animation can be tricky in moviepy. We'll skip complex zoom to ensure stability,
    # or just use standard ImageClip since the AI images are already very cinematic.
    # We will use crossfadein instead.
    if i > 0:
        img_clip = img_clip.with_effects([vfx.CrossFadeIn(0.5)])
    
    # 3. Add Subtitles (Review Phim style)
    sub_np = create_subtitle_image(scene["subtitle"], 1280, 720)
    sub_clip = ImageClip(sub_np).with_duration(dur)
    
    # Composite
    comp = CompositeVideoClip([img_clip, sub_clip])
    comp = comp.with_audio(audio_clip)
    
    clips.append(comp)

# Assemble
final_video = concatenate_videoclips(clips, method="compose")

# Write to file
print(f"Writing video to {output_path}...")
final_video.write_videofile(output_path, fps=24, codec="libx264", audio_codec="aac")
print(f"GenAI Trailer saved to: {output_path}")
