import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Editor } from '@tinymce/tinymce-react';
import tinymce from 'tinymce/tinymce';
import type { Editor as TinyMCEEditor } from 'tinymce';
import 'tinymce/icons/default';
import 'tinymce/models/dom';
import 'tinymce/themes/silver';
import 'tinymce/plugins/advlist';
import 'tinymce/plugins/autolink';
import 'tinymce/plugins/code';
import 'tinymce/plugins/fullscreen';
import 'tinymce/plugins/help';
import 'tinymce/plugins/link';
import 'tinymce/plugins/lists';
import 'tinymce/plugins/table';
import 'tinymce/plugins/visualblocks';
import 'tinymce/plugins/wordcount';
import 'tinymce/skins/ui/oxide/skin.min.css';
import 'tinymce/skins/content/default/content.min.css';

if (typeof window !== 'undefined') {
  (window as typeof window & { tinymce?: typeof tinymce }).tinymce = tinymce;
}

export interface ProductRichEditorProps {
  value: string;
  onChange: (value: string) => void;
  label: string;
  height?: number;
  required?: boolean;
  placeholder?: string;
}

function normalizeEditorValue(value: string) {
  return typeof value === 'string' ? value : '';
}

export function ProductRichEditor({
  value,
  onChange,
  label,
  height = 260,
  required = false,
  placeholder = ''
}: ProductRichEditorProps) {
  const editorId = useId();
  const editorRef = useRef<TinyMCEEditor | null>(null);
  const [mode, setMode] = useState<'visual' | 'html'>('visual');
  const [showMoreTools, setShowMoreTools] = useState(false);
  const [htmlDraft, setHtmlDraft] = useState(normalizeEditorValue(value));

  useEffect(() => {
    const normalized = normalizeEditorValue(value);
    setHtmlDraft(normalized);
    if (editorRef.current && editorRef.current.getContent() !== normalized) {
      editorRef.current.setContent(normalized);
    }
  }, [value]);

  const previewHtml = useMemo(() => normalizeEditorValue(htmlDraft), [htmlDraft]);
  const toolbarRows = useMemo(() => {
    const primary = 'blocks | bold italic | bullist numlist blockquote | alignleft aligncenter alignright alignjustify | link unlink | fullscreen';
    const secondary = 'outdent indent | removeformat | table | visualblocks | code help';
    return showMoreTools ? [primary, secondary] : primary;
  }, [showMoreTools]);

  function handleVisualChange(nextValue: string) {
    const normalized = normalizeEditorValue(nextValue);
    setHtmlDraft(normalized);
    onChange(normalized);
  }

  function handleHtmlChange(nextValue: string) {
    setHtmlDraft(nextValue);
    onChange(nextValue);
    if (editorRef.current && editorRef.current.getContent() !== nextValue) {
      editorRef.current.setContent(nextValue);
    }
  }

  return (
    <div className="form-group">
      <label htmlFor={editorId}>
        {label}
        {required ? <span className="products-rich-editor-required"> *</span> : null}
      </label>

      <div className="products-wp-editor">
        <div className="products-wp-editor-chrome">
          <div className="products-wp-editor-actions">
            <button
              type="button"
              className={`products-wp-editor-action${showMoreTools ? ' is-active' : ''}`}
              onClick={() => setShowMoreTools((current) => !current)}
            >
              {showMoreTools ? 'Ocultar herramientas' : 'Mostrar mas herramientas'}
            </button>
          </div>
          <div className="products-wp-editor-tabs">
            <button
              type="button"
              className={`products-wp-editor-tab${mode === 'visual' ? ' is-active' : ''}`}
              onClick={() => setMode('visual')}
            >
              Visual
            </button>
            <button
              type="button"
              className={`products-wp-editor-tab${mode === 'html' ? ' is-active' : ''}`}
              onClick={() => setMode('html')}
            >
              Codigo
            </button>
          </div>
        </div>

        <div className="products-wp-editor-body">
          {mode === 'visual' ? (
            <Editor
              key={`${editorId}-${showMoreTools ? 'expanded' : 'compact'}`}
              id={editorId}
              licenseKey="gpl"
              tinymceScriptSrc={undefined}
              value={normalizeEditorValue(value)}
              onInit={(_event, editor) => {
                editorRef.current = editor;
              }}
              onEditorChange={handleVisualChange}
              init={{
                height,
                menubar: false,
                branding: false,
                promotion: false,
                resize: true,
                statusbar: true,
                elementpath: false,
                skin: false,
                content_css: false,
                browser_spellcheck: true,
                object_resizing: false,
                toolbar_mode: 'wrap',
                toolbar_sticky: false,
                paste_as_text: false,
                forced_root_block: 'p',
                placeholder,
                plugins: 'advlist autolink lists link code fullscreen help table visualblocks wordcount',
                toolbar: toolbarRows,
                block_formats: 'Parrafo=p; Encabezado 2=h2; Encabezado 3=h3; Encabezado 4=h4; Cita=blockquote',
                content_style: `
                  body {
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                    font-size: 14px;
                    line-height: 1.6;
                    color: #1d2327;
                    margin: 12px;
                  }
                  p { margin: 0 0 12px; }
                  ul, ol { margin: 0 0 12px 24px; }
                  blockquote {
                    margin: 0 0 12px;
                    padding-left: 12px;
                    border-left: 4px solid #dcdcde;
                    color: #50575e;
                  }
                `
              }}
            />
          ) : (
            <div className="products-wp-editor-code">
              <textarea
                id={editorId}
                className="products-wp-editor-code-input"
                value={htmlDraft}
                onChange={(event) => handleHtmlChange(event.target.value)}
                placeholder={placeholder}
              />
              <div className="products-wp-editor-preview">
                <div className="products-wp-editor-preview-title">Preview</div>
                <div
                  className="products-wp-editor-preview-body"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p></p>' }}
                />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ProductRichEditor;
