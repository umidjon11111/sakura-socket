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
    origin: "http://localhost:3000",
    methods: ["GET", "POST"],
  },
});

// 🟦 ROOM → ORDER TYPE MAP
const ROOM_FILTER = {
  oshxona: null, // hamma InProgress
  ekran: null, // hamma InProgress
  zal: "Zal",
  dastavka: "Dastavka",
  saboy: "Saboy",
};

io.on("connection", (socket) => {
  console.log("Socket:", socket.id);

  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`${socket.id} joined → ${room}`);

    const filter = ROOM_FILTER[room];

    let all;

    if (!filter) {
      // oshxona & ekran → faqat in_progress
      all = await Order.find({ status: "in_progress" }).sort({ createdAt: -1 });
    } else {
      // zal / dastavka / saboy → orderType bo‘yicha filter
      all = await Order.find({
        OrderType: filter,
        status: "in_progress",
      }).sort({ createdAt: -1 });
    }

    socket.emit("all_orders", all);
  });

  // ===============================
  // CREATE ORDER
  // ===============================
  socket.on("create_order", async (data) => {
    try {
      const last = await Order.findOne().sort({ orderId: -1 });
      const nextId = last ? last.orderId + 1 : 1;

      const newOrder = await Order.create({
        orderId: nextId,
        OrderType: data.orderType,
        items: data.cart.map((c) => ({
          name: c.name,
          qty: c.qty,
          price: c.price,
        })),
        customer: data.customer,
        status: "in_progress",
      });

      // 🔥 Hamma page ko‘rsin
      io.emit("new_order", newOrder);

      // 🟩 MUHIM → frontga qaytarilsin!
      socket.emit("order_confirmed", newOrder);
    } catch (err) {
      console.error("Order xato:", err);
      socket.emit("order_error", { message: "Xato!" });
    }
  });

  // ===============================
  // UPDATE STATUS
  // ===============================
  socket.on("update_order_status", async ({ orderId, status }) => {
    const updated = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (!updated) return;

    io.emit("order_updated", updated);
  });
  socket.on("order_confirmed", (order) => {
    sendToPrinter(order);
    clearForm();
  });

  // ===============================
  // DELETE
  // ===============================
  socket.on("delete_order", async ({ orderId }) => {
    const deleted = await Order.findOneAndDelete({ orderId });
    if (!deleted) return;

    io.emit("order_deleted", orderId);
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  server.listen(PORT, () => console.log(`🚀 Server: http://localhost:${PORT}`));
});
