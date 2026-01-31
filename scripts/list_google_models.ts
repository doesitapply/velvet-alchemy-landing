import 'dotenv/config';

async function listModels() {
    const keys = [process.env.GEMINI_API_KEY, process.env.GOOGLE_API_KEY].filter(Boolean);
    for (const key of keys) {
        console.log(`\n--- Testing key starting with ${key?.substring(0, 8)} ---`);
        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (!response.ok) {
                console.log(`Failed: ${response.status} ${await response.text()}`);
                continue;
            }
            const data = await response.json() as any;
            console.log(`Available models: ${data.models?.map((m: any) => m.name).join(', ')}`);
        } catch (err) {
            console.error(err);
        }
    }
}

listModels();
