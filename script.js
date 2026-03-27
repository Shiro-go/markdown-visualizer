const markdownInput = document.getElementById("markdownInput");
const lineNumbers = document.getElementById("lineNumbers");
const preview = document.getElementById("preview");
const visualizeBtn = document.getElementById("visualizeBtn");
const downloadBtn = document.getElementById("downloadBtn");
const openBtn = document.getElementById("openBtn");
const fileInput = document.getElementById("fileInput");

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function updateLineNumbers() {
  const lineCount = markdownInput.value.split("\n").length;
  const numbers = Array.from({ length: lineCount }, (_, index) => index + 1).join("\n");
  lineNumbers.textContent = numbers;
}

function syncScroll() {
  lineNumbers.scrollTop = markdownInput.scrollTop;
}

function parseInline(text) {
  let parsed = escapeHtml(text);

  parsed = parsed.replace(/`([^`]+)`/g, "<code>$1</code>");
  parsed = parsed.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  parsed = parsed.replace(/__([^_]+)__/g, "<strong>$1</strong>");
  parsed = parsed.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  parsed = parsed.replace(/_([^_]+)_/g, "<em>$1</em>");
  parsed = parsed.replace(
    /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
    '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
  );

  return parsed;
}

function parseMarkdown(markdown) {
  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let inCodeBlock = false;
  let codeBuffer = [];
  let inUl = false;
  let inOl = false;
  let inBlockquote = false;
  let paragraphBuffer = [];
  let tableMode = false;
  let tableHeader = [];
  let tableRows = [];

  function flushParagraph() {
    if (paragraphBuffer.length > 0) {
      html += `<p>${parseInline(paragraphBuffer.join(" "))}</p>`;
      paragraphBuffer = [];
    }
  }

  function flushLists() {
    if (inUl) {
      html += "</ul>";
      inUl = false;
    }
    if (inOl) {
      html += "</ol>";
      inOl = false;
    }
  }

  function flushBlockquote() {
    if (inBlockquote) {
      html += "</blockquote>";
      inBlockquote = false;
    }
  }

  function flushTable() {
    if (tableMode) {
      html += "<table><thead><tr>";
      for (const cell of tableHeader) {
        html += `<th>${parseInline(cell.trim())}</th>`;
      }
      html += "</tr></thead><tbody>";

      for (const row of tableRows) {
        html += "<tr>";
        for (const cell of row) {
          html += `<td>${parseInline(cell.trim())}</td>`;
        }
        html += "</tr>";
      }

      html += "</tbody></table>";
      tableMode = false;
      tableHeader = [];
      tableRows = [];
    }
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.trim().startsWith("```")) {
      flushParagraph();
      flushLists();
      flushBlockquote();
      flushTable();

      if (!inCodeBlock) {
        inCodeBlock = true;
        codeBuffer = [];
      } else {
        html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
        inCodeBlock = false;
        codeBuffer = [];
      }
      continue;
    }

    if (inCodeBlock) {
      codeBuffer.push(line);
      continue;
    }

    const trimmed = line.trim();

    if (trimmed === "") {
      flushParagraph();
      flushLists();
      flushBlockquote();
      flushTable();
      continue;
    }

    const isTableCandidate =
      trimmed.includes("|") &&
      i + 1 < lines.length &&
      /^\s*\|?[\-\s:|]+\|?\s*$/.test(lines[i + 1]);

    if (isTableCandidate) {
      flushParagraph();
      flushLists();
      flushBlockquote();

      tableMode = true;
      tableHeader = trimmed
        .split("|")
        .map((cell) => cell.trim())
        .filter((cell, index, arr) => !(cell === "" && (index === 0 || index === arr.length - 1)));

      i += 2;

      while (i < lines.length && lines[i].trim().includes("|")) {
        const row = lines[i]
          .trim()
          .split("|")
          .map((cell) => cell.trim())
          .filter((cell, index, arr) => !(cell === "" && (index === 0 || index === arr.length - 1)));

        if (row.length > 0) {
          tableRows.push(row);
        }
        i++;
      }

      i--;
      flushTable();
      continue;
    }

    if (/^#{1,6}\s/.test(trimmed)) {
      flushParagraph();
      flushLists();
      flushBlockquote();
      flushTable();

      const level = trimmed.match(/^#+/)[0].length;
      const content = trimmed.slice(level).trim();
      html += `<h${level}>${parseInline(content)}</h${level}>`;
      continue;
    }

    if (/^>\s?/.test(trimmed)) {
      flushParagraph();
      flushLists();
      flushTable();

      if (!inBlockquote) {
        html += "<blockquote>";
        inBlockquote = true;
      }

      html += `<p>${parseInline(trimmed.replace(/^>\s?/, ""))}</p>`;
      continue;
    } else {
      flushBlockquote();
    }

    if (/^[-*]\s+/.test(trimmed)) {
      flushParagraph();
      flushTable();

      if (inOl) {
        html += "</ol>";
        inOl = false;
      }

      if (!inUl) {
        html += "<ul>";
        inUl = true;
      }

      html += `<li>${parseInline(trimmed.replace(/^[-*]\s+/, ""))}</li>`;
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      flushParagraph();
      flushTable();

      if (inUl) {
        html += "</ul>";
        inUl = false;
      }

      if (!inOl) {
        html += "<ol>";
        inOl = true;
      }

      html += `<li>${parseInline(trimmed.replace(/^\d+\.\s+/, ""))}</li>`;
      continue;
    }

    if (/^---+$/.test(trimmed) || /^\*\*\*+$/.test(trimmed)) {
      flushParagraph();
      flushLists();
      flushBlockquote();
      flushTable();
      html += "<hr>";
      continue;
    }

    if (/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/.test(trimmed)) {
      flushParagraph();
      flushLists();
      flushBlockquote();
      flushTable();

      const match = trimmed.match(/^!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)$/);
      const alt = escapeHtml(match[1]);
      const src = match[2];
      html += `<p><img src="${src}" alt="${alt}"></p>`;
      continue;
    }

    paragraphBuffer.push(trimmed);
  }

  if (inCodeBlock) {
    html += `<pre><code>${escapeHtml(codeBuffer.join("\n"))}</code></pre>`;
  }

  flushParagraph();
  flushLists();
  flushBlockquote();
  flushTable();

  return html.trim();
}

function renderMarkdown() {
  const content = markdownInput.value.trim();

  if (!content) {
    preview.innerHTML = `
      <div class="preview-placeholder">
        Your rendered markdown will appear here.
      </div>
    `;
    return;
  }

  preview.innerHTML = parseMarkdown(content);
}

function downloadMarkdownFile() {
  const content = markdownInput.value;
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);

  const link = document.createElement("a");
  link.href = url;
  link.download = "file.md";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  URL.revokeObjectURL(url);
}

function openMarkdownFile() {
  fileInput.click();
}

function handleFileSelection(event) {
  const file = event.target.files[0];
  if (!file) {
    return;
  }

  const reader = new FileReader();

  reader.onload = function (e) {
    const content = e.target.result;
    markdownInput.value = content;
    updateLineNumbers();
    renderMarkdown();
  };

  reader.readAsText(file);
  fileInput.value = "";
}

markdownInput.addEventListener("input", updateLineNumbers);
markdownInput.addEventListener("scroll", syncScroll);
visualizeBtn.addEventListener("click", renderMarkdown);
downloadBtn.addEventListener("click", downloadMarkdownFile);
openBtn.addEventListener("click", openMarkdownFile);
fileInput.addEventListener("change", handleFileSelection);

updateLineNumbers();
renderMarkdown();