#!/usr/bin/env node
/**
 * LinkedIn Outreach Runner
 *
 * Standalone script to execute sequence actions outside of MCP.
 * Can be triggered by:
 * - Cron job (e.g., daily at 9am)
 * - Claude Code SessionStart hook
 * - Manual execution: npm run runner
 */

import * as db from './db/schema.js';
import * as unipile from './unipile-client.js';

// Rate limits configuration (same as index.ts)
const RATE_LIMITS = {
  invitation: { daily: 40, weekly: 180 },
  message: { daily: 80 },
  profile_view: { daily: 90 },
  post_action: { daily: 50 },
  inmail: { daily: 25 },
};

// ANSI colors for terminal output
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  dim: '\x1b[2m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}  ✓${colors.reset} ${message}`);
}

function logError(message: string) {
  console.log(`${colors.red}  ✗${colors.reset} ${message}`);
}

function logSkip(message: string) {
  console.log(`${colors.yellow}  ⏭${colors.reset} ${message}`);
}

// Helper: Check rate limit
function checkRateLimit(actionType: keyof typeof RATE_LIMITS): { allowed: boolean; current: number; limit: number; message?: string } {
  const limits = RATE_LIMITS[actionType];
  const dailyCount = db.getRateLimitCount(actionType);

  if (dailyCount >= limits.daily) {
    return {
      allowed: false,
      current: dailyCount,
      limit: limits.daily,
      message: `Daily limit reached for ${actionType}: ${dailyCount}/${limits.daily}`,
    };
  }

  if ('weekly' in limits) {
    const weeklyCount = db.getWeeklyRateLimitCount(actionType);
    if (weeklyCount >= (limits as { daily: number; weekly: number }).weekly) {
      return {
        allowed: false,
        current: weeklyCount,
        limit: (limits as { daily: number; weekly: number }).weekly,
        message: `Weekly limit reached for ${actionType}: ${weeklyCount}/${(limits as { daily: number; weekly: number }).weekly}`,
      };
    }
  }

  return { allowed: true, current: dailyCount, limit: limits.daily };
}

// Helper: Personalize message
function personalizeMessage(template: string, prospect: db.Prospect): string {
  return template
    .replace(/\{\{first_name\}\}/g, prospect.first_name || prospect.full_name.split(' ')[0])
    .replace(/\{\{last_name\}\}/g, prospect.last_name || '')
    .replace(/\{\{full_name\}\}/g, prospect.full_name)
    .replace(/\{\{company\}\}/g, prospect.company || 'your company')
    .replace(/\{\{headline\}\}/g, prospect.headline || '');
}

// Helper: Get account ID
function getAccountId(): string {
  const accountId = unipile.getAccountId();
  if (!accountId) {
    throw new Error('UNIPILE_ACCOUNT_ID environment variable not set');
  }
  return accountId;
}

