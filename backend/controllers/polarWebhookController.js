import { validateEvent, WebhookVerificationError } from '@polar-sh/sdk/webhooks';
import { processPolarEvent } from '../services/polarWebhookService.js';

export const handlePolarWebhook = async (req, res) => {
  try {
    const event = validateEvent(
      req.body,
      req.headers,
      process.env.POLAR_WEBHOOK_SECRET
    );

    await processPolarEvent(event);

    res.status(200).json({ message: 'Polar webhook received' });
  } catch (error) {
    if (error instanceof WebhookVerificationError) {
      return res.status(403).json({ message: 'Invalid Signature' });
    }

    console.error('Error handling Polar webhook:', error);
    res.status(500).json({ message: 'Error handling Polar webhook' });
  }
};
