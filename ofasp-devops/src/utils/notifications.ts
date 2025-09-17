interface SlackWebhookPayload {
  text?: string;
  blocks?: SlackBlock[];
  channel?: string;
  username?: string;
  icon_emoji?: string;
}

interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
    emoji?: boolean;
  };
  elements?: any[];
  fields?: SlackField[];
}

interface SlackField {
  type: string;
  text: string;
  short?: boolean;
}

interface DiscordWebhookPayload {
  content?: string;
  embeds?: DiscordEmbed[];
  username?: string;
  avatar_url?: string;
}

interface DiscordEmbed {
  title?: string;
  description?: string;
  color?: number;
  fields?: DiscordField[];
  author?: {
    name: string;
    icon_url?: string;
  };
  footer?: {
    text: string;
  };
  timestamp?: string;
}

interface DiscordField {
  name: string;
  value: string;
  inline?: boolean;
}

interface NotificationEvent {
  type: 'deployment_started' | 'deployment_completed' | 'deployment_failed' | 
        'pipeline_started' | 'pipeline_completed' | 'pipeline_failed' |
        'performance_regression' | 'security_alert';
  environment: 'staging' | 'production' | 'development';
  title: string;
  description: string;
  details: {
    branch?: string;
    commit?: string;
    author?: string;
    version?: string;
    duration?: string;
    url?: string;
    error?: string;
    metrics?: Record<string, any>;
  };
  severity: 'info' | 'warning' | 'error' | 'success';
}

export class NotificationService {
  private slackWebhookUrl: string | undefined;
  private discordWebhookUrl: string | undefined;

  constructor() {
    this.slackWebhookUrl = process.env.SLACK_WEBHOOK_URL;
    this.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
  }

  async sendNotification(event: NotificationEvent): Promise<void> {
    const promises: Promise<any>[] = [];

    if (this.slackWebhookUrl) {
      promises.push(this.sendSlackNotification(event));
    }

    if (this.discordWebhookUrl) {
      promises.push(this.sendDiscordNotification(event));
    }

    if (promises.length > 0) {
      try {
        await Promise.allSettled(promises);
        console.log(`✅ Notifications sent for ${event.type}`);
      } catch (error) {
        console.error('❌ Failed to send notifications:', error);
      }
    } else {
      console.log('ℹ️ No notification webhooks configured');
    }
  }

