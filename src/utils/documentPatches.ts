export type DocumentPatch =
  | {
      type: 'replace_exact';
      old_text: string;
      new_text: string;
    }
  | {
      type: 'replace_between';
      start_anchor: string;
      end_anchor: string;
      new_text: string;
      // If true, keep anchors and replace only content between them (default true).
      keep_anchors?: boolean;
    }
  | {
      type: 'insert_after';
      after_anchor: string;
      insert_text: string;
    }
  | {
      type: 'delete_between';
      start_anchor: string;
      end_anchor: string;
      // If true, keep anchors and delete only content between them (default true).
      keep_anchors?: boolean;
    };

export type PatchApplyFailure = {
  patchIndex: number;
  patch: DocumentPatch;
  reason: string;
};

export type ApplyPatchesResult = {
  text: string;
  appliedCount: number;
  failures: PatchApplyFailure[];
};

// ============================================================================
// FUZZY MATCHING UTILITIES
// These help find text even when whitespace/newlines are corrupted or missing
// ============================================================================

/**
 * Normalize whitespace: collapse multiple spaces/newlines into single space
 * Used for fuzzy comparison when exact match fails
 */
function normalizeWhitespace(str: string): string {
  return str.replace(/\s+/g, ' ').trim();
}

/**
 * Check if a string looks like a markdown section header
 * e.g., "## 4. Section Title" or "### 4.4 Subsection"
 */
function isSectionHeader(str: string): boolean {
  return /^#{1,4}\s+[\d.]*\s*\w+/i.test(str.trim());
}

/**
 * Extract the core header pattern (e.g., "### 4.4 Post-Termination")
 * This helps match headers even when followed by concatenated text
 */
