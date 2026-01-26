/**
 * Diagram Formatter Utility
 * 
 * Creates clean, formatted ASCII box diagrams for documents and PDFs.
 * Uses simple ASCII characters for maximum compatibility.
 */

export interface DiagramFormatOptions {
  /** Box width (default: 55) */
  boxWidth?: number;
  /** Whether to wrap in markdown code block (default: true) */
  wrapInCodeBlock?: boolean;
}

interface DiagramBox {
  title: string;
  items: string[];
}

/**
 * Parses raw diagram input text to extract boxes
 */
function parseDiagramInput(input: string): { title: string; boxes: DiagramBox[] } {
  const lines = input.split('\n');
  let diagramTitle = '';
  const boxes: DiagramBox[] = [];
  
  let currentBox: DiagramBox | null = null;
  let inBox = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const lineLower = line.toLowerCase();
    
    // Skip explanatory text
    if (lineLower.includes('replace') && lineLower.includes('diagram')) continue;
    if (lineLower.includes('tighter version')) continue;
    if (line === '') continue;
    
    // Check for diagram title
    if (line.includes('DATA') && (line.includes('DECISIONS') || line.includes('DELIVERY'))) {
      diagramTitle = line;
      continue;
    }
    
    // Check for box start (top border)
    if (line.match(/^[┌╔\+]+[-─═]+[┐╗\+]+$/) || line.match(/^\+[-]+\+$/)) {
      inBox = true;
      currentBox = { title: '', items: [] };
      continue;
    }
    
    // Check for box end (bottom border)
    if (line.match(/^[└╚\+]+[-─═]+[┘╝\+]+$/) || line.match(/^\+[-]+\+$/)) {
      if (currentBox && (currentBox.title || currentBox.items.length > 0)) {
        boxes.push(currentBox);
      }
      inBox = false;
      currentBox = null;
      continue;
    }
    
    // Inside box - extract content
    if (inBox && currentBox) {
      // Remove box characters and clean up
      let content = line
        .replace(/^[│║\|]+\s*/, '')  // Remove leading vertical bar
        .replace(/\s*[│║\|]+$/, '')   // Remove trailing vertical bar
        .trim();
      
      if (content.length === 0) continue;
      
      // Check if this is a title line (numbered like "1) Data Sources")
      if (content.match(/^\d+\)\s+/)) {
        currentBox.title = content;
      } else if (content.startsWith('•') || content.startsWith('-') || content.startsWith('*')) {
        currentBox.items.push(content);
      } else if (content.length > 0) {
        // Regular content - could be part of title or an item
        if (!currentBox.title) {
          currentBox.title = content;
        } else {
          currentBox.items.push('• ' + content);
        }
      }
    }
  }
  
  // Handle any remaining box
  if (currentBox && (currentBox.title || currentBox.items.length > 0)) {
    boxes.push(currentBox);
  }
  
  return { title: diagramTitle, boxes };
}

/**
 * Creates a single formatted box
 */
function createBox(box: DiagramBox, width: number): string[] {
  const lines: string[] = [];
  const innerWidth = width - 4; // Account for "| " and " |"
  
  // Top border
  lines.push('+' + '-'.repeat(width - 2) + '+');
  
  // Title
  if (box.title) {
    const titleLine = box.title.length > innerWidth 
      ? box.title.substring(0, innerWidth - 3) + '...'
      : box.title;
    lines.push('| ' + titleLine.padEnd(innerWidth) + ' |');
  }
  
  // Items
  for (const item of box.items) {
    const itemLine = item.length > innerWidth 
      ? item.substring(0, innerWidth - 3) + '...'
      : item;
    lines.push('| ' + itemLine.padEnd(innerWidth) + ' |');
  }
  
  // Bottom border
  lines.push('+' + '-'.repeat(width - 2) + '+');
  
  return lines;
}

/**
 * Main function to format an ASCII diagram
 */
export function formatDiagram(input: string, options: DiagramFormatOptions = {}): string {
  const { boxWidth = 55, wrapInCodeBlock = true } = options;
  
  if (!input || !input.trim()) {
    return '';
  }
  
  const { title, boxes } = parseDiagramInput(input);
  
  if (boxes.length === 0) {
    // No boxes found - just clean up and return
    const cleaned = input
      .split('\n')
      .filter(line => {
        const lower = line.toLowerCase().trim();
        return !(lower.includes('replace') && lower.includes('diagram')) &&
               !lower.includes('tighter version');
      })
      .join('\n')
      .trim();
    return wrapInCodeBlock ? '```\n' + cleaned + '\n```' : cleaned;
  }
  
  const resultLines: string[] = [];
  
  // Add title
  if (title) {
    resultLines.push(title);
    resultLines.push('');
  }
  
  // Generate each box with arrows between them
  const arrowIndent = Math.floor(boxWidth / 2) - 1;
  
  for (let i = 0; i < boxes.length; i++) {
    const boxLines = createBox(boxes[i], boxWidth);
    resultLines.push(...boxLines);
    
    // Add arrow between boxes (except after last)
    if (i < boxes.length - 1) {
      resultLines.push(' '.repeat(arrowIndent) + '|');
      resultLines.push(' '.repeat(arrowIndent) + 'v');
    }
  }
  
  const result = resultLines.join('\n');
  
  if (wrapInCodeBlock) {
    return '```\n' + result + '\n```';
  }
  
  return result;
}

