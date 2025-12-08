"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = __importDefault(require("express"));
const client_1 = require("@prisma/client");
const authMiddleware_1 = require("../middleware/authMiddleware");
const router = express_1.default.Router();
const prisma = new client_1.PrismaClient();
// Get all resumes for user
router.get('/', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const resumes = await prisma.resume.findMany({
            where: { userId: req.user.userId },
            orderBy: { updatedAt: 'desc' }
        });
        res.json(resumes);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch resumes' });
    }
});
// Get single resume
router.get('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const resume = await prisma.resume.findUnique({
            where: { id: req.params.id }
        });
        if (!resume)
            return res.status(404).json({ error: 'Resume not found' });
        if (resume.userId !== req.user.userId)
            return res.status(403).json({ error: 'Unauthorized' });
        res.json(resume);
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to fetch resume' });
    }
});
// Create resume
router.post('/', authMiddleware_1.authenticateToken, (0, featureGate_1.checkResourceLimit)('resumes'), async (req, res) => {
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to create resume' });
    }
});
// Update resume
router.put('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const { name, template, data, visibleSections, colorScheme, isPublic } = req.body;
        const existingResume = await prisma.resume.findUnique({ where: { id } });
        if (!existingResume)
            return res.status(404).json({ error: 'Resume not found' });
        if (existingResume.userId !== req.user.userId)
            return res.status(403).json({ error: 'Unauthorized' });
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
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to update resume' });
    }
});
// Delete resume
router.delete('/:id', authMiddleware_1.authenticateToken, async (req, res) => {
    try {
        const { id } = req.params;
        const existingResume = await prisma.resume.findUnique({ where: { id } });
        if (!existingResume)
            return res.status(404).json({ error: 'Resume not found' });
        if (existingResume.userId !== req.user.userId)
            return res.status(403).json({ error: 'Unauthorized' });
        await prisma.resume.delete({ where: { id } });
        res.json({ message: 'Resume deleted successfully' });
    }
    catch (error) {
        res.status(500).json({ error: 'Failed to delete resume' });
    }
});
const multer_1 = __importDefault(require("multer"));
const openai_1 = __importDefault(require("openai"));
const pdfParse = require('pdf-parse');
const upload = (0, multer_1.default)({ storage: multer_1.default.memoryStorage() });
const openai = new openai_1.default({ apiKey: process.env.OPENAI_API_KEY });
const featureGate_1 = require("../middleware/featureGate");
// Parse resume
router.post('/parse', authMiddleware_1.authenticateToken, (0, featureGate_1.checkResourceLimit)('resumes'), (0, featureGate_1.requireAICredits)(1), upload.single('file'), async (req, res) => {
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
        }
        else {
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
            model: "gpt-4o-mini", // Using mini for faster and cheaper processing
            messages: [
                {
                    role: "system",
                    content: `You are a resume parser. Extract ALL information from the resume text and return it as a JSON object with this EXACT structure:
{
  "contact": {
    "name": "string",
    "title": "string (job title/role)",
    "email": "string",
    "phone": ["array of phone numbers"],
    "location": "string (city, state, country)",
    "linkedin": "string (LinkedIn profile URL or username)",
    "github": "string (GitHub username or URL)"
  },
  "summary": "string (professional summary or objective)",
  "experience": [
    {
      "id": "string (generate unique id)",
      "company": "string",
      "position": "string",
      "period": "string (e.g., 'Jan 2020 - Present')",
      "responsibilities": ["array of responsibility strings"],
      "technologies": "string (comma-separated technologies used)"
    }
  ],
  "education": [
    {
      "institution": "string",
      "degree": "string",
      "period": "string",
      "note": "string (optional, e.g., GPA, honors)"
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
  "softSkills": ["array of soft skills"],
  "projects": [
    {
      "name": "string",
      "url": "string (optional)"
    }
  ],
  "languages": [
    {
      "language": "string",
      "proficiency": "string"
    }
  ]
}

IMPORTANT: 
- Extract ALL information from the resume
- Categorize technical skills appropriately matching the keys provided
- Generate unique IDs for experience entries (use company name + timestamp)
- If a field is not found, use empty string or empty array as appropriate
- DO NOT HALLUCINATE or invent information. If the resume is empty or unreadable, return empty values for all fields.
- Return ONLY valid JSON, no additional text
- PRIORITY: Extract contact name, email, and phone from the header or contact section accurately. This is critical.
- IMPORTANT: For fields defined as arrays (experience, education, projects, skills.*, languages), ALWAYS return an array, even if there is only one item. Do not return a single object.`
                },
                {
                    role: "user",
                    content: text
                }
            ],
            response_format: { type: "json_object" },
            temperature: 0.3 // Lower temperature for more consistent parsing
        });
        const parsedData = JSON.parse(completion.choices[0].message.content || '{}');
        // Validate that we got some data
        if (!parsedData.contact && !parsedData.experience && !parsedData.education) {
            console.error('OpenAI returned empty or invalid data');
            return res.status(500).json({ error: 'Failed to parse resume data' });
        }
        res.json({ success: true, data: parsedData });
    }
    catch (error) {
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
exports.default = router;
