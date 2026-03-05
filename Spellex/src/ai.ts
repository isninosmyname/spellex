// OpenAI API Integration for Spellex

export interface AIResponse {
    success: boolean;
    corrections: Correction[];
    language?: string;
    error?: string;
}

export interface Correction {
    original: string;
    corrected: string;
    explanation?: string;
}

const getSystemPrompt = (targetLanguage: string) => `You are a highly advanced context-aware spelling and grammar corrector.
Your goal is to STRICTLY correct ONLY spelling, typos, and basic grammar mistakes.
${targetLanguage !== 'auto' ? `CRITICAL: The user intends to write in **${targetLanguage.toUpperCase()}**. Correct the text to be proper ${targetLanguage}. If the text is clearly another language, translate/correct it into ${targetLanguage}.` : `Detect the language of the provided text and correct it in that same language.`}
DO NOT change the structure, tone, or meaning of the text.
Return the output EXACTLY as a JSON array of correction objects, even if there is only one correction.
Do not wrap it in markdown block. Just pure JSON.

Format:
[
  { "original": "teh", "corrected": "the" },
  { "original": "escirbiendo", "corrected": "escribiendo" }
]

If no errors are found, return an empty array: []
`;

export async function checkTextWithAI(text: string, apiKey: string, targetLanguage: string = 'auto'): Promise<AIResponse> {
    if (!apiKey) {
        return { success: false, corrections: [], error: 'API Key is missing.' };
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
                'HTTP-Referer': 'https://github.com/spellex/spellex', // OpenRouter requires these for rankings
                'X-Title': 'Spellex Extension',
            },
            body: JSON.stringify({
                model: 'openrouter/free', // Routes to best free model
                messages: [
                    { role: 'system', content: getSystemPrompt(targetLanguage) },
                    { role: 'user', content: 'Review this text: "' + text + '"' }
                ],
                temperature: 0.1, // Low temp for deterministic corrections
            }),
        });

        if (!response.ok) {
            throw new Error('OpenRouter API error: ' + response.status);
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || "";

        // Sometimes reasoning models or Gemini wrap json in markdown
        if (content.trim().startsWith('\`\`\`')) {
            content = content.replace(/\`\`\`json/g, '').replace(/\`\`\`/g, '').trim();
        }

        // Parse the JSON array from OpenAI
        let corrections: Correction[] = [];
        try {
            corrections = JSON.parse(content);
        } catch (e) {
            console.error("Failed to parse AI response as JSON", content);
            throw new Error("AI returned invalid format.");
        }

        return { success: true, corrections };
    } catch (error: any) {
        console.error('Error in AI check:', error);
        return { success: false, corrections: [], error: error.message };
    }
}