/**
 * Preview how a diagram will look when formatted (without code block)
 */
export function previewFormattedDiagram(input: string, options?: DiagramFormatOptions): string {
  return formatDiagram(input, { ...options, wrapInCodeBlock: false });
}

/**
 * Extracts section headers from a document for insertion position dropdown
 */
export function extractSectionHeaders(content: string): string[] {
  const headers: string[] = [];
  const lines = content.split('\n');
  
  for (const line of lines) {
    const match = line.match(/^(#{1,4})\s+(.+)$/);
    if (match) {
      headers.push(match[2].trim());
    }
  }
  
  return headers;
}

/**
 * Removes existing diagrams from a document (to prevent duplicates)
 */
function removeExistingDiagrams(content: string): string {
  const lines = content.split('\n');
  const result: string[] = [];
  let skipUntilNextSection = false;
  let inCodeBlock = false;
  let codeBlockIsDiagram = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    
    // Track code blocks
    if (trimmed === '```') {
      if (!inCodeBlock) {
        // Starting a code block - check if it's a diagram
        inCodeBlock = true;
        codeBlockIsDiagram = false;
        
        // Look ahead to see if this is a diagram
        for (let j = i + 1; j < Math.min(i + 15, lines.length); j++) {
          const nextLine = lines[j].trim();
          if (nextLine === '```') break;
          if (nextLine.includes('DATA') && nextLine.includes('DECISIONS') ||
              nextLine.match(/^\d+\)\s+Data/) ||
              nextLine.match(/^\+[-]+\+$/) ||
              nextLine.includes('1) Data Sources')) {
            codeBlockIsDiagram = true;
            break;
          }
        }
        
        if (codeBlockIsDiagram) {
          continue; // Skip opening ```
        }
      } else {
        // Ending a code block
        if (codeBlockIsDiagram) {
          inCodeBlock = false;
          codeBlockIsDiagram = false;
          continue; // Skip closing ```
        }
        inCodeBlock = false;
      }
    }
    
    // Skip lines inside a diagram code block
    if (codeBlockIsDiagram) {
      continue;
    }
    
    // Also detect and skip unformatted diagrams (not in code blocks)
    if (!inCodeBlock) {
      // Skip lines that look like diagram boxes
      if (trimmed.match(/^[┌╔\+][-─═]+[┐╗\+]$/) ||
          trimmed.match(/^[└╚\+][-─═]+[┘╝\+]$/) ||
          trimmed.match(/^[│║\|].+[│║\|]$/) ||
          trimmed === 'v' ||
          (trimmed.includes('DATA') && trimmed.includes('DECISIONS') && trimmed.includes('DELIVERY'))) {
        continue;
      }
    }
    
    result.push(line);
  }
  
  // Clean up multiple consecutive empty lines
  const cleaned: string[] = [];
  let prevWasEmpty = false;
  for (const line of result) {
    const isEmpty = line.trim() === '';
    if (isEmpty && prevWasEmpty) continue;
    cleaned.push(line);
    prevWasEmpty = isEmpty;
  }
  
  return cleaned.join('\n');
}

/**
 * Inserts a formatted diagram into a document at a specified position
 */
export function insertDiagramIntoDocument(
  documentContent: string,
  diagram: string,
  position: 'start' | 'end' | { afterHeader: string }
): string {
  if (!diagram.trim()) {
    return documentContent;
  }
  
  // Remove any existing diagrams first
  const cleanedContent = removeExistingDiagrams(documentContent);
  
  // Format the diagram if not already formatted
  const formattedDiagram = diagram.includes('```') 
    ? diagram 
    : formatDiagram(diagram);
  
  if (position === 'start') {
    return formattedDiagram + '\n\n' + cleanedContent;
  }
  
  if (position === 'end') {
    return cleanedContent + '\n\n' + formattedDiagram;
  }
  
  // Insert after specific header
  const { afterHeader } = position;
  const lines = cleanedContent.split('\n');
  const result: string[] = [];
  let inserted = false;
  
  for (let i = 0; i < lines.length; i++) {
    result.push(lines[i]);
    
    if (!inserted) {
      const headerMatch = lines[i].match(/^(#{1,4})\s+(.+)$/);
      if (headerMatch) {
        const headerText = headerMatch[2].trim().toLowerCase();
        const targetText = afterHeader.toLowerCase();
        
        if (headerText === targetText) {
          // Skip any empty lines after header
          while (i + 1 < lines.length && !lines[i + 1].trim()) {
            i++;
            result.push(lines[i]);
          }
          
          // Insert diagram
          result.push('');
          result.push(formattedDiagram);
          result.push('');
          inserted = true;
        }
      }
    }
  }
  
  // If header not found, append to end
  if (!inserted) {
    result.push('');
    result.push(formattedDiagram);
  }
  
  return result.join('\n');
}
