import fetch from 'node-fetch';
import { getApiKey } from '../lib/config.js';

const OPENAI_CHAT_URL = 'https://api.openai.com/v1/chat/completions';

export class OpenAIService {
  constructor({ model = 'gpt-4o', maxTokens = 150, logger = console } = {}) {
    this.model = model;
    this.maxTokens = maxTokens;
    this.logger = logger;
  }

  async describeScreen(base64Image, history = []) {
    const apiKey = getApiKey();
    if (!apiKey) {
      this.logger.error('No OpenAI API key configured');
      return null;
    }

    let prompt = "You are a screen narrator assistant. You're looking at a screenshot from the user's computer screen. Provide a natural, conversational description of what you see. Be concise but informative.";

    if (history.length > 0) {
      prompt += '\n\nPrevious context from recent screenshots:\n';
      history.forEach((entry) => {
        prompt += `${entry.captureNumber}: ${entry.description}\n`;
      });
      prompt += '\nNow describe this new screenshot, noting any changes or continuity:';
    }

    try {
      const response = await fetch(OPENAI_CHAT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: this.model,
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: { url: `data:image/png;base64,${base64Image}` }
                }
              ]
            }
          ],
          max_tokens: this.maxTokens
        })
      });

      const data = await response.json();

      if (data.error) {
        this.logger.error(`OpenAI API error: ${data.error.message}`);
        return null;
      }

      return data.choices?.[0]?.message?.content?.trim() || null;
    } catch (error) {
      this.logger.error(`OpenAI request failed: ${error.message}`);
      return null;
    }
  }

  async extractQueueNumber(base64Image) {
    const apiKey = getApiKey();
    if (!apiKey) {
      this.logger.error('No OpenAI API key configured');
      return null;
    }

    const models = ['gpt-4o', 'gpt-4-turbo', 'gpt-4o-mini'];

    for (const model of models) {
      try {
        const response = await fetch(OPENAI_CHAT_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`
          },
          body: JSON.stringify({
            model,
            messages: [
              {
                role: 'user',
                content: [
                  {
                    type: 'text',
                    text: 'You are looking at a screenshot. Find and extract ONLY the queue number. This could be displayed as "Queue: 15", "Position: 8", "Your number: 23", or similar formats. Return ONLY the numeric value as a raw integer. If no queue number is found, return -1.'
                  },
                  {
                    type: 'image_url',
                    image_url: { url: `data:image/png;base64,${base64Image}` }
                  }
                ]
              }
            ],
            max_tokens: 10
          })
        });

        const data = await response.json();

        if (data.error) {
          this.logger.warn(`Model ${model} failed: ${data.error.message}`);
          continue;
        }

        const raw = data.choices?.[0]?.message?.content?.trim();
        const number = parseInt(raw, 10);

        if (Number.isNaN(number)) {
          this.logger.warn(`Could not parse queue number from response: ${raw}`);
          return null;
        }

        this.logger.info(`Extracted queue number using ${model}: ${number}`);
        return number;
      } catch (error) {
        this.logger.warn(`Model ${model} failed: ${error.message}`);
      }
    }

    this.logger.error('All vision models failed');
    return null;
  }
}
