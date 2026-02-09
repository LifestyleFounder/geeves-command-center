#!/bin/bash
# Fetch Meta Ads data and update the Command Center JSON

set -e

# Load environment variables
source ~/.openclaw/.env

if [ -z "$META_ACCESS_TOKEN" ] || [ -z "$META_AD_ACCOUNT_ID" ]; then
    echo "Error: META_ACCESS_TOKEN and META_AD_ACCOUNT_ID must be set in ~/.openclaw/.env"
    exit 1
fi

OUTPUT_FILE="$(dirname "$0")/../data/meta-ads.json"
API_VERSION="v18.0"
DATE_PRESET="last_7d"

# Fetch account insights
echo "Fetching Meta Ads insights..."
INSIGHTS=$(curl -s "https://graph.facebook.com/${API_VERSION}/${META_AD_ACCOUNT_ID}/insights?fields=spend,impressions,clicks,ctr,actions,action_values&date_preset=${DATE_PRESET}&access_token=${META_ACCESS_TOKEN}")

# Check for errors
if echo "$INSIGHTS" | grep -q '"error"'; then
    echo "API Error:"
    echo "$INSIGHTS" | jq -r '.error.message // .error'
    exit 1
fi

# Parse the data
SPEND=$(echo "$INSIGHTS" | jq -r '.data[0].spend // "0"')
IMPRESSIONS=$(echo "$INSIGHTS" | jq -r '.data[0].impressions // "0"')
CLICKS=$(echo "$INSIGHTS" | jq -r '.data[0].clicks // "0"')
CTR=$(echo "$INSIGHTS" | jq -r '.data[0].ctr // "0"')

# Get leads from actions array
LEADS=$(echo "$INSIGHTS" | jq -r '.data[0].actions // [] | map(select(.action_type == "lead")) | .[0].value // "0"')
# Get purchase value from action_values
REVENUE=$(echo "$INSIGHTS" | jq -r '.data[0].action_values // [] | map(select(.action_type == "omni_purchase" or .action_type == "purchase")) | .[0].value // "0"')

# Calculate CPL
if [ "$LEADS" != "0" ] && [ "$LEADS" != "null" ]; then
    CPL=$(echo "scale=2; $SPEND / $LEADS" | bc)
else
    CPL="0"
    LEADS="0"
fi

# Calculate ROAS
if [ "$SPEND" != "0" ] && [ "$REVENUE" != "0" ] && [ "$REVENUE" != "null" ]; then
    ROAS=$(echo "scale=2; $REVENUE / $SPEND" | bc)
else
    ROAS="0"
    REVENUE="0"
fi

# Fetch campaigns
echo "Fetching campaigns..."
CAMPAIGNS=$(curl -s "https://graph.facebook.com/${API_VERSION}/${META_AD_ACCOUNT_ID}/campaigns?fields=name,status,insights.date_preset(${DATE_PRESET}){spend,impressions,clicks,ctr,actions}&access_token=${META_ACCESS_TOKEN}")

# Build campaigns array
CAMPAIGNS_JSON=$(echo "$CAMPAIGNS" | jq '[.data[] | select(.insights.data[0] != null) | {
    name: .name,
    status: .status,
    spend: (.insights.data[0].spend | tonumber),
    impressions: (.insights.data[0].impressions | tonumber),
    clicks: (.insights.data[0].clicks | tonumber),
    ctr: (.insights.data[0].ctr | tonumber),
    leads: ((.insights.data[0].actions // []) | map(select(.action_type == "lead")) | .[0].value // "0" | tonumber),
    cpl: 0
}] | map(. + {cpl: (if .leads > 0 then (.spend / .leads) else 0 end)})')

# Build final JSON
NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat > "$OUTPUT_FILE" << EOJSON
{
  "lastUpdated": "$NOW",
  "summary": {
    "spend": $SPEND,
    "leads": $LEADS,
    "cpl": $CPL,
    "roas": $ROAS,
    "impressions": $IMPRESSIONS,
    "revenue": $REVENUE
  },
  "campaigns": $CAMPAIGNS_JSON
}
EOJSON

echo "✓ Meta Ads data saved to $OUTPUT_FILE"
echo "  Spend: \$$SPEND | Leads: $LEADS | CPL: \$$CPL"
