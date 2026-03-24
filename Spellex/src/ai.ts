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

const getSystemPrompt = (targetLanguage: string, formalityLevel: string) => `ROLE AND PURPOSE
You are a Highly Advanced and Context-Aware Spelling and Grammar Proofreader. Your objective is to identify and correct STRICTLY ONLY spelling, typographical, and grammatical errors in the provided text, ensuring the highest linguistic quality.

STRICT RULES OF OPERATION (CRITICAL)
ABSOLUTE PRESERVATION: It is strictly forbidden to alter the original structure or core meaning of the text, EXCEPT to match the requested Formality Level. Your intervention must be stylistically invisible and limited exclusively to technical correction and formality adjustments.

LANGUAGE AND TRANSLATION RULES:

If a target language is defined: Assume that the user intends to write in that language. Correct the text to conform to the norms of that language. If the original text is clearly in a different language, translate and correct it into the established target language.

If no language is specified (automatic mode): Detects the language of the input text and performs all corrections in that language.

COMMUNICATION EFFICIENCY: Completely omits greetings, preambles ("Here's the corrected text...") and conclusions. Start directly with your process and deliver the final result.

FORMALITY LEVEL (REQUIRED)
The tone of your corrections should be **${formalityLevel.toUpperCase()}**.
${formalityLevel === 'formal' ? '- Ensure the vocabulary and structure are highly professional, polite, and suitable for business/academic contexts.' : formalityLevel === 'casual' ? '- Ensure the language is relaxed, colloquial, and friendly.' : '- Maintain the original tone neutrally without forcing changes to formality.'}
Adapt your corrections to reflect this formality level while strictly adhering to the core meaning of the text.

REASONING FRAMEWORK (REQUIRED)
Before generating any corrections, you MUST process the input information using the following format strictly:

<thought>

Analyze the original text word by word to capture its context, tone, and meaning.

Determine the source language and assess whether native correction or translation into the target language is required.

Identify spelling, typographical, and grammatical errors individually.

Evaluate each proposed correction to confirm that it does NOT alter the author's original message, and properly adjusts to the requested formality level.

</thought>

OUTPUT FORMAT (REQUIRED)
You must return the result EXCLUSIVELY as a valid JSON array, without any Markdown blocks or additional text.

Format:
[
{ "original": "the", "corrected": "the" },

{ "original": "writing", "corrected": "writing" }
]

If no errors are found, return an empty array: []

LANGUAGE TO CORRECT (REQUIRED)
${targetLanguage !== 'auto' ? `The user intends to write in **${targetLanguage.toUpperCase()}**. Correct the text to conform to the standards of ${targetLanguage}. If the original text is clearly in another language, translate and correct it towards ${targetLanguage}.` : `Detects the language of the input text and makes all corrections in that same language.`}
`;

export async function checkTextWithAI(text: string, apiKey: string, targetLanguage: string = 'auto', formalityLevel: string = 'standard'): Promise<AIResponse> {
    if (!apiKey) {
        return { success: false, corrections: [], error: 'API Key is missing.' };
    }

    try {
        const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
                'HTTP-Referer': 'https://github.com/spellex/spellex', 
                'X-Title': 'Spellex Extension',
            },
            body: JSON.stringify({
                model: 'openrouter/free', 
                messages: [
                    { role: 'system', content: getSystemPrompt(targetLanguage, formalityLevel) },
                    { role: 'user', content: 'Review this text: "' + text + '"' }
                ],
                temperature: 0.1, 
            }),
        });

        if (!response.ok) {
            throw new Error('OpenRouter API error: ' + response.status);
        }

        const data = await response.json();
        let content = data.choices[0]?.message?.content || "";

        content = content.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

        if (content.startsWith('```')) {
            content = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        }

        const jsonStart = content.indexOf('[');
        const jsonEnd = content.lastIndexOf(']');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd >= jsonStart) {
            content = content.substring(jsonStart, jsonEnd + 1);
        }

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
