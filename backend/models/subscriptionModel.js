import mongoose from "mongoose";

const SubscriptionSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  polarSubscriptionId: {
    type: String,
    unique: true,
    required: true
  },

  status: {
    type: String,
    enum: ["active", "canceled", "past_due", "incomplete"],
    default: "active"
  },

  currentPeriodStart: Date,
  currentPeriodEnd: Date, // used to check expiry

  cancelAtPeriodEnd: { type: Boolean, default: false },

  planAmount: Number, // 5$
  currency: String,   // usd

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Subscription", SubscriptionSchema);
