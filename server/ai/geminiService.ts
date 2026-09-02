import { GoogleGenAI } from '@google/genai';
import { db } from '../database/db';
import { SuggestedProject } from '../../src/types';

// Google direct models
const GOOGLE_MODELS = [
  'gemini-3.6-flash',
  'gemini-3.5-flash-lite',
  'gemini-3.7-flash',
];

// OpenRouter candidate models (Gemini 2.5 Flash for deep intellect & reasoning)
const OPENROUTER_MODELS = [
  'google/gemini-2.5-flash',
  'google/gemini-2.5-flash-lite',
  'meta-llama/llama-3.3-70b-instruct',
];

interface ChatHistoryItem {
  role: 'user' | 'model';
  text: string;
}

export interface ChatServiceResponse {
  reply: string;
  suggestedProjects: SuggestedProject[];
  model_used: string;
}

/**
 * Builds factual system instruction context from the live database
 */
function buildSystemInstruction(currentProjectId?: string): string {
  const projects = db.getAllProjects();
  const alerts = db.getAllAlerts();
  const summary = db.getDashboardSummary();

  // Highlight specific project if requested
  let activeProjectContext = '';
  if (currentProjectId) {
    const pDetail = db.getProjectById(currentProjectId);
    if (pDetail) {
      const p = pDetail.project;
      activeProjectContext = `
ACTIVE PROJECT BEING VIEWED BY USER:
- ID: ${p.id}
- Code: ${p.project_code}
- Name: ${p.project_name}
- Sector: ${p.sector} | Ministry: ${p.ministry} | State: ${p.state}
- Implementing Agency: ${p.implementing_agency}
- Status: ${p.project_status}
- Original Cost: ₹${p.latest_monitoring?.original_cost?.toLocaleString()} Cr
- Revised Cost: ₹${p.latest_monitoring?.revised_cost?.toLocaleString()} Cr (Overrun: +${p.features?.cost_overrun_pct}%, +₹${p.features?.cost_growth} Cr)
- Expenditure Disbursed: ₹${p.latest_monitoring?.expenditure?.toLocaleString()} Cr (Financial Progress: ${p.features?.financial_progress}%)
- Physical Progress: ${p.latest_monitoring?.physical_progress}%
- Progress Gap (Fin - Phys): +${p.features?.progress_gap}%
- Target Completion: Original ${p.latest_monitoring?.original_completion_date} -> Revised ${p.latest_monitoring?.revised_completion_date} (+${p.features?.timeline_revision_months} months slippage)
- Risk Level: ${p.prediction?.risk_level} (Score: ${p.prediction?.risk_score}/100)
- Delay Probability: ${p.prediction?.delay_probability}% | Cost Overrun Probability: ${p.prediction?.cost_overrun_probability}%
- Top Risk Factors: ${p.prediction?.top_risk_factors?.join('; ')}
- Recommended Action: ${p.prediction?.recommended_action}
- Historical Updates Recorded: ${pDetail.history?.length || 0} cycles
`;
    }
  }

  // Portfolio projects tabular ground truth
  const projectList = projects.map((p, idx) => {
    return `${idx + 1}. [${p.project_code}] "${p.project_name}"
   Sector: ${p.sector} | State: ${p.state} | Agency: ${p.implementing_agency}
   Costs: Sanctioned ₹${p.latest_monitoring?.original_cost} Cr, Revised ₹${p.latest_monitoring?.revised_cost} Cr (Overrun: +${p.features?.cost_overrun_pct}%, Growth: +₹${p.features?.cost_growth} Cr)
   Execution: Physical ${p.latest_monitoring?.physical_progress}% vs Financial ${p.features?.financial_progress}% (Progress Gap: +${p.features?.progress_gap}%)
   Schedule: Original ${p.latest_monitoring?.original_completion_date} -> Revised ${p.latest_monitoring?.revised_completion_date} (Slippage: +${p.features?.timeline_revision_months} mo)
   Risk: ${p.prediction?.risk_level} (Score: ${p.prediction?.risk_score}/100) | Delay Prob: ${p.prediction?.delay_probability}% | Cost Prob: ${p.prediction?.cost_overrun_probability}%
   Recommended Action: ${p.prediction?.recommended_action}`;
  }).join('\n\n');

  // Active alerts list
  const activeAlerts = alerts.slice(0, 15).map((a) => {
    return `- [${a.severity}] ${a.project_name} (${a.project_code}): ${a.message} (Action: ${a.recommended_action})`;
  }).join('\n');

  return `You are "Project Sentinel AI", an intelligent, articulate, and insightful Senior Infrastructure Intelligence Advisor and conversational partner for the Government of India / MoSPI Infrastructure Projects Monitoring Dashboard.

You are NOT a mechanical database script, search engine, or canned responder. You possess genuine engineering intellect, deep domain reasoning, and fluid conversational fluency. You converse naturally, thoughtfully, and analytically.

CORE PRINCIPLES:
1. DEEP INTELLECT & DOMAIN UNDERSTANDING:
   - You understand capital infrastructure dynamics deeply: financial-physical progress divergence (when money drains faster than ground delivery occurs, signaling contractor distress or billing irregularities), land acquisition & Right-of-Way (RoW) bottlenecks, utility shifting delays, scope creep, and critical path risk compounding.
   - When asked a question, don't just dump raw numbers—synthesize the insight, explain the underlying causes, interpret the significance of the metrics, and offer strategic context.

2. GROUND TRUTH FIDELITY:
   - You are fed with the real-time infrastructure project monitoring data below. Ground all specific project numbers, costs, dates, and metrics strictly in this data.
   - Never invent or hallucinate facts or figures outside what is provided.
   - If a user asks about something outside the portfolio or unknown (e.g. private contractor personal phone numbers, unmonitored private projects), state with poise that this is outside the monitored portfolio data.

3. CONVERSATIONAL EXCELLENCE:
   - Speak naturally, intelligently, and engagingly. No robotic templates.
   - Tailor your depth to the user's question: if they ask for a concise summary, provide a sharp, well-structured answer; if they ask for an analysis, comparison, or why a project is struggling, provide an intelligent, comprehensive diagnostic.
   - Use clean, professional Markdown with bold metrics and ₹ Crores notation.

${activeProjectContext}

CURRENT MONITORED PORTFOLIO STATE (${projects.length} PROJECTS TOTAL, ${summary.high_risk_projects} HIGH RISK):
${projectList}

RECENT ACTIVE ALERTS (${alerts.length} ALERTS TOTAL):
${activeAlerts}
`;
}

