import type { ButtonHTMLAttributes, ElementType, ReactNode } from 'react'
import { createElement } from 'react'
import type { ActionTier } from '@dqa-ai-solutions/ui-kit/primitives'
import { cls, cx } from '../prefix/index.js'

interface BaseButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  /**
   * Bậc — bốn cái, và chúng nói VIỆC NÀY QUAN TRỌNG ĐẾN ĐÂU, không nói màu.
   * Mặc định `normal`: một nút không khai bậc là một nút chưa ai quyết.
   */
  tier?: ActionTier
  /**
   * ⛔ `submit` phải NÓI RA. Xem ① ở trên.
   */
  type?: 'button' | 'submit' | 'reset'
  /** Hình đứng trước chữ. Nhân không vẽ hình — bên gọi đưa vào. */
  icon?: ReactNode
  /**
   * Đang gửi.
   *
   * ⚠️ Khoá nút VÀ nói ra bằng `aria-busy` — khoá không thôi thì trình đọc màn
   *    hình chỉ nghe "nút, không khả dụng", không biết vì sao và không biết
   *    bao giờ xong.
   */
  busy?: boolean
  /** Thẻ khác — `Link` của bộ định tuyến cho một nút DẪN ĐI ĐÂU ĐÓ. */
  as?: ElementType
  className?: string
  [key: string]: unknown
}

/** Nút có chữ. */
export interface ButtonProps extends BaseButtonProps {
  children: ReactNode
  label?: never
}

/**
 * Nút CHỈ CÓ HÌNH — và `label` là bắt buộc, không phải khuyến nghị.
 */
export interface IconButtonProps extends BaseButtonProps {
  children?: never
  icon: ReactNode
  label: string
}

type AnyButtonProps = BaseButtonProps & { children?: ReactNode; label?: string; icon?: ReactNode }

export function Button(p: ButtonProps | IconButtonProps) {
  const {
    tier = 'normal', type = 'button', icon, busy, as, className, children, label, ...rest
  } = p as AnyButtonProps

  const iconOnly = children == null

  const cn = cx(
    cls('btn'), cls(`btn--${tier}`), iconOnly && cls('btn--icon'), className,
  )
  const shared = {
    ...rest,
    className: cn,
    /*
     * ⛔ `title` CỦA BÊN GỌI THẮNG — sửa 6/9/2026, ba phép thử của một app bắt được.
     *
     *   `label` là cái TÊN của nút; `title` là LỜI GIẢI THÍCH khi rê chuột. Bản
     *   trước đổ cả hai từ `label`, và vì nó nằm SAU `...rest` nên nó lặng lẽ
     *   xoá mất `title` bên gọi đã truyền.
     *
     *   Đo được ở app tham chiếu: một nút mờ mang
     *   `title="Bóc chỉ tiêu — việc của Trưởng phòng, tài khoản đang dùng không làm được"`.
     *   Đổi nút ấy sang dạng chỉ-hình thì lời ấy biến mất, và trên màn còn lại
     *   đúng hai chữ tên nút — cán bộ hết đường biết VÌ SAO nó mờ.
     *
     * ⭐ Nên `label` chỉ ĐỠ cho `title` khi bên gọi không nói gì. Một cái tên
     *   luôn tốt hơn không có tooltip; nhưng nó không được thay lời giải thích.
     */
    ...(label ? { 'aria-label': label, title: rest.title ?? label } : {}),
    ...(busy ? { 'aria-busy': true as const, disabled: true } : {}),
    children: <>{icon}{children}</>,
  }
  /* ⚠️ `type` chỉ đặt cho NÚT. Trên `<a>` thuộc tính `type` nói về kiểu MIME
     của đích đến — sai hẳn nghĩa. */
  return as
    ? createElement(as, shared)
    : createElement('button', { ...shared, type })
}
