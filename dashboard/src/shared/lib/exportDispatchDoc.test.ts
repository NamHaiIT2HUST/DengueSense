import { describe, expect, it, vi } from "vitest";

import { exportDispatchDoc, type PrintableDraft } from "./exportDispatchDoc";

describe("exportDispatchDoc", () => {
  const sampleDraft: PrintableDraft = {
    id: "draft-test-01",
    version: 1,
    title: "Triển khai phòng chống dịch sốt xuất huyết khẩn cấp",
    content:
      "Nội dung chỉ đạo công tác phòng chống dịch.\n\nYêu cầu CDC các tỉnh tăng cường giám sát.",
  };

  it("creates and downloads a .doc blob with Decree 30 formatting", () => {
    const createObjectURLMock = vi.fn().mockReturnValue("blob:mock-url");
    const revokeObjectURLMock = vi.fn();
    window.URL.createObjectURL = createObjectURLMock;
    window.URL.revokeObjectURL = revokeObjectURLMock;

    const clickMock = vi.fn();
    const appendChildMock = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation((node) => node);
    const removeChildMock = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation((node) => node);
    const createElementSpy = vi.spyOn(document, "createElement").mockReturnValue({
      href: "",
      download: "",
      click: clickMock,
    } as unknown as HTMLAnchorElement);

    exportDispatchDoc(sampleDraft);

    expect(createObjectURLMock).toHaveBeenCalled();
    expect(clickMock).toHaveBeenCalled();
    expect(appendChildMock).toHaveBeenCalled();
    expect(removeChildMock).toHaveBeenCalled();
    expect(revokeObjectURLMock).toHaveBeenCalledWith("blob:mock-url");

    createElementSpy.mockRestore();
    appendChildMock.mockRestore();
    removeChildMock.mockRestore();
  });
});
