import { useParams } from "wouter";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Loader2, Printer, ShieldAlert, CheckCircle2, DollarSign } from "lucide-react";

export default function SalesPacket() {
    const { id } = useParams<{ id: string }>();
    const leadId = Number.parseInt(id);

    const packetQuery = trpc.export.getSalesPacket.useQuery({ leadId });

    const createInvoice = trpc.payment.createCheckoutSession.useMutation();

    const handlePrint = () => {
        window.print();
    };

    if (packetQuery.isLoading) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-gold">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2 font-serif italic">Generating Sales Packet...</span>
            </div>
        );
    }

    if (packetQuery.isError || !packetQuery.data) {
        return (
            <div className="flex h-screen items-center justify-center bg-zinc-950 text-red-500">
                Error: {packetQuery.error?.message || "Packet not found"}
            </div>
        );
    }

    const { companyName, screenshotUrl, prestigeScore, topLeaks, offer } = packetQuery.data;
    const checkoutUrl = createInvoice.data?.checkoutUrl || offer.stripeLink;

    return (
        <div className="min-h-screen bg-white text-zinc-900 print:bg-white print:text-black">
            {/* Controls */}
            <div className="fixed top-4 right-4 flex gap-2 print:hidden">
                <Button
                    onClick={() => {
                        createInvoice.mutate({ leadId, packageType: "standard" });
                    }}
                    className="bg-amber-500 text-black hover:bg-amber-600"
                    disabled={createInvoice.isPending}
                >
                    {createInvoice.isPending ? (
                        <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Creating link...
                        </>
                    ) : (
                        <>
                            <DollarSign className="mr-2 h-4 w-4" />
                            Generate $5k Pay Link
                        </>
                    )}
                </Button>

                <Button onClick={handlePrint} className="bg-black text-white hover:bg-zinc-800">
                    <Printer className="mr-2 h-4 w-4" />
                    Print / Save PDF
                </Button>
            </div>

            <div className="max-w-[8.5in] mx-auto p-[0.75in] bg-white min-h-[11in] shadow-2xl print:shadow-none">

                {/* Header */}
                <div className="flex justify-between items-end border-b-2 border-zinc-900 pb-6 mb-8">
                    <div>
                        <h1 className="text-4xl font-serif font-bold tracking-tight text-zinc-900">
                            AUDIT REPORT
                        </h1>
                        <p className="text-zinc-500 mt-2 font-mono text-sm uppercase tracking-widest">
                            CONFIDENTIAL // PREPARED FOR {companyName}
                        </p>
                    </div>
                    <div className="text-right">
                        <div className="text-xl font-bold text-zinc-900">VELVET ALCHEMY</div>
                        <div className="text-sm text-zinc-500">Digital Remediation</div>
                    </div>
                </div>

                {/* Hero Section */}
                <div className="mb-12 grid grid-cols-2 gap-8">
                    <div className="border border-zinc-200 p-2 rounded-sm">
                        {screenshotUrl && (
                            <img
                                src={screenshotUrl}
                                className="w-full h-auto grayscale hover:grayscale-0 transition-all"
                                alt="Site Capture"
                            />
                        )}
                    </div>
                    <div className="flex flex-col justify-center space-y-4">
                        <div className="p-6 bg-zinc-50 border border-zinc-200">
                            <div className="text-sm text-zinc-500 font-mono uppercase tracking-widest mb-1">
                                Current Prestige Score
                            </div>
                            <div className="text-6xl font-black text-zinc-900">
                                {prestigeScore}<span className="text-2xl text-zinc-400 font-light">/100</span>
                            </div>
                        </div>
                        <div className="text-sm text-zinc-600 leading-relaxed">
                            Based on our automated analysis of design cohesion, mobile responsiveness, and conversion signals, your digital presence is currently underperforming.
                        </div>
                    </div>
                </div>

                {/* Leaks Section */}
                <div className="mb-12">
                    <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
                        <ShieldAlert className="h-6 w-6" />
                        CRITICAL LEAKS DETECTED
                    </h2>
                    <div className="space-y-4">
                        {topLeaks.length > 0 ? (
                            topLeaks.map((leak, idx) => (
                                <div key={idx} className="flex gap-4 p-4 border-l-4 border-black bg-zinc-50">
                                    <div className="font-mono font-bold text-lg text-zinc-400">0{idx + 1}</div>
                                    <div>
                                        <div className="font-bold text-lg uppercase mb-1">{leak.severity} ISSUE</div>
                                        <div className="text-zinc-700">{leak.issue}</div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <p>No critical leaks found. Automation may have missed something.</p>
                        )}
                    </div>
                </div>

                {/* Offer Section */}
                <div className="mt-auto pt-8 border-t-2 border-zinc-900">
                    <h2 className="text-2xl font-bold mb-6">REMEDIATION PROPOSAL</h2>

                    <div className="bg-zinc-900 text-white p-8 grid grid-cols-2 gap-8">
                        <div>
                            <div className="font-serif italic text-2xl mb-4 text-amber-500">
                                {offer.title}
                            </div>
                            <ul className="space-y-3">
                                {offer.features.map((f, i) => (
                                    <li key={i} className="flex items-center gap-2 text-sm text-zinc-300">
                                        <CheckCircle2 className="h-4 w-4 text-amber-500" /> {f}
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div className="flex flex-col items-center justify-center border-l border-zinc-700 pl-8">
                            <div className="text-sm text-zinc-400 uppercase tracking-widest mb-2">Total Investment</div>
                            <div className="text-5xl font-bold text-white mb-6">{offer.price}</div>

                            {checkoutUrl ? (
                                <>
                                    <div className="text-center text-xs text-zinc-500 print:hidden">
                                        (This link is generated from your Stripe integration)
                                    </div>
                                    <a
                                        href={checkoutUrl}
                                        target="_blank"
                                        className="print:hidden bg-amber-500 hover:bg-amber-600 text-black font-bold py-3 px-8 rounded-sm transition-colors"
                                        rel="noreferrer"
                                    >
                                        ACCEPT PROPOSAL
                                    </a>
                                </>
                            ) : (
                                <div className="text-center text-xs text-zinc-400">
                                    Click “Generate $5k Pay Link” at the top-right.
                                </div>
                            )}

                            {/* Visible on Print Only */}
                            <div className="hidden print:block text-center space-y-2">
                                <div className="text-sm font-mono border border-white p-2">
                                    Invoice Link: {checkoutUrl || "(generate before printing)"}
                                </div>
                                <div className="text-xs text-zinc-500">Valid for 7 days.</div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center text-xs text-zinc-400 font-mono">
                    GENERATED BY VELVET ALCHEMY INTELLIGENCE • {new Date().toLocaleDateString()}
                </div>

            </div>
        </div>
    );
}
