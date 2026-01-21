/**
 * Unipile API Client
 * Wrapper for Unipile REST API to interact with LinkedIn
 */

import { z } from 'zod';

// Environment configuration
const config = {
  apiKey: process.env.UNIPILE_API_KEY || '',
  dsn: process.env.UNIPILE_DSN || '',
  accountId: process.env.UNIPILE_ACCOUNT_ID || '',
};

// Base URL for API calls
function getBaseUrl(): string {
  return `https://${config.dsn}/api/v1`;
}

// Common headers for all requests
function getHeaders(): Record<string, string> {
  return {
    'X-API-KEY': config.apiKey,
    'Content-Type': 'application/json',
  };
}

// Error response schema
const ErrorResponseSchema = z.object({
  error: z.string().optional(),
  message: z.string().optional(),
  status: z.number().optional(),
});

// Generic API request function
async function apiRequest<T>(
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  endpoint: string,
  body?: unknown,
  additionalHeaders?: Record<string, string>
): Promise<T> {
  const url = `${getBaseUrl()}${endpoint}`;

  const response = await fetch(url, {
    method,
    headers: {
      ...getHeaders(),
      ...additionalHeaders,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const parsed = ErrorResponseSchema.safeParse(errorData);
    const errorMessage = parsed.success
      ? parsed.data.message || parsed.data.error || `HTTP ${response.status}`
      : `HTTP ${response.status}: ${response.statusText}`;

    throw new UnipileError(errorMessage, response.status, errorData);
  }

  return response.json() as Promise<T>;
}

// Custom error class
export class UnipileError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'UnipileError';
  }
}

// ============ LinkedIn Search ============

export interface SearchParams {
  url?: string;  // Copy-pasted LinkedIn search URL
  keywords?: string;
  location?: string;
  industry?: string;
  company?: string;
  title?: string;
  connection_degree?: 1 | 2 | 3;
  cursor?: string;  // For pagination
}

export interface SearchResult {
  id: string;
  provider_id: string;
  public_identifier: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  location?: string;
  profile_url: string;
  picture_url?: string;
  connection_degree?: number;
  current_company?: string;
  current_position?: string;
}

export interface SearchResponse {
  items: SearchResult[];
  cursor?: string;
  has_more: boolean;
}

export async function searchLinkedIn(
  accountId: string,
  params: SearchParams
): Promise<SearchResponse> {
  const body: Record<string, unknown> = {
    api: 'classic',
    category: 'people',
  };

  if (params.url) {
    body.url = params.url;
  } else {
    // Build keywords with location if not using URL
    let keywords = params.keywords || '';
    if (params.location) {
      keywords += ` ${params.location}`;
    }
    if (params.title) {
      keywords += ` ${params.title}`;
    }
    if (params.company) {
      keywords += ` ${params.company}`;
    }
    if (keywords.trim()) {
      body.keywords = keywords.trim();
    }
  }

  if (params.cursor) {
    body.cursor = params.cursor;
  }

  // account_id goes in query string, not body
  const endpoint = `/linkedin/search?account_id=${encodeURIComponent(accountId)}`;

  const response = await apiRequest<{
    object: string;
    items: Array<{
      id: string;
      name: string;
      public_identifier: string;
      profile_url: string;
      profile_picture_url?: string;
      headline?: string;
      location?: string;
      network_distance?: string;
      shared_connections_count?: number;
    }>;
    cursor?: string;
  }>('POST', endpoint, body);

  // Transform Unipile response to our format
  return {
    items: (response.items || []).map(item => ({
      id: item.id,
      provider_id: item.id,
      public_identifier: item.public_identifier,
      full_name: item.name,
      headline: item.headline,
      location: item.location,
      profile_url: item.profile_url,
      picture_url: item.profile_picture_url,
      connection_degree: item.network_distance === 'DISTANCE_1' ? 1
        : item.network_distance === 'DISTANCE_2' ? 2
        : item.network_distance === 'DISTANCE_3' ? 3 : undefined,
    })),
    cursor: response.cursor,
    has_more: !!response.cursor,
  };
}

