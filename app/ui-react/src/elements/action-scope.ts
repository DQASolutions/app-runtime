import { createContext, useContext } from 'react'

/**
 * Đang đứng trong một `<ActionBar>` không — `Button` hỏi điều này trước khi
 * chịu tô mình thành việc chính (`tier="key"`).
 *
 * ⚠️ Tệp riêng, vì `ActionBar` vẽ `Button` còn `Button` đọc cờ của `ActionBar`:
 *    để hai bên cùng nhập một tệp thứ ba thì không vòng nào khép lại.
 */
export const InActionBar = createContext(false)
export const useInActionBar = (): boolean => useContext(InActionBar)
