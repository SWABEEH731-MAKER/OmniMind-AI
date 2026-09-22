import { jsPDF } from 'jspdf';
import { ChatSession, Message } from '../types';

function sanitizeFilename(title: string): string {
  return (title || 'chat-transcript')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '') || 'transcript';
}

/**
 * Export conversation transcript as a clean Plain Text (.txt) file
 */
export function downloadAsText(session: ChatSession) {
  const dateStr = new Date().toLocaleString();
  const divider = '='.repeat(64);
  const subDivider = '-'.repeat(64);

  let text = `${divider}\n`;
  text += ` OmniMind AI - Conversation Transcript\n`;
  text += ` Session: ${session.title || 'Untitled'}\n`;
  text += ` Exported: ${dateStr}\n`;
  text += ` Total Messages: ${session.messages.length}\n`;
  text += `${divider}\n\n`;

  session.messages.forEach((msg, idx) => {
    const time = new Date(msg.timestamp || Date.now()).toLocaleString();
    const speaker = msg.role === 'user' ? (msg.senderName || 'User') : 'OmniMind AI';
    text += `[#${idx + 1}] ${speaker} (${time}):\n`;
    text += `${msg.content}\n`;

    if (msg.sources && msg.sources.length > 0) {
      text += `\nCited Sources:\n`;
      msg.sources.forEach((s, sIdx) => {
        text += `  [${sIdx + 1}] ${s.title}: ${s.uri}\n`;
      });
    }

    text += `\n${subDivider}\n\n`;
  });

  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(session.title)}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation as formatted Markdown (.md)
 */
export function downloadAsMarkdown(session: ChatSession) {
  const dateStr = new Date().toLocaleString();
  let md = `# ${session.title || 'Conversation Transcript'}\n\n`;
  md += `> **Exported:** ${dateStr}  \n`;
  md += `> **Model:** ${session.model || 'Gemini'}  \n`;
  md += `> **Total Messages:** ${session.messages.length}\n\n`;
  md += `---\n\n`;

  session.messages.forEach((msg) => {
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    if (msg.role === 'user') {
      md += `### 👤 ${msg.senderName || 'User'}  *(${time})*\n\n`;
      md += `${msg.content}\n\n`;
    } else {
      md += `### 🤖 OmniMind AI  *(${time})*\n\n`;
      md += `${msg.content}\n\n`;

      if (msg.sources && msg.sources.length > 0) {
        md += `#### 🌐 Cited Sources\n\n`;
        msg.sources.forEach((s) => {
          md += `- [${s.title}](${s.uri})\n`;
        });
        md += `\n`;
      }
    }

    md += `---\n\n`;
  });

  const blob = new Blob([md], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${sanitizeFilename(session.title)}.md`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export conversation as a formatted PDF file using jsPDF
 */
export function downloadAsPDF(session: ChatSession) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 40;
  const contentWidth = pageWidth - margin * 2;
  let cursorY = margin;

  const checkPageBreak = (neededHeight: number) => {
    if (cursorY + neededHeight > pageHeight - margin) {
      doc.addPage();
      cursorY = margin;
      return true;
    }
    return false;
  };

  // Header Background Banner
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(margin, cursorY, contentWidth, 54, 'F');

  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('OmniMind AI', margin + 14, cursorY + 24);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(148, 163, 184); // slate-400
  doc.text(
    `Session: ${session.title.length > 45 ? session.title.slice(0, 42) + '...' : session.title}`,
    margin + 14,
    cursorY + 42
  );

  doc.text(
    `Date: ${new Date().toLocaleDateString()}`,
    pageWidth - margin - 14,
    cursorY + 42,
    { align: 'right' }
  );

  cursorY += 70;

  // Render Messages
  session.messages.forEach((msg) => {
    const isUser = msg.role === 'user';
    const speaker = isUser ? (msg.senderName || 'User') : 'OmniMind AI';
    const time = new Date(msg.timestamp || Date.now()).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
    });

    checkPageBreak(50);

    // Speaker pill
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    if (isUser) {
      doc.setTextColor(79, 70, 229); // indigo-600
    } else {
      doc.setTextColor(16, 185, 129); // emerald-500
    }
    doc.text(`${speaker}`, margin, cursorY);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139); // slate-500
    doc.text(` (${time})`, margin + doc.getTextWidth(speaker) + 2, cursorY);
    cursorY += 16;

    // Message Body
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59); // slate-800

    // Split text into printable lines
    const lines = doc.splitTextToSize(msg.content, contentWidth);
    lines.forEach((line: string) => {
      checkPageBreak(14);
      doc.text(line, margin, cursorY);
      cursorY += 14;
    });

    // Cited sources if any
    if (msg.sources && msg.sources.length > 0) {
      cursorY += 6;
      checkPageBreak(24);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(5, 150, 105);
      doc.text('Cited Sources:', margin, cursorY);
      cursorY += 12;

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      msg.sources.forEach((s) => {
        checkPageBreak(12);
        const sourceText = `• ${s.title}: ${s.uri}`;
        const sourceLines = doc.splitTextToSize(sourceText, contentWidth - 10);
        sourceLines.forEach((sLine: string) => {
          doc.text(sLine, margin + 8, cursorY);
          cursorY += 11;
        });
      });
    }

    cursorY += 14;

    // Subtle divider line between messages
    checkPageBreak(10);
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.line(margin, cursorY, pageWidth - margin, cursorY);
    cursorY += 16;
  });

  // Footer page numbers
  const totalPages = doc.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(
      `OmniMind AI Transcript  |  Page ${i} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 20,
      { align: 'center' }
    );
  }

  doc.save(`${sanitizeFilename(session.title)}.pdf`);
}
