'use client'

import { EditorContent, useEditor, useEditorState } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import StarterKit from '@tiptap/starter-kit'
import { normalizeEditorHtml, toEditorHtml } from '../../utils/docContent'

type DocRichEditorProps = {
  content: string
  onChange: (html: string) => void
  placeholder?: string
}

type ToolbarBtnProps = {
  label: string
  title: string
  active?: boolean
  disabled?: boolean
  onClick: () => void
}

function ToolbarBtn({ label, title, active, disabled, onClick }: ToolbarBtnProps) {
  return (
    <button
      type="button"
      className={`doc-format-btn${active ? ' active' : ''}`}
      title={title}
      aria-label={title}
      aria-pressed={active}
      disabled={disabled}
      onMouseDown={(e) => {
        // Keep selection in the editor
        e.preventDefault()
        onClick()
      }}
    >
      {label}
    </button>
  )
}

function ToolbarDivider() {
  return <span className="doc-format-divider" aria-hidden="true" />
}

const emptyToolbar = {
  h1: false,
  h2: false,
  h3: false,
  bold: false,
  italic: false,
  strike: false,
  bullet: false,
  ordered: false,
  quote: false,
  code: false,
}

export function DocRichEditor({ content, onChange, placeholder }: DocRichEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Placeholder.configure({
        placeholder: placeholder ?? 'Write…',
      }),
    ],
    content: toEditorHtml(content),
    immediatelyRender: false,
    editorProps: {
      attributes: {
        class: 'company-docs-prose',
        'aria-label': 'Document body',
      },
    },
    onUpdate: ({ editor: ed }) => {
      onChange(normalizeEditorHtml(ed.getHTML()))
    },
  })

  const toolbar =
    useEditorState({
      editor,
      selector: ({ editor: ed }) => {
        if (!ed) return emptyToolbar
        return {
          h1: ed.isActive('heading', { level: 1 }),
          h2: ed.isActive('heading', { level: 2 }),
          h3: ed.isActive('heading', { level: 3 }),
          bold: ed.isActive('bold'),
          italic: ed.isActive('italic'),
          strike: ed.isActive('strike'),
          bullet: ed.isActive('bulletList'),
          ordered: ed.isActive('orderedList'),
          quote: ed.isActive('blockquote'),
          code: ed.isActive('code'),
        }
      },
    }) ?? emptyToolbar

  if (!editor) {
    return <div className="company-docs-body-skeleton" aria-hidden="true" />
  }

  return (
    <div className="company-docs-rich">
      <div className="doc-format-toolbar" role="toolbar" aria-label="Text formatting">
        <ToolbarBtn
          label="H1"
          title="Heading 1"
          active={toolbar.h1}
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
        />
        <ToolbarBtn
          label="H2"
          title="Heading 2"
          active={toolbar.h2}
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
        />
        <ToolbarBtn
          label="H3"
          title="Heading 3"
          active={toolbar.h3}
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
        />
        <ToolbarDivider />
        <ToolbarBtn
          label="B"
          title="Bold"
          active={toolbar.bold}
          onClick={() => editor.chain().focus().toggleBold().run()}
        />
        <ToolbarBtn
          label="I"
          title="Italic"
          active={toolbar.italic}
          onClick={() => editor.chain().focus().toggleItalic().run()}
        />
        <ToolbarBtn
          label="S"
          title="Strikethrough"
          active={toolbar.strike}
          onClick={() => editor.chain().focus().toggleStrike().run()}
        />
        <ToolbarBtn
          label="<>"
          title="Inline code"
          active={toolbar.code}
          onClick={() => editor.chain().focus().toggleCode().run()}
        />
        <ToolbarDivider />
        <ToolbarBtn
          label="• List"
          title="Bullet list"
          active={toolbar.bullet}
          onClick={() => editor.chain().focus().toggleBulletList().run()}
        />
        <ToolbarBtn
          label="1. List"
          title="Numbered list"
          active={toolbar.ordered}
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
        />
        <ToolbarBtn
          label="Quote"
          title="Block quote"
          active={toolbar.quote}
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
        />
        <ToolbarDivider />
        <ToolbarBtn
          label="—"
          title="Horizontal rule"
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
        />
      </div>
      <EditorContent editor={editor} className="company-docs-editor-surface" />
    </div>
  )
}
