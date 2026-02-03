/**
 * Tool Intelligence Service - Range Inference
 * Feature: 018-tool-intelligence
 *
 * Extracts and manages input ranges from course content
 * for contextual feedback during tool usage.
 */

import { InputRange, InputFeedback, FeedbackType, ConfidenceLevel } from './types';

// ========== RANGE EXTRACTION ==========

/**
 * Extract input ranges from course analysis deep content
 *
 * This is called during tool generation to store ranges with tool metadata.
 *
 * @param deepContent - Deep content from course analysis
 * @param toolInputs - Tool input field definitions
 * @returns Array of inferred input ranges
 */
export function inferInputRanges(
  deepContent: {
    numberedFramework?: {
      frameworkName: string;
      items: Array<{
        number: number;
        name: string;
        fullLabel: string;
        definition: string;
        toolInputLabel: string;
      }>;
    };
    keyTerminology?: Array<{
      term: string;
      definition: string;
      howToUseInTool: string;
    }>;
  } | null,
  toolInputs: Array<{
    name: string;
    label: string;
    type: string;
  }>
): InputRange[] {
  const ranges: InputRange[] = [];

  if (!deepContent) {
    return ranges;
  }

  // Extract ranges from numbered framework items
  if (deepContent.numberedFramework?.items) {
    for (const item of deepContent.numberedFramework.items) {
      // Try to find matching tool input
      const matchingInput = toolInputs.find(
        input =>
          input.label.toLowerCase().includes(item.name.toLowerCase()) ||
          input.name.toLowerCase().includes(item.name.toLowerCase().replace(/\s+/g, '_'))
      );

      if (matchingInput) {
        const range = extractRangeFromDefinition(item.definition, item.name);
        if (range) {
          ranges.push({
            fieldId: matchingInput.name,
            fieldLabel: matchingInput.label || item.toolInputLabel,
            ...range,
            sourceQuote: item.definition,
            confidence: range.confidence || 'medium'
          });
        }
      }
    }
  }

  // Extract ranges from terminology definitions
  if (deepContent.keyTerminology) {
    for (const term of deepContent.keyTerminology) {
      // Look for numeric ranges in the howToUseInTool or definition
      const range = extractRangeFromText(term.definition + ' ' + term.howToUseInTool);
      if (range) {
        // Try to find matching input
        const matchingInput = toolInputs.find(
          input =>
            input.label.toLowerCase().includes(term.term.toLowerCase()) ||
            input.name.toLowerCase().includes(term.term.toLowerCase().replace(/\s+/g, '_'))
        );

        if (matchingInput && !ranges.find(r => r.fieldId === matchingInput.name)) {
          ranges.push({
            fieldId: matchingInput.name,
            fieldLabel: matchingInput.label,
            ...range,
            sourceQuote: term.definition,
            confidence: 'low' // Terminology-based ranges are less certain
          });
        }
      }
    }
  }

  return ranges;
}

/**
 * Extract numeric range from a definition string
 */
function extractRangeFromDefinition(
  definition: string,
  _name: string
): { inferredMin?: number; inferredMax?: number; recommendedValue?: number; confidence: ConfidenceLevel } | null {
  // Pattern: "30-45 days" or "30 to 45"
  const rangeMatch = definition.match(/(\d+(?:\.\d+)?)\s*[-–to]+\s*(\d+(?:\.\d+)?)/i);
  if (rangeMatch) {
    return {
      inferredMin: parseFloat(rangeMatch[1]),
      inferredMax: parseFloat(rangeMatch[2]),
      confidence: 'high'
    };
  }

  // Pattern: "at least 30" or "minimum 30"
  const minMatch = definition.match(/(?:at least|minimum|min|greater than|above|over)\s*(\d+(?:\.\d+)?)/i);
  if (minMatch) {
    return {
      inferredMin: parseFloat(minMatch[1]),
      confidence: 'medium'
    };
  }

  // Pattern: "no more than 45" or "maximum 45"
  const maxMatch = definition.match(/(?:no more than|maximum|max|less than|under|below)\s*(\d+(?:\.\d+)?)/i);
  if (maxMatch) {
    return {
      inferredMax: parseFloat(maxMatch[1]),
      confidence: 'medium'
    };
  }

  // Pattern: "should be 30" or "typically 30" or "around 30"
  const pointMatch = definition.match(/(?:should be|typically|around|about|approximately|roughly)\s*(\d+(?:\.\d+)?)/i);
  if (pointMatch) {
    return {
      recommendedValue: parseFloat(pointMatch[1]),
      confidence: 'low'
    };
  }

  return null;
}

/**
 * Extract numeric range from general text
 */
