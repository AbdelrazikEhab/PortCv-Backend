import express from 'express';
import OpenAI from 'openai';
import { authenticateToken } from '../middleware/authMiddleware';
import { requireAICredits } from '../middleware/featureGate';
import { prisma } from '../lib/prisma';

const router = express.Router();

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

// Job Match
router.post('/job-match', authenticateToken, async (req: any, res) => {
    try {
        const { resume, jobDescription } = req.body;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert ATS (Applicant Tracking System) analyzer. Compare the resume against the job description. Return a JSON object with: score (0-100), matchingKeywords (array), missingKeywords (array), and advice (string)."
                },
                {
                    role: "user",
                    content: `Resume: ${JSON.stringify(resume)}\n\nJob Description: ${jobDescription}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");
        res.json(result);
    } catch (error) {
        console.error('Job match error:', error);
        res.status(500).json({ error: 'Failed to analyze job match' });
    }
});

// CV Rewrite
router.post('/rewrite', authenticateToken, async (req: any, res) => {
    try {
        const { text, type, instructions } = req.body;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert resume writer. Rewrite the following ${type} to be more professional, impactful, and result-oriented. ${instructions || ''}`
                },
                {
                    role: "user",
                    content: text
                }
            ]
        });

        res.json({ content: completion.choices[0].message.content });
    } catch (error) {
        console.error('Rewrite error:', error);
        res.status(500).json({ error: 'Failed to rewrite content' });
    }
});

// Cover Letter
router.post('/cover-letter', authenticateToken, async (req: any, res) => {
    try {
        const { resume, jobDescription } = req.body;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert career coach. Write a professional, engaging cover letter based on the candidate's resume and the job description. The tone should be professional yet enthusiastic."
                },
                {
                    role: "user",
                    content: `Resume: ${JSON.stringify(resume)}\n\nJob Description: ${jobDescription}`
                }
            ]
        });

        res.json({ content: completion.choices[0].message.content });
    } catch (error) {
        console.error('Cover letter error:', error);
        res.status(500).json({ error: 'Failed to generate cover letter' });
    }
});

