import { createContext, useContext } from 'react'

/**
 * Đang đứng trong một `<Dialog>` không — và đường đóng DUY NHẤT của nó.
 *
 * `DialogHead` đọc `requestClose` để cái ✕ ở góc đi qua khoá "đang gõ dở"
 * như Esc và bấm ra nền. `ActionBar` đọc cờ này để từ chối lối ra ở chân hộp
 * thoại: lối ra của hộp thoại là cái ✕ ở đầu (27/9/2026, xem `dialog.tsx`).
 *
 * ⚠️ Tệp riêng, cùng lý do với `action-scope.ts`: `Dialog`, `DialogHead` và
 *    `ActionBar` cùng nhập một tệp thứ ba thì không vòng nào khép lại.
 */
export interface DialogScope { requestClose: () => void }
export const InDialog = createContext<DialogScope | null>(null)
export const useInDialog = (): DialogScope | null => useContext(InDialog)
