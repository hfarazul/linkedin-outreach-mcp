#!/usr/bin/env node
/**
 * Quick script to check recent LinkedIn messages
 */

import * as unipile from './unipile-client.js';

async function main() {
  const accountId = unipile.getAccountId();

  if (!accountId) {
    console.error('UNIPILE_ACCOUNT_ID not set');
    process.exit(1);
  }

  console.log('Fetching recent chats...\n');

  const chats = await unipile.getChats(accountId);

  console.log(`Found ${chats.items.length} conversations:\n`);

  for (const chat of chats.items.slice(0, 10)) {
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`Chat ID: ${chat.id}`);
    console.log(`From: ${chat.participant_name}`);
    console.log(`Last message: ${chat.last_message?.substring(0, 100) || '(no preview)'}`);
    console.log(`Time: ${chat.last_message_at || 'unknown'}`);
    console.log(`Unread: ${chat.unread_count || 0}`);

    // Get messages for this chat
    if (chat.unread_count && chat.unread_count > 0) {
      console.log('\n  📬 Messages:');
      const messages = await unipile.getChatMessages(accountId, chat.id);
      for (const msg of messages.items.slice(0, 3)) {
        const direction = msg.is_outgoing ? '→' : '←';
        console.log(`  ${direction} ${msg.sender_name}: ${msg.text.substring(0, 80)}${msg.text.length > 80 ? '...' : ''}`);
      }
    }
    console.log('');
  }
}

main().catch(console.error);
