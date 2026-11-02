export interface PrintableDraft {
  id: string;
  title: string;
  content: string;
  version?: number;
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char] ?? char
  );
}

/** Từng dòng nguồn là một đoạn riêng; tuyệt đối không căn đều dòng ngắn trong Word. */
export function renderDispatchBody(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) =>
      line
        .trim()
        .replace(/^#{1,6}\s*/, "")
        .replaceAll("**", "")
    )
    .filter(Boolean)
    .filter(
      (line) =>
        !/^(BẢN MÔ PHỎNG CUỘC THI|CƠ QUAN ĐIỀU PHỐI MÔ PHỎNG|CỘNG HÒA XÃ HỘI|Độc lập - Tự do|Số văn bản:|Công điện điều phối dịch tễ mô phỏng)/i.test(
          line
        )
    )
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("\n");
}

/** Xuất bản xem trước .doc để cán bộ rà soát, không giả lập số văn bản hoặc chữ ký cơ quan. */
export function exportDispatchDoc(draft: PrintableDraft) {
  const today = new Date();
  const day = String(today.getDate()).padStart(2, "0");
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const year = today.getFullYear();

  const formattedContent = renderDispatchBody(draft.content);

  const docHtml = `
<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
<head>
  <meta charset='utf-8'>
  <title>${escapeHtml(draft.title)}</title>
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
      font-size: 13pt;
      line-height: 1.5;
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
    .main-content p {
      margin: 0 0 8pt;
      text-align: left;
      overflow-wrap: break-word;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="width: 45%; text-align: center;">
        <div style="font-size: 12pt; font-weight: bold; text-transform: uppercase;">DengueSense</div>
        <div style="font-size: 10pt;">Bản xem trước phục vụ diễn tập</div>
        <div class="underline-short"></div>
        <div style="font-size: 11pt; margin-top: 4pt;">Số văn bản: <strong>CHƯA CẤP</strong></div>
      </td>
      <td style="width: 55%; text-align: center;">
        <div class="quoc-hieu">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</div>
        <div class="tieu-ngu">Độc lập - Tự do - Hạnh phúc</div>
        <div class="underline-short"></div>
        <div style="font-size: 11pt; font-style: italic; margin-top: 4pt;">Ngày xuất bản xem trước: ${day}/${month}/${year}</div>
      </td>
    </tr>
  </table>

  <div class="doc-title">DỰ THẢO VĂN BẢN ĐIỀU PHỐI</div>
  <div class="doc-subtitle">${escapeHtml(draft.title)}</div>
  <p style="font-size: 10pt; text-align: center;">MÔ PHỎNG CUỘC THI — CHƯA BAN HÀNH, CHƯA KÝ</p>

  <div class="main-content">
    ${formattedContent}
  </div>

  <table class="sign-section">
    <tr>
      <td style="width: 50%; font-size: 11pt;">
        <strong><em>Lưu hồ sơ:</em></strong><br/>
        Mã dự thảo: ${escapeHtml(draft.id)}<br/>
        Phiên bản: ${draft.version ?? 1}
      </td>
      <td style="width: 50%; text-align: center;">
        <div style="font-size: 11pt; font-weight: bold;">CHỜ CÁN BỘ RÀ SOÁT</div>
        <div style="font-size: 10pt;">Không có chữ ký số pháp lý</div>
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
  a.download = `Du_thao_${draft.id}.doc`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
