
import React from 'react';
import { trpc } from '../lib/trpc';
import { PackageType } from '../../../server/products';

interface StripeCheckoutButtonProps {
    leadId: number;
    packageType: PackageType;
    className?: string;
    children?: React.ReactNode;
}

export function StripeCheckoutButton({ leadId, packageType, className, children }: StripeCheckoutButtonProps) {
    const createSession = trpc.payment.createCheckoutSession.useMutation({
        onSuccess: (data) => {
            if (data.checkoutUrl) {
                window.location.href = data.checkoutUrl;
            }
        },
        onError: (error) => {
            alert(`Checkout failed: ${error.message}`);
        }
    });

    const handleClick = () => {
        createSession.mutate({ leadId, packageType });
    };

    return (
        <button
            onClick={handleClick}
            disabled={createSession.isPending}
            className={className || "bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-2 px-4 rounded"}
        >
            {createSession.isPending ? 'Loading...' : (children || 'Buy Now')}
        </button>
    );
}
