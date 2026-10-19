import { describe, expect, it } from "vitest";
import { generateGovernmentSignature, verifyDigitalSignature } from "./digitalSignature";

describe("Government Digital Signature Protocol", () => {
  it("generates authoritative digital signature conforming to Decree 30/2020", () => {
    const sig = generateGovernmentSignature(
      "draft-south-01",
      "TS. BS. Nguyễn Văn A",
      "Trung tâm Kiểm soát Bệnh tật TP.HCM"
    );

    expect(sig.signatureId).toContain("sig-draft-so");
    expect(sig.signerName).toBe("TS. BS. Nguyễn Văn A");
    expect(sig.signatureHash).toMatch(/^SHA256:[a-f0-9]{32}$/);
    expect(sig.certificate.issuerCA).toContain("Ban Cơ yếu Chính phủ");
    expect(sig.complianceStandard).toContain("Nghị định 30/2020/NĐ-CP");
    expect(sig.isValid).toBe(true);
  });

  it("verifies signature integrity and certificates", () => {
    const sig = generateGovernmentSignature("draft-02");
    const check = verifyDigitalSignature(sig);

    expect(check.valid).toBe(true);
    expect(check.message).toContain("Nghị định 30/2020/NĐ-CP");
  });

  it("flags corrupted or tampered signature hashes as invalid", () => {
    const sig = generateGovernmentSignature("draft-03");
    sig.signatureHash = "CORRUPTED";

    const check = verifyDigitalSignature(sig);
    expect(check.valid).toBe(false);
    expect(check.message).toContain("không hợp lệ");
  });
});
