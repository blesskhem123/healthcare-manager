import { GoogleGenerativeAI } from '@google/generative-ai';

export interface PreVisitSummaryResult {
  urgency: 'Low' | 'Medium' | 'High';
  chiefComplaint: string;
  suggestedQuestions: string[];
  rawLlmOutput?: string;
}

export interface PostVisitSummaryResult {
  patientSummary: string;
  medicationSchedule: Array<{
    name: string;
    dosage: string;
    frequency: string;
  }>;
  followUpSteps: string;
  rawLlmOutput?: string;
}

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = apiKey && apiKey !== 'mock_key_or_user_provided' ? new GoogleGenerativeAI(apiKey) : null;

/**
 * Pre-visit summary generation
 * Guidance Prompt:
 * "Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor. Symptoms: <symptoms>"
 */
export async function generatePreVisitSummary(symptoms: string): Promise<PreVisitSummaryResult> {
  const prompt = `Analyse these symptoms and return: urgency level (Low / Medium / High), chief complaint, and three suggested questions for the doctor.
Return ONLY valid JSON matching this exact structure:
{
  "urgency": "Low" | "Medium" | "High",
  "chiefComplaint": "string summary",
  "suggestedQuestions": ["question 1", "question 2", "question 3"]
}

Symptoms: ${symptoms}`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);
      const text = response.response.text();
      
      // Clean JSON formatting markdown codeblocks if present
      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      return {
        urgency: ['Low', 'Medium', 'High'].includes(parsed.urgency) ? parsed.urgency : 'Medium',
        chiefComplaint: parsed.chiefComplaint || symptoms.substring(0, 100),
        suggestedQuestions: Array.isArray(parsed.suggestedQuestions) && parsed.suggestedQuestions.length >= 3
          ? parsed.suggestedQuestions.slice(0, 3)
          : [
              'What could be causing these symptoms?',
              'Are there any immediate lifestyle or dietary adjustments recommended?',
              'What warning signs should prompt urgent care?'
            ],
        rawLlmOutput: text
      };
    } catch (err) {
      console.warn('Gemini API call for pre-visit summary failed or key missing. Falling back to heuristic summary generator.', err);
    }
  }

  // Graceful Fallback Handler
  return generatePreVisitSummaryFallback(symptoms);
}

function generatePreVisitSummaryFallback(symptoms: string): PreVisitSummaryResult {
  const lower = symptoms.toLowerCase();
  let urgency: 'Low' | 'Medium' | 'High' = 'Low';
  
  if (lower.includes('chest pain') || lower.includes('shortness of breath') || lower.includes('severe') || lower.includes('bleeding') || lower.includes('fainting')) {
    urgency = 'High';
  } else if (lower.includes('fever') || lower.includes('persistent') || lower.includes('vomiting') || lower.includes('swelling')) {
    urgency = 'Medium';
  }

  return {
    urgency,
    chiefComplaint: symptoms.length > 120 ? symptoms.substring(0, 120) + '...' : symptoms,
    suggestedQuestions: [
      `How long have you been experiencing ${symptoms.split(' ')[0] || 'these symptoms'}?`,
      'What medications or treatments have you tried so far?',
      'Do you have any known allergies or related prior conditions?'
    ],
    rawLlmOutput: '[Fallback Engine: AI service offline or using fallback]'
  };
}

/**
 * Post-visit summary generation
 * Guidance Prompt:
 * "Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps: <notes>"
 */
export async function generatePostVisitSummary(notes: string): Promise<PostVisitSummaryResult> {
  const prompt = `Convert these clinical notes into a patient-friendly summary with medication schedule and follow-up steps.
Return ONLY valid JSON matching this exact structure:
{
  "patientSummary": "Clear, accessible explanation for the patient",
  "medicationSchedule": [
    {
      "name": "Medication Name",
      "dosage": "e.g. 500mg",
      "frequency": "e.g. Twice Daily after meals"
    }
  ],
  "followUpSteps": "Clear follow-up instructions and warning signs"
}

Notes: ${notes}`;

  if (genAI) {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
      const response = await model.generateContent(prompt);
      const text = response.response.text();

      const cleanedText = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(cleanedText);

      return {
        patientSummary: parsed.patientSummary || 'Post-visit summary based on doctor notes.',
        medicationSchedule: Array.isArray(parsed.medicationSchedule) ? parsed.medicationSchedule : [],
        followUpSteps: parsed.followUpSteps || 'Follow up with your physician as recommended.',
        rawLlmOutput: text
      };
    } catch (err) {
      console.warn('Gemini API call for post-visit summary failed or key missing. Falling back to heuristic summary generator.', err);
    }
  }

  // Graceful Fallback Handler
  return generatePostVisitSummaryFallback(notes);
}

function generatePostVisitSummaryFallback(notes: string): PostVisitSummaryResult {
  return {
    patientSummary: `Thank you for your visit. Based on your consultation notes: ${notes}`,
    medicationSchedule: [
      {
        name: 'As prescribed by doctor',
        dosage: 'Refer to prescription label',
        frequency: 'Daily as instructed'
      }
    ],
    followUpSteps: 'Rest well, complete prescribed medication course, and contact clinic if symptoms worsen.',
    rawLlmOutput: '[Fallback Engine: AI service offline or using fallback]'
  };
}
