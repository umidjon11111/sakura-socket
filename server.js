const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Order = require("./models/Order");
const job = require("./job.js");
require("dotenv").config();
job.start();
const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "https://sakura-frontend-rho.vercel.app",
    methods: ["GET", "POST"],
  },
});

io.on("connection", (socket) => {
  console.log("✅ Socket connected:", socket.id);

  // === ROOM JOIN ===
  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`🟢 ${socket.id} joined ${room}`);

    const orders = await Order.find().sort({ createdAt: -1 });
    socket.emit("all_orders", orders);
  });

  // === CREATE ORDER ===
  socket.on("create_order", async (data) => {
    try {
      const last = await Order.findOne().sort({ orderId: -1 });
      const nextId = last ? last.orderId + 1 : 1;

      const newOrder = await Order.create({
        orderId: nextId,
        items: data.cart.map((c) => ({
          name: c.name,
          qty: c.quantity,
          price: c.price,
        })),
        status: "new",
      });

      console.log("📦 Yangi zakaz:", newOrder.orderId);
      io.to("kassa").emit("new_order", newOrder); // kassa darhol oladi
      socket.emit("order_confirmed", newOrder);
    } catch (err) {
      console.error("❌ Xato:", err);
      socket.emit("order_error", { message: "Serverda xatolik!" });
    }
  });

  // === STATUS YANGILASH ===
  socket.on("update_order_status", async ({ orderId, status }) => {
    const updated = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (!updated) return;

    // 🔸 Kassa har doim eshitadi
    io.to("kassa").emit("order_updated", updated);

    // 🔸 Oshxona faqat in_progress holatda oladi
    if (status === "in_progress") {
      io.to("oshxona").emit("new_order", updated);
    }

    // 🔸 Agar oshxonada status o‘zgarsa (tayyor bo‘ldi, bekor qilindi)
    if (status === "done" || status === "cancelled") {
      io.to("oshxona").emit("order_updated", updated);
    }
  });
  socket.on("delete_order", async ({orderId}) => {
    const deleted = await Order.findOneAndDelete({ orderId });
    if (!deleted) return;

    console.log("🗑️ Zakaz o'chirildi:", orderId);
    io.to("kassa").emit("order_deleted", orderId);
    io.to("oshxona").emit("order_deleted", orderId);
  });

  socket.on("disconnect", () => {
    console.log(`❌ ${socket.id} disconnected`);
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  server.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});
