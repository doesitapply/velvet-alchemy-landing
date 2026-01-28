#!/bin/bash
#
# Technographic Hunter - Vercel Deployment Script
# Run this after setting up your Supabase credentials
#

set -e

echo "🚀 Deploying Technographic Hunter API to Vercel..."
echo ""

# Check if vercel CLI is installed
if ! command -v vercel &> /dev/null; then
    echo "📦 Installing Vercel CLI..."
    npm install -g vercel
fi

# Login to Vercel
echo "🔐 Logging in to Vercel..."
vercel login

# Deploy to preview
echo "📤 Deploying to preview environment..."
vercel

# Add environment variables
echo ""
echo "🔧 Setting up environment variables..."
echo "You'll be prompted to enter your Supabase credentials."
echo ""

vercel env add SUPABASE_URL
vercel env add SUPABASE_SERVICE_ROLE_KEY

# Deploy to production
echo ""
echo "🎯 Deploying to production..."
vercel --prod

echo ""
echo "✅ Deployment complete!"
echo ""
echo "Your API is now live at:"
echo "https://your-project-name.vercel.app/api/v1/leads"
echo ""
echo "Test it with:"
echo 'curl -H "Authorization: Bearer sk_test_123" \'
echo '  "https://your-project-name.vercel.app/api/v1/leads?tech=shopify&pixel=false"'
