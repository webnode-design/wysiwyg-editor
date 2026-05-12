import React, { useRef, useCallback, useState, useEffect } from 'react';
import './RichTextEditor.css';

// ── Types ────────────────────────────────────────────────────────────────────

type HeadingLevel = 'p' | 'h1' | 'h2' | 'h3' | 'h4';
type Alignment = 'left' | 'center' | 'right';

interface RichTextEditorProps {
  defaultValue?: string;
  placeholder?: string;
  onChange?: (html: string) => void;
  minHeight?: number;
}

// ── Icon (Lucide via CDN — same pattern as Webnode icon system) ───────────────

declare global {
  interface Window {
    lucide?: { createIcons: () => void };
  }
}

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  return (
    <i
      data-lucide={name}
      style={{ width: size, height: size, display: 'inline-flex', flexShrink: 0 }}
    />
  );
}

// ── Toolbar button ────────────────────────────────────────────────────────────

interface ToolbarButtonProps {
  title: string;
  active?: boolean;
  disabled?: boolean;
  onMouseDown: (e: React.MouseEvent) => void;
  children: React.ReactNode;
}

function ToolbarButton({ title, active, disabled, onMouseDown, children }: ToolbarButtonProps) {
  return (
    <button
      type="button"
      className={`rte-toolbar-btn${active ? ' rte-toolbar-btn--active' : ''}`}
      title={title}
      disabled={disabled}
      onMouseDown={onMouseDown}
      aria-pressed={active}
    >
      {children}
    </button>
  );
}

// ── Divider ───────────────────────────────────────────────────────────────────

function ToolbarDivider() {
  return <span className="rte-toolbar-divider" aria-hidden />;
}

// ── Main component ────────────────────────────────────────────────────────────

