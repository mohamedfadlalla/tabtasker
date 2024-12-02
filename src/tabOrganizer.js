// tabOrganizer.js
import logger from './logger.js';

// Constants for color mapping
const COLOR_MAP = {
  simple: {
    work: 'blue',
    break: 'orange',
    other: 'grey'
  },
  custom: {
    other: 'grey',
    default: 'purple'
  },
  palette: ['blue', 'red', 'yellow', 'green', 'pink', 'cyan', 'orange']
};

export class TabOrganizer {
  constructor() {
    // Constructor if needed
  }

  static async createGroups(classifications, mode = 'simple') {
    try {
      const groups = Array.from(classifications.entries()).reduce((acc, [tabId, classification]) => {
        (acc[classification] = acc[classification] || []).push(tabId);
        return acc;
      }, {});

      await TabOrganizer.processGroups(groups, mode);
      return { success: true, message: 'Tabs grouped successfully!' };
    } catch (error) {
      logger.error('Failed to create groups:', error);
      return { success: false, message: 'Failed to create groups' };
    }
  }

  static getGroupColor(classification, mode) {
    if (mode === 'simple') {
      return COLOR_MAP.simple[classification] || COLOR_MAP.simple.other;
    }

    if (COLOR_MAP.custom[classification]) {
      return COLOR_MAP.custom[classification];
    }

    const hash = classification.split('')
      .reduce((acc, char) => char.charCodeAt(0) + acc, 0);
    return COLOR_MAP.palette[Math.abs(hash) % COLOR_MAP.palette.length];
  }

  static async findExistingGroup(classification, mode) {
    const groups = await chrome.tabGroups.query({ 
      windowId: chrome.windows.WINDOW_ID_CURRENT 
    });
    
    const normalizedClassification = classification.toLowerCase();
    return groups.find(group => {
      const groupTitle = group.title?.toLowerCase();
      // Only return a match if the titles match exactly, regardless of mode
      return groupTitle === normalizedClassification;
    });
  }

  static async processGroups(groups, mode) {
    const tabs = await chrome.tabs.query({ windowType: 'normal' });
    const tabIds = new Set(tabs.map(tab => tab.id));

    // Process groups sequentially instead of in parallel
    for (const [classification, groupTabIds] of Object.entries(groups)) {
      if (!groupTabIds.length) continue;

      const validTabIds = groupTabIds.filter(id => tabIds.has(id));
      if (!validTabIds.length) continue;

      try {
        const existingGroup = await TabOrganizer.findExistingGroup(classification, mode);
        
        if (existingGroup) {
          try {
            await chrome.tabs.group({
              tabIds: validTabIds,
              groupId: existingGroup.id
            });
            logger.success(`Added ${validTabIds.length} tabs to existing "${classification}" group`);
          } catch (error) {
            logger.warning(`Failed to add to existing group, creating new one: ${error.message}`);
            const groupId = await chrome.tabs.group({ tabIds: validTabIds });
            await chrome.tabGroups.update(groupId, {
              title: classification,
              color: TabOrganizer.getGroupColor(classification, mode)
            });
          }
        } else {
          const groupId = await chrome.tabs.group({ tabIds: validTabIds });
          await chrome.tabGroups.update(groupId, {
            title: classification,
            color: TabOrganizer.getGroupColor(classification, mode)
          });
          logger.success(`Created new group "${classification}" with ${validTabIds.length} tabs`);
        }
      } catch (error) {
        logger.error(`Failed to process group "${classification}":`, error);
      }
    }
  }
}