  private async sendSlackNotification(event: NotificationEvent): Promise<void> {
    if (!this.slackWebhookUrl) return;

    const color = this.getSlackColor(event.severity);
    const emoji = this.getEmoji(event.type, event.severity);

    const payload: SlackWebhookPayload = {
      username: 'OpenASP DevOps',
      icon_emoji: ':rocket:',
      blocks: [
        {
          type: 'header',
          text: {
            type: 'plain_text',
            text: `${emoji} ${event.title}`,
            emoji: true
          }
        },
        {
          type: 'section',
          text: {
            type: 'mrkdwn',
            text: event.description
          }
        }
      ]
    };

    // Add details section if available
    if (Object.keys(event.details).length > 0) {
      const fields: SlackField[] = [];

      if (event.details.environment) {
        fields.push({
          type: 'mrkdwn',
          text: `*Environment:*\n${event.environment}`,
          short: true
        });
      }

      if (event.details.branch) {
        fields.push({
          type: 'mrkdwn',
          text: `*Branch:*\n\`${event.details.branch}\``,
          short: true
        });
      }

      if (event.details.commit) {
        fields.push({
          type: 'mrkdwn',
          text: `*Commit:*\n\`${event.details.commit.substring(0, 8)}\``,
          short: true
        });
      }

      if (event.details.author) {
        fields.push({
          type: 'mrkdwn',
          text: `*Author:*\n${event.details.author}`,
          short: true
        });
      }

      if (event.details.duration) {
        fields.push({
          type: 'mrkdwn',
          text: `*Duration:*\n${event.details.duration}`,
          short: true
        });
      }

      if (event.details.version) {
        fields.push({
          type: 'mrkdwn',
          text: `*Version:*\n\`${event.details.version}\``,
          short: true
        });
      }

      if (fields.length > 0) {
        payload.blocks?.push({
          type: 'section',
          fields
        });
      }
    }

    // Add error details for failures
    if (event.severity === 'error' && event.details.error) {
      payload.blocks?.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Error Details:*\n\`\`\`${event.details.error}\`\`\``
        }
      });
    }

    // Add metrics for performance events
    if (event.details.metrics) {
      const metricsText = Object.entries(event.details.metrics)
        .map(([key, value]) => `• *${key}:* ${value}`)
        .join('\n');

      payload.blocks?.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*Metrics:*\n${metricsText}`
        }
      });
    }

    // Add action buttons if URL is provided
    if (event.details.url) {
      payload.blocks?.push({
        type: 'actions',
        elements: [
          {
            type: 'button',
            text: {
              type: 'plain_text',
              text: 'View Details',
              emoji: true
            },
            url: event.details.url,
            style: event.severity === 'error' ? 'danger' : 'primary'
          }
        ]
      });
    }

    await this.sendWebhook(this.slackWebhookUrl, payload);
  }

  private async sendDiscordNotification(event: NotificationEvent): Promise<void> {
    if (!this.discordWebhookUrl) return;

    const color = this.getDiscordColor(event.severity);
    const emoji = this.getEmoji(event.type, event.severity);

    const embed: DiscordEmbed = {
      title: `${emoji} ${event.title}`,
      description: event.description,
      color,
      timestamp: new Date().toISOString(),
      author: {
        name: 'OpenASP DevOps',
        icon_url: 'https://via.placeholder.com/32/4F46E5/FFFFFF?text=🚀'
      },
      footer: {
        text: `Environment: ${event.environment}`
      }
    };

    // Add fields for details
    if (Object.keys(event.details).length > 0) {
      embed.fields = [];

      if (event.details.branch) {
        embed.fields.push({
          name: 'Branch',
          value: `\`${event.details.branch}\``,
          inline: true
        });
      }

      if (event.details.commit) {
        embed.fields.push({
          name: 'Commit',
          value: `\`${event.details.commit.substring(0, 8)}\``,
          inline: true
        });
      }

      if (event.details.author) {
        embed.fields.push({
          name: 'Author',
          value: event.details.author,
          inline: true
        });
      }

      if (event.details.duration) {
        embed.fields.push({
          name: 'Duration',
          value: event.details.duration,
          inline: true
        });
      }

      if (event.details.version) {
        embed.fields.push({
          name: 'Version',
          value: `\`${event.details.version}\``,
          inline: true
        });
      }

      if (event.details.error) {
        embed.fields.push({
          name: 'Error',
          value: `\`\`\`${event.details.error.substring(0, 1000)}\`\`\``,
          inline: false
        });
      }

      if (event.details.metrics) {
        const metricsText = Object.entries(event.details.metrics)
          .map(([key, value]) => `**${key}:** ${value}`)
          .join('\n');

        embed.fields.push({
          name: 'Metrics',
          value: metricsText,
          inline: false
        });
      }
    }

    const payload: DiscordWebhookPayload = {
      username: 'OpenASP DevOps',
      avatar_url: 'https://via.placeholder.com/64/4F46E5/FFFFFF?text=🚀',
      embeds: [embed]
    };

    // Add URL as content if available
    if (event.details.url) {
      payload.content = `🔗 **View Details:** ${event.details.url}`;
    }

    await this.sendWebhook(this.discordWebhookUrl, payload);
  }

  private async sendWebhook(url: string, payload: any): Promise<void> {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }
  }

  private getEmoji(type: string, severity: string): string {
    const emojiMap: Record<string, string> = {
      'deployment_started': '🚀',
      'deployment_completed': '✅',
      'deployment_failed': '❌',
      'pipeline_started': '⚡',
      'pipeline_completed': '✅',
      'pipeline_failed': '🔴',
      'performance_regression': '📈',
      'security_alert': '🔒'
    };

    return emojiMap[type] || (severity === 'error' ? '❌' : severity === 'warning' ? '⚠️' : 'ℹ️');
  }

  private getSlackColor(severity: string): string {
    const colorMap: Record<string, string> = {
      'success': '#36a64f',
      'info': '#439FE0',
      'warning': '#ff9500',
      'error': '#ff0000'
    };
    return colorMap[severity] || '#439FE0';
  }

  private getDiscordColor(severity: string): number {
    const colorMap: Record<string, number> = {
      'success': 0x36a64f, // Green
      'info': 0x439FE0,    // Blue
      'warning': 0xff9500, // Orange
      'error': 0xff0000    // Red
    };
    return colorMap[severity] || 0x439FE0;
  }
}

// Predefined notification templates
export const NotificationTemplates = {
  deploymentStarted: (environment: string, branch: string, author: string): NotificationEvent => ({
    type: 'deployment_started',
    environment: environment as any,
    title: 'Deployment Started',
    description: `Deployment to ${environment} environment has been initiated.`,
    details: { branch, author },
    severity: 'info'
  }),

  deploymentCompleted: (environment: string, branch: string, author: string, duration: string, url?: string): NotificationEvent => ({
    type: 'deployment_completed',
    environment: environment as any,
    title: 'Deployment Completed',
    description: `✅ Deployment to ${environment} completed successfully!`,
    details: { branch, author, duration, url },
    severity: 'success'
  }),

  deploymentFailed: (environment: string, branch: string, author: string, error: string, url?: string): NotificationEvent => ({
    type: 'deployment_failed',
    environment: environment as any,
    title: 'Deployment Failed',
    description: `❌ Deployment to ${environment} failed and needs attention.`,
    details: { branch, author, error, url },
    severity: 'error'
  }),

  pipelineCompleted: (branch: string, author: string, duration: string, url?: string): NotificationEvent => ({
    type: 'pipeline_completed',
    environment: 'development',
    title: 'CI/CD Pipeline Completed',
    description: `✅ Pipeline completed successfully for ${branch} branch.`,
    details: { branch, author, duration, url },
    severity: 'success'
  }),

  performanceRegression: (metrics: Record<string, any>, branch: string): NotificationEvent => ({
    type: 'performance_regression',
    environment: 'development',
    title: 'Performance Regression Detected',
    description: `⚠️ Performance regression detected in latest build.`,
    details: { branch, metrics },
    severity: 'warning'
  }),

  securityAlert: (severity: string, description: string, branch: string): NotificationEvent => ({
    type: 'security_alert',
    environment: 'development',
    title: 'Security Alert',
    description: `🔒 ${severity} security issue detected: ${description}`,
    details: { branch },
    severity: severity === 'high' ? 'error' : 'warning'
  })
};

// Export singleton instance
export const notificationService = new NotificationService();