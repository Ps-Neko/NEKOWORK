/**
 * AWS WorkMail Service — Manages ephemeral mailboxes for swarm agents.
 *
 * Each swarm agent gets a unique email address:
 *   agent-{swarmId_prefix}-{index}@agents.coasty.ai
 *
 * Mailboxes are provisioned in parallel with EC2 instances and cleaned up
 * when the swarm stops or machines are terminated.
 */

import {
  WorkMailClient,
  CreateUserCommand,
  RegisterToWorkMailCommand,
  DeregisterFromWorkMailCommand,
  DeleteUserCommand,
  ResetPasswordCommand,
  ListUsersCommand,
  DescribeUserCommand,
} from "@aws-sdk/client-workmail";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const ORGANIZATION_ID = process.env.AWS_WORKMAIL_ORGANIZATION_ID || "";
const WORKMAIL_DOMAIN = process.env.AWS_WORKMAIL_DOMAIN || "agents.coasty.ai";
const WORKMAIL_REGION = process.env.AWS_WORKMAIL_REGION || "us-east-1";

let _client: WorkMailClient | null = null;

function getClient(): WorkMailClient {
  if (!_client) {
    _client = new WorkMailClient({
      region: WORKMAIL_REGION,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || "",
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || "",
      },
    });
  }
  return _client;
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SwarmMailbox {
  /** WorkMail user ID */
  userId: string;
  /** Username portion (before @) */
  username: string;
  /** Full email address */
  email: string;
  /** Password for IMAP/SMTP access */
  password: string;
  /** Machine index in the swarm */
  machineIndex: number;
}

// ---------------------------------------------------------------------------
// Core Operations
// ---------------------------------------------------------------------------

/**
 * Generate a realistic human-looking email username.
 * Format: {firstname}.{lastname}  e.g. "james.walker"
 */
function generateRealisticUsername(): string {
  const firstNames = [
    "james", "emma", "liam", "olivia", "noah", "ava", "ethan", "sophia",
    "mason", "mia", "logan", "harper", "lucas", "ella", "alex", "riley",
    "jack", "chloe", "owen", "lily", "ryan", "zoey", "adam", "grace",
    "tyler", "hannah", "nathan", "aria", "caleb", "nora", "dylan", "elena",
    "max", "maya", "leo", "ruby", "sam", "iris", "ben", "clara",
    "daniel", "sarah", "michael", "rachel", "david", "laura", "kevin", "nina",
    "eric", "tessa", "mark", "alice", "paul", "diana", "sean", "vera",
    "jake", "rose", "cole", "fiona", "luke", "julia", "drew", "stella",
  ];
  const lastNames = [
    "smith", "jones", "taylor", "brown", "wilson", "clark", "walker", "hall",
    "davis", "evans", "thomas", "baker", "green", "adams", "lewis", "king",
    "wright", "scott", "morris", "turner", "hill", "moore", "white", "lee",
    "martin", "jackson", "harris", "ross", "cooper", "reed", "ward", "bell",
    "price", "brooks", "gray", "stone", "cole", "marsh", "lane", "mills",
    "hunt", "ford", "grant", "blake", "walsh", "burns", "hart", "west",
    "chen", "kumar", "silva", "park", "kim", "patel", "cohen", "meyer",
  ];
  const first = firstNames[Math.floor(Math.random() * firstNames.length)];
  const last = lastNames[Math.floor(Math.random() * lastNames.length)];
  return `${first}.${last}`;
}

/**
 * Generate a secure random password for the mailbox.
 * WorkMail requires: 8+ chars, uppercase, lowercase, number, special char.
 */
function generateMailboxPassword(): string {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const special = "!@#$%&*";
  const all = upper + lower + digits + special;

  // Ensure at least one of each required character class
  let password = "";
  password += upper[Math.floor(Math.random() * upper.length)];
  password += lower[Math.floor(Math.random() * lower.length)];
  password += digits[Math.floor(Math.random() * digits.length)];
  password += special[Math.floor(Math.random() * special.length)];

  // Fill remaining 12 chars
  for (let i = 0; i < 12; i++) {
    password += all[Math.floor(Math.random() * all.length)];
  }

  // Shuffle
  return password
    .split("")
    .sort(() => Math.random() - 0.5)
    .join("");
}

/**
 * Create a WorkMail mailbox for a swarm agent.
 *
 * @param swarmId - The swarm's UUID
 * @param machineIndex - Zero-based machine index
 * @returns SwarmMailbox with credentials, or null on failure
 */
