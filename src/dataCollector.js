// dataCollector.js
import logger from './logger.js';
import { TabContentExtractor } from './tabContent.js';

export class DataCollector {
  static tabStartTimes = new Map();
  static #aiSession = null;

  static async #getAISession() {
    if (!this.#aiSession) {
      const systemPrompt = {
        role: "system",
        content: "You are a precise webpage summarizer and relationship analyzer. Focus on factual content and key information."
      };
      this.#aiSession = await self.ai.languageModel.create(systemPrompt);
    }
    return this.#aiSession;
  }

  static isSummaryNeeded(summary) {
    return !summary || 
           summary === 'Summary unavailable' || 
           summary === '';
  }

  static isRelationshipNeeded(relationship) {
    return !relationship || 
           relationship === 'related content' || 
           relationship === 'No connection' || 
           relationship === '';
  }

  static async #summarizeContent(title, content) {
    try {
      const session = await this.#getAISession();
      const prompt = `
      Webpage Title: ${title}
      Content: ${content}

      Provide a concise one-paragraph summary (max 100 words).`;

      const response = await session.prompt(prompt);
      return response.trim();
    } catch (error) {
      logger.error('Summarization failed:', error);
      return 'Summary unavailable';
    }
  }

  static async #analyzeRelationship(tab1, tab2) {
    try {
      const session = await this.#getAISession();
      const prompt = `
      PAGE 1
      Title: ${tab1.title}
      Content: ${tab1.summary}

      PAGE 2
      Title: ${tab2.title}
      Content: ${tab2.summary}

      OUTPUT RULES:
      - Use 3-7 words only
      - Start with action verb
      - Focus on core relationship
      - Avoid "Page1/Page2" references

      Relationship:`;

      const response = await session.prompt(prompt);
      return response.trim();
    } catch (error) {
      logger.error('Relationship analysis failed:', error);
      return 'related content';
    }
  }

  static initializeTabTracking() {
    chrome.tabs.onActivated.addListener(({ tabId }) => {
      const now = Date.now();
      this.updateTabTime(tabId, now);
    });
  }

  static updateTabTime(tabId, timestamp) {
    this.tabStartTimes.set(tabId, timestamp);
  }

  static getTabDuration(tabId) {
    const startTime = this.tabStartTimes.get(tabId);
    return startTime ? Date.now() - startTime : 0;
  }

  static async collectData() {
    try {
      const windows = await chrome.windows.getAll();
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const data = {
        groups: [],
        tabs: [],
        relationships: []
      };

      for (const window of windows) {
        const groups = await chrome.tabGroups.query({ windowId: window.id });
        
        for (const group of groups) {
          const groupData = {
            group_id: group.id,
            window_id: window.id,
            title: group.title || '',
            color: group.color,
            created_at: timestamp,
            status: 'active'
          };
          data.groups.push(groupData);

          const tabs = await chrome.tabs.query({ groupId: group.id });
          
          const tabsData = await Promise.all(tabs.map(async (tab, index) => {
            const existingData = await chrome.storage.local.get(`tab_${tab.id}`);
            let summary = existingData[`tab_${tab.id}`]?.summary || 'Summary unavailable';

            if (this.isSummaryNeeded(summary)) {
              try {
                const content = await TabContentExtractor.extractContent(tab.id);
                const truncatedContent = content.slice(0, 2000);
                summary = await this.#summarizeContent(tab.title, truncatedContent);
                await chrome.storage.local.set({
                  [`tab_${tab.id}`]: { summary }
                });
              } catch (error) {
                logger.error(`Failed to summarize tab ${tab.id}:`, error);
              }
            }

            return {
              tab_id: tab.id,
              group_id: group.id,
              url: tab.url,
              title: tab.title,
              position_in_group: index,
              created_at: timestamp,
              status: 'active',
              summary: summary,
              time_spent_ms: this.getTabDuration(tab.id)
            };
          }));
          
          data.tabs.push(...tabsData);

          for (let i = 0; i < tabsData.length; i++) {
            for (let j = i + 1; j < tabsData.length; j++) {
              const relationshipId = `${tabsData[i].tab_id}-${tabsData[j].tab_id}`;
              const existingRelationship = await chrome.storage.local.get(`rel_${relationshipId}`);
              let relationship = existingRelationship[`rel_${relationshipId}`]?.relationship || '';

              if (this.isRelationshipNeeded(relationship)) {
                relationship = await this.#analyzeRelationship(tabsData[i], tabsData[j]);
                await chrome.storage.local.set({
                  [`rel_${relationshipId}`]: { relationship }
                });
              }

              data.relationships.push({
                relationship_id: relationshipId,
                source_tab_id: tabsData[i].tab_id,
                target_tab_id: tabsData[j].tab_id,
                group_id: group.id,
                relationship: relationship
              });
            }
          }
        }
      }

      await chrome.storage.local.set({
        latestCollectedData: data
      });

      logger.info('Data collected and stored in chrome.storage.local');
      
      return {
        success: true,
        data: data
      };
    } catch (error) {
      logger.error('Failed to collect tab data:', error);
      return {
        success: false,
        data: null
      };
    }
  }

  static destroy() {
    if (this.#aiSession) {
      this.#aiSession.destroy();
      this.#aiSession = null;
    }
  }
}