// Interview Prep
router.post('/interview-prep', authenticateToken, async (req: any, res) => {
    try {
        const { resume, jobDescription } = req.body;

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert interview coach. Generate 5 potential interview questions based on the job description and resume, along with suggested key points to cover in the answers. Return a JSON object with a key 'questions' containing an array of objects with 'question' and 'answerTips'."
                },
                {
                    role: "user",
                    content: `Resume: ${JSON.stringify(resume)}\n\nJob Description: ${jobDescription}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");
        res.json(result);
    } catch (error) {
        console.error('Interview prep error:', error);
        res.status(500).json({ error: 'Failed to generate interview prep' });
    }
});

// ATS Score
router.post('/ats-score', authenticateToken, requireAICredits(1), async (req: any, res) => {
    try {
        const { resume, jobDescription, language = 'en' } = req.body;
        const targetLang = language === 'ar' ? 'Arabic' : 'English';

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert ATS (Applicant Tracking System) analyzer with deep knowledge of hiring practices in both English and Arabic markets. Analyze the resume against the job description (if provided) or general best practices.

                    Respond in ${targetLang}.

                    Return a JSON object with: 
                    - score (0-100)
                    - breakdown (object with categories like 'Impact', 'Keywords', 'Format', 'Content' and their scores)
                    - missingKeywords (array of strings in ${targetLang})
                    - improvements (array of strings in ${targetLang})
                    - summary (string in ${targetLang})
                    - strengths (array of strings in ${targetLang})
                    - keywords (array of strings in ${targetLang}, listing important missing keywords)

                    Ensure the Score is rigorous and realistic. Do not give 100% easily. A good resume usually scores 70-85.
                    `
                },
                {
                    role: "user",
                    content: `Resume: ${JSON.stringify(resume)}\n\nJob Description: ${jobDescription || 'General Review'}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const result = JSON.parse(completion.choices[0].message.content || "{}");
        res.json(result);
    } catch (error: any) {
        console.error('ATS score error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(402).json({ error: 'OpenAI API quota exceeded. Please contact administrator.' });
        }
        if (error.code === 'invalid_api_key') {
            return res.status(500).json({ error: 'Invalid OpenAI API key. Please contact administrator.' });
        }

        res.status(500).json({ error: 'Failed to calculate ATS score' });
    }
});

// AI Fix Resume
router.post('/fix-resume', authenticateToken, requireAICredits(2), async (req: any, res) => {
    try {
        const { resume, atsFeedback, language = 'en' } = req.body;
        const targetLang = language === 'ar' ? 'Arabic' : 'English';

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert professional resume editor. Your task is to SIGNIFICANTLY IMPROVE the provided resume data based on general best practices and specific ATS feedback (if provided).
                    
                    The user's preferred language is ${targetLang}.
                    - If the input resume is in English, keep it in English but improve standard and impact.
                    - If the input resume is in Arabic, keep it in Arabic but improve professional tone.
                    - IF appropriate, you may translate content if explicitly asked, but by default, preserve the resume's original language while improving the phrasing.
                    
                    Return the FULL resume JSON object with the exact same structure as the input, but with improved content.
                    
                    Focus on:
                    1. Stronger action verbs in experience.
                    2. Quantifiable results where possible.
                    3. Better summary.
                    4. Fixing any grammar/spelling issues.
                    5. Incorporating missing keywords if ATS feedback is provided.
                    
                    CRITICAL: Return ONLY valid JSON matching the ResumeData structure.`
                },
                {
                    role: "user",
                    content: `Resume Data: ${JSON.stringify(resume)}\n\nATS Feedback (optional): ${JSON.stringify(atsFeedback)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const fixedResume = JSON.parse(completion.choices[0].message.content || "{}");
        res.json({ success: true, data: fixedResume });

    } catch (error: any) {
        console.error('Fix resume error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(402).json({ error: 'OpenAI API quota exceeded. Please contact administrator.' });
        }

        res.status(500).json({ error: 'Failed to fix resume with AI' });
    }
});

// Career Analysis - Analyze CV for strengths, weaknesses, and career guidance
router.post('/career-analysis', authenticateToken, requireAICredits(2), async (req: any, res) => {
    try {
        const { resume, language = 'en' } = req.body;
        const targetLang = language === 'ar' ? 'Arabic' : 'English';

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert career advisor and CV analyst. Analyze the provided resume comprehensively and return a detailed JSON analysis.

Respond in ${targetLang}.

Your analysis should include:
1. Career Level Detection (Junior/Mid/Senior/Lead/Executive) based on experience
2. Strengths - What they're doing well (skills, achievements, impact)
3. Weaknesses - Skill gaps, missing experience, areas needing improvement
4. Red Flags - Common mistakes (vague descriptions, no metrics, poor formatting, etc.)
5. Career Path - Recommended next roles and timeline
6. Skills to Develop - Prioritized list based on their trajectory
7. Actionable Advice - Concrete steps to improve their profile

Be honest, specific, and constructive. Focus on actionable insights.

Return ONLY valid JSON with this structure (values should be in ${targetLang}):
{
  "careerLevel": "Junior|Mid|Senior...",
  "yearsExperience": number,
  "strengths": [
    { "area": string, "description": string, "score": number (0-100) }
  ],
  "weaknesses": [
    { "area": string, "description": string, "severity": "low|medium|high" }
  ],
  "redFlags": [
    { "issue": string, "example": string, "fix": string }
  ],
  "careerPath": {
    "currentRole": string,
    "nextRoles": string[],
    "timeline": string,
    "requirements": string[]
  },
  "skillsToDevelop": [
    { "skill": string, "priority": "low|medium|high", "reason": string }
  ],
  "actionableAdvice": string[]
}`
                },
                {
                    role: "user",
                    content: `Analyze this resume:\n\n${JSON.stringify(resume, null, 2)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const analysis = JSON.parse(completion.choices[0].message.content || "{}");
        res.json({ success: true, data: analysis });

    } catch (error: any) {
        console.error('Career analysis error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(402).json({ error: 'OpenAI API quota exceeded. Please contact administrator.' });
        }

        res.status(500).json({ error: 'Failed to analyze career' });
    }
});

// Generate Portfolio Design from Resume
router.post('/generate-portfolio-design', authenticateToken, requireAICredits(1), async (req: any, res) => {
    try {
        const { resumeId } = req.body;

        if (!resumeId) {
            return res.status(400).json({ error: 'Resume ID is required' });
        }

        // const { PrismaClient } = require('@prisma/client');
        // const prisma = new PrismaClient();

        const resume = await prisma.resume.findUnique({
            where: { id: resumeId }
        });

        if (!resume) {
            return res.status(404).json({ error: 'Resume not found' });
        }

        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: `You are an expert portfolio designer. Analyze the resume and suggest an optimal portfolio design.

Return ONLY valid JSON with this structure:
{
  "colors": {
    "primary": "#hexcode",
    "accent": "#hexcode",
    "background": "#hexcode"
  },
  "font": "inter|roboto|poppins|lora",
  "layout": "modern|minimal|creative",
  "sections": {
    "hero": true,
    "about": true,
    "experience": true,
    "skills": true,
    "projects": true,
    "education": true
  }
}

Design Guidelines:
- For tech/engineering: Modern layout, blue/purple tones, Inter font
- For creative/design: Creative layout, vibrant colors, Poppins font
- For business/corporate: Minimal layout, professional colors, Roboto font
- For academic/research: Minimal layout, muted tones, Lora font

Choose colors that match the industry and create good contrast.`
                },
                {
                    role: "user",
                    content: `Analyze this resume and suggest optimal portfolio design:\n\n${JSON.stringify(resume.data, null, 2)}`
                }
            ],
            response_format: { type: "json_object" }
        });

        const design = JSON.parse(completion.choices[0].message.content || "{}");
        res.json(design);

    } catch (error: any) {
        console.error('Portfolio design generation error:', error);

        if (error.code === 'insufficient_quota') {
            return res.status(402).json({ error: 'OpenAI API quota exceeded. Please contact administrator.' });
        }

        res.status(500).json({ error: 'Failed to generate portfolio design' });
    }
});

export default router;