function extractHeaderCore(str: string): string | null {
  const match = str.match(/^(#{1,4}\s+[\d.]*\s*[\w\s-]+?)(?:\n|$|[a-z])/i);
  if (match) {
    return match[1].trim();
  }
  // Fallback: just get the header prefix up to a reasonable point
  const simpleMatch = str.match(/^(#{1,4}\s+[\d.]+\s+[\w\s-]{3,50})/);
  return simpleMatch ? simpleMatch[1].trim() : null;
}

/**
 * Build a regex pattern that matches text with flexible whitespace
 * Escapes special regex chars and replaces whitespace with \s+
 */
function buildFlexiblePattern(text: string): RegExp {
  // Escape regex special characters
  const escaped = text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Replace whitespace sequences with flexible whitespace matcher
  const flexible = escaped.replace(/\s+/g, '\\s*');
  return new RegExp(flexible, 'i');
}

/**
 * Find the first N significant words from text (skipping markdown symbols)
 */
function extractSignificantWords(text: string, count: number): string[] {
  const words = text
    .replace(/^#{1,6}\s*/, '') // Remove leading markdown headers
    .replace(/[*_`~]/g, '') // Remove markdown formatting
    .split(/\s+/)
    .filter(w => w.length > 2 && !/^[\d.]+$/.test(w)); // Skip short words and numbers
  return words.slice(0, count);
}

/**
 * Find text by matching significant words/phrases
 * This handles cases where whitespace is completely missing
 */
function findBySignificantContent(haystack: string, needle: string): { index: number; matchedText: string } | null {
  // Extract key phrases from the needle
  const significantWords = extractSignificantWords(needle, 5);
  if (significantWords.length < 2) return null;
  
  // Build a pattern that looks for these words in sequence (with anything between them)
  const pattern = significantWords
    .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
    .join('[\\s\\S]{0,50}?'); // Allow up to 50 chars between words
  
  try {
    const regex = new RegExp(pattern, 'i');
    const match = haystack.match(regex);
    if (match && match.index !== undefined) {
      // Extend the match to include surrounding context
      let startIdx = match.index;
      let endIdx = match.index + match[0].length;
      
      // Walk back to find a good start point (newline, ## header, or start of paragraph)
      while (startIdx > 0 && !/[\n]/.test(haystack[startIdx - 1])) {
        startIdx--;
        if (startIdx < match.index - 100) break; // Don't go too far back
      }
      
      // Walk forward to find end of the section (next header or double newline)
      const afterMatch = haystack.slice(endIdx);
      const nextBoundary = afterMatch.match(/\n\n|(?=\n#{1,4}\s)/);
      if (nextBoundary && nextBoundary.index !== undefined) {
        endIdx = endIdx + nextBoundary.index;
      } else {
        endIdx = Math.min(endIdx + 200, haystack.length);
      }
      
      return { index: startIdx, matchedText: haystack.slice(startIdx, endIdx) };
    }
  } catch {
    // Regex might fail
  }
  return null;
}

/**
 * Find text in haystack using fuzzy matching strategies:
 * 1. Exact match
 * 2. Normalized whitespace match (zero or collapsed whitespace)
 * 3. Section header prefix match (for headers followed by concatenated text)
 * 4. Significant content matching (find by key words)
 * 5. Flexible whitespace regex match
 * 
 * Returns the actual matched text from the document (not the needle)
 * so we can replace the correct substring.
 */
function fuzzyFind(
  haystack: string,
  needle: string
): { index: number; matchedText: string; reason?: string } {
  if (!needle) return { index: -1, matchedText: '', reason: 'Empty anchor/text' };

  // Strategy 1: Exact match (fast path)
  const exactIndex = haystack.indexOf(needle);
  if (exactIndex !== -1) {
    // Check uniqueness
    const secondExact = haystack.indexOf(needle, exactIndex + needle.length);
    if (secondExact === -1) {
      return { index: exactIndex, matchedText: needle };
    }
    // Not unique - continue to other strategies which might find a more specific match
  }

  // Strategy 2: Zero-whitespace matching
  // This handles cases where newlines/spaces are completely missing
  // e.g., "Header\n\nContent" became "HeaderContent"
  const noWhitespaceNeedle = needle.replace(/\s+/g, '').toLowerCase();
  if (noWhitespaceNeedle.length >= 15) {
    // Scan for matching content with no whitespace
    for (let i = 0; i < haystack.length - 10; i++) {
      // Build a no-whitespace version starting from this position
      let j = i;
      let matched = 0;
      const matchStart = i;
      
      while (j < haystack.length && matched < noWhitespaceNeedle.length) {
        const char = haystack[j];
        if (/\s/.test(char)) {
          j++; // Skip whitespace in haystack
          continue;
        }
        if (char.toLowerCase() === noWhitespaceNeedle[matched]) {
          matched++;
          j++;
        } else {
          break;
        }
      }
      
      // If we matched most of the needle content
      if (matched >= noWhitespaceNeedle.length * 0.85) {
        const matchedText = haystack.slice(matchStart, j);
        
        // Verify this is reasonably unique
        const restOfDoc = haystack.slice(j + 50);
        const checkNoWs = restOfDoc.replace(/\s+/g, '').toLowerCase();
        if (!checkNoWs.includes(noWhitespaceNeedle.slice(0, 30))) {
          return { index: matchStart, matchedText };
        }
      }
    }
  }

  // Strategy 3: Normalized whitespace comparison (collapse to single spaces)
  const normalizedNeedle = normalizeWhitespace(needle);
  if (normalizedNeedle.length >= 10) {
    const normalizedHaystack = normalizeWhitespace(haystack);
    const normalizedIdx = normalizedHaystack.indexOf(normalizedNeedle);
    
    if (normalizedIdx !== -1) {
      // Found in normalized form - now map back to original positions
      // Count how many characters (ignoring extra whitespace) to reach normalizedIdx
      let origIdx = 0;
      let normCount = 0;
      let inWhitespace = false;
      
      while (origIdx < haystack.length && normCount < normalizedIdx) {
        const char = haystack[origIdx];
        if (/\s/.test(char)) {
          if (!inWhitespace) {
            normCount++; // Count first whitespace as single space
            inWhitespace = true;
          }
        } else {
          normCount++;
          inWhitespace = false;
        }
        origIdx++;
      }
      
      // Skip leading whitespace at the found position
      while (origIdx < haystack.length && /\s/.test(haystack[origIdx])) {
        origIdx++;
      }
      
      // Now find the end position
      let origEnd = origIdx;
      let normMatchLen = 0;
      inWhitespace = false;
      
      while (origEnd < haystack.length && normMatchLen < normalizedNeedle.length) {
        const char = haystack[origEnd];
        if (/\s/.test(char)) {
          if (!inWhitespace) {
            normMatchLen++;
            inWhitespace = true;
          }
        } else {
          normMatchLen++;
          inWhitespace = false;
        }
        origEnd++;
      }
      
      const matchedText = haystack.slice(origIdx, origEnd);
      return { index: origIdx, matchedText };
    }
  }

  // Strategy 4: Section header prefix matching
  // For markdown headers, find them even when followed by concatenated text
  if (isSectionHeader(needle)) {
    const headerCore = extractHeaderCore(needle);
    if (headerCore && headerCore.length >= 5) {
      // Try to find the header with flexible whitespace
      const headerWords = headerCore.split(/\s+/).filter(w => w.length > 0);
      if (headerWords.length >= 2) {
        // Build pattern: ## + number + title words
        const headerPattern = headerWords
          .map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
          .join('\\s*');
        
        try {
          const regex = new RegExp(headerPattern, 'i');
          const match = haystack.match(regex);
          if (match && match.index !== undefined) {
            const startIdx = match.index;
            
            // Find end of this section (next header or significant break)
            let endIdx = startIdx + match[0].length;
            
            // If needle is longer, try to match more content
            if (needle.length > headerCore.length + 10) {
              // Look for the next section marker
              const afterHeader = haystack.slice(startIdx);
              const nextSection = afterHeader.match(/\n(?=#{1,4}\s+\d|## )/);
              if (nextSection && nextSection.index) {
                endIdx = startIdx + Math.min(nextSection.index, needle.length + 100);
              } else {
                endIdx = startIdx + Math.min(needle.length + 50, 500);
              }
            }
            
            const matchedText = haystack.slice(startIdx, endIdx);
            return { index: startIdx, matchedText };
          }
        } catch {
          // Regex failed
        }
      }
    }
  }

  // Strategy 5: Significant content matching
  // Find by key words when structure is badly corrupted
  const contentMatch = findBySignificantContent(haystack, needle);
  if (contentMatch) {
    return contentMatch;
  }

  // Strategy 6: Flexible whitespace regex (most permissive)
  if (needle.length >= 10 && needle.length <= 300) {
    try {
      const flexPattern = buildFlexiblePattern(needle);
      const match = haystack.match(flexPattern);
      if (match && match.index !== undefined) {
        // Check uniqueness by searching for another match after this one
        const rest = haystack.slice(match.index + match[0].length);
        const secondMatch = rest.match(flexPattern);
        if (!secondMatch) {
          return { index: match.index, matchedText: match[0] };
        }
      }
    } catch {
      // Regex might fail for complex patterns, that's okay
    }
  }

  // No fuzzy match found, return failure
  if (exactIndex !== -1) {
    return { index: -1, matchedText: '', reason: 'Anchor/text is not unique' };
  }
  return { index: -1, matchedText: '', reason: 'Anchor/text not found (even with fuzzy matching)' };
}

// ============================================================================
// ORIGINAL HELPER FUNCTIONS (kept for backward compatibility)
// ============================================================================

function countOccurrences(haystack: string, needle: string): number {
  if (!needle) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const next = haystack.indexOf(needle, idx);
    if (next === -1) break;
    count += 1;
    idx = next + needle.length;
  }
  return count;
}

function findUniqueIndex(haystack: string, needle: string): { index: number; reason?: string; matchedText?: string } {
  // First try exact match
  if (!needle) return { index: -1, reason: 'Empty anchor/text' };
  const first = haystack.indexOf(needle);
  if (first !== -1) {
    const second = haystack.indexOf(needle, first + needle.length);
    if (second === -1) {
      return { index: first, matchedText: needle };
    }
  }
  
  // Exact match failed or not unique, try fuzzy matching
  const fuzzyResult = fuzzyFind(haystack, needle);
  if (fuzzyResult.index >= 0) {
    return { index: fuzzyResult.index, matchedText: fuzzyResult.matchedText };
  }
  
  return { index: -1, reason: fuzzyResult.reason || 'Anchor/text not found' };
}

// Debug flag - set to true for verbose logging
const DEBUG_PATCHES = typeof window !== 'undefined' && (window as any).__DEBUG_PATCHES__;

function debugLog(...args: any[]) {
  if (DEBUG_PATCHES || (typeof process !== 'undefined' && process.env?.NODE_ENV === 'development')) {
    // eslint-disable-next-line no-console
    console.log('[DocumentPatches]', ...args);
  }
}

export function applyDocumentPatches(fullText: string, patches: DocumentPatch[]): ApplyPatchesResult {
  let text = String(fullText ?? '');
  const failures: PatchApplyFailure[] = [];
  let appliedCount = 0;

  debugLog('Applying', patches.length, 'patches to document of length', text.length);

  patches.forEach((patch, patchIndex) => {
    try {
      if (patch.type === 'replace_exact') {
        const oldText = patch.old_text ?? '';
        const newText = patch.new_text ?? '';
        
        debugLog(`Patch #${patchIndex}: replace_exact`);
        debugLog(`  Looking for (${oldText.length} chars):`, oldText.substring(0, 100) + (oldText.length > 100 ? '...' : ''));
        
        // First try exact match (fast path)
        const exactOcc = countOccurrences(text, oldText);
        debugLog(`  Exact matches found:`, exactOcc);
        
        if (exactOcc === 1) {
          const idx = text.indexOf(oldText);
          text = text.slice(0, idx) + newText + text.slice(idx + oldText.length);
          appliedCount += 1;
          debugLog(`  ✓ Applied via exact match at index`, idx);
          return;
        }
        
        // Exact match failed - use fuzzy matching
        debugLog(`  Trying fuzzy matching...`);
        const fuzzyResult = fuzzyFind(text, oldText);
        debugLog(`  Fuzzy result:`, fuzzyResult.index >= 0 ? `found at ${fuzzyResult.index}` : fuzzyResult.reason);
        
        if (fuzzyResult.index >= 0 && fuzzyResult.matchedText) {
          debugLog(`  Fuzzy matched text (${fuzzyResult.matchedText.length} chars):`, fuzzyResult.matchedText.substring(0, 100) + (fuzzyResult.matchedText.length > 100 ? '...' : ''));
          // Replace the actual matched text (which may differ from oldText due to whitespace)
          text = text.slice(0, fuzzyResult.index) + newText + text.slice(fuzzyResult.index + fuzzyResult.matchedText.length);
          appliedCount += 1;
          debugLog(`  ✓ Applied via fuzzy match`);
          return;
        }
        
        // Log what's near the expected content for debugging
        const firstWords = oldText.split(/\s+/).slice(0, 3).join(' ');
        if (firstWords.length > 5) {
          const nearbyIdx = text.toLowerCase().indexOf(firstWords.toLowerCase().slice(0, 20));
          if (nearbyIdx >= 0) {
            debugLog(`  Nearby content at ${nearbyIdx}:`, text.substring(nearbyIdx, nearbyIdx + 150));
          }
        }
        
        throw new Error(fuzzyResult.reason || (exactOcc === 0 ? 'old_text not found' : 'old_text not unique'));
      }

      if (patch.type === 'insert_after') {
        const anchor = patch.after_anchor ?? '';
        const insertText = patch.insert_text ?? '';
        const found = findUniqueIndex(text, anchor);
        if (found.index < 0) throw new Error(found.reason || 'after_anchor not found');
        
        // Use the actual matched text length (might differ from anchor due to fuzzy matching)
        const anchorLength = found.matchedText?.length ?? anchor.length;
        const insertAt = found.index + anchorLength;
        text = text.slice(0, insertAt) + insertText + text.slice(insertAt);
        appliedCount += 1;
        return;
      }

      if (patch.type === 'replace_between') {
        const start = patch.start_anchor ?? '';
        const end = patch.end_anchor ?? '';
        const newText = patch.new_text ?? '';
        const keepAnchors = patch.keep_anchors !== false;

        const startFound = findUniqueIndex(text, start);
        if (startFound.index < 0) throw new Error(`start_anchor: ${startFound.reason || 'not found'}`);
        const endFound = findUniqueIndex(text, end);
        if (endFound.index < 0) throw new Error(`end_anchor: ${endFound.reason || 'not found'}`);

        // Use actual matched text lengths
        const startMatchLen = startFound.matchedText?.length ?? start.length;
        const endMatchLen = endFound.matchedText?.length ?? end.length;
        
        const startEnd = startFound.index + startMatchLen;
        const endStart = endFound.index;
        if (endStart < startEnd) throw new Error('end_anchor occurs before start_anchor');

        if (keepAnchors) {
          text = text.slice(0, startEnd) + newText + text.slice(endStart);
        } else {
          text = text.slice(0, startFound.index) + newText + text.slice(endFound.index + endMatchLen);
        }
        appliedCount += 1;
        return;
      }

      if (patch.type === 'delete_between') {
        const start = patch.start_anchor ?? '';
        const end = patch.end_anchor ?? '';
        const keepAnchors = patch.keep_anchors !== false;

        const startFound = findUniqueIndex(text, start);
        if (startFound.index < 0) throw new Error(`start_anchor: ${startFound.reason || 'not found'}`);
        const endFound = findUniqueIndex(text, end);
        if (endFound.index < 0) throw new Error(`end_anchor: ${endFound.reason || 'not found'}`);

        // Use actual matched text lengths
        const startMatchLen = startFound.matchedText?.length ?? start.length;
        const endMatchLen = endFound.matchedText?.length ?? end.length;
        
        const startEnd = startFound.index + startMatchLen;
        const endStart = endFound.index;
        if (endStart < startEnd) throw new Error('end_anchor occurs before start_anchor');

        if (keepAnchors) {
          text = text.slice(0, startEnd) + text.slice(endStart);
        } else {
          text = text.slice(0, startFound.index) + text.slice(endFound.index + endMatchLen);
        }
        appliedCount += 1;
        return;
      }

      // Exhaustiveness check
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const _never: never = patch;
    } catch (e: any) {
      failures.push({
        patchIndex,
        patch,
        reason: e?.message || String(e),
      });
    }
  });

  return { text, appliedCount, failures };
}

