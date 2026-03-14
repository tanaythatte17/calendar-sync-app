import mongoose from "mongoose";

const InvoiceSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },

  subscription: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subscription"
  },

  polarInvoiceId: {
    type: String,
    unique: true
  },

  polarOrderId: String,

  amount: Number,
  currency: String,

  status: {
    type: String,
    enum: ["paid", "failed", "refunded"],
    required: true
  },

  paidAt: Date,

  createdAt: { type: Date, default: Date.now }
});

export default mongoose.model("Invoice", InvoiceSchema);
