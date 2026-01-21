#!/bin/bash

export UNIPILE_API_KEY="v9lJ+EKV.99gK1G7A3Ck/0UDmGZsacAPGJuc7l2pf0JCNuIKnikQ="
export UNIPILE_DSN="api27.unipile.com:15759"
export UNIPILE_ACCOUNT_ID="xD8k0eekShmmvQlzfbzD6Q"

MCP="node /Users/haquefarazul/Linkedin_Lead_gen/linkedin-outreach-mcp/dist/index.js"

test_tool() {
    local name=$1
    local args=$2
    local result=$(echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"$name\",\"arguments\":$args}}" | $MCP 2>/dev/null)
    
    if echo "$result" | grep -q '"error"'; then
        local err=$(echo "$result" | python3 -c "import sys,json; r=json.load(sys.stdin); print(r.get('result',{}).get('content',[{}])[0].get('text','{}'))" 2>/dev/null | python3 -c "import sys,json; print(json.load(sys.stdin).get('error','unknown'))" 2>/dev/null)
        echo "⚠️  $name: $err"
    elif echo "$result" | grep -q '"isError":true'; then
        echo "❌ $name: FAILED"
    else
        echo "✅ $name: OK"
    fi
}

echo "=========================================="
echo "Testing all 16 LinkedIn Outreach MCP Tools"
echo "=========================================="
echo ""

echo "📊 Rate Limits & Monitoring"
test_tool "get_daily_limits" "{}"
test_tool "get_action_history" "{\"limit\":5}"

echo ""
echo "🔍 Search & Profiles"
test_tool "search_linkedin" "{\"keywords\":\"founder\",\"location\":\"NYC\"}"
test_tool "get_profile" "{\"identifier\":\"rishabh-iitkgp\"}"
test_tool "get_prospects" "{\"limit\":5}"
test_tool "update_prospect" "{\"prospect_id\":\"bdd7cd6b-9e7a-4237-a6c2-ca1ebb6e23c4\",\"tags\":[\"test\"]}"

echo ""
echo "🤝 Connections"
test_tool "check_new_connections" "{}"
# Note: send_invitation requires real prospect, skipping actual send
echo "⏭️  send_invitation: SKIPPED (requires real prospect)"

echo ""
echo "💬 Messaging"
# Note: send_message requires being connected
echo "⏭️  send_message: SKIPPED (requires connection)"

echo ""
echo "📋 Sequences"
test_tool "list_sequences" "{}"
test_tool "create_sequence" "{\"name\":\"Test Sequence\",\"steps\":[{\"type\":\"send_invitation\",\"message\":\"Hi!\"}]}"
# Get the sequence ID from the database
SEQ_ID=$(echo "{\"jsonrpc\":\"2.0\",\"id\":1,\"method\":\"tools/call\",\"params\":{\"name\":\"list_sequences\",\"arguments\":{}}}" | $MCP 2>/dev/null | python3 -c "import sys,json; r=json.load(sys.stdin); seqs=json.loads(r['result']['content'][0]['text'])['sequences']; print(seqs[0]['id'] if seqs else '')" 2>/dev/null)

if [ -n "$SEQ_ID" ]; then
    test_tool "get_sequence_status" "{\"sequence_id\":\"$SEQ_ID\"}"
    test_tool "activate_sequence" "{\"sequence_id\":\"$SEQ_ID\"}"
    test_tool "pause_sequence" "{\"sequence_id\":\"$SEQ_ID\"}"
    test_tool "enroll_prospects" "{\"sequence_id\":\"$SEQ_ID\",\"prospect_ids\":[\"bdd7cd6b-9e7a-4237-a6c2-ca1ebb6e23c4\"]}"
    test_tool "run_sequence_actions" "{\"max_actions\":1}"
else
    echo "⚠️  Sequence tests skipped - no sequence found"
fi

echo ""
echo "=========================================="
echo "Test Complete!"
echo "=========================================="