// Check for new connections and update enrollments
async function checkNewConnections(): Promise<number> {
  const accountId = getAccountId();

  try {
    const relations = await unipile.getRelations(accountId);
    let newCount = 0;

    for (const relation of relations.items || []) {
      if (!db.isKnownConnection(relation.provider_id)) {
        db.markAsKnownConnection(relation.provider_id, relation.full_name);
        newCount++;

        // Update prospect if exists
        const prospect = db.getProspectByLinkedInId(relation.provider_id);
        if (prospect) {
          db.saveProspect({
            ...prospect,
            is_connection: true,
          });

          // Update any enrollment
          const enrollment = db.getEnrollmentByProspect(prospect.id);
          if (enrollment && enrollment.status === 'in_progress') {
            db.updateEnrollment(enrollment.id, {
              status: 'connected',
              last_action_at: new Date().toISOString(),
            });
          }
        }
      }
    }

    return newCount;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Failed to check connections: ${errorMessage}`, 'red');
    return 0;
  }
}

// Execute a single step for an enrollment
async function executeStep(
  enrollment: db.SequenceEnrollment,
  sequence: db.Sequence,
  prospect: db.Prospect,
  accountId: string
): Promise<{ success: boolean; action: string; error?: string }> {
  const step = sequence.steps[enrollment.current_step];

  if (!step) {
    db.updateEnrollment(enrollment.id, { status: 'completed' });
    return { success: true, action: 'completed' };
  }

  try {
    switch (step.type) {
      case 'visit_profile': {
        const limitCheck = checkRateLimit('profile_view');
        if (!limitCheck.allowed) {
          return { success: false, action: 'visit_profile', error: limitCheck.message };
        }

        await unipile.getProfile(accountId, prospect.linkedin_id);
        db.incrementRateLimit('profile_view');

        const nextStep = enrollment.current_step + 1;
        db.updateEnrollment(enrollment.id, {
          current_step: nextStep,
          status: 'in_progress',
          last_action_at: new Date().toISOString(),
          next_action_at: step.delay_days
            ? new Date(Date.now() + step.delay_days * 24 * 60 * 60 * 1000).toISOString()
            : new Date().toISOString(),
        });

        db.logAction({
          enrollment_id: enrollment.id,
          prospect_id: prospect.id,
          action_type: 'profile_view',
          step_index: enrollment.current_step,
          status: 'success',
        });

        return { success: true, action: 'visit_profile' };
      }

      case 'send_invitation': {
        const limitCheck = checkRateLimit('invitation');
        if (!limitCheck.allowed) {
          return { success: false, action: 'send_invitation', error: limitCheck.message };
        }

        const message = step.message ? personalizeMessage(step.message, prospect) : undefined;
        const result = await unipile.sendInvitation(accountId, {
          provider_id: prospect.linkedin_id,
          message,
        });

        db.incrementRateLimit('invitation');

        if (result.success) {
          db.updateEnrollment(enrollment.id, {
            current_step: enrollment.current_step + 1,
            status: 'in_progress',
            last_action_at: new Date().toISOString(),
            next_action_at: step.delay_days
              ? new Date(Date.now() + step.delay_days * 24 * 60 * 60 * 1000).toISOString()
              : new Date().toISOString(),
          });
        }

        db.logAction({
          enrollment_id: enrollment.id,
          prospect_id: prospect.id,
          action_type: 'invitation_sent',
          step_index: enrollment.current_step,
          payload: { message },
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
        });

        return { success: result.success === true, action: 'send_invitation', error: result.error };
      }

      case 'wait_for_acceptance': {
        if (prospect.is_connection) {
          db.updateEnrollment(enrollment.id, {
            current_step: enrollment.current_step + 1,
            status: 'connected',
            last_action_at: new Date().toISOString(),
          });
          return { success: true, action: 'wait_for_acceptance (connected!)' };
        }

        // Check timeout
        const enrolledAt = new Date(enrollment.created_at).getTime();
        const timeoutMs = (step.timeout_days || 7) * 24 * 60 * 60 * 1000;

        if (Date.now() - enrolledAt > timeoutMs) {
          db.updateEnrollment(enrollment.id, {
            status: 'failed',
            error_message: 'Timeout waiting for acceptance',
          });
          return { success: false, action: 'wait_for_acceptance', error: 'Timeout' };
        }

        // Still waiting, reschedule
        db.updateEnrollment(enrollment.id, {
          next_action_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
        });
        return { success: true, action: 'wait_for_acceptance (still waiting)' };
      }

      case 'send_message':
      case 'send_followup': {
        const limitCheck = checkRateLimit('message');
        if (!limitCheck.allowed) {
          return { success: false, action: step.type, error: limitCheck.message };
        }

        if (!prospect.is_connection) {
          return { success: false, action: step.type, error: 'Not connected yet' };
        }

        const message = personalizeMessage(step.message || 'Thanks for connecting!', prospect);
        const result = await unipile.sendMessage(accountId, {
          recipient_id: prospect.linkedin_id,
          text: message,
        });

        db.incrementRateLimit('message');

        if (result.success) {
          const nextStep = enrollment.current_step + 1;
          const isComplete = nextStep >= sequence.steps.length;

          db.updateEnrollment(enrollment.id, {
            current_step: nextStep,
            status: isComplete ? 'completed' : 'in_progress',
            last_action_at: new Date().toISOString(),
            next_action_at: !isComplete && step.delay_days
              ? new Date(Date.now() + step.delay_days * 24 * 60 * 60 * 1000).toISOString()
              : undefined,
          });
        }

        db.logAction({
          enrollment_id: enrollment.id,
          prospect_id: prospect.id,
          action_type: step.type === 'send_followup' ? 'followup_sent' : 'message_sent',
          step_index: enrollment.current_step,
          payload: { message },
          status: result.success ? 'success' : 'failed',
          error_message: result.error,
        });

        return { success: result.success === true, action: step.type, error: result.error };
      }

      case 'delay': {
        const nextStep = enrollment.current_step + 1;
        db.updateEnrollment(enrollment.id, {
          current_step: nextStep,
          next_action_at: step.delay_days
            ? new Date(Date.now() + step.delay_days * 24 * 60 * 60 * 1000).toISOString()
            : new Date().toISOString(),
        });
        return { success: true, action: 'delay' };
      }

      default:
        return { success: false, action: 'unknown', error: `Unknown step type: ${step.type}` };
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return { success: false, action: step.type, error: errorMessage };
  }
}

// Run all due sequence actions
async function runSequenceActions(maxActions: number = 20): Promise<{
  successful: number;
  failed: number;
  skipped: number;
}> {
  const accountId = getAccountId();
  const enrollments = db.getEnrollments({
    due_for_action: true,
    limit: maxActions,
  });

  let successful = 0;
  let failed = 0;
  let skipped = 0;

  for (const enrollment of enrollments) {
    const prospect = db.getProspect(enrollment.prospect_id);
    const sequence = db.getSequence(enrollment.sequence_id);

    if (!prospect || !sequence) {
      skipped++;
      continue;
    }

    // Skip if sequence is not active
    if (sequence.status !== 'active') {
      skipped++;
      continue;
    }

    const result = await executeStep(enrollment, sequence, prospect, accountId);

    if (result.success) {
      logSuccess(`${prospect.full_name} - ${result.action}`);
      successful++;
    } else if (result.error?.includes('limit')) {
      logSkip(`${prospect.full_name} - ${result.error}`);
      skipped++;
    } else {
      logError(`${prospect.full_name} - ${result.action}: ${result.error}`);
      failed++;
    }
  }

  return { successful, failed, skipped };
}

// Main runner function
async function main() {
  const now = new Date();
  const timestamp = now.toISOString().replace('T', ' ').split('.')[0];

  log('');
  log(`LinkedIn Outreach Runner - ${timestamp}`, 'blue');
  log('================================================', 'dim');

  // Check if Unipile is configured
  if (!process.env.UNIPILE_API_KEY || !process.env.UNIPILE_DSN || !process.env.UNIPILE_ACCOUNT_ID) {
    log('Error: Unipile environment variables not set', 'red');
    log('Required: UNIPILE_API_KEY, UNIPILE_DSN, UNIPILE_ACCOUNT_ID', 'dim');
    process.exit(1);
  }

  try {
    // Step 1: Check for new connections
    log('Checking for new connections...', 'dim');
    const newConnections = await checkNewConnections();
    if (newConnections > 0) {
      log(`  Found ${newConnections} new connection(s)`, 'green');
    } else {
      log('  No new connections', 'dim');
    }

    // Step 2: Run sequence actions
    log('');
    log('Running sequence actions...', 'dim');
    const results = await runSequenceActions(20);

    // Summary
    log('');
    log('Summary', 'blue');
    log('-------', 'dim');
    log(`  Successful: ${results.successful}`, results.successful > 0 ? 'green' : 'dim');
    log(`  Failed: ${results.failed}`, results.failed > 0 ? 'red' : 'dim');
    log(`  Skipped: ${results.skipped}`, results.skipped > 0 ? 'yellow' : 'dim');

    // Rate limits
    log('');
    log('Rate Limits', 'blue');
    log('-----------', 'dim');
    const inviteLimit = checkRateLimit('invitation');
    const messageLimit = checkRateLimit('message');
    const viewLimit = checkRateLimit('profile_view');
    const postLimit = { current: db.getRateLimitCount('post_action'), limit: RATE_LIMITS.post_action.daily };
    const inmailLimit = { current: db.getRateLimitCount('inmail'), limit: RATE_LIMITS.inmail.daily };
    log(`  Invitations: ${inviteLimit.current}/${inviteLimit.limit}`);
    log(`  Messages: ${messageLimit.current}/${messageLimit.limit}`);
    log(`  Profile Views: ${viewLimit.current}/${viewLimit.limit}`);
    log(`  Posts: ${postLimit.current}/${postLimit.limit}`);
    log(`  InMails: ${inmailLimit.current}/${inmailLimit.limit}`);

    log('');

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    log(`Error: ${errorMessage}`, 'red');
    process.exit(1);
  }
}

// Run
main().catch(console.error);
