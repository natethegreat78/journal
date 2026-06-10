import { zipSync, unzipSync, strToU8 } from "fflate";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function paragraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((line) =>
      line.trim()
        ? `<text:p text:style-name="Text_Body">${escapeXml(line.trim())}</text:p>`
        : `<text:p text:style-name="Text_Body"/>`
    )
    .join("\n      ");
}

function buildContentXml(
  title: string,
  summary: string | null | undefined,
  body: string,
  createdAt: string
): string {
  const summarySection = summary
    ? `<text:h text:style-name="Heading_2" text:outline-level="2">Summary</text:h>
      ${paragraphs(summary)}
      <text:p text:style-name="Text_Body"/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  xmlns:office-style="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  office:version="1.3">
  <office:automatic-styles>
    <style:style style:name="Heading_1" style:display-name="Heading 1" style:family="paragraph" style:parent-style-name="Heading_20_1">
      <style:text-properties fo:font-size="18pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Heading_2" style:display-name="Heading 2" style:family="paragraph" style:parent-style-name="Heading_20_2">
      <style:text-properties fo:font-size="14pt" fo:font-weight="bold"/>
    </style:style>
    <style:style style:name="Text_Body" style:display-name="Text Body" style:family="paragraph">
      <style:paragraph-properties fo:margin-bottom="0.1in"/>
    </style:style>
    <style:style style:name="Meta" style:display-name="Meta" style:family="paragraph">
      <style:text-properties fo:color="#888888" fo:font-size="9pt"/>
    </style:style>
  </office:automatic-styles>
  <office:body>
    <office:text>
      <text:h text:style-name="Heading_1" text:outline-level="1">${escapeXml(title)}</text:h>
      <text:p text:style-name="Meta">${escapeXml(createdAt)}</text:p>
      <text:p text:style-name="Text_Body"/>
      ${summarySection}
      <text:h text:style-name="Heading_2" text:outline-level="2">Transcript</text:h>
      ${paragraphs(body)}
    </office:text>
  </office:body>
</office:document-content>`;
}

const MANIFEST_XML = `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest
  xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0"
  manifest:version="1.3">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/>
  <manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8"?>
<office:document-styles
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0"
  xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"
  office:version="1.3">
  <office:styles>
    <style:default-style style:family="paragraph">
      <style:text-properties fo:font-family="Liberation Serif" fo:font-size="12pt" fo:language="en" fo:country="US"/>
    </style:default-style>
    <style:style style:name="Standard" style:family="paragraph" style:class="text"/>
  </office:styles>
  <office:automatic-styles/>
  <office:master-styles/>
</office:document-styles>`;

function buildMetaXml(title: string, createdAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<office:document-meta
  xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"
  xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  office:version="1.3">
  <office:meta>
    <dc:title>${escapeXml(title)}</dc:title>
    <meta:creation-date>${escapeXml(createdAt)}</meta:creation-date>
    <meta:generator>Journal</meta:generator>
  </office:meta>
</office:document-meta>`;
}

const ENTRY_SEPARATOR = "────────────────────────────────────────";

/**
 * Append a new dated journal entry to an existing .txt string.
 */
export function appendToTxt(existing: string, text: string, date: string): string {
  const sep = `\n\n${ENTRY_SEPARATOR}\n${date}\n\n`;
  return existing.trimEnd() + sep + text.trim();
}

/**
 * Append a new dated journal entry to an existing ODT file's bytes.
 * Uses string injection into content.xml rather than full DOM parsing,
 * so it works with any valid ODT (not just ones we created).
 */
export function appendToOdtBytes(
  existingBytes: Uint8Array,
  text: string,
  date: string,
): Uint8Array {
  try {
    const files = unzipSync(existingBytes);
    const rawXml = files["content.xml"];
    if (!rawXml) throw new Error("No content.xml found");

    let contentXml = new TextDecoder().decode(rawXml);

    // Find the closing </office:text> or </text:section> to inject before
    const insertMarkers = ["</office:text>", "</text:section>"];
    let insertIdx = -1;
    for (const marker of insertMarkers) {
      const idx = contentXml.lastIndexOf(marker);
      if (idx !== -1) { insertIdx = idx; break; }
    }
    if (insertIdx === -1) throw new Error("Cannot find insertion point in content.xml");

    const newElements = [
      `<text:p text:style-name="Meta">${escapeXml(ENTRY_SEPARATOR)}</text:p>`,
      `<text:h text:style-name="Heading_2" text:outline-level="2">${escapeXml(date)}</text:h>`,
      ...text.split(/\n+/).filter(l => l.trim()).map(l =>
        `<text:p text:style-name="Text_Body">${escapeXml(l.trim())}</text:p>`
      ),
    ].join("\n      ");

    contentXml = contentXml.slice(0, insertIdx) + "\n      " + newElements + "\n    " + contentXml.slice(insertIdx);

    // Re-zip preserving all other files; mimetype must be STORED (level 0) and first
    const manifest = files["META-INF/manifest.xml"] ?? strToU8(MANIFEST_XML);
    const styles   = files["styles.xml"]            ?? strToU8(STYLES_XML);
    const meta     = files["meta.xml"]              ?? strToU8(buildMetaXml(date, date));

    return zipSync(
      {
        mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
        "META-INF/manifest.xml": manifest,
        "content.xml": strToU8(contentXml),
        "styles.xml": styles,
        "meta.xml": meta,
      },
      { level: 6 }
    );
  } catch {
    // Fallback: rebuild from scratch so the user always gets something
    return buildOdtBytes(date, text, null, date);
  }
}

export function buildOdtBytes(
  title: string,
  body: string,
  summary?: string | null,
  createdAt?: string | null
): Uint8Array {
  const dateStr = createdAt ?? new Date().toISOString();
  const contentXml = buildContentXml(title, summary, body, dateStr);
  const metaXml = buildMetaXml(title, dateStr);

  return zipSync(
    {
      mimetype: [strToU8("application/vnd.oasis.opendocument.text"), { level: 0 }],
      "META-INF/manifest.xml": strToU8(MANIFEST_XML),
      "content.xml": strToU8(contentXml),
      "styles.xml": strToU8(STYLES_XML),
      "meta.xml": strToU8(metaXml),
    },
    { level: 6 }
  );
}

export function exportAsOdt(
  title: string,
  body: string,
  summary?: string | null,
  createdAt?: string | null
): void {
  const zip = buildOdtBytes(title, body, summary, createdAt);
  const blob = new Blob([zip.buffer as ArrayBuffer], { type: "application/vnd.oasis.opendocument.text" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${title.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.odt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
