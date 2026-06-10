import { zipSync, unzipSync, strToU8 } from "fflate";

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

const CONTENT_TYPES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>
  <Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
</Types>`;

const RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
</Relationships>`;

const DOCUMENT_RELS_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;

const STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:style w:type="paragraph" w:default="1" w:styleId="Normal">
    <w:name w:val="Normal"/>
    <w:rPr>
      <w:sz w:val="24"/>
      <w:lang w:val="en-US"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading1">
    <w:name w:val="heading 1"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:outlineLvl w:val="0"/>
      <w:spacing w:before="240" w:after="60"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="36"/>
    </w:rPr>
  </w:style>
  <w:style w:type="paragraph" w:styleId="Heading2">
    <w:name w:val="heading 2"/>
    <w:basedOn w:val="Normal"/>
    <w:pPr>
      <w:outlineLvl w:val="1"/>
      <w:spacing w:before="200" w:after="40"/>
    </w:pPr>
    <w:rPr>
      <w:b/>
      <w:sz w:val="28"/>
    </w:rPr>
  </w:style>
</w:styles>`;

function buildCoreXml(title: string, createdAt: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties
  xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:dcterms="http://purl.org/dc/terms/"
  xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <dc:title>${escapeXml(title)}</dc:title>
  <dc:creator>Journal</dc:creator>
  <dcterms:created xsi:type="dcterms:W3CDTF">${escapeXml(createdAt)}</dcterms:created>
</cp:coreProperties>`;
}

function wParagraphs(text: string): string {
  return text
    .split(/\n+/)
    .map((line) =>
      line.trim()
        ? `  <w:p><w:r><w:t xml:space="preserve">${escapeXml(line.trim())}</w:t></w:r></w:p>`
        : `  <w:p/>`
    )
    .join("\n");
}

function buildDocumentXml(
  title: string,
  body: string,
  summary: string | null | undefined,
  createdAt: string,
): string {
  const summarySection = summary
    ? `  <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Summary</w:t></w:r></w:p>\n${wParagraphs(summary)}\n  <w:p/>`
    : "";

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>
    <w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>${escapeXml(title)}</w:t></w:r></w:p>
    <w:p><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(createdAt)}</w:t></w:r></w:p>
    <w:p/>
    ${summarySection}
    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>Transcript</w:t></w:r></w:p>
${wParagraphs(body)}
    <w:sectPr/>
  </w:body>
</w:document>`;
}

export function buildDocxBytes(
  title: string,
  body: string,
  summary?: string | null,
  createdAt?: string | null,
): Uint8Array {
  const date = createdAt ?? new Date().toLocaleString();
  return zipSync({
    "[Content_Types].xml":    strToU8(CONTENT_TYPES_XML),
    "_rels/.rels":            strToU8(RELS_XML),
    "word/document.xml":      strToU8(buildDocumentXml(title, body, summary, date)),
    "word/_rels/document.xml.rels": strToU8(DOCUMENT_RELS_XML),
    "word/styles.xml":        strToU8(STYLES_XML),
    "docProps/core.xml":      strToU8(buildCoreXml(title, date)),
  }, { level: 6 });
}

const ENTRY_SEPARATOR = "────────────────────────────────────────";

export function appendToDocxBytes(
  existingBytes: Uint8Array,
  text: string,
  date: string,
): Uint8Array {
  try {
    console.log("[scribe] appendToDocxBytes: input size=", existingBytes.byteLength);
    const files = unzipSync(existingBytes);
    console.log("[scribe] appendToDocxBytes: zip entries=", Object.keys(files));

    const rawXml = files["word/document.xml"];
    if (!rawXml) throw new Error("No word/document.xml found");

    let docXml = new TextDecoder().decode(rawXml);
    console.log("[scribe] appendToDocxBytes: document.xml length=", docXml.length);

    // Inject before <w:sectPr (section properties must stay last), or before </w:body>
    const markers = ["<w:sectPr", "</w:body>"];
    let insertIdx = -1;
    for (const m of markers) {
      const idx = docXml.lastIndexOf(m);
      if (idx !== -1) { insertIdx = idx; break; }
    }
    if (insertIdx === -1) throw new Error("Cannot find insertion point in document.xml");

    const newBlocks = [
      `    <w:p><w:r><w:rPr><w:color w:val="888888"/><w:sz w:val="18"/></w:rPr><w:t>${escapeXml(ENTRY_SEPARATOR)}</w:t></w:r></w:p>`,
      `    <w:p><w:pPr><w:pStyle w:val="Heading2"/></w:pPr><w:r><w:t>${escapeXml(date)}</w:t></w:r></w:p>`,
      ...text.split(/\n+/).filter(l => l.trim()).map(l =>
        `    <w:p><w:r><w:t xml:space="preserve">${escapeXml(l.trim())}</w:t></w:r></w:p>`
      ),
    ].join("\n");

    docXml = docXml.slice(0, insertIdx) + newBlocks + "\n    " + docXml.slice(insertIdx);

    return zipSync({
      "[Content_Types].xml":    files["[Content_Types].xml"] ?? strToU8(CONTENT_TYPES_XML),
      "_rels/.rels":            files["_rels/.rels"]         ?? strToU8(RELS_XML),
      "word/document.xml":      strToU8(docXml),
      "word/_rels/document.xml.rels": files["word/_rels/document.xml.rels"] ?? strToU8(DOCUMENT_RELS_XML),
      "word/styles.xml":        files["word/styles.xml"]     ?? strToU8(STYLES_XML),
      "docProps/core.xml":      files["docProps/core.xml"]   ?? strToU8(buildCoreXml(date, date)),
    }, { level: 6 });
  } catch (err) {
    throw new Error(
      `Could not append to DOCX: ${err instanceof Error ? err.message : String(err)}. ` +
      `Try using a .txt journal instead.`
    );
  }
}

export function exportAsDocx(
  title: string,
  body: string,
  summary?: string | null,
  createdAt?: string | null,
): void {
  const bytes = buildDocxBytes(title, body, summary, createdAt);
  const slug = title.replace(/[^a-z0-9]/gi, "_").toLowerCase();
  const ab = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
  const blob = new Blob([ab], { type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${slug}.docx`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