export async function createSwarmMailbox(
  swarmId: string,
  machineIndex: number
): Promise<SwarmMailbox | null> {
  if (!ORGANIZATION_ID) {
    console.error("WorkMail: AWS_WORKMAIL_ORGANIZATION_ID not configured");
    return null;
  }

  const client = getClient();
  const username = generateRealisticUsername();
  const [first, last] = username.split(".");
  const displayName = `${first.charAt(0).toUpperCase() + first.slice(1)} ${last.charAt(0).toUpperCase() + last.slice(1)}`;
  const password = generateMailboxPassword();

  try {
    // Step 1: Create the user
    const createResult = await client.send(
      new CreateUserCommand({
        OrganizationId: ORGANIZATION_ID,
        Name: username,
        DisplayName: displayName,
        Password: password,
      })
    );

    const userId = createResult.UserId;
    if (!userId) {
      console.error(`WorkMail: CreateUser returned no UserId for ${username}`);
      return null;
    }

    // Step 2: Register the user to WorkMail (activates the mailbox)
    await client.send(
      new RegisterToWorkMailCommand({
        OrganizationId: ORGANIZATION_ID,
        EntityId: userId,
        Email: `${username}@${WORKMAIL_DOMAIN}`,
      })
    );

    console.log(`WorkMail: Created mailbox ${username}@${WORKMAIL_DOMAIN} (userId: ${userId})`);

    return {
      userId,
      username,
      email: `${username}@${WORKMAIL_DOMAIN}`,
      password,
      machineIndex,
    };
  } catch (error: any) {
    console.error(`WorkMail: Failed to create mailbox for ${username}:`, error?.message || error);

    // Attempt cleanup if user was partially created
    try {
      const listResult = await client.send(
        new ListUsersCommand({
          OrganizationId: ORGANIZATION_ID,
          Filters: { UsernamePrefix: username },
        })
      );
      const existing = listResult.Users?.find((u) => u.Name === username);
      if (existing?.Id) {
        await deleteSwarmMailbox(existing.Id);
      }
    } catch {
      // Best-effort cleanup
    }

    return null;
  }
}

/**
 * Delete a WorkMail user and their mailbox.
 *
 * @param userId - The WorkMail user ID to delete
 */
export async function deleteSwarmMailbox(userId: string): Promise<void> {
  if (!ORGANIZATION_ID) return;

  const client = getClient();

  try {
    // Step 1: Deregister from WorkMail (deactivates mailbox)
    try {
      await client.send(
        new DeregisterFromWorkMailCommand({
          OrganizationId: ORGANIZATION_ID,
          EntityId: userId,
        })
      );
    } catch (error: any) {
      // May already be deregistered
      if (!error?.name?.includes("InvalidParameter") && !error?.name?.includes("EntityState")) {
        console.warn(`WorkMail: Deregister warning for ${userId}:`, error?.message);
      }
    }

    // Step 2: Delete the user
    await client.send(
      new DeleteUserCommand({
        OrganizationId: ORGANIZATION_ID,
        UserId: userId,
      })
    );

    console.log(`WorkMail: Deleted user ${userId}`);
  } catch (error: any) {
    console.error(`WorkMail: Failed to delete user ${userId}:`, error?.message || error);
  }
}

/**
 * Create mailboxes for all machines in a swarm (parallel).
 *
 * @param swarmId - The swarm's UUID
 * @param machineCount - Number of machines
 * @returns Array of successfully created mailboxes
 */
export async function createSwarmMailboxes(
  swarmId: string,
  machineCount: number
): Promise<SwarmMailbox[]> {
  const promises = Array.from({ length: machineCount }, (_, i) =>
    createSwarmMailbox(swarmId, i)
  );

  const results = await Promise.allSettled(promises);
  const mailboxes: SwarmMailbox[] = [];

  for (const result of results) {
    if (result.status === "fulfilled" && result.value) {
      mailboxes.push(result.value);
    }
  }

  console.log(
    `WorkMail: Created ${mailboxes.length}/${machineCount} mailboxes for swarm ${swarmId.substring(0, 8)}`
  );

  return mailboxes;
}

/**
 * Delete all mailboxes for a swarm.
 *
 * @param mailboxes - Array of SwarmMailbox records to delete
 */
export async function deleteSwarmMailboxes(mailboxes: SwarmMailbox[]): Promise<void> {
  if (mailboxes.length === 0) return;

  const results = await Promise.allSettled(
    mailboxes.map((mb) => deleteSwarmMailbox(mb.userId))
  );

  const succeeded = results.filter((r) => r.status === "fulfilled").length;
  console.log(`WorkMail: Deleted ${succeeded}/${mailboxes.length} mailboxes`);
}

/**
 * Clean up orphaned WorkMail users older than maxAgeHours.
 * Matches both legacy "agent-*" and new friendly "{adj}-{animal}-{num}" names.
 * Intended to be called periodically as a safety net.
 */
export async function cleanupOrphanedMailboxes(maxAgeHours: number = 8): Promise<number> {
  if (!ORGANIZATION_ID) return 0;

  const client = getClient();
  let cleaned = 0;

  // Pattern: firstname.lastname (realistic names) or agent-* (legacy)
  const REALISTIC_NAME_RE = /^[a-z]+\.[a-z]+$/;

  try {
    const listResult = await client.send(
      new ListUsersCommand({
        OrganizationId: ORGANIZATION_ID,
      })
    );

    const cutoff = new Date(Date.now() - maxAgeHours * 60 * 60 * 1000);

    for (const user of listResult.Users || []) {
      if (!user.Id || !user.Name) continue;
      // Only clean up agent mailboxes (legacy or realistic-named)
      if (!user.Name.startsWith("agent-") && !REALISTIC_NAME_RE.test(user.Name)) continue;

      try {
        const desc = await client.send(
          new DescribeUserCommand({
            OrganizationId: ORGANIZATION_ID,
            UserId: user.Id,
          })
        );

        // If user was enabled before the cutoff, it's orphaned
        if (desc.EnabledDate && desc.EnabledDate < cutoff) {
          await deleteSwarmMailbox(user.Id);
          cleaned++;
          console.log(`WorkMail: Cleaned up orphaned mailbox ${user.Name} (created ${desc.EnabledDate.toISOString()})`);
        }
      } catch {
        // Skip users we can't describe
      }
    }
  } catch (error: any) {
    console.error(`WorkMail: Orphan cleanup failed:`, error?.message || error);
  }

  return cleaned;
}
