
import fetch from 'node-fetch';

async function run() {
    console.log("Triggering workflow via API...");

    const response = await fetch('http://localhost:3000/api/trpc/test.runRealWorkflow', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            json: {
                query: "coffee shops in Reno, NV"
            }
        })
    });

    if (!response.ok) {
        console.error("Failed to trigger workflow:", await response.text());
        return;
    }

    const result = await response.json();
    console.log("Workflow result:", JSON.stringify(result, null, 2));
}

run().catch(console.error);
