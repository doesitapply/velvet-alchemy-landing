export const config = {
    runtime: 'edge', // Use Edge for fast proxying
};

export default async function handler(req) {
    if (req.method !== "POST") {
        return new Response("Method Not Allowed", { status: 405 });
    }

    const relayUrl = process.env.HUNTER_RELAY_URL;
    if (!relayUrl) {
        return new Response(
            JSON.stringify({ error: "HUNTER_RELAY_URL not configured on Vercel" }),
            { status: 502, headers: { "Content-Type": "application/json" } }
        );
    }

    // Pass the auth header from the client through to the relay
    const authHeader = req.headers.get("authorization");

    try {
        const backendRes = await fetch(`${relayUrl}/api/relay/sync`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "Authorization": authHeader || "",
            },
        });

        const data = await backendRes.json();
        return new Response(JSON.stringify(data), {
            status: backendRes.status,
            headers: { "Content-Type": "application/json" },
        });
    } catch (err: any) {
        return new Response(
            JSON.stringify({ error: "Failed to connect to local relay. Is ngrok running?", details: err.message }),
            { status: 502, headers: { "Content-Type": "application/json" } }
        );
    }
}
