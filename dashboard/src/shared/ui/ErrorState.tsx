import { toUserFacing } from "@/shared/api";
import { vi } from "@/shared/i18n/vi";

import { Alert } from "./Alert";
import { Button } from "./Button";

/**
 * Khối lỗi chuẩn: thông điệp tiếng Việt theo mã lỗi, mã yêu cầu để báo lại, nút thử lại (docs/10 §7.3, §13).
 * Lỗi của MỘT khối không làm sập cả trang.
 */
export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const info = toUserFacing(error);
  return (
    <Alert tone="error">
      <p>{info.message}</p>
      {info.requestId ? (
        <p className="mt-1 text-xs opacity-80">
          {vi.common.requestId}: <code>{info.requestId}</code>
        </p>
      ) : null}
      {onRetry && info.action === "retry" ? (
        <Button variant="secondary" className="mt-3" onClick={onRetry}>
          {vi.common.retry}
        </Button>
      ) : null}
    </Alert>
  );
}