function extractRangeFromText(
  text: string
): { inferredMin?: number; inferredMax?: number; recommendedValue?: number; confidence: ConfidenceLevel } | null {
  // Try the same patterns as extractRangeFromDefinition
  return extractRangeFromDefinition(text, '');
}

// ========== INPUT FEEDBACK GENERATION ==========

/**
 * Generate feedback for a single input value against its range
 *
 * @param fieldId - Input field identifier
 * @param value - User's input value
 * @param ranges - Available input ranges
 * @returns Feedback object or null if no range defined
 */
export function generateInputFeedback(
  fieldId: string,
  value: string | number,
  ranges: InputRange[]
): InputFeedback | null {
  const range = ranges.find(r => r.fieldId === fieldId);

  if (!range) {
    return null; // No range defined for this field
  }

  const numericValue = typeof value === 'number' ? value : parseFloat(String(value));

  if (isNaN(numericValue)) {
    return null; // Non-numeric value, can't compare
  }

  // Determine feedback based on range comparison
  const { feedbackType, feedbackMessage } = evaluateValueAgainstRange(
    numericValue,
    range
  );

  // Build recommended range string
  let recommendedRange: string | null = null;
  if (range.inferredMin !== undefined && range.inferredMax !== undefined) {
    recommendedRange = `${range.inferredMin} - ${range.inferredMax}`;
  } else if (range.inferredMin !== undefined) {
    recommendedRange = `at least ${range.inferredMin}`;
  } else if (range.inferredMax !== undefined) {
    recommendedRange = `up to ${range.inferredMax}`;
  } else if (range.recommendedValue !== undefined) {
    recommendedRange = `around ${range.recommendedValue}`;
  }

  return {
    fieldId,
    userValue: numericValue,
    recommendedRange,
    feedbackMessage,
    feedbackType
  };
}

/**
 * Evaluate a value against a range and generate feedback
 */
function evaluateValueAgainstRange(
  value: number,
  range: InputRange
): { feedbackType: FeedbackType; feedbackMessage: string } {
  const hasMin = range.inferredMin !== undefined;
  const hasMax = range.inferredMax !== undefined;
  const hasRecommended = range.recommendedValue !== undefined;

  // Full range check
  if (hasMin && hasMax) {
    if (value >= range.inferredMin! && value <= range.inferredMax!) {
      return {
        feedbackType: 'good',
        feedbackMessage: `Good - within the recommended range of ${range.inferredMin}-${range.inferredMax}`
      };
    } else if (value < range.inferredMin!) {
      const deviation = range.inferredMin! - value;
      const severity = deviation > (range.inferredMax! - range.inferredMin!) * 0.5 ? 'critical' : 'warning';
      return {
        feedbackType: severity,
        feedbackMessage: `Below recommended minimum of ${range.inferredMin}`
      };
    } else {
      const deviation = value - range.inferredMax!;
      const severity = deviation > (range.inferredMax! - range.inferredMin!) * 0.5 ? 'critical' : 'warning';
      return {
        feedbackType: severity,
        feedbackMessage: `Above recommended maximum of ${range.inferredMax}`
      };
    }
  }

  // Min-only check
  if (hasMin && !hasMax) {
    if (value >= range.inferredMin!) {
      return {
        feedbackType: 'good',
        feedbackMessage: `Good - meets minimum of ${range.inferredMin}`
      };
    } else {
      return {
        feedbackType: 'warning',
        feedbackMessage: `Below recommended minimum of ${range.inferredMin}`
      };
    }
  }

  // Max-only check
  if (!hasMin && hasMax) {
    if (value <= range.inferredMax!) {
      return {
        feedbackType: 'good',
        feedbackMessage: `Good - within maximum of ${range.inferredMax}`
      };
    } else {
      return {
        feedbackType: 'warning',
        feedbackMessage: `Above recommended maximum of ${range.inferredMax}`
      };
    }
  }

  // Point estimate check (with 20% tolerance)
  if (hasRecommended) {
    const tolerance = Math.abs(range.recommendedValue! * 0.2);
    const deviation = Math.abs(value - range.recommendedValue!);

    if (deviation <= tolerance) {
      return {
        feedbackType: 'good',
        feedbackMessage: `Good - close to recommended value of ${range.recommendedValue}`
      };
    } else if (deviation <= tolerance * 2) {
      return {
        feedbackType: 'warning',
        feedbackMessage: `Consider adjusting toward ${range.recommendedValue}`
      };
    } else {
      return {
        feedbackType: 'critical',
        feedbackMessage: `Significantly different from recommended ${range.recommendedValue}`
      };
    }
  }

  // No range information
  return {
    feedbackType: 'good',
    feedbackMessage: 'Value accepted'
  };
}

export default {
  inferInputRanges,
  generateInputFeedback
};
