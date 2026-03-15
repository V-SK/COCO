import { CocoError, type CocoPlugin, type CocoTool } from '@coco/core';
import { z } from 'zod';

export interface TwitterConnectorConfig {
  appKey: string;
  appSecret: string;
  accessToken: string;
  accessSecret: string;
  autoReply?:
    | {
        enabled: boolean;
        keywords?: string[] | undefined;
        cooldown?: number | undefined;
      }
    | undefined;
  listen?:
    | {
        mentions: boolean;
        keywords?: string[] | undefined;
        accounts?: string[] | undefined;
      }
    | undefined;
}

function notConfigured() {
  return new CocoError(
    'Twitter API integration is scaffolded but not activated in this environment.',
    'twitter_not_configured',
  );
}

export function createTwitterConnectorPlugin(
  _config?: Partial<TwitterConnectorConfig>,
): CocoPlugin {
  const postSchema = z.object({
    text: z.string(),
    media: z.array(z.string()).optional(),
    replyTo: z.string().optional(),
  });
  const searchSchema = z.object({
    query: z.string(),
    maxResults: z.number().optional(),
    sortOrder: z.enum(['recency', 'relevancy']).optional(),
  });
  const mentionsSchema = z.object({
    sinceId: z.string().optional(),
    maxResults: z.number().optional(),
  });
  const replySchema = z.object({
    tweetId: z.string(),
    text: z.string(),
  });
  const followSchema = z.object({
    username: z.string(),
  });

  const tools: CocoTool[] = [
    {
      id: 'twitter.post-tweet',
      triggers: ['twitter', 'tweet', 'post'],
      description: 'Post a tweet once credentials are available.',
      schema: postSchema,
      requiresConfirmation: true,
      async execute() {
        throw notConfigured();
      },
    },
    {
      id: 'twitter.search-tweets',
      triggers: ['twitter', 'search'],
      description: 'Search tweets once credentials are available.',
      schema: searchSchema,
      async execute() {
        throw notConfigured();
      },
    },
    {
      id: 'twitter.get-mentions',
      triggers: ['twitter', 'mentions'],
      description: 'Get mentions once credentials are available.',
      schema: mentionsSchema,
      async execute() {
        throw notConfigured();
      },
    },
    {
      id: 'twitter.reply-tweet',
      triggers: ['twitter', 'reply'],
      description: 'Reply to a tweet once credentials are available.',
      schema: replySchema,
      requiresConfirmation: true,
      async execute() {
        throw notConfigured();
      },
    },
    {
      id: 'twitter.follow-user',
      triggers: ['twitter', 'follow'],
      description: 'Follow a user once credentials are available.',
      schema: followSchema,
      requiresConfirmation: true,
      async execute() {
        throw notConfigured();
      },
    },
  ];

  return {
    id: 'twitter',
    name: 'Coco Twitter',
    version: '1.2.0',
    description: 'Scaffolded Twitter/X connector',
    async setup() {},
    tools,
  };
}

export const twitterConnectorPlugin = createTwitterConnectorPlugin();

export default twitterConnectorPlugin;