export function RichTextEditor({
  defaultValue = '',
  placeholder = 'Začněte psát...',
  onChange,
  minHeight = 240,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [activeFormats, setActiveFormats] = useState<Set<string>>(new Set());
  const [heading, setHeading] = useState<HeadingLevel>('p');
  const [alignment, setAlignment] = useState<Alignment>('left');
  const [wordCount, setWordCount] = useState(0);
  const [charCount, setCharCount] = useState(0);
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const savedSelection = useRef<Range | null>(null);

  // Initialise Lucide icons after mount
  useEffect(() => {
    if (window.lucide) window.lucide.createIcons();
  });

  // Seed with defaultValue
  useEffect(() => {
    if (editorRef.current && defaultValue) {
      editorRef.current.innerHTML = defaultValue;
      updateCounts();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Helpers ─────────────────────────────────────────────────────────────────

  const exec = useCallback((command: string, value?: string) => {
    document.execCommand(command, false, value ?? undefined);
    editorRef.current?.focus();
  }, []);

  function saveSelection() {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) savedSelection.current = sel.getRangeAt(0).cloneRange();
  }

  function restoreSelection() {
    if (!savedSelection.current) return;
    const sel = window.getSelection();
    if (!sel) return;
    sel.removeAllRanges();
    sel.addRange(savedSelection.current);
  }

  function updateCounts() {
    const text = editorRef.current?.innerText ?? '';
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    setCharCount(text.length);
    setWordCount(words);
  }

  function updateFormatState() {
    const formats = new Set<string>();
    if (document.queryCommandState('bold')) formats.add('bold');
    if (document.queryCommandState('italic')) formats.add('italic');
    if (document.queryCommandState('underline')) formats.add('underline');
    if (document.queryCommandState('strikeThrough')) formats.add('strike');
    if (document.queryCommandState('insertOrderedList')) formats.add('ol');
    if (document.queryCommandState('insertUnorderedList')) formats.add('ul');
    setActiveFormats(formats);

    // Detect heading / block format
    const block = document.queryCommandValue('formatBlock').toLowerCase();
    if (['h1', 'h2', 'h3', 'h4'].includes(block)) setHeading(block as HeadingLevel);
    else setHeading('p');

    // Detect alignment
    if (document.queryCommandState('justifyCenter')) setAlignment('center');
    else if (document.queryCommandState('justifyRight')) setAlignment('right');
    else setAlignment('left');
  }

  // ── Event handlers ───────────────────────────────────────────────────────────

  function handleKeyUp() {
    updateFormatState();
    updateCounts();
    onChange?.(editorRef.current?.innerHTML ?? '');
  }

  function handleInput() {
    updateCounts();
    onChange?.(editorRef.current?.innerHTML ?? '');
  }

  function handleMouseUp() {
    updateFormatState();
  }

  // Toolbar action — prevent blur with e.preventDefault()
  function toolbar(command: string, value?: string) {
    return (e: React.MouseEvent) => {
      e.preventDefault();
      exec(command, value);
      updateFormatState();
      onChange?.(editorRef.current?.innerHTML ?? '');
    };
  }

  function handleHeadingChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value as HeadingLevel;
    exec('formatBlock', val === 'p' ? 'p' : val);
    setHeading(val);
    editorRef.current?.focus();
  }

  // ── Link dialog ──────────────────────────────────────────────────────────────

  function openLinkDialog(e: React.MouseEvent) {
    e.preventDefault();
    saveSelection();
    const sel = window.getSelection();
    const existing = sel?.anchorNode?.parentElement?.closest('a') as HTMLAnchorElement | null;
    setLinkUrl(existing?.href ?? 'https://');
    setLinkDialogOpen(true);
  }

  function insertLink() {
    restoreSelection();
    if (linkUrl.trim()) exec('createLink', linkUrl.trim());
    setLinkDialogOpen(false);
    setLinkUrl('');
    onChange?.(editorRef.current?.innerHTML ?? '');
  }

  function removeLink() {
    restoreSelection();
    exec('unlink');
    setLinkDialogOpen(false);
    onChange?.(editorRef.current?.innerHTML ?? '');
  }

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div className="rte">
      {/* ── Toolbar ─────────────────────────────────────────────────────────── */}
      <div className="rte-toolbar" role="toolbar" aria-label="Formátování textu">

        {/* Heading selector */}
        <select
          className="rte-heading-select"
          value={heading}
          onChange={handleHeadingChange}
          aria-label="Styl nadpisu"
        >
          <option value="p">Odstavec</option>
          <option value="h1">Nadpis 1</option>
          <option value="h2">Nadpis 2</option>
          <option value="h3">Nadpis 3</option>
          <option value="h4">Nadpis 4</option>
        </select>

        <ToolbarDivider />

        {/* Inline formatting */}
        <ToolbarButton title="Tučné (Ctrl+B)" active={activeFormats.has('bold')} onMouseDown={toolbar('bold')}>
          <Icon name="bold" />
        </ToolbarButton>
        <ToolbarButton title="Kurzíva (Ctrl+I)" active={activeFormats.has('italic')} onMouseDown={toolbar('italic')}>
          <Icon name="italic" />
        </ToolbarButton>
        <ToolbarButton title="Podtržení (Ctrl+U)" active={activeFormats.has('underline')} onMouseDown={toolbar('underline')}>
          <Icon name="underline" />
        </ToolbarButton>
        <ToolbarButton title="Přeškrtnutí" active={activeFormats.has('strike')} onMouseDown={toolbar('strikeThrough')}>
          <Icon name="strikethrough" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Alignment */}
        <ToolbarButton title="Zarovnat vlevo" active={alignment === 'left'} onMouseDown={toolbar('justifyLeft')}>
          <Icon name="align-left" />
        </ToolbarButton>
        <ToolbarButton title="Zarovnat na střed" active={alignment === 'center'} onMouseDown={toolbar('justifyCenter')}>
          <Icon name="align-center" />
        </ToolbarButton>
        <ToolbarButton title="Zarovnat vpravo" active={alignment === 'right'} onMouseDown={toolbar('justifyRight')}>
          <Icon name="align-right" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Lists */}
        <ToolbarButton title="Odrážkový seznam" active={activeFormats.has('ul')} onMouseDown={toolbar('insertUnorderedList')}>
          <Icon name="list" />
        </ToolbarButton>
        <ToolbarButton title="Číslovaný seznam" active={activeFormats.has('ol')} onMouseDown={toolbar('insertOrderedList')}>
          <Icon name="list-ordered" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Link */}
        <ToolbarButton title="Vložit odkaz" onMouseDown={openLinkDialog}>
          <Icon name="link" />
        </ToolbarButton>

        <ToolbarDivider />

        {/* Undo / Redo */}
        <ToolbarButton title="Zpět (Ctrl+Z)" onMouseDown={toolbar('undo')}>
          <Icon name="undo-2" />
        </ToolbarButton>
        <ToolbarButton title="Znovu (Ctrl+Y)" onMouseDown={toolbar('redo')}>
          <Icon name="redo-2" />
        </ToolbarButton>
      </div>

      {/* ── Editable area ────────────────────────────────────────────────────── */}
      <div
        ref={editorRef}
        className="rte-content"
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight }}
        data-placeholder={placeholder}
        onKeyUp={handleKeyUp}
        onMouseUp={handleMouseUp}
        onInput={handleInput}
        role="textbox"
        aria-multiline
        aria-label="Editor obsahu"
        spellCheck
      />

      {/* ── Footer — word / char count ────────────────────────────────────────── */}
      <div className="rte-footer">
        <span>{wordCount} {wordCount === 1 ? 'slovo' : wordCount < 5 ? 'slova' : 'slov'}</span>
        <span>{charCount} {charCount === 1 ? 'znak' : charCount < 5 ? 'znaky' : 'znaků'}</span>
      </div>

      {/* ── Link dialog ───────────────────────────────────────────────────────── */}
      {linkDialogOpen && (
        <div className="rte-link-overlay" role="dialog" aria-modal aria-label="Vložit odkaz">
          <div className="rte-link-dialog">
            <p className="rte-link-title">Vložit odkaz</p>
            <input
              className="rte-link-input"
              type="url"
              value={linkUrl}
              onChange={e => setLinkUrl(e.target.value)}
              placeholder="https://example.com"
              autoFocus
              onKeyDown={e => {
                if (e.key === 'Enter') insertLink();
                if (e.key === 'Escape') setLinkDialogOpen(false);
              }}
            />
            <div className="rte-link-actions">
              <button type="button" className="btn btn-ghost" onClick={() => setLinkDialogOpen(false)}>Zrušit</button>
              <button type="button" className="btn btn-tertiary" onClick={removeLink}>Odebrat odkaz</button>
              <button type="button" className="btn btn-secondary" onClick={insertLink}>Použít</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
