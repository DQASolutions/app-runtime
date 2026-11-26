// @dqa-ai-solutions/ui-react — the React half of a screen.
//
// ═══════════════════════════════════════════════════════════════════════════
// ⭐ THE SPLIT, AND WHY IT IS TWO PACKAGES AND NOT ONE
//
//   `@dqa-ai-solutions/ui-kit` declares itself "the renderer-agnostic half of a screen …
//   owns no pixels and no framework", and its `dependencies` are empty on
//   purpose: two of its consumers are not React. Putting a component in there
//   would tie them to React to get a colour ramp.
//
//   So the decisions stay there, and the drawing lives here.
//
// ⛔ WHAT THIS PACKAGE IS NOT ALLOWED TO DECIDE
//
//   Not a size, not a colour, not a weight, not which button is the important
//   one. Every one of those is a lookup in the kit. If a value appears in this
//   package that is not a class name or an ARIA attribute, it is in the wrong
//   package.
//
//   And nothing here may render a business WORD — a label, a value, an empty
//   sentence, a legal basis, a role name. That boundary is the kit's, recorded
//   in `CaseConductor`: grouping and wording belong to the domain.
// ═══════════════════════════════════════════════════════════════════════════

export { setPrefix, prefix, cls, cx, type Prefix } from './prefix/index.js'
export { Link, type LinkProps } from './elements/link.js'
export {
  Field, Select, Textarea,
  type FieldProps, type SelectProps, type TextareaProps,
} from './elements/field.js'
export {
  fieldAttributes, acceptItems, ACCEPT_ITEM,
  type DeclaredConstraints, type FieldAttributes,
} from './elements/field-attributes.js'
export { FileField, fileSize, fileRefusal, type FileFieldProps, type FileRefusal } from './elements/file.js'
export { Check, Radio, type ChoiceProps } from './elements/choice.js'
export { Disclosure, type DisclosureProps } from './elements/disclosure.js'
export {
  Notice, Empty, Skeleton, Icon, SrOnly,
  type Tone, type NoticeProps, type EmptyProps, type SkeletonProps, type IconProps,
} from './elements/surface.js'
export { Dialog, DialogHead, DialogBody, type DialogProps, type DialogHeadProps } from './elements/dialog.js'
// Lời báo ở góc phải dưới — kết quả của việc vừa làm; lỗi ở lại tới khi người dùng đóng.
export { Suggest } from './elements/suggest.js'
export type { SuggestProps } from './elements/suggest.js'
export { Toaster, toast, dismissToast, dismissAllToasts, type ToasterProps, type ToastOptions, type ToastTone } from './elements/toast.js'
export {
  Menu, MenuItem, MenuSeparator, type MenuProps, type MenuItemProps,
} from './elements/menu.js'
export { ActionBar, type ActionBarProps, type ActionItem } from './elements/action-bar.js'
export {
  Segmented, SegmentedItem, type SegmentedProps, type SegmentedItemProps,
} from './elements/segmented.js'
export { FilterSelect, type FilterSelectProps, type FilterOption } from './elements/filter.js'
export {
  ColumnPicker, useColumnVisibility, type ColumnPickerProps, type ColumnPickerChoice,
} from './elements/columns.js'
export { Tabs, Tab, RailItem, type TabsProps, type TabProps, type RailItemProps } from './elements/nav.js'
export {
  Table, THead, TBody, Tr, Th, Td, RowHeader, Pick, TreeToggle,
  type TableProps, type TrProps, type ThProps, type TdProps,
  type PickProps, type TreeToggleProps,
} from './elements/table.js'
export { Button, type ButtonProps, type IconButtonProps } from './elements/button.js'
export {
  Card, CardHead, CardBody, Facts, Fact, Badge, Legend, Count, Tag, Meter, Avatar, Provenance,
  type CardProps, type FactsProps, type FactProps, type BadgeProps,
  type MeterProps, type AvatarProps,
} from './elements/record.js'
export {
  Milestones, Milestone, MilestonesFoot, MilestoneNote,
  type MilestonesProps, type MilestoneProps, type MilestoneNoteProps,
  type Standing, type Settlement,
} from './elements/milestone.js'
