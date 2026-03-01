/**
 * Response Parser - Extracts structured data from Llama responses
 * Used for analyzing companion responses, extracting recommendations, etc.
 */

class ResponseParser {
  /**
   * Parse response to extract any structured data/recommendations
   */
  static parseResponse(response) {
    return {
      text: response,
      hasQuestion: response.includes('?'),
      isValidation: this.detectValidation(response),
      isSuggestion: this.detectSuggestion(response),
      isEmpathetic: this.detectEmpathy(response),
      language: this.detectLanguage(response),
    };
  }

  /**
   * Detect if response validates youth feeling
   */
  static detectValidation(response) {
    const validationPatterns = [
      /that (sounds|makes|sounds like|is)/i,
      /your (feelings|concerns|experience)/i,
      /i (hear|understand|see) you/i,
      /you (have|are) (right|valid)/i,
      /it makes sense/i,
    ];

    return validationPatterns.some((pattern) => pattern.test(response));
  }

  /**
   * Detect if response includes suggestion
   */
  static detectSuggestion(response) {
    const suggestionPatterns = [
      /try|consider|maybe|could|might/i,
      /talking to|reaching out/i,
      /would it help/i,
      /what if/i,
      /one thing that might/i,
    ];

    return suggestionPatterns.some((pattern) => pattern.test(response));
  }

  /**
   * Detect empathetic language
   */
  static detectEmpathy(response) {
    const empathyPatterns = [
      /i (understand|see|hear|get)/i,
      /that (sounds|must be|seems)/i,
      /you (sound|seem|must be)/i,
      /care|support|help you/i,
      /i'm (here|listening)/i,
    ];

    return empathyPatterns.some((pattern) => pattern.test(response));
  }

  /**
   * Detect primary language (simple check)
   */
  static detectLanguage(response) {
    // Simple heuristic based on character patterns
    const nonLatinCount = (response.match(/[^\x00-\x7F]/g) || []).length;
    const totalChars = response.length;

    if (nonLatinCount / totalChars > 0.1) {
      return 'multilingual';
    }

    return 'english';
  }

  /**
   * Extract action items from response
   */
  static extractActionItems(response) {
    const actions = [];

    // Look for suggestion patterns
    const lines = response.split(/[\.\!\?]/);

    lines.forEach((line) => {
      if (
        /talk|speak|tell|contact|reach out/i.test(line) &&
        /staff|counselor|therapist|adult/i.test(line)
      ) {
        actions.push({
          type: 'contact-staff',
          description: line.trim(),
        });
      }

      if (/try|consider|practice/i.test(line) && /breathing|write|exercise/i.test(line)) {
        actions.push({
          type: 'coping-strategy',
          description: line.trim(),
        });
      }
    });

    return actions;
  }

  /**
   * Check response quality
   */
  static assessQuality(response) {
    const score = {
      empathy: this.detectEmpathy(response) ? 1 : 0,
      validation: this.detectValidation(response) ? 1 : 0,
      suggestion: this.detectSuggestion(response) ? 1 : 0,
      length: response.length > 30 && response.length < 500 ? 1 : 0,
      noRepetition: !/(.)\\1{3,}/.test(response) ? 1 : 0,
    };

    const total = Object.values(score).reduce((a, b) => a + b, 0);
    const quality = (total / 5) * 100;

    return {
      score: quality,
      components: score,
      isQuality: quality >= 60,
    };
  }
}

module.exports = ResponseParser;
