import OpenAI from 'openai';
import dotenv from 'dotenv';
import path from 'path';

// Load env vars from backend root
dotenv.config({ path: path.join(__dirname, '../.env') });

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function test() {
    console.log('Testing OpenAI connection...');
    console.log('API Key exists:', !!process.env.OPENAI_API_KEY);
    try {
        const completion = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [{ role: "user", content: "Hello" }],
        });
        console.log('Success:', completion.choices[0].message.content);
    } catch (error: any) {
        console.error('Error:', error);
        if (error.response) {
            console.error('Response data:', error.response.data);
        }
    }
}

test();
