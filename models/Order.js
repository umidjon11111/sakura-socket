const mongoose = require("mongoose");
const { Schema, models } = mongoose;
const orderSchema = new Schema(
  {
    orderId: { type: Number, required: true, unique: true },
    items: [{ name: String, qty: Number, price: Number }],
    status: {
      type: String,
      enum: ["new", "in_progress", "done"],
      default: "new",
    },
    OrderType: {
      type: String,
      enum: ["Zal", "Dastavka", "Saboy"],
      required: true,
    },
    customer: {
      name: String,
      phone: String,
      address: String,
    },
  },
  { timestamps: true }
);

const Order = models.Order || mongoose.model("Order", orderSchema);
module.exports = Order;
