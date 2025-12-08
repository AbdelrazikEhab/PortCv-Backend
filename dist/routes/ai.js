"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const openai_1 = __importDefault(require("openai"));
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const openai = new openai_1.default({
    apiKey: process.env.OPENAI_API_KEY,
});
// Job Match
router.post('/job-match', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Job match error:', error);
        res.status(500).json({ error: 'Failed to analyze job match' });
    }
});
// CV Rewrite
router.post('/rewrite', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Rewrite error:', error);
        res.status(500).json({ error: 'Failed to rewrite content' });
    }
});
// Cover Letter
router.post('/cover-letter', authMiddleware_1.authenticateToken, async (req, res) => {
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
    }
    catch (error) {
        console.error('Cover letter error:', error);
        res.status(500).json({ error: 'Failed to generate cover letter' });
    }
});
// Interview Prep
router.post('/interview-prep', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { resume, jobDescription } = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert interview coach. Generate 5 potential interview questions based on the job description and resume, along with suggested key points to cover in the answers. Return as JSON with an array of objects containing 'question' and 'answerTips'."
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
    }
    catch (error) {
        console.error('Interview prep error:', error);
        res.status(500).json({ error: 'Failed to generate interview prep' });
    }
});
const featureGate_1 = require("../middleware/featureGate");
// ATS Score
router.post('/ats-score', authMiddleware_1.authenticateToken, (0, featureGate_1.requireAICredits)(1), async (req, res) => {
    try {
        const { resume, jobDescription } = req.body;
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: "You are an expert ATS (Applicant Tracking System) analyzer. Analyze the resume against the job description (if provided) or general best practices. Return a JSON object with: score (0-100), breakdown (object with categories like 'Impact', 'Keywords', 'Format', 'Content' and their scores), missingKeywords (array), and improvements (array of strings)."
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
    }
    catch (error) {
        console.error('ATS score error:', error);
        res.status(500).json({ error: 'Failed to calculate ATS score' });
    }
});
exports.default = router;
