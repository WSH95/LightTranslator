/**
 * Clean up text by removing unwanted line breaks within paragraphs
 * while preserving actual paragraph breaks.
 */
export function cleanTextLineBreaks(text: string): string {
  if (!text) return '';
  
  // Split into lines
  const lines = text.split('\n');
  const result: string[] = [];
  let currentParagraph = '';
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Empty line means paragraph break
    if (!line) {
      if (currentParagraph) {
        result.push(currentParagraph.trim());
        currentParagraph = '';
      }
      continue;
    }
    
    // Check if previous line ended with sentence-ending punctuation
    const prevEndsWithPunctuation = currentParagraph && 
      /[.!?。！？；;:：）)】」』"']$/.test(currentParagraph.trim());
    
    // Check if current line starts with a capital letter or Chinese character (might be new paragraph)
    const startsNewSentence = /^[A-Z\u4e00-\u9fff]/.test(line);
    
    // If previous line ended with punctuation and current starts with capital, might be new paragraph
    // But only if the previous line was reasonably long (not just a short title)
    if (prevEndsWithPunctuation && startsNewSentence && currentParagraph.length > 50) {
      result.push(currentParagraph.trim());
      currentParagraph = line;
    } else if (currentParagraph) {
      // Continue the same paragraph - join with space for English, no space for CJK
      const lastChar = currentParagraph.slice(-1);
      const firstChar = line.charAt(0);
      
      // Check if both are CJK characters (no space needed)
      const isCJK = (char: string) => /[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(char);
      
      if (isCJK(lastChar) || isCJK(firstChar)) {
        currentParagraph += line;
      } else {
        // Add space for non-CJK (English, etc.)
        currentParagraph += ' ' + line;
      }
    } else {
      currentParagraph = line;
    }
  }
  
  // Don't forget the last paragraph
  if (currentParagraph) {
    result.push(currentParagraph.trim());
  }
  
  return result.join('\n\n');
}

/**
 * Check if text has unnecessary line breaks (potential OCR/copy issue)
 */
export function hasUnnecessaryLineBreaks(text: string): boolean {
  if (!text) return false;
  
  const lines = text.split('\n');
  
  // If there are multiple consecutive non-empty lines that don't end with punctuation,
  // it's likely there are unnecessary line breaks
  for (let i = 0; i < lines.length - 1; i++) {
    const currentLine = lines[i].trim();
    const nextLine = lines[i + 1].trim();
    
    if (currentLine && nextLine) {
      // Line doesn't end with sentence-ending punctuation and next line is not empty
      if (!/[.!?。！？；;）)】」』"'\n]$/.test(currentLine)) {
        return true;
      }
    }
  }
  
  return false;
}
