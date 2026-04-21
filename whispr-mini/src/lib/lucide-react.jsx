/* eslint-disable react-refresh/only-export-components */
import { createElement, forwardRef } from 'react'

const SvgIcon = forwardRef(function SvgIcon(
  { size = 24, strokeWidth = 2, className, children, ...props },
  ref,
) {
  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      {...props}
    >
      {children}
    </svg>
  )
})

function createIcon(displayName, nodes) {
  const Icon = forwardRef(function Icon(props, ref) {
    return (
      <SvgIcon ref={ref} {...props}>
        {nodes.map(([tag, attrs], index) =>
          createElement(tag, {
            ...attrs,
            key: `${displayName}-${index}`,
          }),
        )}
      </SvgIcon>
    )
  })

  Icon.displayName = displayName
  return Icon
}

export const Settings = createIcon('Settings', [
  ['circle', { cx: '12', cy: '12', r: '3' }],
  [
    'path',
    {
      d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82 2 2 0 1 1-2.83 2.83 1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51 2 2 0 1 1-4 0 1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33 2 2 0 1 1-2.83-2.83 1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1 2 2 0 1 1 0-4 1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82 2 2 0 1 1 2.83-2.83 1.65 1.65 0 0 0 1.82.33h.01a1.65 1.65 0 0 0 .99-1.5 2 2 0 1 1 4 0 1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33 2 2 0 1 1 2.83 2.83 1.65 1.65 0 0 0-.33 1.82v.01a1.65 1.65 0 0 0 1.5.99 2 2 0 1 1 0 4 1.65 1.65 0 0 0-1.5 1z',
    },
  ],
])

export const UserCircle2 = createIcon('UserCircle2', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['circle', { cx: '12', cy: '10', r: '3' }],
  ['path', { d: 'M7 18c1.5-2 3-3 5-3s3.5 1 5 3' }],
])

export const Layers = createIcon('Layers', [
  ['path', { d: 'm12 2 10 5-10 5L2 7z' }],
  ['path', { d: 'm2 12 10 5 10-5' }],
  ['path', { d: 'm2 17 10 5 10-5' }],
])

export const Clock3 = createIcon('Clock3', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'M12 6v6h4' }],
])

export const CheckCircle2 = createIcon('CheckCircle2', [
  ['circle', { cx: '12', cy: '12', r: '10' }],
  ['path', { d: 'm9 12 2 2 4-4' }],
])

export const BookOpenText = createIcon('BookOpenText', [
  ['path', { d: 'M2 6.5A2.5 2.5 0 0 1 4.5 4H10a2 2 0 0 1 2 2v14a2 2 0 0 0-2-2H4.5A2.5 2.5 0 0 0 2 20.5z' }],
  ['path', { d: 'M12 8h8v12.5A2.5 2.5 0 0 0 17.5 18H14a2 2 0 0 0-2 2' }],
  ['path', { d: 'M6 9h3' }],
  ['path', { d: 'M6 12h3' }],
])

export const CalendarClock = createIcon('CalendarClock', [
  ['path', { d: 'M8 2v4' }],
  ['path', { d: 'M16 2v4' }],
  ['rect', { x: '3', y: '4', width: '18', height: '16', rx: '2' }],
  ['path', { d: 'M3 10h18' }],
  ['circle', { cx: '17', cy: '16', r: '3' }],
  ['path', { d: 'M17 14.5V16h1' }],
])

export const Sparkles = createIcon('Sparkles', [
  ['path', { d: 'M12 3l1.7 3.8L17.5 8l-3.8 1.2L12 13l-1.7-3.8L6.5 8l3.8-1.2z' }],
  ['path', { d: 'M5 14l1 2.2L8.2 17 6 17.8 5 20l-1-2.2L1.8 17 4 16.2z' }],
  ['path', { d: 'M18 14l.8 1.8L20.6 17l-1.8.6L18 19.4l-.8-1.8-1.8-.6 1.8-.6z' }],
])

export const Archive = createIcon('Archive', [
  ['rect', { x: '3', y: '4', width: '18', height: '5', rx: '1.5' }],
  ['path', { d: 'M4 9h16v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2z' }],
  ['path', { d: 'M10 13h4' }],
])

export const Plus = createIcon('Plus', [
  ['path', { d: 'M12 5v14' }],
  ['path', { d: 'M5 12h14' }],
])

export const Mic = createIcon('Mic', [
  ['rect', { x: '9', y: '3', width: '6', height: '11', rx: '3' }],
  ['path', { d: 'M5 11a7 7 0 0 0 14 0' }],
  ['path', { d: 'M12 18v3' }],
])

export const CalendarDays = createIcon('CalendarDays', [
  ['path', { d: 'M8 2v4' }],
  ['path', { d: 'M16 2v4' }],
  ['rect', { x: '3', y: '4', width: '18', height: '18', rx: '2' }],
  ['path', { d: 'M3 10h18' }],
  ['path', { d: 'M8 14h.01' }],
  ['path', { d: 'M12 14h.01' }],
  ['path', { d: 'M16 14h.01' }],
  ['path', { d: 'M8 18h.01' }],
  ['path', { d: 'M12 18h.01' }],
  ['path', { d: 'M16 18h.01' }],
])

export const ArrowLeft = createIcon('ArrowLeft', [
  ['path', { d: 'm12 19-7-7 7-7' }],
  ['path', { d: 'M19 12H5' }],
])

export const Pencil = createIcon('Pencil', [
  ['path', { d: 'M12 20h9' }],
  ['path', { d: 'm16.5 3.5 4 4L8 20l-4 1 1-4z' }],
])

export const Trash2 = createIcon('Trash2', [
  ['path', { d: 'M3 6h18' }],
  ['path', { d: 'M8 6V4h8v2' }],
  ['path', { d: 'm6 6 1 14h10l1-14' }],
  ['path', { d: 'M10 11v6' }],
  ['path', { d: 'M14 11v6' }],
])
