const LANGUAGE_INSTRUCTION =
  'Detect the language of the user\'s text and respond entirely in that same language.';

const FORMAT_INSTRUCTION =
  'Format your response clearly. Use markdown sparingly — bold for key terms, bullet lists only when listing items. ' +
  'Do not use headers for short explanations. Be concise. Prefer depth over breadth.';

const EXPERTISE_CONFIGS = {
  beginner: {
    system:
      'You are explaining concepts to someone with no prior knowledge. ' +
      'Use very simple language. Avoid jargon entirely. ' +
      'Use everyday analogies and real-world examples. ' +
      'Keep sentences short. Define any technical term you must use. ' +
      'Aim for a 6th grade reading level.',
    maxTokens: 400,
  },
  intermediate: {
    system:
      'You are explaining concepts to someone with general knowledge. ' +
      'Use clear language with some domain terminology (briefly explained). ' +
      'Provide context and background. ' +
      'Use analogies that connect to common experiences. ' +
      'Aim for a high school / early college reading level.',
    maxTokens: 600,
  },
  advanced: {
    system:
      'You are explaining concepts to someone with solid domain knowledge. ' +
      'Use appropriate technical terminology without over-explaining basics. ' +
      'Go deeper into mechanisms, nuances, and edge cases. ' +
      'Assume familiarity with related concepts.',
    maxTokens: 800,
  },
  expert: {
    system:
      'You are explaining concepts to a domain expert. ' +
      'Be maximally precise. Use specialized terminology freely. ' +
      'Focus on subtleties, current research, limitations, and open questions. ' +
      'Skip foundational explanations entirely. Treat the reader as a peer.',
    maxTokens: 1200,
  },
};

export function buildExplainPrompt(text, level) {
  const config = EXPERTISE_CONFIGS[level] || EXPERTISE_CONFIGS.intermediate;
  return {
    system: `${config.system}\n\n${FORMAT_INSTRUCTION}\n\n${LANGUAGE_INSTRUCTION}`,
    user: `Explain the following text clearly and concisely:\n\n"${text}"`,
    maxTokens: config.maxTokens,
  };
}

export function buildFollowUpPrompt(text, level) {
  const config = EXPERTISE_CONFIGS[level] || EXPERTISE_CONFIGS.intermediate;
  return {
    system: `${config.system}\n\n${LANGUAGE_INSTRUCTION}`,
    user:
      `Based on this text: "${text}"\n\n` +
      `Generate exactly 3 follow-up questions that a ${level}-level learner would naturally ask next. ` +
      'Questions should build on the explanation, not repeat it. ' +
      'Progress from clarification → application → deeper exploration. ' +
      'Return ONLY a valid JSON array of 3 strings, no preamble, no explanation.\n' +
      '["Question 1?", "Question 2?", "Question 3?"]',
    maxTokens: 250,
  };
}
