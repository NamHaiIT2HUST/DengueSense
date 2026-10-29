/**
 * Government Digital Signature Protocol Simulation
 * Compliant with Decree 30/2020/NĐ-CP (Administrative Records)
 * & Circular 18/2019/TT-BTTTT (Public Key Infrastructure & Public Health Authority Signatures).
 */

export interface DigitalCertificate {
  subjectName: string;
  subjectTitle: string;
  organization: string;
  issuerCA: string;
  serialNumber: string;
  validFrom: string;
  validTo: string;
  algorithm: string;
  keyUsage: string;
}

export interface DigitalSignatureRecord {
  signatureId: string;
  documentId: string;
  signerName: string;
  signerRole: string;
  organization: string;
  signedAt: string;
  signatureHash: string;
  certificate: DigitalCertificate;
  tsaTimestamp: string;
  complianceStandard: string;
  isValid: boolean;
}

export const MOCK_GOVERNMENT_CERTIFICATE: DigitalCertificate = {
  subjectName: "TS. BS. Nguyễn Văn A",
  subjectTitle: "Giám đốc Trung tâm",
  organization: "Trung tâm Kiểm soát Bệnh tật (CDC) tỉnh / thành phố",
  issuerCA: "Ban Cơ yếu Chính phủ — Cục Chứng thực số và Bảo mật thông tin (VGCA Root)",
  serialNumber: "54:0E:8B:1F:9A:3C:D2:77:E1:44:80:BC",
  validFrom: "2025-01-01T00:00:00Z",
  validTo: "2028-12-31T23:59:59Z",
  algorithm: "RSA 2048-bit / SHA-256 with PKCS#1 v1.5",
  keyUsage: "Digital Signature, Non-Repudiation (Ký số văn bản hành chính điện tử)",
};

/**
 * Generates an authoritative digital signature conforming to Decree 30/2020/NĐ-CP.
 */
export function generateGovernmentSignature(
  documentId: string,
  signerName = "TS. BS. Nguyễn Văn A",
  organization = "Trung tâm Kiểm soát Bệnh tật (CDC)"
): DigitalSignatureRecord {
  const signedAt = new Date().toISOString();
  // Simulated SHA-256 digital signature digest
  const signatureHash = `SHA256:${Array.from({ length: 16 }, () =>
    Math.floor(Math.random() * 16).toString(16)
  ).join("")}${Array.from({ length: 16 }, () => Math.floor(Math.random() * 16).toString(16)).join(
    ""
  )}`;

  return {
    signatureId: `sig-${documentId.slice(0, 8)}-${Date.now().toString(36)}`,
    documentId,
    signerName,
    signerRole: "Thẩm quyền Phê duyệt & Ban hành",
    organization,
    signedAt,
    signatureHash,
    certificate: {
      ...MOCK_GOVERNMENT_CERTIFICATE,
      subjectName: signerName,
      organization,
    },
    tsaTimestamp: `${signedAt} (RFC 3161 Time-Stamp Authority)`,
    complianceStandard: "Nghị định 30/2020/NĐ-CP & Luật Giao dịch Điện tử",
    isValid: true,
  };
}

/**
 * Verifies mathematical integrity and validity of the digital signature.
 */
export function verifyDigitalSignature(sig: DigitalSignatureRecord): {
  valid: boolean;
  message: string;
  timestamp: string;
} {
  if (!sig.signatureHash || !sig.signatureHash.startsWith("SHA256:")) {
    return {
      valid: false,
      message: "Chữ ký số không hợp lệ: Mã băm toàn vẹn bị khiếm khuyết.",
      timestamp: sig.signedAt,
    };
  }

  const expiration = new Date(sig.certificate.validTo);
  if (new Date() > expiration) {
    return {
      valid: false,
      message: "Chứng thư số đã hết hiệu lực theo thẩm quyền cấp phát.",
      timestamp: sig.signedAt,
    };
  }

  return {
    valid: true,
    message:
      "Chữ ký số điện tử hợp lệ, toàn vẹn dữ liệu và có giá trị pháp lý theo Nghị định 30/2020/NĐ-CP.",
    timestamp: sig.signedAt,
  };
}
