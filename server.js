const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// الاتصال بقاعدة البيانات عبر البيئة أو الرابط المباشر
const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://hasaana843_db_user:t0dL5h0OyrZ2ma0F@cluster0.9jtdpkk.mongodb.net/waslha_db?appName=Cluster0';

mongoose.connect(MONGO_URI)
  .then(() => console.log('MongoDB Connected Successfully'))
  .catch(err => console.error('MongoDB Connection Error:', err));

// أحداث Socket.io للربط اللحظي
io.on('connection', (socket) => {
  console.log('مستخدم جديد متصل:', socket.id);

  // استقبال طلب رحلة من الزبون وتمريرها للكباتن
  socket.on('requestRide', (data) => {
    console.log('طلب رحلة جديد:', data);
    io.emit('newRideRequest', data);
  });

  // تحديث موقع الكابتن وإرساله للوحة التحكم والزبائن
  socket.on('updateLocation', (data) => {
    io.emit('captainPositionUpdated', data);
  });

  socket.on('disconnect', () => {
    console.log('انقطع اتصال المستخدم:', socket.id);
  });
});

app.get('/', (req, res) => {
  res.send('Waslha Backend Server is Running Online!');
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