/**
 * Dynamically extract relevant suggested projects from query, reply, and portfolio
 */
function extractSuggestedProjects(
  query: string,
  reply: string,
  currentProjectId?: string
): SuggestedProject[] {
  const allProjects = db.getAllProjects();
  const candidates: SuggestedProject[] = [];
  const addedIds = new Set<string>();

  const lowerQuery = query.toLowerCase();
  const lowerReply = reply.toLowerCase();

  // 1. Projects mentioned by name or code
  for (const p of allProjects) {
    const codeMatch = lowerReply.includes(p.project_code.toLowerCase()) || lowerQuery.includes(p.project_code.toLowerCase());
    const nameMatch = lowerReply.includes(p.project_name.toLowerCase()) || lowerQuery.includes(p.project_name.toLowerCase());
    
    const nameKeywords = p.project_name.toLowerCase().split(/\s+/).filter(w => w.length > 5);
    const keywordMatch = nameKeywords.some(w => lowerReply.includes(w) || lowerQuery.includes(w));

    if (codeMatch || nameMatch || keywordMatch) {
      if (!addedIds.has(p.id)) {
        addedIds.add(p.id);
        candidates.push({
          id: p.id,
          project_code: p.project_code,
          project_name: p.project_name,
          sector: p.sector,
          risk_level: p.prediction?.risk_level || 'LOW',
          risk_score: p.prediction?.risk_score || 0,
        });
      }
    }
  }

  // 2. If viewing a specific project, ensure it is included
  if (currentProjectId && !addedIds.has(currentProjectId)) {
    const cur = allProjects.find(p => p.id === currentProjectId);
    if (cur) {
      addedIds.add(cur.id);
      candidates.unshift({
        id: cur.id,
        project_code: cur.project_code,
        project_name: cur.project_name,
        sector: cur.sector,
        risk_level: cur.prediction?.risk_level || 'LOW',
        risk_score: cur.prediction?.risk_score || 0,
      });
    }
  }

  // 3. If still fewer than 2 candidates, add top high-risk projects dynamically
  if (candidates.length < 2) {
    const sortedHighRisk = [...allProjects]
      .sort((a, b) => (b.prediction?.risk_score || 0) - (a.prediction?.risk_score || 0));
    
    for (const p of sortedHighRisk) {
      if (!addedIds.has(p.id) && candidates.length < 3) {
        addedIds.add(p.id);
        candidates.push({
          id: p.id,
          project_code: p.project_code,
          project_name: p.project_name,
          sector: p.sector,
          risk_level: p.prediction?.risk_level || 'LOW',
          risk_score: p.prediction?.risk_score || 0,
        });
      }
    }
  }

  return candidates.slice(0, 4);
}

/**
 * Executes chat using OpenRouter (when an OpenRouter key starting with sk-or- is configured)
 */
