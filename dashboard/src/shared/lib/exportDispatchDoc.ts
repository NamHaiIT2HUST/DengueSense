export interface PrintableDraft {
  id: string;
  title: string;
  content: string;
  version?: number;
}

/**
 * Xuất dự thảo công điện B2G thành tệp tài liệu Microsoft Word (.doc)
 * Tuân thủ chuẩn thể thức kỹ thuật soạn thảo văn bản hành chính theo Nghị định 30/2020/NĐ-CP.
 */
export function exportDispatchDoc(
  draft: PrintableDraft,
  options?: { signerTitle?: string; signerName?: string; provinceName?: string }
) {
  const signerTitle = options?.signerTitle ?? "KT. CỤC TRƯỞNG\nPHÓ CỤC TRƯỞNG";
  const signerName = options?.signerName ?? "Lãnh đạo phê duyệt";
  const provinceName = options?.provinceName ?? "Hà Nội";
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  const formattedContent = draft.content
    .split("\n\n")
    .map(
      (p: string) =>
        `<p style="margin: 6pt 0; text-indent: 1.27cm; line-height: 1.5; text-align: justify;">${p.replace(/\n/g, "<br/>")}</p>`
    )
    .join("");

  const docHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${draft.title}</title>
  <!--[if gte mso 9]>
  <xml>
    <w:WordDocument>
      <w:View>Print</w:View>
      <w:Zoom>100</w:Zoom>
      <w:DoNotOptimizeForBrowser/>
    </w:WordDocument>
  </xml>
  <![endif]-->
  <style>
    @page {
      size: A4 portrait;
      margin: 2.0cm 2.0cm 2.0cm 2.5cm;
    }
    body {
      font-family: 'Times New Roman', Times, serif;
      font-size: 14pt;
      line-height: 1.4;
      color: #000000;
    }
    table.header-table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18pt;
    }
    table.header-table td {
      vertical-align: top;
      padding: 0;
    }
    .quoc-hieu {
      font-weight: bold;
      font-size: 13pt;
      text-transform: uppercase;
      text-align: center;
    }
    .tieu-ngu {
      font-weight: bold;
      font-size: 14pt;
      text-align: center;
    }
    .underline-short {
      width: 40%;
      height: 1px;
      background: #000;
      margin: 3pt auto 6pt auto;
    }
    .doc-title {
      font-size: 15pt;
      font-weight: bold;
      text-transform: uppercase;
      text-align: center;
      margin: 18pt 0 6pt 0;
    }
    .doc-subtitle {
      font-size: 13pt;
      font-style: italic;
      text-align: center;
      margin-bottom: 18pt;
    }
    .sign-section {
      width: 100%;
      margin-top: 24pt;
    }
    .sign-section td {
      vertical-align: top;
    }
    .digital-seal {
      display: inline-block;
      border: 1px solid #16a34a;
      background: #f0fdf4;
      color: #15803d;
      padding: 4pt 8pt;
      font-size: 10pt;
      font-family: Arial, sans-serif;
      margin-top: 8pt;
      border-radius: 4pt;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 45%; text-align: center;">
        <div style="font-size: 12pt; text-transform: uppercase;">BỘ Y TẾ</div>
        <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase;">CỤC Y TẾ DỰ PHÒNG</div>
        <div class="underline-short"></div>
        <div style="font-size: 12pt; margin-top: 4pt;">Số: <strong>${draft.id.toUpperCase()}/CĐ-YTDP</strong></div>
      </td>
      <td style="width: 55%; text-align: center;">
        <div class="quoc-hieu">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="tieu-ngu">Độc lập - Tự do - Hạnh phúc</div>
        <div class="underline-short"></div>
        <div style="font-size: 13pt; font-style: italic; margin-top: 4pt;">${provinceName}, ngày ${day} tháng ${month} năm ${year}</div>
      </td>
    </tr>
  </table>

  <div class="doc-title">CÔNG ĐIỆN KHẨN CẤP</div>
  <div class="doc-subtitle">V/v: ${draft.title}</div>

  <div style="margin-bottom: 12pt;">
    <strong>Kính gửi:</strong>
    <ul style="margin: 4pt 0 12pt 24pt; padding: 0;">
      <li>Ủy ban nhân dân các tỉnh, thành phố trực thuộc Trung ương;</li>
      <li>Sở Y tế, Trung tâm Kiểm soát bệnh tật (CDC) các tỉnh trọng điểm;</li>
      <li>Các Viện Vệ sinh Dịch tễ, Viện Pasteur phụ trách khu vực.</li>
    </ul>
  </div>

  <div class="main-content">
    ${formattedContent}
  </div>

  <table class="sign-section">
    <tr>
      <td style="width: 50%; font-size: 11pt;">
        <strong><em>Nơi nhận:</em></strong><br/>
        - Như trên;<br/>
        - Bộ trưởng Bộ Y tế (để b/c);<br/>
        - Cục Quản lý Khám, chữa bệnh;<br/>
        - Lưu: VT, YTDP (v${draft.version}).
      </td>
      <td style="width: 50%; text-align: center;">
        <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase;">
          ${signerTitle.replace(/\n/g, "<br/>")}
        </div>
        <div style="height: 40pt;"></div>
        <div class="digital-seal">
          ✔ KÝ SỐ BỞI: CỤC Y TẾ DỰ PHÒNG - BỘ Y TẾ<br/>
          Thời gian ký: ${day}/${month}/${year} ${today.toLocaleTimeString("vi-VN")}<br/>
          Chứng thư số: Ban Cơ yếu Chính phủ / VNPT-CA
        </div>
        <div style="margin-top: 8pt; font-weight: bold; font-size: 13pt;">
          ${signerName}
        </div>
      </td>
    </tr>
  </table>
</body>
</html>
  `;

  const blob = new Blob([docHtml], { type: "application/msword;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Cong_dien_${draft.id}_Nghi_dinh_30.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
