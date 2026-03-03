import express from "express";
import { createServer as createViteServer } from "vite";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import twilio from "twilio";
import admin from "firebase-admin";
import { createServer } from "http";
import { Server } from "socket.io";

dotenv.config();

// Initialize firebase-admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.VITE_FIREBASE_PROJECT_ID || "dummy_project"
  });
}

const db_admin = admin.firestore();

async function startServer() {
  const app = express();
  const httpServer = createServer(app);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });
  const PORT = 3000;

  app.use(express.json());

  // Headers for ffmpeg.wasm
  app.use((req, res, next) => {
    res.header("Cross-Origin-Embedder-Policy", "require-corp");
    res.header("Cross-Origin-Opener-Policy", "same-origin");
    next();
  });

  // Socket.io Logic
  io.on("connection", (socket) => {
    console.log("User connected:", socket.id);

    socket.on("join-room", (roomId) => {
      socket.join(roomId);
      console.log(`User ${socket.id} joined room ${roomId}`);
    });

    socket.on("send-message", (data) => {
      // data: { roomId, message, senderId, senderName }
      io.to(data.roomId).emit("receive-message", data);
    });

    // WebRTC Signaling
    socket.on("call-user", (data) => {
      // data: { userToCall, signalData, from, name, type: 'voice' | 'video' }
      io.to(data.userToCall).emit("incoming-call", { 
        signal: data.signalData, 
        from: data.from, 
        name: data.name,
        type: data.type 
      });
    });

    socket.on("answer-call", (data) => {
      // data: { signal, to }
      io.to(data.to).emit("call-accepted", data.signal);
    });

    socket.on("end-call", (data) => {
      // data: { to }
      io.to(data.to).emit("call-ended");
    });

    socket.on("disconnect", () => {
      console.log("User disconnected:", socket.id);
    });
  });

  // Twilio Client
  const twilioClient = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN 
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

  const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_placeholder",
    key_secret: process.env.RAZORPAY_KEY_SECRET || "placeholder_secret",
  });

  // Auth Endpoints
  app.post("/api/auth/send-otp", async (req, res) => {
    const { phone } = req.body;
    const otp = "1234";

    if (twilioClient && process.env.TWILIO_PHONE_NUMBER) {
      try {
        await twilioClient.messages.create({
          body: `Your REELS KING OTP is: ${otp}`,
          from: process.env.TWILIO_PHONE_NUMBER,
          to: `+91${phone}`,
        });
        res.json({ success: true, mode: 'production' });
      } catch (error) {
        console.error("Twilio Error:", error);
        res.status(500).json({ success: false, error: "Failed to send SMS" });
      }
    } else {
      // Demo Mode
      res.json({ success: true, mode: 'demo', otp });
    }
  });

  // Razorpay Order Creation
  app.post("/api/payments/order", async (req, res) => {
    const { amount, planId } = req.body;
    try {
      const options = {
        amount: amount * 100, // amount in the smallest currency unit (paise)
        currency: "INR",
        receipt: `receipt_${Date.now()}`,
        notes: { planId },
      };
      const order = await razorpay.orders.create(options);
      res.json(order);
    } catch (error) {
      console.error("Razorpay Order Error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  });

  // Razorpay Payment Verification
  app.post("/api/payments/verify", async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
    const sign = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSign = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "placeholder_secret")
      .update(sign.toString())
      .digest("hex");

    if (razorpay_signature === expectedSign) {
      res.json({ success: true, message: "Payment verified successfully" });
    } else {
      res.status(400).json({ success: false, message: "Invalid signature" });
    }
  });

  // Video Transcoding Simulation
  app.post("/api/videos/transcode", async (req, res) => {
    const { videoId, videoUrl } = req.body;
    
    if (!videoId || !videoUrl) {
      return res.status(400).json({ error: "Missing videoId or videoUrl" });
    }

    console.log(`[Transcoder] Received request for video: ${videoId}`);
    
    // Simulate transcoding process
    setTimeout(async () => {
      try {
        const videoRef = db_admin.collection('videos').doc(videoId);
        
        // In a real app, we would use ffmpeg to create these files and upload them to Storage
        // Here we simulate the metadata update
        await videoRef.update({
          status: 'ready',
          adaptiveStreaming: true,
          resolutions: {
            '1080p': videoUrl,
            '720p': videoUrl.replace('.mp4', '_720p.mp4'), // Simulated path
            '480p': videoUrl.replace('.mp4', '_480p.mp4'),
          },
          transcodedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        console.log(`[Transcoder] Transcoding complete for video: ${videoId}`);
        
        // Notify via socket
        io.to(videoId).emit('transcoding-complete', { videoId, status: 'ready' });
        
      } catch (error) {
        console.error("[Transcoder] Transcoding update failed:", error);
      }
    }, 8000); // Simulate 8 seconds of heavy transcoding work

    res.json({ 
      success: true, 
      message: "Transcoding process initiated",
      videoId 
    });
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  httpServer.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
