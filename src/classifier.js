import logger from './logger.js';
import { TabContentExtractor } from './tabContent.js';

export class TabClassifier {
  static #session = null;
  
  static async #getSession(systemPrompt) {
    if (!this.#session) {
      this.#session = await self.ai.languageModel.create({
        role: "system",
        content: systemPrompt
      });
    }
    return this.#session;
  }

  static #getSystemPrompt(mode) {
    return mode === 'simple' 
      ? `Ignore all non-English languages. Output must be in English only.
You are a webpage classifier that categorizes browser tab titles and content into two categories: "work" or "break". 
- "work" refers to productive, professional, or educational activities
- "break" refers to leisure or non-work activities
Respond with exactly one word: either "work" or "break".`
      : `You are a specialized webpage classifier that maps content to predefined project categories. Your role:

Input processing:
- Project list with descriptions
- Tab title and page content
- Process English content only

Output requirements:
- Return exactly one project name from provided list
- No explanations or additional text
- Base classification on both title and content relevance
- Default to "other" if no clear project match

Strict output format: Single project name only`;
  }

  static #getUserPrompt(mode, projects, tabTitle, pageContent) {
    // Format projects text
    const projectsText = projects.length > 0 
      ? projects.map(p => `"${p.name}": ${p.description}`).join('\n')
      : 'No custom projects defined. Using simple work/break classification.';
    
    // Create comma-separated project names
    const projectNames = projects.length > 0
      ? projects.map(p => p.name).join(', ')
      : '';

    return `
Classify this page into ONE project category:

Available Projects:
${projectsText}

Page Details:
Title: ${tabTitle}
Content: ${pageContent}

${mode === 'simple' 
  ? 'Respond with exactly one word: either "work" or "break".' 
  : `Output format: Respond with single word from [${projectNames}, other]`}`;
  }

  static async classify(tabTitle, pageContent, mode = 'simple', projects = []) {
    try {
      // Get the system prompt
      const systemPrompt = this.#getSystemPrompt(mode);
      
      // Log classification attempt
      logger.info(`Attempting to classify tab: "${tabTitle}"`);
      console.log('Classification attempt for:', tabTitle);

      // Get or create the session
      const session = await this.#getSession(systemPrompt);

      // Format the user prompt
      const userPrompt = this.#getUserPrompt(mode, projects, tabTitle, pageContent);

      // Log prompts for debugging
      logger.info('System Prompt:', systemPrompt);
      logger.info('User Prompt:', userPrompt);
      
      // Make the API call using Gemini Nano
      const response = await session.prompt(userPrompt);
      
      // Log raw response for debugging
      logger.info('Raw Gemini response:', response);
      console.log('Raw Gemini response:', response);

      // Process and validate the response
      const classification = response.trim().toLowerCase().replace(/['"]/g, '');
      
      // Log the result
      logger.info(`Classification result for "${tabTitle}": ${classification}`);
      console.log('Classification result:', classification);

      if (classification && classification !== '') {
        // Validate classification against allowed values
        if (mode === 'simple') {
          if (!['work', 'break'].includes(classification)) {
            throw new Error(`Invalid classification: ${classification}. Must be either "work" or "break"`);
          }
        } else {
          const allowedValues = [...projects.map(p => p.name.toLowerCase()), 'other'];
          if (!allowedValues.includes(classification)) {
            throw new Error(`Invalid classification: ${classification}. Must be one of: ${allowedValues.join(', ')}`);
          }
        }
        return classification;
      } else {
        throw new Error('Empty or invalid classification received');
      }
    } catch (error) {
      // Log the error with full context
      logger.error('Classification failed:', {
        error: error.message,
        tabTitle,
        mode,
        projects: projects.length
      });
      console.error('Classification Error:', error);
      throw error;
    } finally {
      // Clean up the session
      if (this.#session) {
        this.#session.destroy();
        this.#session = null;
      }
    }
  }

  static async classifyWithRetry(tab, mode = 'simple', projects = [], maxRetries = 3) {
    logger.info(`Classifying tab: "${tab.title}" (ID: ${tab.id})`);
    console.log(`Starting classification for tab: "${tab.title}" (ID: ${tab.id})`);

    try {
      // Extract content with error handling
      const content = await TabContentExtractor.extractContent(tab.id);
      const truncatedContent = content.slice(0, 500); // Limit content length for API
      
      let lastError = null;
      
      // Log the truncated content
      logger.info('Truncated content for classification:', truncatedContent);
      console.log('Truncated content for classification:', truncatedContent);
      
      // Attempt classification with retries
      for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
        logger.info(`Starting classification attempt ${retryCount + 1}/${maxRetries}`);
        console.log(`Starting classification attempt ${retryCount + 1}/${maxRetries}`);
        try {
          // Add exponential backoff for retries
          if (retryCount > 0) {
            const backoffTime = Math.pow(2, retryCount) * 1000;
            logger.warn(`Retry attempt ${retryCount + 1} for tab ${tab.id}, waiting ${backoffTime}ms`);
            console.log(`Retry attempt ${retryCount + 1}, waiting ${backoffTime}ms`);
            await new Promise(resolve => setTimeout(resolve, backoffTime));
          }

          const classification = await this.classify(tab.title, truncatedContent, mode, projects);
          logger.info(`Successfully classified tab ${tab.id} on attempt ${retryCount + 1}`);
          console.log(`Classification successful on attempt ${retryCount + 1}:`, classification);
          
          return classification;
          
        } catch (error) {
          lastError = error;
          logger.error(`Classification attempt ${retryCount + 1} failed:`, error);
          console.error(`Attempt ${retryCount + 1} failed:`, error);
          
          // If this is the last retry, throw the error
          if (retryCount === maxRetries - 1) {
            throw error;
          }
        }
      }

      // This code should never be reached due to the throw in the loop
      throw lastError || new Error('Classification failed for unknown reason');
      
    } catch (error) {
      logger.error(`All ${maxRetries} classification attempts failed for tab ${tab.id}. Last error:`, error);
      console.error(`All ${maxRetries} classification attempts failed. Last error:`, error);
      
      // Return default classification based on mode
      return mode === 'simple' ? 'other' : 'other';
    }
  }
}