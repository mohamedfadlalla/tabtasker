// background.js
import logger from './logger.js';
import { TabClassifier } from './classifier.js';
import { TabOrganizer } from './tabOrganizer.js';
import { DataCollector } from './dataCollector.js';
import { GraphVisualizer } from './graphVisualizer.js';

let isClassificationEnabled = false;
let classificationMode = 'simple';
let customProjects = [];

const groupTabs = async (mode = 'simple', projects = []) => {
  try {
    logger.info(`Starting tab grouping process in ${mode} mode`);
    const tabs = await chrome.tabs.query({ currentWindow: true, windowType: 'normal' });
    
    const tabClassifications = new Map();
    for (const tab of tabs) {
      const classification = await TabClassifier.classifyWithRetry(tab, mode, projects);
      if (classification) {
        tabClassifications.set(tab.id, classification);
      }
    }

    isClassificationEnabled = true;
    classificationMode = mode;
    customProjects = projects;
    
    logger.info('Auto-classification enabled with mode:', mode);
    const result = await TabOrganizer.createGroups(tabClassifications, mode);
    const collectionResult = await DataCollector.collectData();
    if (collectionResult.success && collectionResult.data) {
      // await GraphVisualizer.visualizeData(collectionResult.data);
    }
    return result;
  } catch (error) {
    logger.error('Failed to group tabs:', error);
    return { success: false, message: 'Failed to group tabs.' };
  }
}

// Keep track of tabs that are still loading
const loadingTabs = new Set();

// Function to classify a single tab and add it to a group
const classifyAndGroupTab = async (tabId) => {
  if (!isClassificationEnabled) return;
  
  try {
    // Wait for a moment to ensure the page is fully loaded
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const tab = await chrome.tabs.get(tabId);
    
    // Don't classify empty tabs, chrome:// URLs, or non-normal windows
    if (!tab.url || 
        tab.url.startsWith('chrome://') || 
        tab.url.startsWith('edge://') ||
        tab.url === 'about:blank' ||
        tab.status !== 'complete') {
      return;
    }

    // Force a fresh content reload by executing a script
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => {
        // Clear any page cache
        window.stop();
        // Get fresh document content
        return document.documentElement.outerHTML;
      }
    });

    logger.info(`Classifying tab: "${tab.title}" (URL: ${tab.url})`);
    const classification = await TabClassifier.classifyWithRetry(
      tab, 
      classificationMode, 
      customProjects
    );
    
    if (classification) {
      await TabOrganizer.createGroups(
        new Map([[tab.id, classification]]), 
        classificationMode
      );
      const collectionResult = await DataCollector.collectData();
      if (collectionResult.success && collectionResult.data) {
        // await GraphVisualizer.visualizeData(collectionResult.data);
      }
      logger.success(`New tab classified as "${classification}": ${tab.title}`);
    }
  } catch (error) {
    logger.error('Failed to classify new tab:', error);
  } finally {
    loadingTabs.delete(tabId);
  }
};

// Listen for tab updates
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (!isClassificationEnabled) return;

  // If the tab is loading and we haven't processed it yet
  if (changeInfo.status === 'loading' && !loadingTabs.has(tabId)) {
    loadingTabs.add(tabId);
  }
  
  // When the tab completes loading
  if (changeInfo.status === 'complete' && loadingTabs.has(tabId)) {
    // Wait a short moment for the page to fully render
    setTimeout(() => classifyAndGroupTab(tabId), 1500);
  }
});

// Listen for new tab creation
chrome.tabs.onCreated.addListener((tab) => {
  if (!isClassificationEnabled) return;
  
  // Add to loading tabs set
  loadingTabs.add(tab.id);
  
  // Wait for the tab to get its initial URL and content
  setTimeout(() => classifyAndGroupTab(tab.id), 2000);
});

// Listen for messages from popup
// Remove GraphVisualizer calls from groupTabs and classifyAndGroupTab

// Update the message listener to include new visualization action
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'groupTabs') {
    const mode = request.mode || 'simple';
    const projects = request.projects || [];
    groupTabs(mode, projects).then(sendResponse);
    return true;
  }
  
  if (request.action === 'toggleClassification') {
    isClassificationEnabled = !isClassificationEnabled;
    classificationMode = request.mode || classificationMode;
    customProjects = request.projects || customProjects;
    logger.info(`Auto-classification ${isClassificationEnabled ? 'enabled' : 'disabled'} in ${classificationMode} mode`);
    sendResponse({ success: true, enabled: isClassificationEnabled });
    return true;
  }

  if (request.action === 'visualizeData') {
    (async () => {
      try {
        const collectionResult = await DataCollector.collectData();
        if (collectionResult.success && collectionResult.data) {
          await GraphVisualizer.visualizeData(collectionResult.data);
          logger.success('Data visualization completed successfully');
          sendResponse({ success: true });
        } else {
          logger.warn('No data available for visualization');
          sendResponse({ success: false, message: 'No data available for visualization' });
        }
      } catch (error) {
        logger.error('Failed to visualize data:', error);
        sendResponse({ success: false, message: 'Failed to visualize data' });
      }
    })();
    return true; // Keep message channel open for async response
  }
});

logger.info('Background script loaded and ready!');
DataCollector.initializeTabTracking();