// ============ Profile ============

export interface ProfileDetails {
  id: string;
  provider_id: string;
  public_identifier: string;
  full_name: string;
  first_name?: string;
  last_name?: string;
  headline?: string;
  summary?: string;
  location?: string;
  profile_url: string;
  picture_url?: string;
  connection_degree?: number;
  is_connection?: boolean;
  current_company?: string;
  current_position?: string;
  experience?: Array<{
    company: string;
    title: string;
    start_date?: string;
    end_date?: string;
    is_current?: boolean;
  }>;
}

export async function getProfile(
  accountId: string,
  identifier: string  // Can be provider_id, public_identifier, or profile URL
): Promise<ProfileDetails> {
  // account_id must be in query string, not header
  const response = await apiRequest<{
    object: string;
    provider: string;
    provider_id: string;
    public_identifier: string;
    first_name?: string;
    last_name?: string;
    headline?: string;
    location?: string;
    profile_picture_url?: string;
    network_distance?: string;
    is_relationship?: boolean;
    summary?: string;
  }>(
    'GET',
    `/users/${encodeURIComponent(identifier)}?account_id=${encodeURIComponent(accountId)}`
  );

  // Transform Unipile response to our ProfileDetails format
  return {
    id: response.provider_id,
    provider_id: response.provider_id,
    public_identifier: response.public_identifier,
    full_name: [response.first_name, response.last_name].filter(Boolean).join(' ') || 'Unknown',
    first_name: response.first_name,
    last_name: response.last_name,
    headline: response.headline,
    summary: response.summary,
    location: response.location,
    profile_url: `https://www.linkedin.com/in/${response.public_identifier}`,
    picture_url: response.profile_picture_url,
    connection_degree: response.network_distance === 'FIRST_DEGREE' ? 1
      : response.network_distance === 'SECOND_DEGREE' ? 2
      : response.network_distance === 'THIRD_DEGREE' ? 3 : undefined,
    is_connection: response.is_relationship,
  };
}

// ============ Connections/Relations ============

export interface Relation {
  id: string;
  provider_id: string;
  public_identifier: string;
  full_name: string;
  headline?: string;
  picture_url?: string;
  connected_at?: string;
}

export interface RelationsResponse {
  items: Relation[];
  cursor?: string;
  has_more: boolean;
}

export async function getRelations(
  accountId: string,
  cursor?: string
): Promise<RelationsResponse> {
  const params = new URLSearchParams();
  params.set('account_id', accountId);
  if (cursor) params.set('cursor', cursor);

  return apiRequest<RelationsResponse>('GET', `/users/relations?${params.toString()}`);
}

// ============ Invitations ============

export interface Invitation {
  id: string;
  provider_id: string;
  full_name: string;
  headline?: string;
  status: 'pending' | 'accepted' | 'declined';
  sent_at: string;
  message?: string;
}

export interface InvitationsResponse {
  items: Invitation[];
  cursor?: string;
  has_more: boolean;
}

// Note: getSentInvitations removed - endpoint doesn't exist in Unipile API
// Use getRelations() and compare against saved invitations to detect accepted ones

export interface SendInvitationParams {
  provider_id: string;
  message?: string;  // Max 300 chars for paid accounts, 200 for free
}

export interface SendInvitationResponse {
  success: boolean;
  invitation_id?: string;
  error?: string;
}

export async function sendInvitation(
  accountId: string,
  params: SendInvitationParams
): Promise<SendInvitationResponse> {
  return apiRequest<SendInvitationResponse>('POST', '/users/invite', {
    account_id: accountId,
    provider_id: params.provider_id,
    message: params.message,
  });
}

// ============ Messages ============

