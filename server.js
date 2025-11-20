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
    origin: "*", // Printer agent ham ulana olishi uchun
    methods: ["GET", "POST"],
  },
});

// ROOM FILTER
const ROOM_FILTER = {
  oshxona: null,
  ekran: null,
  zal: "Zal",
  dastavka: "Dastavka",
  saboy: "Saboy",
};

io.on("connection", (socket) => {
  console.log("🔌 Client connected:", socket.id);

  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`${socket.id} joined → ${room}`);

    const filter = ROOM_FILTER[room];

    let all;
    if (!filter) {
      all = await Order.find({ status: "in_progress" }).sort({ createdAt: -1 });
    } else {
      all = await Order.find({
        OrderType: filter,
        status: "in_progress",
      }).sort({ createdAt: -1 });
    }

    socket.emit("all_orders", all);
  });

  // CREATE ORDER
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

      // KASSA – tasdiq
      socket.emit("order_confirmed", newOrder);

      // Oshxona/tablo – yangi order
      io.emit("new_order", newOrder);

      // 🔥 MUHIM! PRINT AGENTLARGA SIGNAL
      io.emit("print_order", newOrder);
    } catch (err) {
      console.error("❌ Order xato:", err);
      socket.emit("order_error", { message: "Xato!" });
    }
  });

  // UPDATE STATUS
  socket.on("update_order_status", async ({ orderId, status }) => {
    const updated = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );
    if (updated) io.emit("order_updated", updated);
  });

  // DELETE
  socket.on("delete_order", async ({ orderId }) => {
    const deleted = await Order.findOneAndDelete({ orderId });
    if (deleted) io.emit("order_deleted", orderId);
  });
  socket.on("printer_kunlik_check", async (data) => {
    console.log("📊 Kunlik Hisobot so‘rovi oldim!");
    io.emit("printer_kunlik_check", data);
  });
});

const PORT = process.env.PORT || 5000;
mongoose.connect(process.env.MONGODB_URI).then(() => {
  server.listen(PORT, () =>
    console.log(`🚀 Server running: http://localhost:${PORT}`)
  );
});
