const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const mongoose = require("mongoose");
const Order = require("./models/Order");
require("dotenv").config();

const job = require("./job.js");
const Karzina = require("./models/karzina.js");
job.start();

const app = express();
app.use(express.json());

// ================================
// SERVER + SOCKET
// ================================
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] },
});

// XONALAR
const ROOM_FILTER = {
  oshxona: null,
  ekran: null,
  zal: "Zal",
  dastavka: "Dastavka",
  saboy: "Saboy",
};

// ===============================
// SOCKET HANDLERS
// ===============================
io.on("connection", (socket) => {
  console.log("🔌 Client joined:", socket.id);

  // PRINTER ROOM
  socket.on("join_printer", () => {
    socket.join("printers");
    console.log(`🖨 Printer joined → ${socket.id}`);
  });

  // ROOMS (Zal, Saboy, Dastavka)
  socket.on("join_room", async (room) => {
    socket.join(room);
    console.log(`${socket.id} joined → ${room}`);

    const filter = ROOM_FILTER[room];
    let orders;

    if (!filter) {
      orders = await Order.find().sort({ createdAt: -1 });
    } else {
      orders = await Order.find({ OrderType: filter }).sort({ createdAt: -1 });
    }

    socket.emit("all_orders", orders);
  });

  // CREATE ORDER
  socket.on("create_order", async (data) => {
    try {
      const last = await Order.findOne().sort({ orderId: -1 });
      const lastid = await Karzina.findOne().sort({ orderId: -1 });

      const nextId =
        Math.max(last ? last.orderId : 0, lastid ? lastid.orderId : 0) + 1;

      const newOrder = await Order.create({
        orderId: nextId,
        OrderType: data.orderType,
        items: data.cart,
        customer: data.customer,
        status: "in_progress",
      });

      socket.emit("order_confirmed", newOrder);
      io.emit("new_order", newOrder);

      io.to("printers").emit("print_order", newOrder);
    } catch (err) {
      console.error("❌ CREATE ORDER ERROR:", err);
    }
  });

  // UPDATE STATUS
  socket.on("update_order_status", async ({ orderId, status }) => {
    const updated = await Order.findOneAndUpdate(
      { orderId },
      { status },
      { new: true }
    );

    if (updated) {
      io.emit("order_updated", updated);
    }
  });

  // DELETE ORDER
  socket.on("delete_order", async ({ orderId }) => {
    const del = await Order.findOneAndDelete({ orderId });
    if (del) io.emit("order_deleted", orderId);
  });

  // ===============================
  // 🔥 REAL-TIME DAILY REPORT
  // ===============================
  socket.on("printer_kunlik_check", (data) => {
    // Printerlarga yuboramiz
    io.to("printers").emit("printer_kunlik_check", data);

    // Barcha clientlarga real-time signal
    io.emit("daily_report_closed", {
      ok: true,
      time: Date.now(),
      message: "Kunlik hisobot yakunlandi",
    });
  });
});

mongoose.connect(process.env.MONGODB_URI).then(() => {
  server.listen(5000, () => console.log("🚀 Server running on :5000"));
});
