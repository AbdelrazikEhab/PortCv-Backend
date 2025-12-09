import express from 'express';
import { PrismaClient } from '@prisma/client';
import { authenticateToken } from '../middleware/authMiddleware';
import { checkResourceLimit, requireAICredits } from '../middleware/featureGate';

import { prisma } from '../lib/prisma';

const router = express.Router();
// const prisma = new PrismaClient(); // Removed

// Get all resumes for user
router.get('/', authenticateToken, async (req: any, res) => {
    try {
        const resumes = await prisma.resume.findMany({
            where: { userId: req.user.userId },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(resumes);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resumes' });
    }
});

// Get single resume
router.get('/:id', authenticateToken, async (req: any, res) => {
    try {
        const resume = await prisma.resume.findUnique({
            where: { id: req.params.id }
        });

        if (!resume) return res.status(404).json({ error: 'Resume not found' });
        if (resume.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        res.json(resume);
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch resume' });
    }
});

// Create resume
router.post('/', authenticateToken, checkResourceLimit('resumes'), async (req: any, res) => {
    try {
        const { name, template, data } = req.body;

        const resume = await prisma.resume.create({
            data: {
                userId: req.user.userId,
                name,
                template: template || 'classic',
                data: data || {},
                visibleSections: {}
            }
        });

        res.status(201).json(resume);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create resume' });
    }
});

// Update resume
router.put('/:id', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;
        const { name, template, data, visibleSections, colorScheme, isPublic } = req.body;

        const existingResume = await prisma.resume.findUnique({ where: { id } });
        if (!existingResume) return res.status(404).json({ error: 'Resume not found' });
        if (existingResume.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        const updatedResume = await prisma.resume.update({
            where: { id },
            data: {
                name,
                template,
                data,
                visibleSections,
                colorScheme,
                isPublic
            }
        });

        res.json(updatedResume);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update resume' });
    }
});

// Delete resume
router.delete('/:id', authenticateToken, async (req: any, res) => {
    try {
        const { id } = req.params;

        const existingResume = await prisma.resume.findUnique({ where: { id } });
        if (!existingResume) return res.status(404).json({ error: 'Resume not found' });
        if (existingResume.userId !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        await prisma.resume.delete({ where: { id } });

        res.json({ message: 'Resume deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete resume' });
    }
});

import multer from 'multer';
import OpenAI from 'openai';
const pdfParse = require('pdf-parse');

const upload = multer({ storage: multer.memoryStorage() });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });



// Parse resume
router.post('/parse', authenticateToken, requireAICredits(1), upload.single('file'), async (req: any, res) => {
    try {
        console.log('--- RESUME PARSE REQUEST RECEIVED ---');
        console.log('File present:', !!req.file);
        console.log('API Key configured:', !!process.env.OPENAI_API_KEY);

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        let text = '';
        if (req.file.mimetype === 'application/pdf') {
            const data = await pdfParse(req.file.buffer);
            text = data.text;
            console.log('--- START PDF EXTRACTED TEXT ---');
            console.log(text.substring(0, 3000));
            console.log('--- END PDF EXTRACTED TEXT ---');
        } else {
            return res.status(400).json({ error: 'Only PDF files are supported' });
        }

        if (!text || text.trim().length === 0) {
            return res.status(400).json({ error: 'Could not extract text from PDF' });
        }

        // Check if OpenAI API key is configured
        if (!process.env.OPENAI_API_KEY) {
            console.error('OPENAI_API_KEY is not configured');
            return res.status(500).json({ error: 'Resume parsing is not configured. Please contact administrator.' });
        }

        // Use OpenAI to extract structured data matching the frontend ResumeData structure
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini", // Reverted to mini due to quota limits, but keeping improved prompt
            messages: [
                {
                    role: "system",
                    content: `You are an expert resume parser with 100% accuracy. Extract ALL information from the resume text and return it as a JSON object with this EXACT structure:
{
  "contact": {
    "name": "string (Full Name)",
    "title": "string (Current Job Title)",
    "email": "string",
    "phone": ["array of strings"],
    "location": "string (City, State, Country)",
    "linkedin": "string (Full URL)",
    "github": "string (Full URL)"
  },
  "summary": "string (Professional Summary)",
  "experience": [
    {
      "id": "string (unique id)",
      "company": "string",
      "position": "string",
      "period": "string (e.g., 'Jan 2020 - Present')",
      "responsibilities": ["array of strings"],
      "technologies": "string (comma-separated)"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "period": "string",
      "note": "string (GPA, Honors, etc.)"
    }
  ],
  "skills": {
    "programmingLanguages": ["array"],
    "fundamentals": ["array"],
    "frameworks": ["array"],
    "databases": ["array"],
    "apiDesign": ["array"],
    "authentication": ["array"],
    "tools": ["array"],
    "designPatterns": ["array"],
    "frontend": ["array"],
    "devops": ["array"]
  },
  "softSkills": ["array of strings"],
  "projects": [
    {
      "name": "string",
      "url": "string"
    }
  ],
  "languages": [
    {
      "language": "string",
      "proficiency": "string"
    }
  ]
}

CRITICAL INSTRUCTIONS:
1. **ACCURACY IS PARAMOUNT**: Do not summarize or abbreviate. Extract exact text where appropriate (e.g., company names, job titles).
2. **CONTACT INFO**: Extract email and phone number with high precision. Look for them in headers/footers.
3. **ARRAYS**: Fields like 'experience', 'education', 'projects', and all 'skills' sub-fields MUST be arrays. If there is only one item, return an array with one item. NEVER return a single object or string for these fields.
4. **DATES**: Format dates consistently (e.g., "Jan 2020 - Present" or "2018 - 2022").
5. **MISSING DATA**: If a field is not found, return an empty string "" or empty array [] as appropriate. DO NOT return "N/A" or "Unknown".
6. **SKILLS CATEGORIZATION**: Intelligently categorize technical skills into the provided categories (languages, frameworks, tools, etc.).
7. **RESPONSIBILITIES**: Split bullet points into separate strings in the 'responsibilities' array.
8. **JSON ONLY**: Return ONLY valid JSON. No markdown formatting, no code blocks.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.2 // Low temperature for deterministic results
        });

        const parsedData = JSON.parse(completion.choices[0].message.content || '{}');

        // Validate that we got some data
        if (!parsedData.contact && !parsedData.experience && !parsedData.education) {
            console.error('OpenAI returned empty or invalid data');
            return res.status(500).json({ error: 'Failed to parse resume data' });
        }

        res.json({ success: true, data: parsedData });

    } catch (error: any) {
        console.error('Error parsing resume:', error);

        // Provide more specific error messages
        if (error.code === 'insufficient_quota') {
            return res.status(500).json({ error: 'OpenAI API quota exceeded. Please contact administrator.' });
        }
        if (error.code === 'invalid_api_key') {
            return res.status(500).json({ error: 'Invalid OpenAI API key. Please contact administrator.' });
        }

        res.status(500).json({ error: 'Failed to parse resume: ' + (error.message || 'Unknown error') });
    }
});

export default router;
