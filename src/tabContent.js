// tabContent.js
import logger from './logger.js';

export class TabContentExtractor {
  static async extractContent(tabId) {
    try {
      const [result] = await chrome.scripting.executeScript({
        target: { tabId },
        func: () => {
          const getText = (node) => {
            if (node.nodeType === Node.TEXT_NODE) return node.textContent;
            if (node.nodeType !== Node.ELEMENT_NODE) return '';
            if (['SCRIPT', 'STYLE', 'NOSCRIPT'].includes(node.tagName)) return '';
            return Array.from(node.childNodes)
              .map(getText)
              .join(' ')
              .replace(/\\s+/g, ' ')
              .trim();
          };
          return getText(document.body);
        }
      });
      return result.result || '';
    } catch (error) {
      logger.error('Failed to extract page content:', error);
      return '';
    }
  }
}