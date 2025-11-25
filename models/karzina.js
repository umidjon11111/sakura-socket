const mongoose = require("mongoose");
// 🧩 Model (agar oldin yaratilmagan bo‘lsa)
const KarzinaSchema = new mongoose.Schema(
  {
    orderId: Number,
    status: String,
    items: [
      {
        name: String,
        qty: Number,
        price: Number,
      },
    ],
    OrderType: {
      type: String,
      enum: ["Zal", "Dastavka", "Saboy"],
      required: true,
    },
    deletedAt: { type: Date, default: Date.now },
  },
  { collection: "karzina" }
);

// Bir xil model ikki marta yaratilmasligi uchun tekshiramiz
const Karzina =
  mongoose.models.Karzina || mongoose.model("Karzina", KarzinaSchema);

module.exports = Karzina;