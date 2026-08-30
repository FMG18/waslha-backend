const { socketAuth } = require('./auth');
const { emitRideStatus, updateCaptainLocation } = require('./events');
function roomForUser(user) { return `${user.role}:${user._id}`; }
function roomForRide(id) { return `ride:${id}`; }
function initializeSocket(io) {
  io.use(socketAuth);
  io.on('connection', socket => {
    const { user } = socket;
    socket.join(roomForUser(user));
    socket.on('ride:join', async ({ rideId } = {}, ack) => {
      try {
        if (!rideId) throw new Error('rideId is required');
        const Ride = require('../models/Ride'); const Captain = require('../models/Captain');
        const ride = await Ride.findById(rideId).select('customer captain'); if (!ride) throw new Error('Ride not found');
        let allowed = user.role === 'admin' || ride.customer.equals(user._id);
        if (user.role === 'captain') { const captain = await Captain.findOne({ user:user._id }).select('_id'); allowed = !!captain && ride.captain?.equals(captain._id); }
        if (!allowed) throw new Error('Forbidden');
        await socket.join(roomForRide(rideId)); if (ack) ack({ success:true });
      } catch (error) { if (ack) ack({ success:false, error:error.message }); }
    });
    socket.on('captain:location:update', async (payload, ack) => { try { const location = await updateCaptainLocation(io,user,payload); if(ack) ack({success:true,data:location}); } catch(error) { if(ack) ack({success:false,error:error.message}); } });
    socket.on('disconnect', () => {});
  });
}
module.exports = { initializeSocket, roomForUser, roomForRide, emitRideStatus };