export interface Chat {
  id: string;
  provider_id: string;
  participant_name: string;
  participant_id: string;
  last_message?: string;
  last_message_at?: string;
  unread_count?: number;
}

export interface ChatsResponse {
  items: Chat[];
  cursor?: string;
  has_more: boolean;
}

export async function getChats(
  accountId: string,
  cursor?: string
): Promise<ChatsResponse> {
  const params = new URLSearchParams();
  params.set('account_id', accountId);
  if (cursor) params.set('cursor', cursor);

  return apiRequest<ChatsResponse>('GET', `/chats?${params.toString()}`);
}

export interface Message {
  id: string;
  sender_id: string;
  sender_name: string;
  text: string;
  sent_at: string;
  is_outgoing: boolean;
}

export interface MessagesResponse {
  items: Message[];
  cursor?: string;
  has_more: boolean;
}

export async function getChatMessages(
  accountId: string,
  chatId: string,
  cursor?: string
): Promise<MessagesResponse> {
  const params = new URLSearchParams();
  params.set('account_id', accountId);
  if (cursor) params.set('cursor', cursor);

  return apiRequest<MessagesResponse>('GET', `/chats/${chatId}/messages?${params.toString()}`);
}

export interface SendMessageParams {
  recipient_id: string;  // provider_id of the recipient (must be a connection)
  text: string;
}

export interface SendMessageResponse {
  success: boolean;
  message_id?: string;
  chat_id?: string;
  error?: string;
}

export async function sendMessage(
  accountId: string,
  params: SendMessageParams
): Promise<SendMessageResponse> {
  const response = await apiRequest<{
    object: string;
    chat_id: string;
    message_id: string;
  }>('POST', '/chats', {
    account_id: accountId,
    attendees_ids: [params.recipient_id],
    text: params.text,
  });

  return {
    success: true,
    message_id: response.message_id,
    chat_id: response.chat_id,
  };
}

// ============ Posts & Engagement ============

export interface Post {
  id: string;
  social_id: string;  // Use this for all post operations
  author_id: string;
  author_name: string;
  text: string;
  posted_at: string;
  likes_count?: number;
  comments_count?: number;
  shares_count?: number;
}

export interface PostsResponse {
  items: Post[];
  cursor?: string;
  has_more: boolean;
}

export async function getUserPosts(
  accountId: string,
  userId: string,
  cursor?: string
): Promise<PostsResponse> {
  const params = new URLSearchParams();
  params.set('account_id', accountId);
  if (cursor) params.set('cursor', cursor);

  return apiRequest<PostsResponse>('GET', `/users/${userId}/posts?${params.toString()}`);
}

export interface CreatePostParams {
  text: string;
}

export interface CreatePostResponse {
  success: boolean;
  post_id?: string;
  social_id?: string;
  error?: string;
}

export async function createPost(
  accountId: string,
  params: CreatePostParams
): Promise<CreatePostResponse> {
  return apiRequest<CreatePostResponse>('POST', '/posts', {
    account_id: accountId,
    text: params.text,
  });
}

// Note: reactToPost and commentOnPost removed - endpoints return 404 in Unipile API
// These features may be available via the raw route (/api/v1/linkedin) in the future

// ============ Account Info ============

export interface AccountInfo {
  id: string;
  provider: string;
  status: string;
  user_id?: string;
  user_name?: string;
}

export async function getAccountInfo(accountId: string): Promise<AccountInfo> {
  return apiRequest<AccountInfo>('GET', `/accounts/${accountId}`);
}

export async function getMyProfile(accountId: string): Promise<ProfileDetails> {
  return apiRequest<ProfileDetails>(
    'GET',
    '/users/me',
    undefined,
    { 'account_id': accountId }
  );
}

// Export config getter for initialization check
export function isConfigured(): boolean {
  return !!(config.apiKey && config.dsn);
}

export function getAccountId(): string {
  return config.accountId;
}

export function setAccountId(accountId: string): void {
  config.accountId = accountId;
}