async function callOpenRouter(
  apiKey: string,
  systemInstruction: string,
  message: string,
  history: ChatHistoryItem[] = []
): Promise<{ text: string; model_used: string }> {
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemInstruction },
  ];

  for (const h of history) {
    if (h.text && h.text.trim()) {
      messages.push({
        role: h.role === 'model' ? 'assistant' : 'user',
        content: h.text.trim(),
      });
    }
  }

  messages.push({ role: 'user', content: message });

  let lastErr: any = null;
  for (const model of OPENROUTER_MODELS) {
    try {
      console.log(`[OpenRouter AI Service] Invoking model: ${model}`);
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'HTTP-Referer': 'https://projectsentinel.ai',
          'X-Title': 'Project Sentinel AI',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: 800,
          temperature: 0.6,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        lastErr = data;
        console.warn(`[OpenRouter AI Service] Model ${model} returned error:`, data.error?.message || data);
        continue;
      }

      const reply = data.choices?.[0]?.message?.content?.trim() || '';
      if (reply) {
        return { text: reply, model_used: `OpenRouter (${model})` };
      }
    } catch (err: any) {
      lastErr = err;
      console.warn(`[OpenRouter AI Service] Model ${model} call failed:`, err.message || err);
    }
  }

  throw new Error(`OpenRouter API error: ${lastErr?.error?.message || lastErr?.message || 'All OpenRouter models failed'}`);
}

/**
 * Executes chat using Google GenAI SDK (when a Google API key is configured)
 */
async function callGoogleGenAI(
  apiKey: string,
  systemInstruction: string,
  message: string,
  history: ChatHistoryItem[] = []
): Promise<{ text: string; model_used: string }> {
  const ai = new GoogleGenAI({ apiKey });
  const formattedContents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

  for (const item of history) {
    if (item.text && item.text.trim()) {
      formattedContents.push({
        role: item.role === 'model' ? 'model' : 'user',
        parts: [{ text: item.text.trim() }],
      });
    }
  }

  formattedContents.push({
    role: 'user',
    parts: [{ text: message }],
  });

  let lastError: any = null;

  for (const modelName of GOOGLE_MODELS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        console.log(`[Google GenAI Service] Invoking ${modelName} (attempt ${attempt}) for prompt: "${message.slice(0, 50)}..."`);
        const response = await ai.models.generateContent({
          model: modelName,
          contents: formattedContents,
          config: {
            systemInstruction,
            temperature: 0.6,
            topP: 0.85,
            maxOutputTokens: 800,
          },
        });

        const replyText = response.text || '';
        return { text: replyText, model_used: modelName };
      } catch (err: any) {
        lastError = err;
        console.warn(`[Google GenAI Service] Model ${modelName} attempt ${attempt} failed:`, err.message || err);
        const is503 = String(err.message || '').includes('503') || String(err.message || '').includes('high demand');
        if (is503 && attempt === 1) {
          await new Promise((r) => setTimeout(r, 600));
          continue;
        }
        break;
      }
    }
  }

  throw new Error(`Google GenAI Service error: ${lastError?.message || 'Failed to generate response'}`);
}

/**
 * Universal chat handler: Auto-detects whether key is OpenRouter or Google GenAI
 */
export async function chatWithPortfolio(
  message: string,
  history: ChatHistoryItem[] = [],
  currentProjectId?: string
): Promise<ChatServiceResponse> {
  const apiKey = (
    process.env.API_KEY ||
    process.env.GEMINI_API_KEY ||
    process.env.OPENROUTER_API_KEY ||
    ''
  ).trim();

  if (!apiKey || apiKey === 'MY_API_KEY' || apiKey === 'YOUR_API_KEY_HERE' || apiKey === 'MY_GEMINI_API_KEY') {
    const errorMsg =
      'API_KEY is missing or unconfigured. Please provide a valid API key in your .env file (API_KEY=your_key).';
    console.error('[AI Service Config Error]:', errorMsg);
    throw new Error(errorMsg);
  }

  const systemInstruction = buildSystemInstruction(currentProjectId);
  const isOpenRouter = apiKey.startsWith('sk-or-');

  console.log(`[AI Service] Routing request via ${isOpenRouter ? 'OpenRouter API' : 'Google GenAI SDK'}...`);

  let responseData: { text: string; model_used: string };

  if (isOpenRouter) {
    responseData = await callOpenRouter(apiKey, systemInstruction, message, history);
  } else {
    responseData = await callGoogleGenAI(apiKey, systemInstruction, message, history);
  }

  const replyText = responseData.text || 'I processed your query against the project portfolio, but received an empty response. Please ask again.';
  const suggestedProjects = extractSuggestedProjects(message, replyText, currentProjectId);

  return {
    reply: replyText,
    suggestedProjects,
    model_used: responseData.model_used,
  };
}
