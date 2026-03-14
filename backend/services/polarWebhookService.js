// services/polarWebhookService.js
import User from '../models/userModel.js';
import Subscription from '../models/subscriptionModel.js';
import Invoice from '../models/invoiceModel.js';

export const processPolarEvent = async (event) => {
  switch (event.type) {
    case 'subscription.created':
      await handleSubscriptionCreated(event.data);
      break;

    case 'subscription.updated':
      await handleSubscriptionUpdated(event.data);
      break;

    case 'subscription.canceled':
      await handleSubscriptionCanceled(event.data);
      break;

    case 'order.paid':
      await handleOrderPaid(event.data);
      break;

    default:
      console.log(`Unhandled Polar event type: ${event.type}`);
  }
};

const handleSubscriptionCreated = async (data) => {
  const userId = data.metadata?.userId;
  if (!userId) {
    console.warn('Missing userId in metadata for subscription.created');
    return;
  }

  const existing = await Subscription.findOne({
    polarSubscriptionId: data.id
  });

  if (existing) return;

  const subscription = await Subscription.create({
    user: userId,
    polarSubscriptionId: data.id,
    status: data.status,
    currentPeriodStart: data.current_period_start,
    currentPeriodEnd: data.current_period_end,
    cancelAtPeriodEnd: data.cancel_at_period_end,
    planAmount: data.plan?.amount,
    currency: data.plan?.currency
  });

  await User.findByIdAndUpdate(userId, {
    subscription: subscription._id
  });

  console.log('Subscription created:', subscription._id);
};

const handleSubscriptionUpdated = async (data) => {
  await Subscription.findOneAndUpdate(
    { polarSubscriptionId: data.id },
    {
      status: data.status,
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end,
      cancelAtPeriodEnd: data.cancel_at_period_end
    }
  );

  console.log('Subscription updated:', data.id);
};

const handleSubscriptionCanceled = async (data) => {
  await Subscription.findOneAndUpdate(
    { polarSubscriptionId: data.id },
    { status: 'canceled' }
  );

  console.log('Subscription canceled:', data.id);
};

const handleOrderPaid = async (data) => {
  console.log('Data is ', data);
  const userId = data.metadata?.userId;
  if (!userId) {
    console.warn('Missing userId in metadata for order.paid');
    return;
  }

  // 🛑 Idempotency: prevent duplicate invoices
  const existingInvoice = await Invoice.findOne({
    polarOrderId: data.id
  });

  if (existingInvoice) {
    console.log('Duplicate order.paid ignored:', data.id);
    return;
  }

  // Ensure subscription exists
  let subscription = await Subscription.findOne({
    polarSubscriptionId: data.subscriptionId
  });

  if (!subscription) {
    subscription = await Subscription.create({
      user: userId,
      polarSubscriptionId: data.subscriptionId,
      status: 'active',
      currentPeriodStart: data.current_period_start,
      currentPeriodEnd: data.current_period_end
    });

    await User.findByIdAndUpdate(userId, {
      subscription: subscription._id
    });
  }

  await Invoice.create({
    user: userId,
    subscription: subscription._id,
    polarInvoiceId: data.invoice_id,
    polarOrderId: data.id,
    amount: data.amount,
    currency: data.currency,
    status: 'paid',
    paidAt: new Date(data.createdAt)
  });

  console.log('Invoice recorded for order:', data.id);
};

